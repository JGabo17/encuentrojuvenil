import { Server, Socket } from 'socket.io';
import prisma from '../services/db.js';
import { verifyAdminToken } from '../middleware/auth.js';
import {
  registerOrReconnectParticipant,
  setParticipantDisconnected,
  getAllParticipants,
  getParticipantById,
  kickParticipant
} from '../services/participantService.js';
import {
  replaceVariables,
  logMessage
} from '../services/messageService.js';
import {
  createTemplate,
  updateTemplate,
  deleteTemplate
} from '../services/templateService.js';
import {
  participantJoinSchema,
  sendMessageSchema,
  templateSchema
} from '../utils/validators.js';
import type { ClientToServerEvents, ServerToClientEvents, LiveMessagePayload, StageAudioState, StageViewMode } from '../types/index.js';

import {
  createTeamWithCaptain,
  joinTeamAsMember,
  getAllTeams,
  getStageData,
  adjustTeamScore,
  setTeamScore,
  transferCaptaincy,
  resetEventData
} from '../services/teamService.js';

import {
  gameEngine,
  getAllQuestions,
  createQuestion,
  reloadDefaultBiblicalQuestions
} from '../services/triviaService.js';

import {
  generateEventPairings,
  getPairingDataForParticipant,
  getAllPairingsForEvent,
  createChatMessage,
  getModerationQueue,
  moderateChatMessagePhoto,
  getApprovedMuralPhotos,
  isChatEnabled,
  setChatEnabled
} from '../services/pairingService.js';
import {
  getWallMessages,
  getWallModeration,
  isWallEnabled,
  setWallEnabled,
  setMessageHidden,
  setMessageApproved,
  getCustomWords,
  setCustomWords
} from '../services/wallService.js';

interface SocketData {
  isAdmin?: boolean;
  participantId?: string;
  participantName?: string;
  eventId?: string;
  teamId?: string;
  teamName?: string;
  role?: string;
}

// Estado centralizado del audio en vivo para la pantalla del Stage (Auditorio)
let stageAudioState: StageAudioState = {
  playing: false,
  volume: 0.6,
  muted: false,
  trackTitle: 'Cambiaré Mis Tristezas / Eres Fiel'
};

// Modo de proyección activo en la pantalla del Stage (Auditorio)
let currentStageViewMode: StageViewMode = 'auto';

function checkIsAdmin(socket: Socket<any, any, any, SocketData>, tokenOrData?: any): boolean {
  if (socket.data.isAdmin) return true;
  const token =
    (typeof tokenOrData === 'string' ? tokenOrData : tokenOrData?.token) ||
    (socket.handshake.auth as any)?.token ||
    (socket.handshake.headers as any)?.authorization?.replace('Bearer ', '');
  if (token) {
    try {
      const payload = verifyAdminToken(token);
      if (payload && payload.role === 'ADMIN') {
        socket.data.isAdmin = true;
        socket.join('room:admin');
        return true;
      }
    } catch (e) {}
  }
  return false;
}

