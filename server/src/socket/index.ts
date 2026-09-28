import { Server, Socket } from 'socket.io';
import { verifyAdminToken } from '../middleware/auth.js';
import {
  registerOrReconnectParticipant,
  setParticipantDisconnected,
  getAllParticipants,
  getParticipantById
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
import type { ClientToServerEvents, ServerToClientEvents, LiveMessagePayload } from '../types/index.js';

interface SocketData {
  isAdmin?: boolean;
  participantId?: string;
  participantName?: string;
  eventId?: string;
}

export function setupSocketHandlers(io: Server<ClientToServerEvents, ServerToClientEvents, {}, SocketData>) {
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

        // Unir al socket a la sala del participante y del evento
        socket.join(`participant:${participant.id}`);
        socket.join(`event:${participant.eventId}`);

        // Notificar a administradores
        io.to('room:admin').emit('admin:participant-joined', participant);
        io.to('room:admin').emit('admin:participant-status', {
          participantId: participant.id,
          isConnected: true
        });

        callback?.({ success: true, participant });
      } catch (err: any) {
        console.error('[participant:join] Error:', err);
        callback?.({ success: false, error: err.message || 'Error al conectar participante' });
      }
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

        // Enviar lista actualizada de participantes
        const participants = await getAllParticipants();
        socket.emit('admin:participants-update', participants);

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
        if (!socket.data.isAdmin) {
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
      if (!socket.data.isAdmin) return callback?.({ success: false, error: 'No autorizado' });
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
      if (!socket.data.isAdmin) return callback?.({ success: false, error: 'No autorizado' });
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
      if (!socket.data.isAdmin) return callback?.({ success: false, error: 'No autorizado' });
      try {
        await deleteTemplate(data.id);
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
        }
      }
    });
  });
}
