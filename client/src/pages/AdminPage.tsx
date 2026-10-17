import { useState, useEffect } from 'react';
import { socket } from '../services/socket';
import {
  loginAdmin,
  verifyAdminAuth,
  getAdminToken,
  removeAdminToken,
  fetchParticipants,
  fetchTemplates,
  fetchMessageHistory,
  createTemplate as apiCreateTemplate,
  updateTemplate as apiUpdateTemplate,
  deleteTemplate as apiDeleteTemplate
} from '../services/api';
import { QRCodeSVG } from 'qrcode.react';
import {
  Users,
  Send,
  QrCode,
  LogOut,
  Plus,
  Edit2,
  Trash2,
  CheckCircle,
  Clock,
  ExternalLink,
  X,
  Trophy,
  Play,
  CheckCircle2,
  XCircle,
  Award,
  Flame,
  RotateCcw,
  Gamepad2,
  MessageSquare,
  Camera,
  Key,
  ShieldAlert,
  UserMinus,
  Crown,
  AlertTriangle,
  Music,
  Volume2,
  VolumeX,
  Pause,
  Tv,
  Minus,
  Target
} from 'lucide-react';
import type {
  Participant,
  MessageTemplate,
  MessageLog,
  RecipientType,
  Question,
  GameState,
  QuestionType,
  ChatMessageItem,
  Team,
  WallModerationItem,
  StageAudioState,
  StageViewMode
} from '../../../shared/types/index.js';
import '../styles/admin.css';