export function setupSocketHandlers(io: Server<ClientToServerEvents, ServerToClientEvents, {}, SocketData>) {
  // Inicializar servidor de socket en el motor de juego
  gameEngine.setSocketServer(io);

  // Muro de mensajes en vivo: envía la versión filtrada al Stage y la versión completa al Admin
  const broadcastWall = async () => {
    try {
      const [stageMessages, adminMessages] = await Promise.all([getWallMessages(), getWallModeration()]);
      io.to('room:stage').emit('stage:wall-update', { enabled: isWallEnabled(), messages: stageMessages });
      io.to('room:admin').emit('admin:wall-update', {
        enabled: isWallEnabled(),
        messages: adminMessages,
        words: getCustomWords()
      });
    } catch (err) {
      console.error('[wall] Error al difundir el muro:', err);
    }
  };

  // Middleware de autenticación de admin en conexión handshake
  io.use((socket, next) => {
    try {
      const token =
        (socket.handshake.auth as any)?.token ||
        (socket.handshake.headers as any)?.authorization?.replace('Bearer ', '');
      if (token) {
        const payload = verifyAdminToken(token);
        if (payload && payload.role === 'ADMIN') {
          socket.data.isAdmin = true;
          socket.join('room:admin');
        }
      }
    } catch (e) {}
    next();
  });

  io.on('connection', (socket: Socket<ClientToServerEvents, ServerToClientEvents, {}, SocketData>) => {
    // ----------------------------------------------------
    // Fase 1 Hello / Ping
    // ----------------------------------------------------
    socket.on('client:ping', (data) => {
      socket.emit('server:pong', {
        message: `¡Hola recibido con éxito! Servidor respondió a: "${data.message}"`,
        timestamp: new Date().toLocaleTimeString()
      });
    });

    // ----------------------------------------------------
    // Participante: Registro o Reconexión
    // ----------------------------------------------------
    socket.on('participant:join', async (data, callback) => {
      try {
        const parsed = participantJoinSchema.safeParse(data);
        if (!parsed.success) {
          const errMsg = parsed.error.errors[0]?.message || 'Nombre inválido';
          callback?.({ success: false, error: errMsg });
          return;
        }

        const { name, sessionToken } = parsed.data;
        const participant = await registerOrReconnectParticipant({
          name,
          sessionToken,
          socketId: socket.id
        });

        // Guardar metadatos en el socket
        socket.data.participantId = participant.id;
        socket.data.participantName = participant.name;
        socket.data.eventId = participant.eventId;
        socket.data.teamId = participant.teamId || undefined;
        socket.data.teamName = participant.team?.name;
        socket.data.role = participant.role || 'MEMBER';

        // Unir al socket a la sala del participante y del evento
        socket.join(`participant:${participant.id}`);
        socket.join(`event:${participant.eventId}`);
        if (participant.teamId) {
          socket.join(`team:${participant.teamId}`);
        }

        // Notificar a administradores y stage
        io.to('room:admin').emit('admin:participant-joined', participant);
        io.to('room:admin').emit('admin:participant-status', {
          participantId: participant.id,
          isConnected: true
        });

        const stageData = await getStageData(participant.eventId);
        io.to('room:stage').emit('stage:update', stageData);

        callback?.({ success: true, participant });
      } catch (err: any) {
        console.error('[participant:join] Error:', err);
        callback?.({ success: false, error: err.message || 'Error al conectar participante' });
      }
    });

    // ----------------------------------------------------
    // Fase 1: Creación de Equipo (Capitán)
    // ----------------------------------------------------
    socket.on('team:create', async (data, callback) => {
      try {
        if (!data.teamName || !data.teamName.trim()) {
          callback?.({ success: false, error: 'El nombre del equipo es obligatorio.' });
          return;
        }
        if (!data.captainName || !data.captainName.trim()) {
          callback?.({ success: false, error: 'El nombre del capitán es obligatorio.' });
          return;
        }

        const result = await createTeamWithCaptain({
          teamName: data.teamName,
          motto: data.motto,
          avatar: data.avatar || '🛡️',
          captainName: data.captainName,
          sessionToken: data.sessionToken,
          socketId: socket.id
        });

        // Guardar metadatos en socket
        socket.data.participantId = result.participant.id;
        socket.data.participantName = result.participant.name;
        socket.data.eventId = result.participant.eventId;
        socket.data.teamId = result.team.id;
        socket.data.teamName = result.team.name;
        socket.data.role = 'CAPTAIN';

        socket.join(`participant:${result.participant.id}`);
        socket.join(`team:${result.team.id}`);
        socket.join(`event:${result.participant.eventId}`);

        // Notificar a administradores y stage
        io.to('room:admin').emit('admin:participant-joined', result.participant as any);
        io.to('room:admin').emit('admin:participant-status', {
          participantId: result.participant.id,
          isConnected: true
        });

        const [teams, stageData] = await Promise.all([
          getAllTeams(result.participant.eventId, false),
          getStageData(result.participant.eventId)
        ]);

        io.emit('teams:update', teams);
        io.to('room:stage').emit('stage:update', stageData);

        callback?.({
          success: true,
          team: result.team,
          participant: result.participant as any
        });
      } catch (err: any) {
        console.error('[team:create] Error:', err);
        callback?.({ success: false, error: err.message || 'Error al crear el equipo.' });
      }
    });

    // ----------------------------------------------------
    // Fase 1: Unirse a un Equipo con PIN (Integrante)
    // ----------------------------------------------------
    socket.on('team:join', async (data, callback) => {
      try {
        if (!data.teamId) {
          callback?.({ success: false, error: 'Debes seleccionar un equipo.' });
          return;
        }
        if (!data.pin || !data.pin.trim()) {
          callback?.({ success: false, error: 'Debes ingresar el PIN de 4 dígitos.' });
          return;
        }
        if (!data.name || !data.name.trim()) {
          callback?.({ success: false, error: 'Debes ingresar tu nombre.' });
          return;
        }

        const result = await joinTeamAsMember({
          teamId: data.teamId,
          pin: data.pin,
          name: data.name,
          sessionToken: data.sessionToken,
          socketId: socket.id
        });

        // Guardar metadatos en socket
        socket.data.participantId = result.participant.id;
        socket.data.participantName = result.participant.name;
        socket.data.eventId = result.participant.eventId;
        socket.data.teamId = result.team.id;
        socket.data.teamName = result.team.name;
        socket.data.role = 'MEMBER';

        socket.join(`participant:${result.participant.id}`);
        socket.join(`team:${result.team.id}`);
        socket.join(`event:${result.participant.eventId}`);

        // Notificar a administradores y stage
        io.to('room:admin').emit('admin:participant-joined', result.participant as any);
        io.to('room:admin').emit('admin:participant-status', {
          participantId: result.participant.id,
          isConnected: true
        });

        const [teams, stageData] = await Promise.all([
          getAllTeams(result.participant.eventId, false),
          getStageData(result.participant.eventId)
        ]);

        io.emit('teams:update', teams);
        io.to('room:stage').emit('stage:update', stageData);

        callback?.({
          success: true,
          team: result.team,
          participant: result.participant as any
        });
      } catch (err: any) {
        console.error('[team:join] Error:', err);
        callback?.({ success: false, error: err.message || 'Error al unirse al equipo.' });
      }
    });

    // ----------------------------------------------------
    // Fase 1: Listado de Equipos disponibles
    // ----------------------------------------------------
    socket.on('teams:get', async (callback) => {
      try {
        const teams = await getAllTeams();
        callback?.({ success: true, teams });
      } catch (err: any) {
        callback?.({ success: false, teams: [] });
      }
    });

    // ----------------------------------------------------
    // Fase 1, 2 y 3: Auditorio / Pantalla Gigante (Stage)
    // ----------------------------------------------------
    socket.on('stage:join', async (callback) => {
      try {
        socket.join('room:stage');
        const data = await getStageData();
        const gameState = gameEngine.getState();
        const eventId = data.teams[0]?.eventId || 'default';
        const muralPhotos = await getApprovedMuralPhotos(eventId);
        data.muralPhotos = muralPhotos;
        callback?.({
          success: true,
          data,
          gameState,
          chatEnabled: isChatEnabled(),
          audioState: stageAudioState,
          viewMode: currentStageViewMode
        });
      } catch (err: any) {
        console.error('[stage:join] Error:', err);
        callback?.({
          success: false,
          data: { teams: [], totalParticipants: 0, connectedCount: 0 },
          gameState: gameEngine.getState()
        });
      }
    });

    // ----------------------------------------------------
    // Fase 2: Pulsador Digital (Buzzer) - Solo Capitanes
    // ----------------------------------------------------
    socket.on('captain:buzz', async (callback) => {
      try {
        if (!socket.data.teamId || socket.data.role !== 'CAPTAIN') {
          callback?.({ success: false, won: false, error: 'Solo el capitán de cada equipo tiene habilitado el pulsador.' });
          return;
        }

        const captainName = socket.data.participantName || 'Capitán';
        const result = await gameEngine.handleBuzzerPress(socket.data.teamId, captainName);
        callback?.({ success: true, won: result.won });
      } catch (err: any) {
        console.error('[captain:buzz] Error:', err);
        callback?.({ success: false, won: false, error: err.message || 'Error en pulsador.' });
      }
    });

    // ----------------------------------------------------
    // Fase 2: Respuesta de Opción Múltiple (Capitán)
    // ----------------------------------------------------
    socket.on('captain:submit-choice', async (data, callback) => {
      try {
        if (!socket.data.teamId || socket.data.role !== 'CAPTAIN') {
          callback?.({ success: false, error: 'Solo el capitán puede emitir la respuesta.' });
          return;
        }

        await gameEngine.handleChoiceSubmit(socket.data.teamId, data.choiceIndex);
        callback?.({ success: true });
      } catch (err: any) {
        console.error('[captain:submit-choice] Error:', err);
        callback?.({ success: false, error: err.message || 'Error al enviar respuesta.' });
      }
    });

    // Estado del juego para reconexiones
    socket.on('game:get-state', (callback) => {
      callback?.({ state: gameEngine.getState() });
    });

    // ----------------------------------------------------
    // Fase 2: Moderador / Admin Trivia Control
    // ----------------------------------------------------
    socket.on('admin:start-question', async (data, callback) => {
      if (!checkIsAdmin(socket, data)) return callback?.({ success: false, error: 'No autorizado' });
      try {
        if (currentStageViewMode !== 'auto') {
          currentStageViewMode = 'auto';
          io.to('room:stage').emit('stage:view-change', { mode: 'auto' });
          io.to('room:admin').emit('stage:view-change', { mode: 'auto' });
        }
        await gameEngine.startQuestion(data.questionId, data.order, data.text);
        callback?.({ success: true });
        // Sincronizar banco de preguntas actualizado con los administradores conectados
        const questions = await getAllQuestions();
        io.to('room:admin').emit('admin:questions-update', questions);
      } catch (err: any) {
        callback?.({ success: false, error: err.message });
      }
    });

    socket.on('admin:start-countdown', async (data, callback) => {
      if (!checkIsAdmin(socket, data)) return callback?.({ success: false, error: 'No autorizado' });
      try {
        gameEngine.startCountdown(data?.countdownSeconds || 7);
        callback?.({ success: true });
      } catch (err: any) {
        callback?.({ success: false, error: err.message });
      }
    });

    socket.on('admin:cancel-question', async (...args: any[]) => {
      const callback = typeof args[0] === 'function' ? args[0] : args[1];
      const data = typeof args[0] === 'object' ? args[0] : undefined;
      if (!checkIsAdmin(socket, data)) return callback?.({ success: false, error: 'No autorizado' });
      try {
        gameEngine.cancelQuestion();
        callback?.({ success: true });
      } catch (err: any) {
        callback?.({ success: false, error: err.message });
      }
    });

    socket.on('admin:grade-defense', async (data, callback) => {
      if (!checkIsAdmin(socket, data)) return callback?.({ success: false, error: 'No autorizado' });
      try {
        await gameEngine.gradeOralDefense(data.grade);
        callback?.({ success: true });
      } catch (err: any) {
        callback?.({ success: false, error: err.message });
      }
    });

    socket.on('admin:show-leaderboard', async (...args: any[]) => {
      const callback = typeof args[0] === 'function' ? args[0] : args[1];
      const data = typeof args[0] === 'object' ? args[0] : undefined;
      if (!checkIsAdmin(socket, data)) return callback?.({ success: false });
      try {
        await gameEngine.showLeaderboard();
        callback?.({ success: true });
      } catch (err: any) {
        callback?.({ success: false });
      }
    });

    socket.on('admin:reset-to-lobby', async (...args: any[]) => {
      const callback = typeof args[0] === 'function' ? args[0] : args[1];
      const data = typeof args[0] === 'object' ? args[0] : undefined;
      if (!checkIsAdmin(socket, data)) return callback?.({ success: false });
      try {
        gameEngine.resetToLobby();
        callback?.({ success: true });
      } catch (err: any) {
        callback?.({ success: false });
      }
    });

    socket.on('admin:create-question', async (data, callback) => {
      if (!checkIsAdmin(socket, data)) return callback?.({ success: false, error: 'No autorizado' });
      try {
        const question = await createQuestion(data);
        callback?.({ success: true, question });
      } catch (err: any) {
        callback?.({ success: false, error: err.message });
      }
    });

    socket.on('admin:get-questions', async (callback) => {
      try {
        const questions = await getAllQuestions();
        callback?.({ success: true, questions });
      } catch (err: any) {
        callback?.({ success: false, questions: [] });
      }
    });

    socket.on('admin:reload-default-questions', async (...args: any[]) => {
      const callback = typeof args[0] === 'function' ? args[0] : args[1];
      const data = typeof args[0] === 'object' ? args[0] : undefined;
      if (!checkIsAdmin(socket, data)) return callback?.({ success: false, error: 'No autorizado' });
      try {
        const stageData = await getStageData();
        const eventId = stageData.teams[0]?.eventId || 'default';
        const questions = await reloadDefaultBiblicalQuestions(eventId);
        io.to('room:admin').emit('admin:questions-update', questions);
        callback?.({ success: true, count: questions.length, questions });
      } catch (err: any) {
        callback?.({ success: false, error: err.message });
      }
    });

    // ----------------------------------------------------
    // Fase 3: Encuentro e Integración (Chat en duplas & Mural social)
    // ----------------------------------------------------
    socket.on('admin:start-pairings', async (...args: any[]) => {
      const callback = typeof args[0] === 'function' ? args[0] : args[1];
      const data = typeof args[0] === 'object' ? args[0] : undefined;
      if (!checkIsAdmin(socket, data)) return callback?.({ success: false, error: 'No autorizado' });
      try {
        const stageData = await getStageData();
        const eventId = stageData.teams[0]?.eventId || 'default';
        const result = await generateEventPairings(eventId);

        // Optimización masiva: mapear todas las duplas en 1 única pasada O(1) de BD
        const allPairingsMap = await getAllPairingsForEvent(eventId);
        for (const [participantId, pairingData] of allPairingsMap.entries()) {
          io.to(`participant:${participantId}`).emit('pairing:assigned', pairingData);
          // Auto-unir sockets activos a la sala de la dupla
          const sockets = await io.in(`participant:${participantId}`).fetchSockets();
          for (const s of sockets) {
            s.join(`pairing:${pairingData.id}`);
          }
        }

        io.emit('chat:status-change', { chatEnabled: true });

        const queue = await getModerationQueue(eventId);
        io.to('room:admin').emit('admin:moderation-queue-update', queue);

        callback?.({ success: true, count: result.totalPairings });
      } catch (err: any) {
        console.error('[admin:start-pairings] Error:', err);
        callback?.({ success: false, error: err.message });
      }
    });

    socket.on('admin:toggle-chat', async (data, callback) => {
      if (!checkIsAdmin(socket, data)) return callback?.({ success: false, chatEnabled: isChatEnabled() });
      try {
        const updated = setChatEnabled(data.enabled);
        io.emit('chat:status-change', { chatEnabled: updated });
        if (updated) {
          stageAudioState.playing = true;
          stageAudioState.muted = false;
          io.to('room:stage').emit('stage:audio-update', stageAudioState);
          io.to('room:admin').emit('stage:audio-update', stageAudioState);
        }
        callback?.({ success: true, chatEnabled: updated });
      } catch (err: any) {
        callback?.({ success: false, chatEnabled: isChatEnabled() });
      }
    });

    // Control remoto de audio del Stage desde el Panel de Admin
    socket.on('admin:get-stage-audio', async (callback) => {
      callback?.({ success: true, audioState: stageAudioState });
    });

    socket.on('admin:set-stage-audio', async (data, callback) => {
      if (!checkIsAdmin(socket, data)) {
        return callback?.({ success: false, error: 'No autorizado' });
      }

      switch (data.action) {
        case 'play':
          stageAudioState.playing = true;
          stageAudioState.muted = false;
          break;
        case 'pause':
          stageAudioState.playing = false;
          break;
        case 'restart':
          stageAudioState.playing = true;
          stageAudioState.muted = false;
          stageAudioState.seekTime = Date.now();
          break;
        case 'set-volume':
          if (typeof data.volume === 'number') {
            stageAudioState.volume = Math.max(0, Math.min(1, data.volume));
          }
          break;
        case 'toggle-mute':
          stageAudioState.muted = data.muted !== undefined ? data.muted : !stageAudioState.muted;
          break;
      }

      io.to('room:stage').emit('stage:audio-update', stageAudioState);
      io.to('room:admin').emit('stage:audio-update', stageAudioState);

      callback?.({ success: true, audioState: stageAudioState });
    });

    // Control remoto del modo de proyección del Stage (/stage) desde el Admin
    socket.on('admin:get-stage-view', async (callback) => {
      callback?.({ success: true, mode: currentStageViewMode });
    });

    socket.on('admin:set-stage-view', async (data, callback) => {
      if (!checkIsAdmin(socket, data)) {
        return callback?.({ success: false, mode: currentStageViewMode, error: 'No autorizado' });
      }
      currentStageViewMode = data.mode || 'auto';
      io.to('room:stage').emit('stage:view-change', { mode: currentStageViewMode });
      io.to('room:admin').emit('stage:view-change', { mode: currentStageViewMode });
      callback?.({ success: true, mode: currentStageViewMode });
    });

    socket.on('admin:get-moderation-queue', async (...args: any[]) => {
      const callback = typeof args[0] === 'function' ? args[0] : args[1];
      const data = typeof args[0] === 'object' ? args[0] : undefined;
      if (!checkIsAdmin(socket, data)) return callback?.({ success: false, queue: [] });
      try {
        const stageData = await getStageData();
        const eventId = stageData.teams[0]?.eventId || 'default';
        const queue = await getModerationQueue(eventId);
        callback?.({ success: true, queue });
      } catch (err: any) {
        callback?.({ success: false, queue: [] });
      }
    });

    socket.on('admin:moderate-photo', async (data, callback) => {
      if (!checkIsAdmin(socket, data)) return callback?.({ success: false });
      try {
        await moderateChatMessagePhoto(data.messageId, data.approved);
        const stageData = await getStageData();
        const eventId = stageData.teams[0]?.eventId || 'default';
        const [photos, queue] = await Promise.all([
          getApprovedMuralPhotos(eventId),
          getModerationQueue(eventId)
        ]);

        io.to('room:stage').emit('stage:mural-update', photos);
        io.to('room:admin').emit('admin:moderation-queue-update', queue);

        callback?.({ success: true });
      } catch (err: any) {
        callback?.({ success: false });
      }
    });

    socket.on('participant:get-pairing', async (callback) => {
      try {
        const pId = socket.data.participantId;
        if (!pId) return callback?.({ success: false, chatEnabled: isChatEnabled() });

        const pairing = await getPairingDataForParticipant(pId);
        if (pairing) {
          socket.join(`pairing:${pairing.id}`);
        }
        callback?.({ success: true, pairing: pairing || undefined, chatEnabled: isChatEnabled() });
      } catch (err: any) {
        callback?.({ success: false, chatEnabled: isChatEnabled() });
      }
    });

    socket.on('chat:send-message', async (data, callback) => {
      try {
        if (!isChatEnabled()) {
          return callback?.({ success: false, error: 'El chat se encuentra pausado por el moderador.' });
        }

        const senderId = socket.data.participantId;
        const senderName = socket.data.participantName || 'Participante';
        const eventId = socket.data.eventId || 'default';

        let senderTeamName = socket.data.teamName || 'Sin Equipo';
        if (!socket.data.teamName && socket.data.teamId) {
          const team = (await getAllTeams()).find((t) => t.id === socket.data.teamId);
          if (team) {
            senderTeamName = team.name;
            socket.data.teamName = team.name;
          }
        }

        if (!senderId) {
          return callback?.({ success: false, error: 'No se identificó el participante.' });
        }

        const message = await createChatMessage({
          pairingId: data.pairingId,
          senderId,
          senderName,
          senderTeamName,
          content: data.content,
          photoUrl: data.photoUrl
        });

        // 1. Asegurar que el socket del remitente esté en la sala de la dupla
        socket.join(`pairing:${data.pairingId}`);

        // 2. Emitir a la sala de la dupla
        io.to(`pairing:${data.pairingId}`).emit('chat:new-message', message);

        // 3. Respaldo de entrega inmediata a las salas personales de los integrantes
        try {
          const pRec = await prisma.pairing.findUnique({ where: { id: data.pairingId } });
          if (pRec?.memberIds) {
            const memberIds: string[] = JSON.parse(pRec.memberIds);
            for (const mId of memberIds) {
              io.to(`participant:${mId}`).emit('chat:new-message', message);
            }
          }
        } catch (e) {}

        // Actualizar el muro en vivo del Stage (el texto pasa por el filtro de lenguaje)
        if (data.content && data.content.trim()) {
          void broadcastWall();
        }

        // Si tiene foto, enviar a la bandeja de moderación del admin
        if (data.photoUrl) {
          io.to('room:admin').emit('admin:photo-submitted', message);
          const queue = await getModerationQueue(eventId);
          io.to('room:admin').emit('admin:moderation-queue-update', queue);
        }

        callback?.({ success: true, message });
      } catch (err: any) {
        console.error('[chat:send-message] Error:', err);
        callback?.({ success: false, error: err.message });
      }
    });

    socket.on('stage:get-mural', async (callback) => {
      try {
        const stageData = await getStageData();
        const eventId = stageData.teams[0]?.eventId || 'default';
        const photos = await getApprovedMuralPhotos(eventId);
        callback?.({ success: true, photos });
      } catch (err: any) {
        callback?.({ success: false, photos: [] });
      }
    });

    // ----------------------------------------------------
    // Muro de mensajes en vivo (Stage) + moderación del Admin
    // ----------------------------------------------------
    socket.on('stage:get-wall', async (callback) => {
      try {
        const messages = await getWallMessages();
        callback?.({ success: true, enabled: isWallEnabled(), messages });
      } catch (err: any) {
        callback?.({ success: false, enabled: isWallEnabled(), messages: [] });
      }
    });

    socket.on('admin:get-wall', async (...args: any[]) => {
      const callback = typeof args[0] === 'function' ? args[0] : args[1];
      const data = typeof args[0] === 'object' ? args[0] : undefined;
      if (!checkIsAdmin(socket, data)) {
        return callback?.({ success: false, enabled: isWallEnabled(), messages: [], words: [] });
      }
      try {
        const messages = await getWallModeration();
        callback?.({ success: true, enabled: isWallEnabled(), messages, words: getCustomWords() });
      } catch (err: any) {
        callback?.({ success: false, enabled: isWallEnabled(), messages: [], words: [] });
      }
    });

    socket.on('admin:wall-hide', async (data, callback) => {
      if (!checkIsAdmin(socket, data)) return callback?.({ success: false });
      setMessageHidden(data.messageId, data.hidden);
      await broadcastWall();
      callback?.({ success: true });
    });

    socket.on('admin:wall-approve', async (data, callback) => {
      if (!checkIsAdmin(socket, data)) return callback?.({ success: false });
      setMessageApproved(data.messageId, data.approved);
      await broadcastWall();
      callback?.({ success: true });
    });

    socket.on('admin:wall-toggle', async (data, callback) => {
      if (!checkIsAdmin(socket, data)) return callback?.({ success: false, enabled: isWallEnabled() });
      const enabled = setWallEnabled(!!data.enabled);
      await broadcastWall();
      callback?.({ success: true, enabled });
    });

    socket.on('admin:wall-set-words', async (data, callback) => {
      if (!checkIsAdmin(socket, data)) return callback?.({ success: false, words: getCustomWords() });
      const words = setCustomWords(Array.isArray(data.words) ? data.words : []);
      await broadcastWall();
      callback?.({ success: true, words });
    });

    // ----------------------------------------------------
    // Administrador: Autenticación y Entrada al Panel
    // ----------------------------------------------------
    socket.on('admin:join', async (data, callback) => {
      try {
        if (!data.token) {
          callback?.({ success: false, error: 'Token no proporcionado' });
          return;
        }

        const payload = verifyAdminToken(data.token);
        if (!payload || payload.role !== 'ADMIN') {
          callback?.({ success: false, error: 'Token inválido o sin permisos de administrador' });
          return;
        }

        socket.data.isAdmin = true;
        socket.join('room:admin');

        // Enviar lista actualizada de participantes y equipos con PIN
        const [participants, teams] = await Promise.all([
          getAllParticipants(),
          getAllTeams(undefined, true)
        ]);
        socket.emit('admin:participants-update', participants);
        socket.emit('teams:update', teams);

        callback?.({ success: true });
      } catch (err: any) {
        console.error('[admin:join] Error:', err);
        callback?.({ success: false, error: 'Error al autorizar administrador' });
      }
    });

    // ----------------------------------------------------
    // Administrador: Envío de Mensajes (Todos o Específico)
    // ----------------------------------------------------
    socket.on('admin:send-message', async (data, callback) => {
      try {
        if (!checkIsAdmin(socket, data)) {
          callback?.({ success: false, error: 'No autorizado para enviar mensajes' });
          return;
        }

        const parsed = sendMessageSchema.safeParse(data);
        if (!parsed.success) {
          callback?.({ success: false, error: parsed.error.errors[0]?.message || 'Datos del mensaje inválidos' });
          return;
        }

        const { recipientType, recipientId, content } = parsed.data;

        if (recipientType === 'ALL') {
          // Enviar a todos los participantes del evento
          const allParticipants = await getAllParticipants();

          for (const p of allParticipants) {
            const personalized = replaceVariables(content, p.name);
            const livePayload: LiveMessagePayload = {
              id: `${Date.now()}-${p.id}`,
              content: personalized,
              recipientType: 'ALL',
              recipientId: null,
              sentAt: new Date().toISOString()
            };

            // Emitir a la sala privada de cada participante
            io.to(`participant:${p.id}`).emit('message:received', livePayload);
          }

          // Registrar en la base de datos
          const log = await logMessage({
            recipientType: 'ALL',
            content,
            sender: 'ADMIN'
          });

          // Notificar a todos los administradores conectados
          io.to('room:admin').emit('admin:message-logged', log);
          callback?.({ success: true, message: log });

        } else if (recipientType === 'PARTICIPANT') {
          if (!recipientId) {
            callback?.({ success: false, error: 'Debe especificar el participante destinatario' });
            return;
          }

          const target = await getParticipantById(recipientId);
          if (!target) {
            callback?.({ success: false, error: 'Participante no encontrado' });
            return;
          }

          const personalized = replaceVariables(content, target.name);
          const livePayload: LiveMessagePayload = {
            id: `${Date.now()}-${target.id}`,
            content: personalized,
            recipientType: 'PARTICIPANT',
            recipientId: target.id,
            sentAt: new Date().toISOString()
          };

          // Emitir únicamente al participante seleccionado
          io.to(`participant:${target.id}`).emit('message:received', livePayload);

          // Registrar en la base de datos
          const log = await logMessage({
            recipientType: 'PARTICIPANT',
            recipientId: target.id,
            recipientName: target.name,
            content: personalized,
            sender: 'ADMIN'
          });

          io.to('room:admin').emit('admin:message-logged', log);
          callback?.({ success: true, message: log });
        }
      } catch (err: any) {
        console.error('[admin:send-message] Error:', err);
        callback?.({ success: false, error: err.message || 'Error al enviar mensaje' });
      }
    });

    // ----------------------------------------------------
    // Administrador: Gestión de Plantillas por Socket
    // ----------------------------------------------------
    socket.on('admin:create-template', async (data, callback) => {
      if (!checkIsAdmin(socket, data)) return callback?.({ success: false, error: 'No autorizado' });
      const parsed = templateSchema.safeParse(data);
      if (!parsed.success) return callback?.({ success: false, error: parsed.error.errors[0]?.message });
      try {
        const template = await createTemplate(parsed.data);
        callback?.({ success: true, template });
      } catch (err: any) {
        callback?.({ success: false, error: err.message });
      }
    });

    socket.on('admin:update-template', async (data, callback) => {
      if (!checkIsAdmin(socket, data)) return callback?.({ success: false, error: 'No autorizado' });
      const parsed = templateSchema.safeParse({ name: data.name, content: data.content });
      if (!parsed.success) return callback?.({ success: false, error: parsed.error.errors[0]?.message });
      try {
        const template = await updateTemplate(data.id, parsed.data);
        callback?.({ success: true, template });
      } catch (err: any) {
        callback?.({ success: false, error: err.message });
      }
    });

    socket.on('admin:delete-template', async (data, callback) => {
      if (!checkIsAdmin(socket, data)) return callback?.({ success: false, error: 'No autorizado' });
      try {
        await deleteTemplate(data.id);
        callback?.({ success: true });
      } catch (err: any) {
        callback?.({ success: false, error: err.message });
      }
    });

    // ----------------------------------------------------
    // Contingencias y Superpoderes de Administración en Vivo
    // ----------------------------------------------------

    // 1. Rebotar Pregunta al Auditorio
    socket.on('admin:rebound-question', async (data, callback) => {
      if (!checkIsAdmin(socket, data)) return callback?.({ success: false, error: 'No autorizado' });
      try {
        gameEngine.reboundQuestion(data?.seconds || 15);
        callback?.({ success: true });
      } catch (err: any) {
        callback?.({ success: false, error: err.message });
      }
    });

    // 2. Ajuste Manual de Puntos a un Equipo (+/- Pts)
    socket.on('admin:adjust-team-points', async (data, callback) => {
      if (!checkIsAdmin(socket, data)) return callback?.({ success: false, error: 'No autorizado' });
      try {
        await adjustTeamScore(data.teamId, data.deltaPoints);

        const [teamsPublic, teamsAdmin, stageData] = await Promise.all([
          getAllTeams(undefined, false),
          getAllTeams(undefined, true),
          getStageData()
        ]);

        io.emit('teams:update', teamsPublic);
        io.to('room:admin').emit('teams:update', teamsAdmin);
        io.emit('game:score-updated', teamsPublic);
        io.to('room:stage').emit('stage:update', stageData);

        callback?.({ success: true });
      } catch (err: any) {
        callback?.({ success: false, error: err.message });
      }
    });

    // 2.1 Asignar Puntaje Exacto a un Equipo (Fijar Puntos)
    socket.on('admin:set-team-score', async (data, callback) => {
      if (!checkIsAdmin(socket, data)) return callback?.({ success: false, error: 'No autorizado' });
      try {
        await setTeamScore(data.teamId, data.score);

        const [teamsPublic, teamsAdmin, stageData] = await Promise.all([
          getAllTeams(undefined, false),
          getAllTeams(undefined, true),
          getStageData()
        ]);

        io.emit('teams:update', teamsPublic);
        io.to('room:admin').emit('teams:update', teamsAdmin);
        io.emit('game:score-updated', teamsPublic);
        io.to('room:stage').emit('stage:update', stageData);

        callback?.({ success: true });
      } catch (err: any) {
        callback?.({ success: false, error: err.message });
      }
    });

    // 3. Expulsar Participante Troll o Duplicado
    socket.on('admin:kick-participant', async (data, callback) => {
      if (!checkIsAdmin(socket, data)) return callback?.({ success: false, error: 'No autorizado' });
      try {
        const kicked = await kickParticipant(data.participantId);
        if (kicked) {
          // Notificar y expulsar los sockets asociados a ese participante
          io.to(`participant:${data.participantId}`).emit('participant:kicked', {
            reason: 'Has sido retirado del evento por el moderador.'
          });
          io.in(`participant:${data.participantId}`).disconnectSockets(true);

          const [participants, teamsPublic, teamsAdmin, stageData] = await Promise.all([
            getAllParticipants(),
            getAllTeams(undefined, false),
            getAllTeams(undefined, true),
            getStageData()
          ]);

          io.to('room:admin').emit('admin:participants-update', participants);
          io.emit('teams:update', teamsPublic);
          io.to('room:admin').emit('teams:update', teamsAdmin);
          io.to('room:stage').emit('stage:update', stageData);
        }
        callback?.({ success: true });
      } catch (err: any) {
        callback?.({ success: false, error: err.message });
      }
    });

    // 4. Transferir Capitanía (en caso de batería baja o reconexión fallida)
    socket.on('admin:transfer-captain', async (data, callback) => {
      if (!checkIsAdmin(socket, data)) return callback?.({ success: false, error: 'No autorizado' });
      try {
        await transferCaptaincy(data.teamId, data.newCaptainId);

        // Actualizar roles en memoria de todos los sockets del equipo
        const teamSockets = await io.in(`team:${data.teamId}`).fetchSockets();
        for (const s of teamSockets) {
          if (s.data.participantId === data.newCaptainId) {
            s.data.role = 'CAPTAIN';
          } else if (s.data.role === 'CAPTAIN') {
            s.data.role = 'MEMBER';
            if (s.data.participantId) {
              io.to(`participant:${s.data.participantId}`).emit('participant:role-updated', { role: 'MEMBER' });
            }
          }
        }

        // Notificar al nuevo capitán promovido
        io.to(`participant:${data.newCaptainId}`).emit('participant:role-updated', { role: 'CAPTAIN' });

        const [participants, teamsPublic, teamsAdmin, stageData] = await Promise.all([
          getAllParticipants(),
          getAllTeams(undefined, false),
          getAllTeams(undefined, true),
          getStageData()
        ]);

        io.to('room:admin').emit('admin:participants-update', participants);
        io.emit('teams:update', teamsPublic);
        io.to('room:admin').emit('teams:update', teamsAdmin);
        io.to('room:stage').emit('stage:update', stageData);

        callback?.({ success: true });
      } catch (err: any) {
        callback?.({ success: false, error: err.message });
      }
    });

    // 5. Botón de Reseteo Maestro del Evento (Doble check con texto 'RESET')
    socket.on('admin:reset-event', async (data, callback) => {
      if (!checkIsAdmin(socket, data)) return callback?.({ success: false, error: 'No autorizado' });
      if (data.confirmText !== 'RESET') {
        return callback?.({ success: false, error: 'Debes escribir exactamente "RESET" para confirmar el reinicio.' });
      }
      try {
        await resetEventData();
        gameEngine.resetToLobby();

        // Limpiar en memoria el estado y salas de todos los sockets participantes conectados
        for (const [_, clientSocket] of io.sockets.sockets) {
          if (!clientSocket.data.isAdmin) {
            clientSocket.data.participantId = undefined;
            clientSocket.data.participantName = undefined;
            clientSocket.data.teamId = undefined;
            clientSocket.data.teamName = undefined;
            clientSocket.data.role = undefined;
            for (const room of clientSocket.rooms) {
              if (room.startsWith('participant:') || room.startsWith('team:')) {
                clientSocket.leave(room);
              }
            }
          }
        }

        // Notificar a todos los dispositivos en el auditorio para reiniciar su vista local
        io.emit('event:reset');

        const [participants, teamsPublic, teamsAdmin, stageData] = await Promise.all([
          getAllParticipants(),
          getAllTeams(undefined, false),
          getAllTeams(undefined, true),
          getStageData()
        ]);

        io.to('room:admin').emit('admin:participants-update', participants);
        io.emit('teams:update', teamsPublic);
        io.to('room:admin').emit('teams:update', teamsAdmin);
        io.to('room:stage').emit('stage:update', stageData);

        callback?.({ success: true });
      } catch (err: any) {
        callback?.({ success: false, error: err.message });
      }
    });

    // ----------------------------------------------------
    // Manejo de Desconexión
    // ----------------------------------------------------
    socket.on('disconnect', async (reason) => {
      if (socket.data.participantId) {
        const updated = await setParticipantDisconnected(socket.id);
        if (updated) {
          io.to('room:admin').emit('admin:participant-status', {
            participantId: updated.id,
            isConnected: false
          });

          // Actualizar auditorio si hay evento activo
          if (socket.data.eventId) {
            getStageData(socket.data.eventId).then((stageData) => {
              io.to('room:stage').emit('stage:update', stageData);
            }).catch(() => {});
          }
        }
      }
    });
  });
}