export function AdminPage() {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loginError, setLoginError] = useState('');
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  // Estados del Panel
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [templates, setTemplates] = useState<MessageTemplate[]>([]);
  const [history, setHistory] = useState<MessageLog[]>([]);

  // Editor
  const [recipientType, setRecipientType] = useState<RecipientType>('ALL');
  const [selectedParticipantId, setSelectedParticipantId] = useState<string>('');
  const [messageContent, setMessageContent] = useState('Hola {nombre},\nTenemos un anuncio especial para ti.');
  const [isSending, setIsSending] = useState(false);
  const [sendSuccessMsg, setSendSuccessMsg] = useState('');

  // Modales
  const [showQrModal, setShowQrModal] = useState(false);
  const [showTemplateModal, setShowTemplateModal] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<MessageTemplate | null>(null);
  const [templateName, setTemplateName] = useState('');
  const [templateBody, setTemplateBody] = useState('');

  // Pestaña activa del administrador
  const [adminTab, setAdminTab] = useState<'trivia' | 'social' | 'messaging'>('trivia');

  // Estados de Encuentro & Moderación (Fase 3)
  const [moderationQueue, setModerationQueue] = useState<ChatMessageItem[]>([]);
  const [isStartingPairings, setIsStartingPairings] = useState(false);
  const [chatEnabled, setChatEnabled] = useState(false);

  // Muro de mensajes en vivo del Stage (con filtro de lenguaje ofensivo)
  const [wallEnabled, setWallEnabled] = useState(true);
  const [wallItems, setWallItems] = useState<WallModerationItem[]>([]);
  const [wallWordsInput, setWallWordsInput] = useState('');
  const [wallWordsSaved, setWallWordsSaved] = useState(false);

  // Control remoto de audio del Stage (Auditorio)
  const [stageAudio, setStageAudio] = useState<StageAudioState>({
    playing: false,
    volume: 0.6,
    muted: false,
    trackTitle: 'Cambiaré Mis Tristezas / Eres Fiel'
  });

  // Control remoto de proyección del Stage (Auditorio)
  const [stageViewMode, setStageViewMode] = useState<StageViewMode>('auto');

  // Estados de Trivia y Buzzer (Fase 2)
  const [questions, setQuestions] = useState<Question[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [manualPoints, setManualPoints] = useState<Record<string, string>>({});
  const [gameState, setGameState] = useState<GameState>({
    status: 'LOBBY',
    currentQuestion: null,
    timeRemaining: 0,
    buzzerWinner: null,
    selectedChoice: null,
    result: null
  });

  // Contingencia & Reseteo Maestro
  const [showResetModal, setShowResetModal] = useState(false);
  const [resetConfirmInput, setResetConfirmInput] = useState('');
  const [isResetting, setIsResetting] = useState(false);

  // Modal para Crear Pregunta
  const [showQuestionModal, setShowQuestionModal] = useState(false);
  const [newQuestionText, setNewQuestionText] = useState('');
  const [newQuestionType, setNewQuestionType] = useState<QuestionType>('ORAL_DEFENSE');
  const [newQuestionPoints, setNewQuestionPoints] = useState(100);
  const [newQuestionTime, setNewQuestionTime] = useState(25);
  const [newOptionA, setNewOptionA] = useState('');
  const [newOptionB, setNewOptionB] = useState('');
  const [newOptionC, setNewOptionC] = useState('');
  const [newOptionD, setNewOptionD] = useState('');
  const [newCorrectOptionIndex, setNewCorrectOptionIndex] = useState(0);

  // URL del QR
  const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
  const initialQrUrl = isLocalhost ? 'https://participating-resorts-permitted-hurricane.trycloudflare.com/' : `${window.location.origin}/`;
  const [qrUrl, setQrUrl] = useState(initialQrUrl);

  // 1. Verificar autenticación al cargar
  useEffect(() => {
    verifyAdminAuth().then((isValid) => {
      setIsAuthenticated(isValid);
      if (isValid) {
        initAdminSession();
      }
    });
  }, []);

  // 2. Inicializar sesión de Socket y datos
  const initAdminSession = () => {
    const token = getAdminToken();
    if (!token) return;

    // Asignar credenciales en el objeto socket para reconexiones automáticas
    (socket.auth as any) = { token };

    // Unirse a Socket.IO con token
    socket.emit('admin:join', { token }, (res) => {
      if (!res.success) {
        console.error('Error al unirse como admin en Socket.IO:', res.error);
      }
    });

    // Cargar preguntas iniciales
    socket.emit('admin:get-questions', (res) => {
      if (res?.success && res.questions) setQuestions(res.questions);
    });

    // Cargar cola de moderación de fotografías (Fase 3)
    socket.emit('admin:get-moderation-queue', (res) => {
      if (res?.success && res.queue) setModerationQueue(res.queue);
    });

    // Cargar muro de mensajes en vivo (Stage)
    socket.emit('admin:get-wall', { token: getAdminToken() || undefined }, (res) => {
      if (res?.success) {
        setWallEnabled(res.enabled);
        setWallItems(res.messages);
        setWallWordsInput(res.words.join(', '));
      }
    });

    // Cargar estado inicial del juego
    socket.emit('game:get-state', (res) => {
      if (res?.state) setGameState(res.state);
    });

    // Cargar modo de proyección activo del Stage (/stage)
    socket.emit('admin:get-stage-view', (res) => {
      if (res?.success && res.mode) setStageViewMode(res.mode);
    });

    // Cargar equipos con PINs
    socket.emit('teams:get', (res) => {
      if (res?.success && res.teams) setTeams(res.teams);
    });

    // Cargar datos iniciales
    fetchParticipants().then(setParticipants).catch(console.error);
    fetchTemplates().then(setTemplates).catch(console.error);
    fetchMessageHistory().then(setHistory).catch(console.error);
  };

  // 3. Listeners en tiempo real para el Panel
  useEffect(() => {
    if (!isAuthenticated) return;

    function onSocketConnect() {
      const token = getAdminToken();
      if (token) {
        (socket.auth as any) = { token };
        socket.emit('admin:join', { token });
      }

      // Re-sincronizar siempre estado, banco de preguntas y equipos al reconectar
      socket.emit('admin:get-questions', (res) => {
        if (res?.success && res.questions) setQuestions(res.questions);
      });
      socket.emit('game:get-state', (res) => {
        if (res?.state) setGameState(res.state);
      });
      socket.emit('teams:get', (res) => {
        if (res?.success && res.teams) setTeams(res.teams);
      });
      socket.emit('admin:get-wall', { token: getAdminToken() || undefined }, (res) => {
        if (res?.success) {
          setWallEnabled(res.enabled);
          setWallItems(res.messages);
        }
      });
      socket.emit('admin:get-stage-audio', (res) => {
        if (res?.success && res.audioState) setStageAudio(res.audioState);
      });
    }

    socket.on('connect', onSocketConnect);
    if (socket.connected) {
      onSocketConnect();
    }

    function onParticipantsUpdate(list: Participant[]) {
      setParticipants(list);
    }

    function onTeamsUpdate(list: Team[]) {
      setTeams(list);
    }

    function onParticipantJoined(newP: Participant) {
      setParticipants((prev) => {
        const exists = prev.some((p) => p.id === newP.id);
        if (exists) {
          return prev.map((p) => (p.id === newP.id ? newP : p));
        }
        return [...prev, newP];
      });
    }

    function onParticipantStatus(data: { participantId: string; isConnected: boolean }) {
      setParticipants((prev) =>
        prev.map((p) => (p.id === data.participantId ? { ...p, isConnected: data.isConnected } : p))
      );
    }

    function onMessageLogged(log: MessageLog) {
      setHistory((prev) => [log, ...prev]);
    }

    function onGameStateUpdate(state: GameState) {
      setGameState(state);
    }

    function onGameTimerTick({ timeRemaining }: { timeRemaining: number }) {
      setGameState((prev) => ({ ...prev, timeRemaining }));
    }

    function onCountdownTick({ countdownRemaining }: { countdownRemaining: number }) {
      setGameState((prev) => ({ ...prev, countdownRemaining }));
    }

    function onPhotoSubmitted(msg: ChatMessageItem) {
      setModerationQueue((prev) => [msg, ...prev.filter((m) => m.id !== msg.id)]);
    }

    function onModerationQueueUpdate(queue: ChatMessageItem[]) {
      setModerationQueue(queue);
    }

    function onChatStatusChange(data: { chatEnabled: boolean }) {
      setChatEnabled(data.chatEnabled);
    }

    function onWallUpdate(data: { enabled: boolean; messages: WallModerationItem[] }) {
      setWallEnabled(data.enabled);
      setWallItems(data.messages);
    }

    function onQuestionsUpdate(list: Question[]) {
      setQuestions(list);
    }

    function onStageAudioUpdate(audioState: StageAudioState) {
      setStageAudio(audioState);
    }

    socket.on('admin:participants-update', onParticipantsUpdate);
    socket.on('teams:update', onTeamsUpdate);
    socket.on('admin:participant-joined', onParticipantJoined);
    socket.on('admin:participant-status', onParticipantStatus);
    socket.on('admin:message-logged', onMessageLogged);
    socket.on('game:state-update', onGameStateUpdate);
    socket.on('game:timer-tick', onGameTimerTick);
    socket.on('game:countdown-tick', onCountdownTick);
    socket.on('admin:photo-submitted', onPhotoSubmitted);
    socket.on('admin:moderation-queue-update', onModerationQueueUpdate);
    socket.on('chat:status-change', onChatStatusChange);
    socket.on('admin:wall-update', onWallUpdate);
    socket.on('admin:questions-update', onQuestionsUpdate);
    socket.on('stage:audio-update', onStageAudioUpdate);

    function onStageViewChange({ mode }: { mode: StageViewMode }) {
      if (mode) setStageViewMode(mode);
    }
    socket.on('stage:view-change', onStageViewChange);

    return () => {
      socket.off('connect', onSocketConnect);
      socket.off('admin:participants-update', onParticipantsUpdate);
      socket.off('teams:update', onTeamsUpdate);
      socket.off('admin:participant-joined', onParticipantJoined);
      socket.off('admin:participant-status', onParticipantStatus);
      socket.off('admin:message-logged', onMessageLogged);
      socket.off('game:state-update', onGameStateUpdate);
      socket.off('game:timer-tick', onGameTimerTick);
      socket.off('game:countdown-tick', onCountdownTick);
      socket.off('admin:photo-submitted', onPhotoSubmitted);
      socket.off('admin:moderation-queue-update', onModerationQueueUpdate);
      socket.off('chat:status-change', onChatStatusChange);
      socket.off('admin:wall-update', onWallUpdate);
      socket.off('admin:questions-update', onQuestionsUpdate);
      socket.off('stage:audio-update', onStageAudioUpdate);
      socket.off('stage:view-change', onStageViewChange);
    };
  }, [isAuthenticated]);

  // Manejo de Login
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError('');
    setIsLoggingIn(true);
    try {
      await loginAdmin(username, password);
      setIsAuthenticated(true);
      initAdminSession();
    } catch (err: any) {
      setLoginError(err.message || 'Error de credenciales');
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleLogout = () => {
    removeAdminToken();
    setIsAuthenticated(false);
  };

  // Envío de mensaje
  const handleSendMessage = () => {
    if (!messageContent.trim()) return;

    setIsSending(true);
    setSendSuccessMsg('');

    socket.emit(
      'admin:send-message',
      {
        recipientType,
        recipientId: recipientType === 'PARTICIPANT' ? selectedParticipantId : undefined,
        content: messageContent.trim(),
        token: getAdminToken() || undefined
      },
      (res) => {
        setIsSending(false);
        if (res.success) {
          setSendSuccessMsg('Mensaje transmitido con éxito');
          setTimeout(() => setSendSuccessMsg(''), 4000);
        } else {
          alert(res.error || 'Error al enviar mensaje');
        }
      }
    );
  };

  const handleUseTemplate = (tmpl: MessageTemplate) => {
    setMessageContent(tmpl.content);
  };

  const handleSaveTemplate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!templateName.trim() || !templateBody.trim()) return;

    try {
      if (editingTemplate) {
        const updated = await apiUpdateTemplate(editingTemplate.id, templateName.trim(), templateBody.trim());
        setTemplates((prev) => prev.map((t) => (t.id === updated.id ? updated : t)));
      } else {
        const created = await apiCreateTemplate(templateName.trim(), templateBody.trim());
        setTemplates((prev) => [...prev, created]);
      }
      setShowTemplateModal(false);
      setEditingTemplate(null);
      setTemplateName('');
      setTemplateBody('');
    } catch (err: any) {
      alert(err.message || 'Error al guardar plantilla');
    }
  };

  const handleDeleteTemplate = async (id: string, name: string) => {
    if (!confirm(`¿Eliminar la plantilla "${name}"?`)) return;
    try {
      await apiDeleteTemplate(id);
      setTemplates((prev) => prev.filter((t) => t.id !== id));
    } catch (err: any) {
      alert(err.message || 'Error al eliminar');
    }
  };

  const openNewTemplateModal = () => {
    setEditingTemplate(null);
    setTemplateName('');
    setTemplateBody('');
    setShowTemplateModal(true);
  };

  const openEditTemplateModal = (tmpl: MessageTemplate) => {
    setEditingTemplate(tmpl);
    setTemplateName(tmpl.name);
    setTemplateBody(tmpl.content);
    setShowTemplateModal(true);
  };

  // Acciones de Trivia & Moderación en Vivo
  const handleStartQuestion = (questionId: string, order?: number, text?: string) => {
    socket.emit('admin:start-question', { questionId, order, text, token: getAdminToken() || undefined }, (res) => {
      if (!res?.success) {
        socket.emit('admin:get-questions', (qRes) => {
          if (qRes?.success && qRes.questions) setQuestions(qRes.questions);
        });
        alert(res?.error || 'Error al lanzar la pregunta');
      }
    });
  };

  const handleGradeDefense = (grade: 'CORRECT' | 'PARTIAL' | 'INCORRECT') => {
    socket.emit('admin:grade-defense', { grade, token: getAdminToken() || undefined }, (res) => {
      if (!res?.success) {
        alert(res?.error || 'Error al calificar la respuesta');
      }
    });
  };

  const handleShowLeaderboard = () => {
    socket.emit('admin:show-leaderboard', { token: getAdminToken() || undefined }, (res) => {
      if (!res?.success) {
        alert('Error al proyectar el podio');
      }
    });
  };

  const handleStartCountdown = (countdownSeconds = 7) => {
    socket.emit('admin:start-countdown', { countdownSeconds, token: getAdminToken() || undefined }, (res) => {
      if (!res?.success) {
        alert(res?.error || 'Error al iniciar la cuenta regresiva');
      }
    });
  };

  const handleCancelQuestion = () => {
    if (confirm('¿Deseas cancelar esta pregunta inmediatamente y volver a la sala de espera?')) {
      socket.emit('admin:cancel-question', { token: getAdminToken() || undefined }, (res) => {
        if (!res?.success) {
          alert(res?.error || 'Error al cancelar la pregunta');
        }
      });
    }
  };

  const handleResetToLobby = () => {
    socket.emit('admin:reset-to-lobby', { token: getAdminToken() || undefined }, (res) => {
      if (!res?.success) {
        alert('Error al reiniciar al lobby');
      }
    });
  };

  const handleCreateQuestion = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newQuestionText.trim()) return;

    const payload = {
      text: newQuestionText.trim(),
      type: newQuestionType,
      points: Number(newQuestionPoints) || 100,
      timeLimit: Number(newQuestionTime) || 25,
      options:
        newQuestionType === 'MULTIPLE_CHOICE'
          ? [newOptionA.trim(), newOptionB.trim(), newOptionC.trim(), newOptionD.trim()].filter(Boolean)
          : undefined,
      correctOptionIndex: newQuestionType === 'MULTIPLE_CHOICE' ? Number(newCorrectOptionIndex) : undefined,
      token: getAdminToken() || undefined
    };

    socket.emit('admin:create-question', payload, (res) => {
      if (res?.success && res.question) {
        setQuestions((prev) => [...prev, res.question as Question]);
        setShowQuestionModal(false);
        setNewQuestionText('');
        setNewOptionA('');
        setNewOptionB('');
        setNewOptionC('');
        setNewOptionD('');
      } else {
        alert(res?.error || 'Error al crear la pregunta');
      }
    });
  };

  const handleReloadDefaultQuestions = () => {
    if (!confirm('¿Deseas cargar el banco oficial de 20 preguntas bíblicas difíciles (Scribd)? Esto actualizará la lista de preguntas.')) return;
    socket.emit('admin:reload-default-questions', { token: getAdminToken() || undefined }, (res) => {
      if (res?.success && res.questions) {
        setQuestions(res.questions);
        alert(`¡Listo! Se cargaron con éxito ${res.count || res.questions.length} preguntas bíblicas oficiales.`);
      } else {
        alert(res?.error || 'Error al cargar las preguntas bíblicas');
      }
    });
  };

  // Acciones Sociales
  const handleStartPairings = () => {
    if (!confirm('¿Deseas iniciar el emparejamiento automático de duplas? Esto cruzará a los participantes de equipos diferentes.')) return;

    setIsStartingPairings(true);
    socket.emit('admin:start-pairings', { token: getAdminToken() || undefined }, (res) => {
      setIsStartingPairings(false);
      if (res?.success) {
        setChatEnabled(true);
        alert(`Emparejamiento exitoso. Se crearon ${res.count} duplas de integración y se habilitó el canal de chat.`);
      } else {
        alert(res?.error || 'Error al generar emparejamientos');
      }
    });
  };

  const handleToggleChat = () => {
    socket.emit('admin:toggle-chat', { enabled: !chatEnabled, token: getAdminToken() || undefined }, (res) => {
      if (res?.success) {
        setChatEnabled(res.chatEnabled);
      }
    });
  };

  const handleModeratePhoto = (messageId: string, approved: boolean) => {
    socket.emit('admin:moderate-photo', { messageId, approved, token: getAdminToken() || undefined }, (res) => {
      if (!res?.success) {
        alert('Error al moderar la fotografía');
      }
    });
  };

  // Muro de mensajes en vivo
  const handleWallToggle = () => {
    socket.emit('admin:wall-toggle', { enabled: !wallEnabled, token: getAdminToken() || undefined }, (res) => {
      if (res?.success) setWallEnabled(res.enabled);
    });
  };

  const handleWallHide = (messageId: string, hidden: boolean) => {
    socket.emit('admin:wall-hide', { messageId, hidden, token: getAdminToken() || undefined }, (res) => {
      if (!res?.success) alert('No se pudo actualizar el mensaje');
    });
  };

  const handleWallApprove = (messageId: string, approved: boolean) => {
    socket.emit('admin:wall-approve', { messageId, approved, token: getAdminToken() || undefined }, (res) => {
      if (!res?.success) alert('No se pudo actualizar el mensaje');
    });
  };

  const handleWallSaveWords = () => {
    const words = wallWordsInput
      .split(/[,\n]/)
      .map((w) => w.trim())
      .filter(Boolean);
    socket.emit('admin:wall-set-words', { words, token: getAdminToken() || undefined }, (res) => {
      if (res?.success) {
        setWallWordsInput(res.words.join(', '));
        setWallWordsSaved(true);
        setTimeout(() => setWallWordsSaved(false), 2500);
      }
    });
  };

  // Control remoto de audio del Stage (Auditorio)
  const handleStageAudioAction = (
    action: 'play' | 'pause' | 'restart' | 'set-volume' | 'toggle-mute',
    value?: number | boolean
  ) => {
    const payload: any = {
      action,
      token: getAdminToken() || undefined
    };
    if (action === 'set-volume' && typeof value === 'number') {
      payload.volume = value;
    }
    if (action === 'toggle-mute' && typeof value === 'boolean') {
      payload.muted = value;
    }
    socket.emit('admin:set-stage-audio', payload, (res) => {
      if (res?.success && res.audioState) {
        setStageAudio(res.audioState);
      }
    });
  };

  // Control remoto de la vista del Stage (Auditorio)
  const handleSetStageView = (mode: StageViewMode) => {
    socket.emit('admin:set-stage-view', { mode, token: getAdminToken() || undefined }, (res) => {
      if (res?.success && res.mode) {
        setStageViewMode(res.mode);
      }
    });
  };

  // Contingencias
  const handleReboundQuestion = (seconds = 15) => {
    socket.emit('admin:rebound-question', { seconds, token: getAdminToken() || undefined }, (res) => {
      if (!res?.success) {
        alert(res?.error || 'Error al abrir el rebote de la pregunta');
      }
    });
  };

  const handleAdjustPoints = (teamId: string, deltaPoints: number) => {
    socket.emit('admin:adjust-team-points', { teamId, deltaPoints, token: getAdminToken() || undefined }, (res) => {
      if (!res?.success) {
        alert(res?.error || 'Error al ajustar puntos');
      }
    });
  };

  const handleSetExactScore = (teamId: string, score: number) => {
    socket.emit('admin:set-team-score', { teamId, score, token: getAdminToken() || undefined }, (res) => {
      if (!res?.success) {
        alert(res?.error || 'Error al fijar puntaje');
      }
    });
  };

  const handleKickParticipant = (p: Participant) => {
    if (confirm(`¿Expulsar a "${p.name}" del evento? Se desconectará de inmediato.`)) {
      socket.emit('admin:kick-participant', { participantId: p.id, token: getAdminToken() || undefined }, (res) => {
        if (!res?.success) {
          alert(res?.error || 'Error al expulsar al participante');
        }
      });
    }
  };

  const handleTransferCaptain = (p: Participant) => {
    if (!p.teamId) {
      alert('El participante debe estar asignado a un equipo.');
      return;
    }
    if (confirm(`¿Transferir el rol de CAPITÁN a "${p.name}"? Su pulsador se habilitará de inmediato.`)) {
      socket.emit('admin:transfer-captain', { teamId: p.teamId, newCaptainId: p.id, token: getAdminToken() || undefined }, (res) => {
        if (!res?.success) {
          alert(res?.error || 'Error al transferir la capitanía');
        }
      });
    }
  };

  const handleResetEvent = () => {
    if (resetConfirmInput.trim() !== 'RESET') {
      alert('Para confirmar, escribe exactamente RESET en mayúsculas.');
      return;
    }
    setIsResetting(true);
    socket.emit('admin:reset-event', { confirmText: 'RESET', token: getAdminToken() || undefined }, (res) => {
      setIsResetting(false);
      if (res?.success) {
        setShowResetModal(false);
        setResetConfirmInput('');
        alert('Evento reseteado a cero. Equipos y participantes limpios. Banco de preguntas conservado.');
      } else {
        alert(res?.error || 'Error al reiniciar el evento');
      }
    });
  };

  const connectedCount = participants.filter((p) => p.isConnected).length;
  const selectedParticipant = participants.find((p) => p.id === selectedParticipantId);

  // --------------------------------------------------------------------------
  // Vista: Login
  // --------------------------------------------------------------------------
  if (!isAuthenticated) {
    return (
      <div className="adm-login-wrap">
        <div className="adm-login-card">
          <div className="adm-login-brand">
            <img src="/logo-rvc.png" alt="RVC" className="adm-login-logo" />
            <span className="adm-login-kicker">RVC Broadcast</span>
            <h1 className="adm-login-title">Control Room</h1>
            <p className="adm-login-subtitle">Encuentro Juvenil — Panel de Administración</p>
          </div>

          <form onSubmit={handleLogin} className="adm-login-form">
            <div className="adm-form-group">
              <label className="adm-label">Usuario</label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                autoComplete="off"
                placeholder="admin"
                required
                className="adm-input"
              />
            </div>

            <div className="adm-form-group">
              <label className="adm-label">Contraseña</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="new-password"
                placeholder="••••••••"
                required
                className="adm-input"
              />
            </div>

            {loginError && <div className="adm-error-banner">{loginError}</div>}

            <button type="submit" disabled={isLoggingIn} className="adm-btn-primary" style={{ marginTop: '6px' }}>
              {isLoggingIn ? 'Verificando...' : 'Acceder al Panel'}
            </button>
          </form>
        </div>
      </div>
    );
  }

  // --------------------------------------------------------------------------
  // Vista: Panel Principal
  // --------------------------------------------------------------------------
  return (
    <div className="adm-root">
      <div className="adm-layout">
        {/* 1. Header Principal */}
        <header className="adm-header">
          <div className="adm-brand">
            <img src="/logo-rvc.png" alt="RVC" className="adm-brand-logo" />
            <div className="adm-brand-text">
              <span className="adm-kicker">RVC Broadcast Control</span>
              <h1 className="adm-title">Panel de Administración</h1>
            </div>
          </div>

          <div className="adm-header-tools">
            <div className="adm-stat-badge">
              <span className="adm-live-dot" />
              <span>
                Conectados: <strong>{connectedCount}</strong> / {participants.length}
              </span>
            </div>

            <button
              type="button"
              onClick={() => handleStageAudioAction(stageAudio.playing ? 'pause' : 'play')}
              className={stageAudio.playing ? 'adm-btn-primary' : 'adm-btn-subtle'}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                borderColor: stageAudio.playing ? '#35c27d' : undefined,
                background: stageAudio.playing ? 'rgba(53, 194, 125, 0.18)' : undefined,
                color: stageAudio.playing ? '#35c27d' : undefined
              }}
              title={stageAudio.playing ? 'Pausar música del auditorio (/stage)' : 'Reproducir música en el auditorio (/stage)'}
            >
              {stageAudio.playing ? <Volume2 size={14} /> : <VolumeX size={14} />}
              <span>{stageAudio.playing ? 'Audio: En vivo' : 'Audio: Pausado'}</span>
            </button>

            {/* Control rápido de Proyección en Stage */}
            <button
              type="button"
              onClick={() => handleSetStageView(stageViewMode === 'mural' ? 'auto' : 'mural')}
              className={stageViewMode === 'mural' ? 'adm-btn-primary' : 'adm-btn-subtle'}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                borderColor: stageViewMode === 'mural' ? 'var(--primary)' : undefined,
                background: stageViewMode === 'mural' ? 'rgba(255, 90, 31, 0.18)' : undefined,
                color: stageViewMode === 'mural' ? 'var(--primary)' : undefined
              }}
              title={stageViewMode === 'mural' ? 'Auditorio proyectando Mural. Clic para volver a Trivia En Vivo.' : 'Clic para proyectar el Mural 3D en el Auditorio (/stage)'}
            >
              <Tv size={14} />
              <span>{stageViewMode === 'mural' ? 'Mural Proyectado' : 'Proyectar Mural'}</span>
            </button>

            <button type="button" onClick={() => setShowQrModal(true)} className="adm-btn-subtle">
              <QrCode size={15} />
              <span>QR Acceso</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setResetConfirmInput('');
                setShowResetModal(true);
              }}
              title="Reiniciar evento a cero (contingencia)"
              className="adm-btn-danger-outline"
            >
              <AlertTriangle size={14} />
              <span>Reseteo Maestro</span>
            </button>

            <button type="button" onClick={handleLogout} title="Cerrar sesión" className="adm-btn-subtle">
              <LogOut size={14} />
              <span>Salir</span>
            </button>
          </div>
        </header>

        {/* 2. Barra de Navegación de Pestañas */}
        <nav className="adm-nav">
          <button
            type="button"
            onClick={() => setAdminTab('trivia')}
            className={`adm-nav-btn ${adminTab === 'trivia' ? 'active' : ''}`}
          >
            <Gamepad2 size={16} />
            <span>Trivia & Pulsador</span>
          </button>

          <button
            type="button"
            onClick={() => setAdminTab('social')}
            className={`adm-nav-btn ${adminTab === 'social' ? 'active' : ''}`}
          >
            <Camera size={16} />
            <span>Duplas & Mural</span>
            {moderationQueue.filter((m) => !m.isApprovedForMural).length > 0 && (
              <span className="adm-counter-pill alert">
                {moderationQueue.filter((m) => !m.isApprovedForMural).length}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => setAdminTab('messaging')}
            className={`adm-nav-btn ${adminTab === 'messaging' ? 'active' : ''}`}
          >
            <MessageSquare size={16} />
            <span>Mensajería & Roster</span>
            <span className="adm-counter-pill">{participants.length}</span>
          </button>
        </nav>

        {/* ------------------------------------------------------------------
            PESTAÑA 1: TRIVIA & BUZZER
            ------------------------------------------------------------------ */}
        {adminTab === 'trivia' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            {/* Monitor de Transmisión en Vivo */}
            <div className={`adm-monitor ${gameState.buzzerWinner ? 'locked' : ''}`}>
              <div className="adm-monitor-top">
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                  <span
                    className={`adm-status-tag ${
                      gameState.status === 'LOBBY'
                        ? 'lobby'
                        : gameState.status === 'QUESTION_READING'
                        ? 'reading'
                        : gameState.status === 'COUNTDOWN_ACTIVE'
                        ? 'countdown'
                        : gameState.status === 'QUESTION_ACTIVE'
                        ? 'active'
                        : gameState.status === 'BUZZER_LOCKED'
                        ? 'buzzer'
                        : gameState.status === 'SHOWING_RESULT'
                        ? 'result'
                        : 'leaderboard'
                    }`}
                  >
                    {gameState.status === 'QUESTION_READING'
                      ? 'Lectura Previa'
                      : gameState.status === 'COUNTDOWN_ACTIVE'
                      ? `Cuenta Regresiva (${gameState.countdownRemaining ?? 7}s)`
                      : gameState.status === 'QUESTION_ACTIVE'
                      ? 'Pulsador Activo'
                      : gameState.status === 'BUZZER_LOCKED'
                      ? 'Pulsador Bloqueado'
                      : gameState.status === 'SHOWING_RESULT'
                      ? 'Veredicto en Pantalla'
                      : gameState.status === 'LEADERBOARD'
                      ? 'Podio en Pantalla'
                      : 'Lobby / Espera'}
                  </span>

                  {gameState.currentQuestion && (
                    <span className="adm-monitor-meta">
                      Pregunta activa: <strong>{gameState.currentQuestion.points} pts</strong> •{' '}
                      {gameState.currentQuestion.type === 'ORAL_DEFENSE' ? 'Defensa Oral' : 'Opción Múltiple'}
                    </span>
                  )}
                </div>

                <div className="adm-monitor-actions">
                  <button
                    type="button"
                    onClick={handleResetToLobby}
                    className={`adm-btn-subtle ${gameState.status === 'LOBBY' ? 'active' : ''}`}
                    title="Proyectar sala de bienvenida con código QR para que los participantes se unan"
                    style={
                      gameState.status === 'LOBBY'
                        ? { borderColor: 'var(--primary)', color: 'var(--primary)', background: 'rgba(255, 90, 31, 0.12)' }
                        : {}
                    }
                  >
                    <QrCode size={14} />
                    <span>Sala de Espera (QR)</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleShowLeaderboard}
                    className={`adm-btn-subtle ${gameState.status === 'LEADERBOARD' ? 'active' : ''}`}
                    title="Proyectar tabla general de posiciones"
                  >
                    <Trophy size={14} />
                    <span>Proyectar Podio</span>
                  </button>

                  {gameState.currentQuestion && (
                    <button
                      type="button"
                      onClick={() => handleReboundQuestion(15)}
                      title="Reabre el pulsador por 15s para que otro equipo intente responder"
                      className="adm-btn-subtle"
                    >
                      <RotateCcw size={14} />
                      <span>Rebotar (15s)</span>
                    </button>
                  )}

                  {gameState.status !== 'LOBBY' && (
                    <button
                      type="button"
                      onClick={handleCancelQuestion}
                      title="Cancela la pregunta actual y vuelve inmediatamente a la sala de espera"
                      className="adm-btn-danger-outline"
                    >
                      <XCircle size={14} />
                      <span>Cancelar Pregunta</span>
                    </button>
                  )}
                </div>
              </div>

              {/* Banner Informativo y Botón Dar Play en LECTURA PREVIA */}
              {gameState.status === 'QUESTION_READING' && gameState.currentQuestion && (
                <div className="adm-reading-banner">
                  <div className="adm-reading-info">
                    <h4>Pregunta Proyectada para Lectura</h4>
                    <p>
                      "{gameState.currentQuestion.text}" — Los participantes leen el enunciado. Da play para iniciar la
                      cuenta de 7s hacia el pulsador.
                    </p>
                  </div>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button type="button" onClick={() => handleStartCountdown(7)} className="adm-btn-play-countdown">
                      <Play size={15} fill="#fff" />
                      <span>Iniciar Cuenta (7s)</span>
                    </button>
                    <button type="button" onClick={handleCancelQuestion} className="adm-btn-danger-outline">
                      <XCircle size={14} />
                      <span>Cancelar</span>
                    </button>
                  </div>
                </div>
              )}

              {/* Cuenta Regresiva Activa */}
              {gameState.status === 'COUNTDOWN_ACTIVE' && (
                <div className="adm-countdown-box">
                  <span className="adm-countdown-kicker">Cuenta Regresiva Activa</span>
                  <div className="adm-countdown-number">{gameState.countdownRemaining ?? 7}</div>
                  <p style={{ fontSize: '13px', color: 'var(--text-muted)', margin: 0 }}>
                    Al llegar a cero se desbloqueará el pulsador para todos los capitanes simultáneamente.
                  </p>
                </div>
              )}

              {/* Buzzer Reclamado */}
              {gameState.buzzerWinner ? (
                <div className="adm-buzzer-panel">
                  <div className="adm-buzzer-row">
                    <div className="adm-buzzer-team">
                      <div className="adm-buzzer-icon">
                        <Flame size={24} />
                      </div>
                      <div>
                        <div className="adm-kicker" style={{ color: 'var(--primary)', marginBottom: '2px' }}>
                          Pulsador Bloqueado
                        </div>
                        <div className="adm-buzzer-team-name">{gameState.buzzerWinner.teamName}</div>
                        <div className="adm-buzzer-captain">Capitán: {gameState.buzzerWinner.captainName}</div>
                      </div>
                    </div>

                    {gameState.currentQuestion?.type === 'ORAL_DEFENSE' && (
                      <div className="adm-verdict-group">
                        <button
                          type="button"
                          onClick={() => handleGradeDefense('CORRECT')}
                          className="adm-btn-verdict-correct"
                        >
                          <CheckCircle2 size={16} />
                          <span>Correcto (+{gameState.currentQuestion?.points} pts)</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => handleGradeDefense('PARTIAL')}
                          className="adm-btn-verdict-partial"
                        >
                          <Award size={16} />
                          <span>Parcial (+{Math.round((gameState.currentQuestion?.points || 100) / 2)} pts)</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => handleGradeDefense('INCORRECT')}
                          className="adm-btn-verdict-wrong"
                        >
                          <XCircle size={16} />
                          <span>Incorrecto (0 pts)</span>
                        </button>
                      </div>
                    )}
                  </div>

                  {gameState.currentQuestion?.type === 'MULTIPLE_CHOICE' && (
                    <div style={{ padding: '12px 14px', background: '#121417', borderRadius: '3px', fontSize: '13px' }}>
                      {gameState.selectedChoice !== null && gameState.selectedChoice !== undefined ? (
                        <span style={{ color: '#34d399', fontWeight: 600 }}>
                          El capitán seleccionó: Opción {['A', 'B', 'C', 'D'][gameState.selectedChoice]} (
                          {gameState.currentQuestion.options?.[gameState.selectedChoice]})
                        </span>
                      ) : (
                        <span style={{ color: '#fbbf24' }}>
                          El capitán está respondiendo en su pantalla ({gameState.timeRemaining}s restantes)...
                        </span>
                      )}
                    </div>
                  )}
                </div>
              ) : gameState.status === 'QUESTION_ACTIVE' ? (
                <div
                  style={{
                    padding: '16px 18px',
                    background: '#17191d',
                    border: '1px solid rgba(255, 90, 31, 0.3)',
                    borderRadius: '3px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '16px',
                    flexWrap: 'wrap'
                  }}
                >
                  <div>
                    <span className="adm-kicker" style={{ color: 'var(--primary)' }}>
                      Pulsador Activo
                    </span>
                    <div style={{ fontSize: '15px', fontWeight: 700, color: '#fff', marginTop: '4px' }}>
                      "{gameState.currentQuestion?.text}"
                    </div>
                  </div>
                  <div
                    style={{
                      fontFamily: 'var(--font-mono)',
                      fontSize: '24px',
                      fontWeight: 800,
                      color: gameState.timeRemaining <= 5 ? '#f87171' : 'var(--primary)'
                    }}
                  >
                    {gameState.timeRemaining}s
                  </div>
                </div>
              ) : gameState.status === 'SHOWING_RESULT' && gameState.result ? (
                <div
                  style={{
                    padding: '16px 18px',
                    background: '#17191d',
                    border: `1px solid ${gameState.result.grade === 'CORRECT' ? '#10b981' : '#ef4444'}`,
                    borderRadius: '3px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '16px',
                    flexWrap: 'wrap'
                  }}
                >
                  <div>
                    <div style={{ fontSize: '15px', fontWeight: 800, color: '#fff' }}>
                      Veredicto:{' '}
                      {gameState.result.grade === 'CORRECT'
                        ? 'Correcto'
                        : gameState.result.grade === 'PARTIAL'
                        ? 'Parcial'
                        : 'Incorrecto'}
                    </div>
                    <div style={{ fontSize: '13px', color: 'var(--text-muted)', marginTop: '2px' }}>
                      Equipo {gameState.result.teamName} — Puntos asignados: +{gameState.result.pointsAwarded} pts
                    </div>
                  </div>
                  <button type="button" onClick={handleShowLeaderboard} className="adm-btn-subtle">
                    <Trophy size={14} />
                    <span>Ver Podio</span>
                  </button>
                </div>
              ) : (
                <div style={{ textAlign: 'center', padding: '16px', color: 'var(--text-dim)', fontSize: '13px' }}>
                  Sala de espera activa. Selecciona una pregunta del banco a continuación para lanzarla a la pantalla.
                </div>
              )}
            </div>

            {/* Banco de Preguntas */}
            <div>
              <div className="adm-section-header">
                <div>
                  <h2 className="adm-section-title">
                    <Gamepad2 size={18} color="var(--primary)" />
                    Banco de Preguntas ({questions.length})
                  </h2>
                  <p className="adm-section-sub">
                    Lanza preguntas al proyector y habilita los pulsadores de los capitanes.
                  </p>
                </div>

                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                  <button
                    type="button"
                    onClick={handleReloadDefaultQuestions}
                    className="adm-btn-subtle"
                    title="Cargar las 20 preguntas bíblicas difíciles seleccionadas"
                    style={{ background: 'rgba(255, 90, 31, 0.12)', borderColor: 'rgba(255, 90, 31, 0.35)', color: '#ff5a1f' }}
                  >
                    <RotateCcw size={15} />
                    <span>Cargar Banco Bíblico (20)</span>
                  </button>
                  <button type="button" onClick={() => setShowQuestionModal(true)} className="adm-btn-primary">
                    <Plus size={15} />
                    <span>Nueva Pregunta</span>
                  </button>
                </div>
              </div>

              <div className="adm-deck-grid">
                {questions.map((q, idx) => {
                  const isActive = gameState.currentQuestion?.id === q.id;
                  return (
                    <div key={q.id} className={`adm-qcard ${isActive ? 'on-air' : ''}`}>
                      <div>
                        <div className="adm-qcard-top">
                          <span className={`adm-type-pill ${q.type === 'ORAL_DEFENSE' ? 'oral' : 'multiple'}`}>
                            {q.type === 'ORAL_DEFENSE' ? 'Defensa Oral' : 'Opción Múltiple'}
                          </span>
                          <span className="adm-pts-pill">
                            {q.points} pts • {q.timeLimit}s
                          </span>
                        </div>

                        <div className="adm-qcard-body" style={{ marginTop: '10px' }}>
                          <span style={{ color: 'var(--text-dim)', marginRight: '6px' }}>{idx + 1}.</span>
                          {q.text}
                        </div>

                        {q.options && q.options.length > 0 && (
                          <div className="adm-qcard-options">
                            {q.options.map((opt, oIdx) => (
                              <div
                                key={oIdx}
                                className={`adm-qcard-opt-row ${q.correctOptionIndex === oIdx ? 'correct' : ''}`}
                              >
                                <span className="adm-opt-letter">{['A', 'B', 'C', 'D'][oIdx]}.</span>
                                <span>{opt}</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>

                      <button
                        type="button"
                        onClick={() => handleStartQuestion(q.id, q.order, q.text)}
                        disabled={isActive}
                        className={`adm-btn-launch ${isActive ? 'active' : ''}`}
                      >
                        {isActive ? (
                          <span>En Vivo Ahora</span>
                        ) : (
                          <>
                            <Play size={14} />
                            <span>Lanzar Pregunta</span>
                          </>
                        )}
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Equipos, PINs y Ajuste Manual */}
            <div style={{ marginTop: '10px' }}>
              <div className="adm-section-header">
                <div>
                  <h2 className="adm-section-title">
                    <Award size={18} color="var(--primary)" />
                    Equipos & PINs ({teams.length})
                  </h2>
                  <p className="adm-section-sub">
                    Códigos PIN de acceso de 4 dígitos, modificadores rápidos y ajuste manual de puntos (+, -, o fijar puntaje).
                  </p>
                </div>
              </div>

              {teams.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '32px', color: 'var(--text-dim)', fontSize: '14px' }}>
                  Aún no se han registrado equipos en este evento.
                </div>
              ) : (
                <div className="adm-teams-grid">
                  {teams.map((t) => (
                    <div key={t.id} className="adm-team-card">
                      <div className="adm-team-header">
                        <div className="adm-team-identity">
                          {t.avatar && t.avatar.startsWith('data:image') ? (
                            <img src={t.avatar} alt={t.name} className="adm-team-crest" />
                          ) : (
                            <div
                              className="adm-team-crest"
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                background: '#1c1f24',
                                fontSize: '18px'
                              }}
                            >
                              {t.avatar || 'T'}
                            </div>
                          )}
                          <div>
                            <div className="adm-team-name">{t.name}</div>
                            <div className="adm-team-members">
                              {t.memberCount} integrante{t.memberCount !== 1 ? 's' : ''}
                            </div>
                          </div>
                        </div>

                        <div className="adm-pin-tag">
                          <Key size={11} />
                          <span>PIN: {t.pin || '••••'}</span>
                        </div>
                      </div>

                      <div className="adm-score-strip">
                        <span className="adm-score-label">Puntaje Actual</span>
                        <span className="adm-score-val">{t.score} pts</span>
                      </div>

                      <div className="adm-modifiers-row">
                        <button
                          type="button"
                          onClick={() => handleAdjustPoints(t.id, -100)}
                          title="Restar 100 puntos"
                          className="adm-btn-mod minus"
                        >
                          -100
                        </button>
                        <button
                          type="button"
                          onClick={() => handleAdjustPoints(t.id, -50)}
                          title="Restar 50 puntos"
                          className="adm-btn-mod minus"
                        >
                          -50
                        </button>
                        <button
                          type="button"
                          onClick={() => handleAdjustPoints(t.id, 50)}
                          title="Sumar 50 puntos"
                          className="adm-btn-mod plus"
                        >
                          +50
                        </button>
                        <button
                          type="button"
                          onClick={() => handleAdjustPoints(t.id, 100)}
                          title="Sumar 100 puntos"
                          className="adm-btn-mod plus"
                        >
                          +100
                        </button>
                      </div>

                      {/* Control Manual de Puntos (+, -, o Asignar Exacto) */}
                      <div className="adm-manual-pts-box">
                        <div className="adm-manual-pts-header">
                          <span className="adm-manual-pts-title">Ajuste Manual Personalizado</span>
                          {manualPoints[t.id] && (
                            <button
                              type="button"
                              onClick={() => setManualPoints((prev) => ({ ...prev, [t.id]: '' }))}
                              className="adm-manual-pts-clear"
                              title="Limpiar campo"
                            >
                              ✕ Limpiar
                            </button>
                          )}
                        </div>

                        <div className="adm-manual-pts-input-row">
                          <input
                            type="number"
                            min="0"
                            placeholder="Pts (ej: 25, 150...)"
                            value={manualPoints[t.id] ?? ''}
                            onChange={(e) => {
                              const val = e.target.value;
                              setManualPoints((prev) => ({ ...prev, [t.id]: val }));
                            }}
                            className="adm-manual-pts-input"
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                const pts = parseInt(manualPoints[t.id] || '', 10);
                                if (!isNaN(pts) && pts > 0) {
                                  handleAdjustPoints(t.id, pts);
                                  setManualPoints((prev) => ({ ...prev, [t.id]: '' }));
                                }
                              }
                            }}
                          />
                        </div>

                        <div className="adm-manual-pts-actions">
                          <button
                            type="button"
                            onClick={() => {
                              const pts = parseInt(manualPoints[t.id] || '', 10);
                              if (isNaN(pts) || pts <= 0) {
                                alert('Ingresa una cantidad mayor a 0 para quitar');
                                return;
                              }
                              handleAdjustPoints(t.id, -pts);
                              setManualPoints((prev) => ({ ...prev, [t.id]: '' }));
                            }}
                            title={`Quitar ${manualPoints[t.id] || 'X'} puntos`}
                            className="adm-manual-btn minus"
                          >
                            <Minus size={11} />
                            <span>Quitar</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => {
                              const pts = parseInt(manualPoints[t.id] || '', 10);
                              if (isNaN(pts) || pts <= 0) {
                                alert('Ingresa una cantidad mayor a 0 para adicionar');
                                return;
                              }
                              handleAdjustPoints(t.id, pts);
                              setManualPoints((prev) => ({ ...prev, [t.id]: '' }));
                            }}
                            title={`Adicionar ${manualPoints[t.id] || 'X'} puntos`}
                            className="adm-manual-btn plus"
                          >
                            <Plus size={11} />
                            <span>Adicionar</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => {
                              const pts = parseInt(manualPoints[t.id] || '', 10);
                              if (isNaN(pts) || pts < 0) {
                                alert('Ingresa un número (0 o mayor) para fijar el puntaje total');
                                return;
                              }
                              if (confirm(`¿Asignar un puntaje total fijo de ${pts} pts a "${t.name}"?`)) {
                                handleSetExactScore(t.id, pts);
                                setManualPoints((prev) => ({ ...prev, [t.id]: '' }));
                              }
                            }}
                            title={`Fijar puntaje total exactamente a ${manualPoints[t.id] || 'X'} puntos`}
                            className="adm-manual-btn set"
                          >
                            <Target size={11} />
                            <span>Asignar</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ------------------------------------------------------------------
            PESTAÑA 2: DUPLAS & MURAL SOCIAL
            ------------------------------------------------------------------ */}
        {adminTab === 'social' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <div className="adm-social-bar">
              <div className="adm-social-info">
                <h3>Dinámica de Integración en Duplas</h3>
                <p>
                  Empareja a los participantes de equipos diferentes para que se conozcan y compartan selfies en el
                  mural.
                </p>
              </div>

              <div className="adm-social-btns">
                <button
                  type="button"
                  onClick={handleStartPairings}
                  disabled={isStartingPairings}
                  className="adm-btn-primary"
                >
                  <Users size={16} />
                  <span>{isStartingPairings ? 'Emparejando...' : 'Iniciar Emparejamiento'}</span>
                </button>

                <button
                  type="button"
                  onClick={handleToggleChat}
                  className={chatEnabled ? 'adm-btn-danger-outline' : 'adm-btn-subtle'}
                >
                  {chatEnabled ? 'Pausar Chat' : 'Habilitar Chat'}
                </button>
              </div>
            </div>

            {/* Consola de Control de Proyección del Stage (Auditorio) */}
            <div
              className="adm-panel-card"
              style={{
                padding: '18px 20px',
                borderLeft: '4px solid #3b82f6',
                background: 'linear-gradient(135deg, rgba(59, 130, 246, 0.05) 0%, rgba(18, 20, 23, 0.95) 100%)'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px', flexWrap: 'wrap' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                  <div
                    style={{
                      width: '44px',
                      height: '44px',
                      borderRadius: '8px',
                      background: stageViewMode === 'mural' ? 'rgba(255, 90, 31, 0.2)' : 'rgba(59, 130, 246, 0.15)',
                      border: `1px solid ${stageViewMode === 'mural' ? 'var(--primary)' : 'rgba(59, 130, 246, 0.3)'}`,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: stageViewMode === 'mural' ? 'var(--primary)' : '#60a5fa',
                      flexShrink: 0
                    }}
                  >
                    <Tv size={22} />
                  </div>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                      <h3 style={{ fontSize: '15px', fontWeight: 700, margin: 0, color: '#fff' }}>
                        Proyección en Auditorio (/stage)
                      </h3>
                      <span
                        style={{
                          padding: '2px 8px',
                          borderRadius: '999px',
                          fontSize: '11px',
                          fontWeight: 700,
                          background: stageViewMode === 'mural' ? 'rgba(255, 90, 31, 0.2)' : 'rgba(59, 130, 246, 0.2)',
                          color: stageViewMode === 'mural' ? 'var(--primary)' : '#60a5fa',
                          border: `1px solid ${stageViewMode === 'mural' ? 'rgba(255, 90, 31, 0.4)' : 'rgba(59, 130, 246, 0.4)'}`
                        }}
                      >
                        {stageViewMode === 'mural'
                          ? '● Proyectando Mural 3D'
                          : stageViewMode === 'lobby'
                          ? '● Proyectando Sala QR'
                          : stageViewMode === 'leaderboard'
                          ? '● Proyectando Clasificación'
                          : '● Modo En Vivo (Auto)'}
                      </span>
                    </div>
                    <p style={{ margin: '3px 0 0', fontSize: '12px', color: 'var(--text-dim)' }}>
                      Controla en tiempo real qué se proyecta en la pantalla gigante del auditorio.
                    </p>
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                  <button
                    type="button"
                    onClick={() => handleSetStageView('mural')}
                    className={stageViewMode === 'mural' ? 'adm-btn-primary' : 'adm-btn-subtle'}
                    style={{
                      padding: '8px 14px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      boxShadow: stageViewMode === 'mural' ? '0 0 16px rgba(255, 90, 31, 0.4)' : undefined
                    }}
                    title="Proyectar el mural de integración 3D y muro de mensajes en vivo"
                  >
                    <Camera size={15} />
                    <span>Proyectar Mural 3D</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleSetStageView('auto')}
                    className={stageViewMode === 'auto' ? 'adm-btn-primary' : 'adm-btn-subtle'}
                    style={{ padding: '8px 12px', display: 'flex', alignItems: 'center', gap: '6px' }}
                    title="Modo automático: Sigue las preguntas, temporizadores y resultados de trivia"
                  >
                    <Gamepad2 size={15} />
                    <span>En Vivo (Auto)</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleSetStageView('lobby')}
                    className={stageViewMode === 'lobby' ? 'adm-btn-primary' : 'adm-btn-subtle'}
                    style={{ padding: '8px 12px', display: 'flex', alignItems: 'center', gap: '6px' }}
                    title="Proyectar la sala de bienvenida con código QR de acceso"
                  >
                    <QrCode size={15} />
                    <span>Sala QR</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleSetStageView('leaderboard')}
                    className={stageViewMode === 'leaderboard' ? 'adm-btn-primary' : 'adm-btn-subtle'}
                    style={{ padding: '8px 12px', display: 'flex', alignItems: 'center', gap: '6px' }}
                    title="Proyectar podio y tabla general de posiciones"
                  >
                    <Trophy size={15} />
                    <span>Clasificación</span>
                  </button>

                  <a
                    href="/stage"
                    target="_blank"
                    rel="noreferrer"
                    className="adm-btn-subtle"
                    style={{ padding: '8px 10px', display: 'flex', alignItems: 'center', gap: '4px', textDecoration: 'none' }}
                    title="Abrir la pantalla del auditorio en otra pestaña"
                  >
                    <ExternalLink size={14} />
                    <span>Abrir Stage</span>
                  </a>
                </div>
              </div>
            </div>

            {/* Consola de Control de Audio del Stage (Auditorio) */}
            <div
              className="adm-panel-card"
              style={{
                padding: '18px 20px',
                borderLeft: '4px solid var(--primary)',
                background: 'linear-gradient(135deg, rgba(255, 90, 31, 0.04) 0%, rgba(18, 20, 23, 0.95) 100%)'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px', flexWrap: 'wrap' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                  <div
                    style={{
                      width: '44px',
                      height: '44px',
                      borderRadius: '8px',
                      background: stageAudio.playing ? 'rgba(53, 194, 125, 0.15)' : 'rgba(255, 90, 31, 0.15)',
                      border: `1px solid ${stageAudio.playing ? '#35c27d' : 'rgba(255, 90, 31, 0.3)'}`,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: stageAudio.playing ? '#35c27d' : 'var(--primary)',
                      flexShrink: 0
                    }}
                  >
                    <Music size={22} />
                  </div>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                      <h3 style={{ fontSize: '15px', fontWeight: 700, margin: 0, color: '#fff' }}>
                        Pista de Audio en Vivo (/stage)
                      </h3>
                      <span
                        style={{
                          padding: '2px 8px',
                          borderRadius: '999px',
                          fontSize: '11px',
                          fontWeight: 700,
                          background: stageAudio.playing ? 'rgba(53, 194, 125, 0.2)' : 'rgba(255, 255, 255, 0.08)',
                          color: stageAudio.playing ? '#35c27d' : 'var(--text-dim)',
                          border: `1px solid ${stageAudio.playing ? 'rgba(53, 194, 125, 0.4)' : 'rgba(255, 255, 255, 0.1)'}`
                        }}
                      >
                        {stageAudio.playing ? '● Sonando en Auditorio' : 'Pausado'}
                      </span>
                    </div>
                    <p style={{ margin: '3px 0 0', fontSize: '12px', color: 'var(--text-dim)' }}>
                      🎵 {stageAudio.trackTitle}
                    </p>
                  </div>
                </div>

                {/* Controles interactivos: Play, Pausa, Reinicio, Mute y Volumen */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                  {!stageAudio.playing ? (
                    <button
                      type="button"
                      onClick={() => handleStageAudioAction('play')}
                      className="adm-btn-primary"
                      style={{ padding: '8px 16px', display: 'flex', alignItems: 'center', gap: '6px' }}
                    >
                      <Play size={16} />
                      <span>Play en Stage</span>
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => handleStageAudioAction('pause')}
                      className="adm-btn-danger-outline"
                      style={{ padding: '8px 16px', display: 'flex', alignItems: 'center', gap: '6px' }}
                    >
                      <Pause size={16} />
                      <span>Pausar</span>
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={() => handleStageAudioAction('restart')}
                    className="adm-btn-subtle"
                    title="Reiniciar pista desde el segundo 0"
                    style={{ padding: '8px 12px', display: 'flex', alignItems: 'center', gap: '6px' }}
                  >
                    <RotateCcw size={14} />
                    <span>Inicio</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleStageAudioAction('toggle-mute')}
                    className={stageAudio.muted ? 'adm-btn-danger-outline' : 'adm-btn-subtle'}
                    title={stageAudio.muted ? 'Reactivar sonido en Stage' : 'Silenciar sonido en Stage'}
                    style={{ padding: '8px 12px', display: 'flex', alignItems: 'center', gap: '6px' }}
                  >
                    {stageAudio.muted ? <VolumeX size={15} /> : <Volume2 size={15} />}
                    <span>{stageAudio.muted ? 'Silenciado' : 'Mute'}</span>
                  </button>

                  {/* Slider de volumen sincronizado */}
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      background: 'rgba(255,255,255,0.04)',
                      padding: '6px 12px',
                      borderRadius: '4px',
                      border: '1px solid var(--border-subtle)'
                    }}
                  >
                    <Volume2 size={14} color="var(--text-dim)" />
                    <input
                      type="range"
                      min="0"
                      max="100"
                      value={stageAudio.muted ? 0 : Math.round(stageAudio.volume * 100)}
                      onChange={(e) => handleStageAudioAction('set-volume', Number(e.target.value) / 100)}
                      style={{ width: '90px', cursor: 'pointer', accentColor: 'var(--primary)' }}
                      title={`Volumen del Stage: ${Math.round(stageAudio.volume * 100)}%`}
                    />
                    <span style={{ fontSize: '12px', fontWeight: 700, minWidth: '32px', textAlign: 'right', color: '#fff' }}>
                      {stageAudio.muted ? '0%' : `${Math.round(stageAudio.volume * 100)}%`}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Muro de mensajes en vivo (carriles laterales del carrusel en /stage) */}
            <div className="adm-panel-card" style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div className="adm-section-header" style={{ marginBottom: 0 }}>
                <div>
                  <h2 className="adm-section-title">
                    <MessageSquare size={18} color="var(--primary)" />
                    Muro en vivo del Stage
                  </h2>
                  <p className="adm-section-sub">
                    Los mensajes de los jóvenes se proyectan a los costados del carrusel. El filtro automático retiene
                    el lenguaje ofensivo; tú puedes ocultar cualquier mensaje al instante.
                  </p>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                  <div className="adm-stat-badge">
                    En pantalla: <strong>{wallItems.filter((m) => m.onWall).length}</strong>
                  </div>
                  <div className="adm-stat-badge">
                    Retenidos: <strong>{wallItems.filter((m) => m.flagged && !m.approved).length}</strong>
                  </div>
                  <button
                    type="button"
                    onClick={handleWallToggle}
                    className={wallEnabled ? 'adm-btn-danger-outline' : 'adm-btn-primary'}
                    title="Apaga o enciende todo el muro de mensajes en el proyector"
                  >
                    {wallEnabled ? 'Apagar Muro' : 'Encender Muro'}
                  </button>
                </div>
              </div>

              <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
                <input
                  className="adm-input"
                  style={{ flex: 1, minWidth: '220px' }}
                  value={wallWordsInput}
                  onChange={(e) => setWallWordsInput(e.target.value)}
                  placeholder="Palabras extra a bloquear, separadas por coma (ej. tonto, feo)"
                />
                <button type="button" onClick={handleWallSaveWords} className="adm-btn-subtle">
                  <ShieldAlert size={14} />
                  <span>{wallWordsSaved ? 'Guardado ✓' : 'Guardar lista'}</span>
                </button>
              </div>

              {wallItems.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '28px', color: 'var(--text-dim)', fontSize: '14px' }}>
                  Aún no hay mensajes. Aparecerán aquí en cuanto las duplas empiecen a chatear.
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', maxHeight: '380px', overflowY: 'auto' }}>
                  {wallItems.map((m) => {
                    const status = m.hidden
                      ? { label: 'Oculto', color: '#9aa0a6' }
                      : m.flagged && !m.approved
                      ? { label: 'Retenido por filtro', color: '#ff5a1f' }
                      : m.flagged && m.approved
                      ? { label: 'Permitido por ti', color: '#35c27d' }
                      : { label: 'En pantalla', color: '#35c27d' };
                    return (
                      <div
                        key={m.id}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          gap: '12px',
                          padding: '10px 12px',
                          border: '1px solid var(--border-subtle)',
                          borderLeft: `3px solid ${status.color}`,
                          borderRadius: '4px',
                          background: m.onWall ? 'rgba(53, 194, 125, 0.05)' : 'rgba(255,255,255,0.02)'
                        }}
                      >
                        <div style={{ minWidth: 0, flex: 1 }}>
                          <div style={{ fontSize: '12px', color: 'var(--text-dim)', marginBottom: '2px' }}>
                            <strong style={{ color: '#fff' }}>{m.senderName}</strong> · {m.senderTeamName} ·{' '}
                            {new Date(m.sentAt).toLocaleTimeString()} ·{' '}
                            <span style={{ color: status.color, fontWeight: 700 }}>{status.label}</span>
                          </div>
                          <div style={{ fontSize: '14px', overflowWrap: 'anywhere' }}>{m.content}</div>
                        </div>

                        <div style={{ display: 'flex', gap: '6px', flexShrink: 0 }}>
                          {m.flagged && !m.approved && !m.hidden && (
                            <button
                              type="button"
                              onClick={() => handleWallApprove(m.id, true)}
                              className="adm-btn-subtle"
                              title="Mostrar este mensaje aunque el filtro lo haya retenido"
                            >
                              <CheckCircle2 size={14} />
                              <span>Permitir</span>
                            </button>
                          )}
                          {m.hidden ? (
                            <button type="button" onClick={() => handleWallHide(m.id, false)} className="adm-btn-subtle">
                              <span>Restaurar</span>
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={() => handleWallHide(m.id, true)}
                              className="adm-btn-danger-outline"
                              title="Retirar este mensaje del muro ahora mismo"
                            >
                              <XCircle size={14} />
                              <span>Ocultar</span>
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div>
              <div className="adm-section-header">
                <div>
                  <h2 className="adm-section-title">
                    <Camera size={18} color="var(--primary)" />
                    Bandeja de Moderación ({moderationQueue.length})
                  </h2>
                  <p className="adm-section-sub">
                    Aprueba las fotos enviadas por las duplas para que se proyecten en el carrusel 3D del auditorio.
                  </p>
                </div>

                <div className="adm-stat-badge">
                  Aprobadas en Mural: <strong>{moderationQueue.filter((m) => m.isApprovedForMural).length}</strong>
                </div>
              </div>

              {moderationQueue.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '48px', color: 'var(--text-dim)', fontSize: '14px' }}>
                  No hay fotografías pendientes de moderación en este momento.
                </div>
              ) : (
                <div className="adm-mod-grid">
                  {moderationQueue.map((m) => (
                    <div key={m.id} className={`adm-mod-card ${m.isApprovedForMural ? 'approved' : ''}`}>
                      <div>
                        {m.photoUrl ? (
                          <div className="adm-mod-photo-wrap">
                            <img src={m.photoUrl} alt="Foto dupla" />
                            <span className={`adm-mod-badge ${m.isApprovedForMural ? 'live' : 'pending'}`}>
                              {m.isApprovedForMural ? 'En Mural' : 'Pendiente'}
                            </span>
                          </div>
                        ) : (
                          <div style={{ padding: '24px', textAlign: 'center', color: 'var(--text-dim)' }}>
                            Sin fotografía
                          </div>
                        )}

                        <div className="adm-mod-details">
                          <div className="adm-mod-sender">
                            {m.senderName} <span>({m.senderTeamName})</span>
                          </div>
                          {m.content && <div className="adm-mod-caption">"{m.content}"</div>}
                          <div className="adm-mod-time">{new Date(m.sentAt).toLocaleTimeString()}</div>
                        </div>
                      </div>

                      <div className="adm-mod-footer">
                        {!m.isApprovedForMural ? (
                          <button
                            type="button"
                            onClick={() => handleModeratePhoto(m.id, true)}
                            className="adm-btn-primary"
                            style={{ width: '100%', padding: '8px' }}
                          >
                            <CheckCircle2 size={14} />
                            <span>Aprobar para Mural</span>
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => handleModeratePhoto(m.id, false)}
                            className="adm-btn-danger-outline"
                            style={{ width: '100%', justifyContent: 'center' }}
                          >
                            <XCircle size={14} />
                            <span>Retirar del Mural</span>
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ------------------------------------------------------------------
            PESTAÑA 3: MENSAJERÍA & ROSTER
            ------------------------------------------------------------------ */}
        {adminTab === 'messaging' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <div className="adm-messaging-split">
              {/* Roster de Participantes */}
              <div className="adm-panel-card">
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px' }}>
                  <h3 className="adm-section-title" style={{ fontSize: '15px' }}>
                    <Users size={16} color="var(--primary)" />
                    Participantes ({participants.length})
                  </h3>

                  <button
                    type="button"
                    onClick={() => {
                      setRecipientType('ALL');
                      setSelectedParticipantId('');
                    }}
                    className={recipientType === 'ALL' ? 'adm-btn-primary' : 'adm-btn-subtle'}
                    style={{ padding: '4px 10px', fontSize: '11px' }}
                  >
                    Seleccionar Todos
                  </button>
                </div>

                {participants.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '32px', color: 'var(--text-dim)', fontSize: '13px' }}>
                    No hay participantes registrados todavía.
                  </div>
                ) : (
                  <div className="adm-roster-list">
                    {participants.map((p) => {
                      const isSelected = recipientType === 'PARTICIPANT' && selectedParticipantId === p.id;
                      const teamObj = teams.find((t) => t.id === p.teamId) || p.team;
                      const isCaptain = p.role === 'CAPTAIN';

                      return (
                        <div
                          key={p.id}
                          onClick={() => {
                            setRecipientType('PARTICIPANT');
                            setSelectedParticipantId(p.id);
                          }}
                          className={`adm-roster-row ${isSelected ? 'selected' : ''}`}
                        >
                          <div className="adm-roster-info">
                            <span className={`adm-dot ${p.isConnected ? 'online' : 'offline'}`} />
                            <div style={{ minWidth: 0 }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                <span className="adm-roster-name">{p.name}</span>
                                <span className={`adm-role-tag ${isCaptain ? 'captain' : 'member'}`}>
                                  {isCaptain ? 'Capitán' : 'Miembro'}
                                </span>
                              </div>
                              <div className="adm-roster-sub">
                                <span>{teamObj?.name || 'Sin equipo'}</span>
                                {teamObj?.pin && <span>• PIN: {teamObj.pin}</span>}
                              </div>
                            </div>
                          </div>

                          <div className="adm-roster-actions">
                            {!isCaptain && p.teamId && (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleTransferCaptain(p);
                                }}
                                title="Transferir capitanía a este participante"
                                className="adm-btn-subtle"
                                style={{ padding: '4px 6px' }}
                              >
                                <Crown size={12} color="#fbbf24" />
                              </button>
                            )}

                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleKickParticipant(p);
                              }}
                              title="Expulsar participante"
                              className="adm-btn-subtle"
                              style={{ padding: '4px 6px', color: '#f87171' }}
                            >
                              <UserMinus size={12} />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Editor de Mensajes */}
              <div className="adm-panel-card">
                <h3 className="adm-section-title" style={{ fontSize: '15px' }}>
                  <Send size={16} color="var(--primary)" />
                  Transmisor de Mensajes
                </h3>

                <div className="adm-form-group">
                  <label className="adm-label">Destinatario</label>
                  <select
                    value={recipientType === 'ALL' ? 'ALL' : selectedParticipantId}
                    onChange={(e) => {
                      const val = e.target.value;
                      if (val === 'ALL') {
                        setRecipientType('ALL');
                        setSelectedParticipantId('');
                      } else {
                        setRecipientType('PARTICIPANT');
                        setSelectedParticipantId(val);
                      }
                    }}
                    className="adm-input"
                  >
                    <option value="ALL">Todos los conectados ({connectedCount})</option>
                    {participants.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.isConnected ? '●' : '○'} {p.name} {p.isConnected ? '(En línea)' : '(Desconectado)'}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="adm-form-group">
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <label className="adm-label">Plantillas Rápidas</label>
                    <button
                      type="button"
                      onClick={openNewTemplateModal}
                      className="adm-btn-subtle"
                      style={{ padding: '2px 8px', fontSize: '11px' }}
                    >
                      <Plus size={12} />
                      <span>Nueva</span>
                    </button>
                  </div>

                  <div className="adm-templates-wrap">
                    {templates.map((tmpl) => (
                      <div key={tmpl.id} style={{ display: 'inline-flex', alignItems: 'center' }}>
                        <button
                          type="button"
                          onClick={() => handleUseTemplate(tmpl)}
                          className="adm-template-btn"
                          title="Cargar en el editor"
                        >
                          {tmpl.name}
                        </button>
                        <button
                          type="button"
                          onClick={() => openEditTemplateModal(tmpl)}
                          className="adm-btn-subtle"
                          style={{ padding: '5px 6px', borderLeft: 'none' }}
                        >
                          <Edit2 size={11} />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteTemplate(tmpl.id, tmpl.name)}
                          className="adm-btn-subtle"
                          style={{ padding: '5px 6px', borderLeft: 'none', color: '#f87171' }}
                        >
                          <Trash2 size={11} />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="adm-form-group">
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <label className="adm-label">Contenido del Mensaje</label>
                    <span style={{ fontSize: '11px', color: 'var(--text-dim)', fontFamily: 'var(--font-mono)' }}>
                      {'{nombre}'} para nombre personalizado
                    </span>
                  </div>
                  <textarea
                    rows={4}
                    value={messageContent}
                    onChange={(e) => setMessageContent(e.target.value)}
                    placeholder="Escribe el mensaje..."
                    className="adm-input"
                    style={{ resize: 'vertical' }}
                  />
                </div>

                {sendSuccessMsg && (
                  <div
                    style={{
                      padding: '8px 12px',
                      background: 'rgba(16, 185, 129, 0.12)',
                      border: '1px solid rgba(16, 185, 129, 0.35)',
                      borderRadius: '3px',
                      color: '#34d399',
                      fontSize: '12px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px'
                    }}
                  >
                    <CheckCircle size={14} />
                    <span>{sendSuccessMsg}</span>
                  </div>
                )}

                <button
                  type="button"
                  onClick={handleSendMessage}
                  disabled={isSending || !messageContent.trim()}
                  className="adm-btn-primary"
                >
                  <Send size={15} />
                  <span>
                    {isSending
                      ? 'Transmitiendo...'
                      : recipientType === 'ALL'
                      ? 'Enviar a Todos'
                      : `Enviar a ${selectedParticipant?.name || 'Destinatario'}`}
                  </span>
                </button>
              </div>
            </div>

            {/* Historial en Vivo */}
            <div className="adm-panel-card">
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <h3 className="adm-section-title" style={{ fontSize: '15px' }}>
                  <Clock size={16} color="var(--primary)" />
                  Historial de Transmisiones ({history.length})
                </h3>
              </div>

              {history.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '24px', color: 'var(--text-dim)', fontSize: '13px' }}>
                  No se han transmitido mensajes en esta sesión.
                </div>
              ) : (
                <div className="adm-history-list">
                  {history.map((log) => (
                    <div key={log.id} className="adm-history-item">
                      <div className="adm-history-meta">
                        <span>{new Date(log.sentAt).toLocaleTimeString()}</span>
                        <span>•</span>
                        <strong>{log.recipientType === 'ALL' ? 'Todos' : log.recipientName || 'Individual'}</strong>
                      </div>
                      <div className="adm-history-content">"{log.content}"</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ------------------------------------------------------------------
            MODAL: CÓDIGO QR
            ------------------------------------------------------------------ */}
        {showQrModal && (
          <div className="adm-modal-backdrop">
            <div className="adm-modal-panel">
              <div className="adm-modal-header">
                <h3 className="adm-modal-title">Código QR de Participación</h3>
                <button type="button" onClick={() => setShowQrModal(false)} className="adm-modal-close">
                  <X size={18} />
                </button>
              </div>

              <p style={{ fontSize: '13px', color: 'var(--text-muted)', margin: 0 }}>
                Escanea con la cámara de tu smartphone para acceder directamente a la pantalla de juego.
              </p>

              <div className="adm-qr-box">
                <QRCodeSVG value={qrUrl} size={220} />
              </div>

              <div className="adm-form-group">
                <label className="adm-label">URL de Enlace</label>
                <input
                  type="text"
                  value={qrUrl}
                  onChange={(e) => setQrUrl(e.target.value)}
                  className="adm-input"
                  style={{ textAlign: 'center' }}
                />
              </div>

              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard.writeText(qrUrl);
                    alert('Enlace copiado al portapapeles');
                  }}
                  className="adm-btn-subtle"
                  style={{ flex: 1, justifyContent: 'center' }}
                >
                  Copiar Enlace
                </button>
                <button
                  type="button"
                  onClick={() => window.open(qrUrl, '_blank')}
                  className="adm-btn-primary"
                  style={{ flex: 1 }}
                >
                  <ExternalLink size={14} />
                  <span>Abrir Pestaña</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ------------------------------------------------------------------
            MODAL: CREAR / EDITAR PLANTILLA
            ------------------------------------------------------------------ */}
        {showTemplateModal && (
          <div className="adm-modal-backdrop">
            <div className="adm-modal-panel">
              <div className="adm-modal-header">
                <h3 className="adm-modal-title">{editingTemplate ? 'Editar Plantilla' : 'Nueva Plantilla'}</h3>
                <button type="button" onClick={() => setShowTemplateModal(false)} className="adm-modal-close">
                  <X size={18} />
                </button>
              </div>

              <form onSubmit={handleSaveTemplate} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <div className="adm-form-group">
                  <label className="adm-label">Título de la Plantilla</label>
                  <input
                    type="text"
                    value={templateName}
                    onChange={(e) => setTemplateName(e.target.value)}
                    placeholder="Bienvenida personalizada"
                    required
                    className="adm-input"
                  />
                </div>

                <div className="adm-form-group">
                  <label className="adm-label">Contenido (soporta {'{nombre}'})</label>
                  <textarea
                    rows={4}
                    value={templateBody}
                    onChange={(e) => setTemplateBody(e.target.value)}
                    placeholder="Hola {nombre}, estamos listos para comenzar..."
                    required
                    className="adm-input"
                  />
                </div>

                <div style={{ display: 'flex', gap: '8px', marginTop: '6px' }}>
                  <button
                    type="button"
                    onClick={() => setShowTemplateModal(false)}
                    className="adm-btn-subtle"
                    style={{ flex: 1, justifyContent: 'center' }}
                  >
                    Cancelar
                  </button>
                  <button type="submit" className="adm-btn-primary" style={{ flex: 1 }}>
                    Guardar
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* ------------------------------------------------------------------
            MODAL: CREAR PREGUNTA DE TRIVIA
            ------------------------------------------------------------------ */}
        {showQuestionModal && (
          <div className="adm-modal-backdrop">
            <div className="adm-modal-panel">
              <div className="adm-modal-header">
                <h3 className="adm-modal-title">Nueva Pregunta de Trivia</h3>
                <button type="button" onClick={() => setShowQuestionModal(false)} className="adm-modal-close">
                  <X size={18} />
                </button>
              </div>

              <form onSubmit={handleCreateQuestion} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <div className="adm-form-group">
                  <label className="adm-label">Texto de la Pregunta</label>
                  <textarea
                    rows={3}
                    value={newQuestionText}
                    onChange={(e) => setNewQuestionText(e.target.value)}
                    placeholder="Enunciado de la pregunta..."
                    required
                    className="adm-input"
                  />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div className="adm-form-group">
                    <label className="adm-label">Modalidad</label>
                    <select
                      value={newQuestionType}
                      onChange={(e) => setNewQuestionType(e.target.value as QuestionType)}
                      className="adm-input"
                    >
                      <option value="ORAL_DEFENSE">Defensa Oral</option>
                      <option value="MULTIPLE_CHOICE">Opción Múltiple</option>
                    </select>
                  </div>

                  <div className="adm-form-group">
                    <label className="adm-label">Puntos</label>
                    <input
                      type="number"
                      value={newQuestionPoints}
                      onChange={(e) => setNewQuestionPoints(Number(e.target.value))}
                      min={10}
                      step={10}
                      className="adm-input"
                    />
                  </div>
                </div>

                <div className="adm-form-group">
                  <label className="adm-label">Tiempo Límite (segundos)</label>
                  <input
                    type="number"
                    value={newQuestionTime}
                    onChange={(e) => setNewQuestionTime(Number(e.target.value))}
                    min={5}
                    max={120}
                    className="adm-input"
                  />
                </div>

                {newQuestionType === 'MULTIPLE_CHOICE' && (
                  <div className="adm-form-group">
                    <label className="adm-label">Opciones y Respuesta Correcta</label>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '4px' }}>
                      {[
                        { label: 'A', val: newOptionA, setVal: setNewOptionA, idx: 0 },
                        { label: 'B', val: newOptionB, setVal: setNewOptionB, idx: 1 },
                        { label: 'C', val: newOptionC, setVal: setNewOptionC, idx: 2 },
                        { label: 'D', val: newOptionD, setVal: setNewOptionD, idx: 3 }
                      ].map((opt) => (
                        <div key={opt.label} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <input
                            type="radio"
                            name="correctOpt"
                            checked={newCorrectOptionIndex === opt.idx}
                            onChange={() => setNewCorrectOptionIndex(opt.idx)}
                            title="Marcar como correcta"
                            style={{ accentColor: 'var(--primary)' }}
                          />
                          <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, width: '18px' }}>
                            {opt.label}.
                          </span>
                          <input
                            type="text"
                            value={opt.val}
                            onChange={(e) => opt.setVal(e.target.value)}
                            placeholder={`Opción ${opt.label}`}
                            required={opt.idx < 2}
                            className="adm-input"
                            style={{ padding: '8px 10px' }}
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
                  <button
                    type="button"
                    onClick={() => setShowQuestionModal(false)}
                    className="adm-btn-subtle"
                    style={{ flex: 1, justifyContent: 'center' }}
                  >
                    Cancelar
                  </button>
                  <button type="submit" className="adm-btn-primary" style={{ flex: 1 }}>
                    Guardar Pregunta
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* ------------------------------------------------------------------
            MODAL: RESETEO MAESTRO DEL EVENTO (SEGURIDAD CRÍTICA)
            ------------------------------------------------------------------ */}
        {showResetModal && (
          <div className="adm-modal-backdrop">
            <div className="adm-modal-panel danger">
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div
                  style={{
                    width: '42px',
                    height: '42px',
                    borderRadius: '3px',
                    background: 'rgba(239, 68, 68, 0.15)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#f87171'
                  }}
                >
                  <ShieldAlert size={24} />
                </div>
                <div>
                  <h3 className="adm-modal-title" style={{ color: '#ef4444' }}>
                    Reseteo Maestro del Evento
                  </h3>
                  <span style={{ fontSize: '11px', color: 'var(--text-dim)', textTransform: 'uppercase' }}>
                    Operación Crítica de Contingencia
                  </span>
                </div>
              </div>

              <div
                style={{
                  padding: '12px 14px',
                  background: 'rgba(239, 68, 68, 0.1)',
                  border: '1px solid rgba(239, 68, 68, 0.25)',
                  borderRadius: '3px',
                  fontSize: '13px',
                  color: '#fca5a5',
                  lineHeight: 1.5
                }}
              >
                <strong>ADVERTENCIA:</strong> Esta acción borrará inmediatamente:
                <ul style={{ margin: '6px 0 0 16px', padding: 0 }}>
                  <li>Participantes conectados y registrados</li>
                  <li>Equipos formados y puntuaciones acumuladas</li>
                  <li>Duplas y chats generados</li>
                </ul>
                <div style={{ marginTop: '8px', color: '#34d399', fontWeight: 600 }}>
                  ✓ El banco de preguntas y plantillas NO se borrarán.
                </div>
              </div>

              <div className="adm-form-group">
                <label className="adm-label">
                  Escribe <strong style={{ color: '#ef4444' }}>RESET</strong> para confirmar:
                </label>
                <input
                  type="text"
                  value={resetConfirmInput}
                  onChange={(e) => setResetConfirmInput(e.target.value.toUpperCase())}
                  placeholder="RESET"
                  className="adm-input"
                  style={{
                    textAlign: 'center',
                    fontFamily: 'var(--font-mono)',
                    fontWeight: 800,
                    letterSpacing: '0.15em'
                  }}
                />
              </div>

              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  type="button"
                  onClick={() => {
                    setShowResetModal(false);
                    setResetConfirmInput('');
                  }}
                  disabled={isResetting}
                  className="adm-btn-subtle"
                  style={{ flex: 1, justifyContent: 'center' }}
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleResetEvent}
                  disabled={resetConfirmInput !== 'RESET' || isResetting}
                  className="adm-btn-danger-outline"
                  style={{
                    flex: 1,
                    justifyContent: 'center',
                    background: resetConfirmInput === 'RESET' ? '#ef4444' : undefined,
                    color: resetConfirmInput === 'RESET' ? '#fff' : undefined,
                    cursor: resetConfirmInput === 'RESET' && !isResetting ? 'pointer' : 'not-allowed',
                    opacity: resetConfirmInput === 'RESET' ? 1 : 0.4
                  }}
                >
                  {isResetting ? 'Reiniciando...' : 'Confirmar Reseteo'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
