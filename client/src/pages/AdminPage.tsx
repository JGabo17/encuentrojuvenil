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
  AlertTriangle
} from 'lucide-react';
import type { Participant, MessageTemplate, MessageLog, RecipientType, Question, GameState, QuestionType, ChatMessageItem, Team } from '../../../shared/types/index.js';

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
  const [messageContent, setMessageContent] = useState('Hola {nombre} 👋\nTenemos algo preparado para ti.');
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

  // Estados de Trivia y Buzzer (Fase 2)
  const [questions, setQuestions] = useState<Question[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
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

  // URL del QR: utiliza el túnel global público de Cloudflare activo para acceso desde cualquier celular del mundo
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

    // Cargar estado inicial del juego
    socket.emit('game:get-state', (res) => {
      if (res?.state) setGameState(res.state);
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

    return () => {
      socket.off('admin:participants-update', onParticipantsUpdate);
      socket.off('teams:update', onTeamsUpdate);
      socket.off('admin:participant-joined', onParticipantJoined);
      socket.off('admin:participant-status', onParticipantStatus);
      socket.off('admin:message-logged', onMessageLogged);
      socket.off('game:state-update', onGameStateUpdate);
      socket.off('game:timer-tick', onGameTimerTick);
      socket.off('game:countdown-tick', onCountdownTick);
      socket.off('admin:moderation-queue-update', onModerationQueueUpdate);
      socket.off('chat:status-change', onChatStatusChange);
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
        content: messageContent.trim()
      },
      (res) => {
        setIsSending(false);
        if (res.success) {
          setSendSuccessMsg('¡Mensaje enviado con éxito!');
          setTimeout(() => setSendSuccessMsg(''), 4000);
        } else {
          alert(res.error || 'Error al enviar mensaje');
        }
      }
    );
  };

  // Cargar plantilla en el editor
  const handleUseTemplate = (tmpl: MessageTemplate) => {
    setMessageContent(tmpl.content);
  };

  // Guardar plantilla (nueva o editar)
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

  // ----------------------------------------------------
  // Acciones de Trivia & Moderación en Vivo (Fase 2)
  // ----------------------------------------------------
  const handleStartQuestion = (questionId: string) => {
    socket.emit('admin:start-question', { questionId }, (res) => {
      if (!res?.success) {
        alert(res?.error || 'Error al lanzar la pregunta');
      }
    });
  };

  const handleGradeDefense = (grade: 'CORRECT' | 'PARTIAL' | 'INCORRECT') => {
    socket.emit('admin:grade-defense', { grade }, (res) => {
      if (!res?.success) {
        alert(res?.error || 'Error al calificar la respuesta');
      }
    });
  };

  const handleShowLeaderboard = () => {
    socket.emit('admin:show-leaderboard', (res) => {
      if (!res?.success) {
        alert('Error al proyectar el podio');
      }
    });
  };

  const handleStartCountdown = (countdownSeconds = 7) => {
    socket.emit('admin:start-countdown', { countdownSeconds }, (res) => {
      if (!res?.success) {
        alert(res?.error || 'Error al iniciar la cuenta regresiva');
      }
    });
  };

  const handleCancelQuestion = () => {
    if (confirm('¿Deseas cancelar esta pregunta inmediatamente y volver a la sala de espera?')) {
      socket.emit('admin:cancel-question', (res) => {
        if (!res?.success) {
          alert(res?.error || 'Error al cancelar la pregunta');
        }
      });
    }
  };

  const handleResetToLobby = () => {
    socket.emit('admin:reset-to-lobby', (res) => {
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
      correctOptionIndex: newQuestionType === 'MULTIPLE_CHOICE' ? Number(newCorrectOptionIndex) : undefined
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

  // ----------------------------------------------------
  // Acciones de Encuentro & Moderación (Fase 3)
  // ----------------------------------------------------
  const handleStartPairings = () => {
    if (!confirm('¿Deseas iniciar el emparejamiento automático de duplas? Esto cruzará a los participantes de equipos diferentes.')) return;

    setIsStartingPairings(true);
    socket.emit('admin:start-pairings', (res) => {
      setIsStartingPairings(false);
      if (res?.success) {
        setChatEnabled(true);
        alert(`¡Emparejamiento exitoso! Se crearon ${res.count} duplas de integración y se habilitó el chat.`);
      } else {
        alert(res?.error || 'Error al generar emparejamientos');
      }
    });
  };

  const handleToggleChat = () => {
    socket.emit('admin:toggle-chat', { enabled: !chatEnabled }, (res) => {
      if (res?.success) {
        setChatEnabled(res.chatEnabled);
      }
    });
  };

  const handleModeratePhoto = (messageId: string, approved: boolean) => {
    socket.emit('admin:moderate-photo', { messageId, approved }, (res) => {
      if (!res?.success) {
        alert('Error al moderar la fotografía');
      }
    });
  };

  // ----------------------------------------------------
  // Superpoderes & Contingencias en Vivo
  // ----------------------------------------------------
  const handleReboundQuestion = (seconds = 15) => {
    socket.emit('admin:rebound-question', { seconds }, (res) => {
      if (!res?.success) {
        alert(res?.error || 'Error al abrir el rebote de la pregunta');
      }
    });
  };

  const handleAdjustPoints = (teamId: string, deltaPoints: number) => {
    socket.emit('admin:adjust-team-points', { teamId, deltaPoints }, (res) => {
      if (!res?.success) {
        alert(res?.error || 'Error al ajustar puntos');
      }
    });
  };

  const handleKickParticipant = (p: Participant) => {
    if (confirm(`¿Estás seguro de que deseas EXPULSAR a "${p.name}" del evento?\n\nSerá desconectado inmediatamente y su registro será eliminado.`)) {
      socket.emit('admin:kick-participant', { participantId: p.id }, (res) => {
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
    if (confirm(`¿Transferir el rol de CAPITÁN a "${p.name}"?\n\nSu pulsador digital se habilitará inmediatamente en su pantalla.`)) {
      socket.emit('admin:transfer-captain', { teamId: p.teamId, newCaptainId: p.id }, (res) => {
        if (!res?.success) {
          alert(res?.error || 'Error al transferir la capitanía');
        }
      });
    }
  };

  const handleResetEvent = () => {
    if (resetConfirmInput.trim() !== 'RESET') {
      alert('Para confirmar, debes escribir exactamente la palabra "RESET" en mayúsculas.');
      return;
    }
    setIsResetting(true);
    socket.emit('admin:reset-event', { confirmText: 'RESET' }, (res) => {
      setIsResetting(false);
      if (res?.success) {
        setShowResetModal(false);
        setResetConfirmInput('');
        alert('✅ Evento reseteado exitosamente a cero.\nParticipantes, equipos y chats limpiados. Las preguntas se conservaron intactas.');
      } else {
        alert(res?.error || 'Error al reiniciar el evento');
      }
    });
  };

  const connectedCount = participants.filter((p) => p.isConnected).length;
  const selectedParticipant = participants.find((p) => p.id === selectedParticipantId);

  // ----------------------------------------------------
  // Vista: Login de Administrador
  // ----------------------------------------------------
  if (!isAuthenticated) {
    return (
      <div style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '20px'
      }}>
        <div className="glass-panel" style={{
          maxWidth: '420px',
          width: '100%',
          padding: '36px 30px',
          textAlign: 'center'
        }}>
          <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: '16px'
          }}>
            <img
              src="/logo-rvc.png"
              alt="Logo RVC"
              style={{
                width: '64px',
                height: '64px',
                borderRadius: '50%',
                objectFit: 'cover',
                border: '2px solid var(--primary)',
                boxShadow: '0 8px 24px rgba(255, 101, 25, 0.45)'
              }}
            />
          </div>

          <h1 style={{ fontSize: '26px', marginBottom: '6px', color: '#fff' }}>
            Panel de Administración
          </h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '14px', marginBottom: '24px' }}>
            Encuentro Juvenil — Control en Vivo
          </p>

          <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{ textAlign: 'left' }}>
              <label style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '6px', display: 'block' }}>
                Usuario
              </label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                autoComplete="off"
                placeholder="Usuario administrador"
                required
                style={{
                  width: '100%',
                  padding: '12px 14px',
                  borderRadius: 'var(--radius-md)',
                  background: 'rgba(255, 255, 255, 0.05)',
                  border: '1px solid var(--border-subtle)',
                  color: '#fff',
                  fontSize: '15px'
                }}
              />
            </div>

            <div style={{ textAlign: 'left' }}>
              <label style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '6px', display: 'block' }}>
                Contraseña
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="new-password"
                placeholder="••••••••"
                required
                style={{
                  width: '100%',
                  padding: '12px 14px',
                  borderRadius: 'var(--radius-md)',
                  background: 'rgba(255, 255, 255, 0.05)',
                  border: '1px solid var(--border-subtle)',
                  color: '#fff',
                  fontSize: '15px'
                }}
              />
            </div>

            {loginError && (
              <div style={{ color: '#f87171', fontSize: '13px', fontWeight: 500 }}>
                {loginError}
              </div>
            )}

            <button
              type="submit"
              disabled={isLoggingIn}
              style={{
                marginTop: '8px',
                padding: '14px',
                borderRadius: 'var(--radius-md)',
                background: 'linear-gradient(135deg, var(--primary) 0%, #8b5cf6 100%)',
                color: '#fff',
                fontSize: '16px',
                fontWeight: 700,
                boxShadow: '0 10px 25px -5px var(--primary-glow)',
                cursor: isLoggingIn ? 'not-allowed' : 'pointer',
                opacity: isLoggingIn ? 0.7 : 1
              }}
            >
              {isLoggingIn ? 'Iniciando sesión...' : 'Ingresar al Panel'}
            </button>
          </form>
        </div>
      </div>
    );
  }

  // ----------------------------------------------------
  // Vista: Panel de Control en Vivo
  // ----------------------------------------------------
  return (
    <div style={{
      maxWidth: '1240px',
      margin: '0 auto',
      padding: '24px 20px',
      minHeight: '100vh',
      display: 'flex',
      flexDirection: 'column',
      gap: '24px'
    }}>
      {/* 1. Header Principal */}
      <header className="glass-panel" style={{
        padding: '18px 24px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '16px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <img
            src="/logo-rvc.png"
            alt="Logo RVC"
            style={{
              width: '46px',
              height: '46px',
              borderRadius: '50%',
              objectFit: 'cover',
              border: '2px solid var(--primary)',
              boxShadow: '0 4px 14px rgba(255, 101, 25, 0.4)'
            }}
          />
          <div>
            <div style={{ fontSize: '11px', fontWeight: 900, color: 'var(--primary)', letterSpacing: '0.12em', textTransform: 'uppercase' }}>
              RVC • CONTROL EN VIVO
            </div>
            <h1 style={{ fontSize: '22px', margin: 0, color: '#fff', fontWeight: 800 }}>
              Encuentro Juvenil — Panel Admin
            </h1>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
          {/* Contador de Participantes */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '8px 16px',
            borderRadius: '999px',
            background: 'rgba(255, 255, 255, 0.05)',
            border: '1px solid var(--border-subtle)'
          }}>
            <Users size={18} color="var(--primary)" />
            <span style={{ fontSize: '14px', fontWeight: 600 }}>
              Conectados: <strong style={{ color: '#34d399' }}>{connectedCount}</strong> / {participants.length}
            </span>
          </div>

          {/* Botón QR */}
          <button
            onClick={() => setShowQrModal(true)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '8px 16px',
              borderRadius: '999px',
              background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
              color: '#fff',
              fontSize: '14px',
              fontWeight: 600,
              boxShadow: '0 6px 16px -3px var(--success-glow)'
            }}
          >
            <QrCode size={18} />
            Mostrar QR
          </button>

          {/* Botón Reseteo Maestro de Emergencia */}
          <button
            onClick={() => {
              setResetConfirmInput('');
              setShowResetModal(true);
            }}
            title="Reiniciar evento a cero (contingencia/apertura)"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '8px 14px',
              borderRadius: '999px',
              background: 'rgba(239, 68, 68, 0.12)',
              border: '1px solid rgba(239, 68, 68, 0.35)',
              color: '#f87171',
              fontSize: '13px',
              fontWeight: 700,
              cursor: 'pointer',
              transition: 'all 0.15s ease'
            }}
          >
            <AlertTriangle size={15} />
            Reseteo Maestro
          </button>

          {/* Logout */}
          <button
            onClick={handleLogout}
            title="Cerrar sesión"
            style={{
              padding: '8px 12px',
              borderRadius: '999px',
              background: 'rgba(239, 68, 68, 0.1)',
              border: '1px solid rgba(239, 68, 68, 0.25)',
              color: '#f87171',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              fontSize: '13px',
              fontWeight: 600
            }}
          >
            <LogOut size={16} />
            Salir
          </button>
        </div>
      </header>

      {/* 2. Barra de Navegación de Pestañas: Trivia vs Mensajería */}
      <div style={{
        display: 'flex',
        gap: '12px',
        borderBottom: '1px solid var(--border-subtle)',
        paddingBottom: '12px',
        flexWrap: 'wrap'
      }}>
        <button
          onClick={() => setAdminTab('trivia')}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '12px 22px',
            borderRadius: '12px',
            border: 'none',
            cursor: 'pointer',
            fontWeight: 700,
            fontSize: '14px',
            background: adminTab === 'trivia'
              ? 'linear-gradient(135deg, var(--primary) 0%, #ff8c42 100%)'
              : 'rgba(255, 255, 255, 0.05)',
            color: adminTab === 'trivia' ? '#fff' : 'var(--text-muted)',
            boxShadow: adminTab === 'trivia' ? '0 4px 16px rgba(255, 101, 25, 0.35)' : 'none',
            transition: 'all 0.2s'
          }}
        >
          <Gamepad2 size={18} />
          🎮 Control de Trivia & Buzzer
        </button>

        <button
          onClick={() => setAdminTab('social')}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '12px 22px',
            borderRadius: '12px',
            border: 'none',
            cursor: 'pointer',
            fontWeight: 700,
            fontSize: '14px',
            background: adminTab === 'social'
              ? 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)'
              : 'rgba(255, 255, 255, 0.05)',
            color: adminTab === 'social' ? '#fff' : 'var(--text-muted)',
            boxShadow: adminTab === 'social' ? '0 4px 16px rgba(59, 130, 246, 0.35)' : 'none',
            transition: 'all 0.2s'
          }}
        >
          <Camera size={18} />
          🤝 Encuentro & Mural Social
          {moderationQueue.filter((m) => !m.isApprovedForMural).length > 0 && (
            <span style={{
              background: '#ef4444',
              color: '#fff',
              fontSize: '11px',
              padding: '2px 7px',
              borderRadius: '999px',
              fontWeight: 800
            }}>
              {moderationQueue.filter((m) => !m.isApprovedForMural).length}
            </span>
          )}
        </button>

        <button
          onClick={() => setAdminTab('messaging')}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '12px 22px',
            borderRadius: '12px',
            border: 'none',
            cursor: 'pointer',
            fontWeight: 700,
            fontSize: '14px',
            background: adminTab === 'messaging'
              ? 'linear-gradient(135deg, var(--primary) 0%, #ff8c42 100%)'
              : 'rgba(255, 255, 255, 0.05)',
            color: adminTab === 'messaging' ? '#fff' : 'var(--text-muted)',
            boxShadow: adminTab === 'messaging' ? '0 4px 16px rgba(255, 101, 25, 0.35)' : 'none',
            transition: 'all 0.2s'
          }}
        >
          <MessageSquare size={18} />
          💬 Mensajería & Participantes ({participants.length})
        </button>
      </div>

      {/* PESTAÑA: TRIVIA & BUZZER (FASE 2) */}
      {adminTab === 'trivia' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          {/* Monitor de Estado en Vivo & Buzzer */}
          <div className="glass-panel" style={{
            padding: '24px',
            border: gameState.buzzerWinner ? '2px solid var(--primary)' : '1px solid var(--border-subtle)',
            background: gameState.buzzerWinner
              ? 'radial-gradient(ellipse at top, rgba(255, 101, 25, 0.15) 0%, rgba(13, 17, 23, 0.95) 70%)'
              : 'rgba(13, 17, 23, 0.7)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px', marginBottom: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <span style={{
                  padding: '4px 12px',
                  borderRadius: '999px',
                  fontSize: '12px',
                  fontWeight: 800,
                  letterSpacing: '0.08em',
                  textTransform: 'uppercase',
                  background:
                    gameState.status === 'QUESTION_READING' ? 'rgba(59, 130, 246, 0.2)' :
                    gameState.status === 'COUNTDOWN_ACTIVE' ? 'rgba(245, 158, 11, 0.25)' :
                    gameState.status === 'QUESTION_ACTIVE' ? 'rgba(59, 130, 246, 0.2)' :
                    gameState.status === 'BUZZER_LOCKED' ? 'rgba(255, 101, 25, 0.25)' :
                    gameState.status === 'SHOWING_RESULT' ? 'rgba(16, 185, 129, 0.2)' :
                    gameState.status === 'LEADERBOARD' ? 'rgba(245, 158, 11, 0.2)' : 'rgba(255, 255, 255, 0.08)',
                  color:
                    gameState.status === 'QUESTION_READING' ? '#60a5fa' :
                    gameState.status === 'COUNTDOWN_ACTIVE' ? '#fbbf24' :
                    gameState.status === 'QUESTION_ACTIVE' ? '#60a5fa' :
                    gameState.status === 'BUZZER_LOCKED' ? 'var(--primary)' :
                    gameState.status === 'SHOWING_RESULT' ? '#34d399' :
                    gameState.status === 'LEADERBOARD' ? '#fbbf24' : 'var(--text-muted)',
                  border: '1px solid currentColor'
                }}>
                  {gameState.status === 'QUESTION_READING' ? '📖 LECTURA PREVIA' :
                   gameState.status === 'COUNTDOWN_ACTIVE' ? `⚡ CUENTA REGRESIVA (${gameState.countdownRemaining ?? 7}s)` :
                   gameState.status === 'QUESTION_ACTIVE' ? '⚡ ¡PULSADOR ACTIVO!' :
                   `ESTADO: ${gameState.status}`}
                </span>

                {gameState.currentQuestion && (
                  <span style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
                    Pregunta activa: <strong style={{ color: '#fff' }}>{gameState.currentQuestion.points} pts</strong> ({gameState.currentQuestion.type === 'ORAL_DEFENSE' ? 'Defensa Oral' : 'Opción Múltiple'})
                  </span>
                )}
              </div>

              {/* Botones de Acción Global */}
              <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'center' }}>
                {gameState.status === 'QUESTION_READING' && (
                  <button
                    onClick={() => handleStartCountdown(7)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      padding: '8px 18px',
                      borderRadius: '8px',
                      border: 'none',
                      background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                      color: '#fff',
                      fontWeight: 800,
                      fontSize: '13px',
                      cursor: 'pointer',
                      boxShadow: '0 0 16px rgba(16, 185, 129, 0.5)',
                      animation: 'pulse-glow 1.5s infinite'
                    }}
                  >
                    <Play size={16} fill="#fff" />
                    ▶ Iniciar Cuenta Regresiva (7s)
                  </button>
                )}

                <button
                  onClick={handleShowLeaderboard}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '8px 16px',
                    borderRadius: '8px',
                    border: '1px solid rgba(245, 158, 11, 0.4)',
                    background: 'rgba(245, 158, 11, 0.12)',
                    color: '#fbbf24',
                    fontWeight: 700,
                    fontSize: '13px',
                    cursor: 'pointer'
                  }}
                >
                  <Trophy size={16} />
                  Proyectar Podio
                </button>

                {gameState.currentQuestion && (
                  <button
                    onClick={() => handleReboundQuestion(15)}
                    title="Reabre el pulsador digital por 15s para que otro equipo intente responder"
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      padding: '8px 16px',
                      borderRadius: '8px',
                      border: '1px solid rgba(59, 130, 246, 0.4)',
                      background: 'rgba(59, 130, 246, 0.15)',
                      color: '#60a5fa',
                      fontWeight: 700,
                      fontSize: '13px',
                      cursor: 'pointer'
                    }}
                  >
                    <RotateCcw size={16} />
                    Rebotar Pregunta (15s)
                  </button>
                )}

                {gameState.status !== 'LOBBY' && (
                  <button
                    onClick={handleCancelQuestion}
                    title="Cancela la pregunta actual y vuelve inmediatamente a la sala de espera"
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      padding: '8px 16px',
                      borderRadius: '8px',
                      border: '1px solid rgba(239, 68, 68, 0.5)',
                      background: 'rgba(239, 68, 68, 0.15)',
                      color: '#f87171',
                      fontWeight: 700,
                      fontSize: '13px',
                      cursor: 'pointer'
                    }}
                  >
                    <XCircle size={16} />
                    🚫 Cancelar Pregunta
                  </button>
                )}

                <button
                  onClick={handleResetToLobby}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '8px 16px',
                    borderRadius: '8px',
                    border: '1px solid var(--border-subtle)',
                    background: 'rgba(255, 255, 255, 0.05)',
                    color: 'var(--text-muted)',
                    fontWeight: 600,
                    fontSize: '13px',
                    cursor: 'pointer'
                  }}
                >
                  <RotateCcw size={16} />
                  Reiniciar a Lobby
                </button>
              </div>
            </div>

            {/* Banner Informativo y Botón de Inicio de Cuenta Regresiva cuando está en LECTURA PREVIA */}
            {gameState.status === 'QUESTION_READING' && gameState.currentQuestion && (
              <div style={{
                padding: '16px 20px',
                borderRadius: '12px',
                background: 'rgba(59, 130, 246, 0.12)',
                border: '1px solid rgba(59, 130, 246, 0.4)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: '12px'
              }}>
                <div>
                  <div style={{ fontSize: '15px', fontWeight: 800, color: '#60a5fa' }}>
                    📖 Pregunta visible en todas las pantallas para lectura previa
                  </div>
                  <div style={{ fontSize: '13px', color: '#cbd5e1', marginTop: '2px' }}>
                    Los participantes y el auditorio están leyendo el enunciado. Cuando estés listo para que compitan, presiona Iniciar Cuenta Regresiva (7s).
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button
                    onClick={() => handleStartCountdown(7)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      padding: '10px 22px',
                      borderRadius: '8px',
                      background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                      color: '#fff',
                      fontWeight: 800,
                      fontSize: '14px',
                      border: 'none',
                      cursor: 'pointer',
                      boxShadow: '0 0 20px rgba(16, 185, 129, 0.5)'
                    }}
                  >
                    <Play size={16} fill="#fff" />
                    ▶ Dar Play (Cuenta 7s)
                  </button>
                  <button
                    onClick={handleCancelQuestion}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      padding: '10px 16px',
                      borderRadius: '8px',
                      background: 'rgba(239, 68, 68, 0.2)',
                      border: '1px solid rgba(239, 68, 68, 0.4)',
                      color: '#f87171',
                      fontWeight: 700,
                      fontSize: '13px',
                      cursor: 'pointer'
                    }}
                  >
                    <XCircle size={16} />
                    Cancelar
                  </button>
                </div>
              </div>
            )}

            {/* Banner de Cuenta Regresiva Activa */}
            {gameState.status === 'COUNTDOWN_ACTIVE' && (
              <div style={{
                padding: '18px',
                borderRadius: '12px',
                background: 'radial-gradient(circle, rgba(245, 158, 11, 0.2), rgba(15, 23, 42, 0.85))',
                border: '2px solid #f59e0b',
                textAlign: 'center',
                boxShadow: '0 0 25px rgba(245, 158, 11, 0.35)'
              }}>
                <div style={{ fontSize: '13px', fontWeight: 800, color: '#fbbf24', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                  ⚡ ¡CUENTA REGRESIVA DE 7 SEGUNDOS EN PROCESO!
                </div>
                <div style={{ fontSize: '52px', fontWeight: 900, color: '#fff', textShadow: '0 0 20px rgba(245, 158, 11, 0.8)', lineHeight: 1, margin: '6px 0' }}>
                  {gameState.countdownRemaining ?? 7}
                </div>
                <div style={{ fontSize: '13px', color: '#ffedd5' }}>
                  El botón del buzzer se desbloqueará en los teléfonos al llegar a cero.
                </div>
              </div>
            )}

            {/* Si el Buzzer fue presionado */}
            {gameState.buzzerWinner ? (
              <div style={{
                padding: '20px',
                borderRadius: '12px',
                background: 'rgba(255, 101, 25, 0.08)',
                border: '1px solid rgba(255, 101, 25, 0.3)',
                display: 'flex',
                flexDirection: 'column',
                gap: '16px'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div style={{
                      width: '48px',
                      height: '48px',
                      borderRadius: '50%',
                      background: 'var(--primary)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: '#fff',
                      boxShadow: '0 0 20px rgba(255, 101, 25, 0.5)'
                    }}>
                      <Flame size={26} />
                    </div>
                    <div>
                      <div style={{ fontSize: '11px', color: 'var(--primary)', fontWeight: 800, letterSpacing: '0.1em', textTransform: 'uppercase' }}>
                        ¡BUZZER BLOQUEADO!
                      </div>
                      <div style={{ fontSize: '20px', fontWeight: 800, color: '#fff' }}>
                        {gameState.buzzerWinner.teamName}
                      </div>
                      <div style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
                        Capitán: {gameState.buzzerWinner.captainName}
                      </div>
                    </div>
                  </div>

                  {gameState.currentQuestion?.type === 'ORAL_DEFENSE' && (
                    <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                      <button
                        onClick={() => handleGradeDefense('CORRECT')}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '6px',
                          padding: '10px 18px',
                          borderRadius: '8px',
                          border: 'none',
                          background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                          color: '#fff',
                          fontWeight: 700,
                          fontSize: '14px',
                          cursor: 'pointer',
                          boxShadow: '0 4px 12px rgba(16, 185, 129, 0.3)'
                        }}
                      >
                        <CheckCircle2 size={18} />
                        Correcto (+{gameState.currentQuestion?.points} pts)
                      </button>
                      <button
                        onClick={() => handleGradeDefense('PARTIAL')}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '6px',
                          padding: '10px 18px',
                          borderRadius: '8px',
                          border: 'none',
                          background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
                          color: '#fff',
                          fontWeight: 700,
                          fontSize: '14px',
                          cursor: 'pointer',
                          boxShadow: '0 4px 12px rgba(245, 158, 11, 0.3)'
                        }}
                      >
                        <Award size={18} />
                        Parcial (+{Math.round((gameState.currentQuestion?.points || 100) / 2)} pts)
                      </button>
                      <button
                        onClick={() => handleGradeDefense('INCORRECT')}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '6px',
                          padding: '10px 18px',
                          borderRadius: '8px',
                          background: 'rgba(239, 68, 68, 0.2)',
                          color: '#f87171',
                          border: '1px solid rgba(239, 68, 68, 0.4)',
                          fontWeight: 700,
                          fontSize: '14px',
                          cursor: 'pointer'
                        }}
                      >
                        <XCircle size={18} />
                        Incorrecto (0 pts)
                      </button>
                    </div>
                  )}
                </div>

                {gameState.currentQuestion?.type === 'MULTIPLE_CHOICE' && (
                  <div style={{
                    padding: '14px',
                    borderRadius: '8px',
                    background: 'rgba(255, 255, 255, 0.04)',
                    border: '1px solid var(--border-subtle)'
                  }}>
                    {gameState.selectedChoice !== null && gameState.selectedChoice !== undefined ? (
                      <div style={{ color: '#34d399', fontWeight: 600 }}>
                        El capitán seleccionó: <strong>Opción {['A', 'B', 'C', 'D'][gameState.selectedChoice]}</strong> ({gameState.currentQuestion.options?.[gameState.selectedChoice]})
                      </div>
                    ) : (
                      <div style={{ color: '#fbbf24', fontWeight: 500 }}>
                        ⏳ El capitán está deliberando y seleccionando en su dispositivo... ({gameState.timeRemaining}s restantes)
                      </div>
                    )}
                  </div>
                )}
              </div>
            ) : gameState.status === 'QUESTION_ACTIVE' ? (
              <div style={{
                padding: '20px',
                borderRadius: '12px',
                background: 'rgba(59, 130, 246, 0.08)',
                border: '1px solid rgba(59, 130, 246, 0.3)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: '16px'
              }}>
                <div>
                  <div style={{ fontSize: '13px', color: '#60a5fa', fontWeight: 700, textTransform: 'uppercase' }}>
                    Pregunta proyectada en pantalla
                  </div>
                  <div style={{ fontSize: '18px', fontWeight: 700, color: '#fff', marginTop: '4px' }}>
                    "{gameState.currentQuestion?.text}"
                  </div>
                </div>
                <div style={{
                  fontSize: '28px',
                  fontWeight: 900,
                  color: gameState.timeRemaining <= 5 ? '#f87171' : 'var(--primary)',
                  padding: '6px 18px',
                  borderRadius: '10px',
                  background: 'rgba(0,0,0,0.3)',
                  border: '1px solid var(--border-subtle)'
                }}>
                  ⏱️ {gameState.timeRemaining}s
                </div>
              </div>
            ) : gameState.status === 'SHOWING_RESULT' && gameState.result ? (
              <div style={{
                padding: '16px 20px',
                borderRadius: '12px',
                background: gameState.result.grade === 'CORRECT' ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)',
                border: `1px solid ${gameState.result.grade === 'CORRECT' ? '#10b981' : '#ef4444'}`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: '12px'
              }}>
                <div>
                  <div style={{ fontSize: '16px', fontWeight: 800, color: '#fff' }}>
                    Veredicto: {gameState.result.grade === 'CORRECT' ? '✅ CORRECTO' : gameState.result.grade === 'PARTIAL' ? '🟡 PARCIAL' : '❌ INCORRECTO'}
                  </div>
                  <div style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
                    Equipo {gameState.result.teamName} — Puntos otorgados: +{gameState.result.pointsAwarded} pts
                  </div>
                </div>
                <button
                  onClick={handleShowLeaderboard}
                  style={{
                    padding: '8px 16px',
                    borderRadius: '8px',
                    border: 'none',
                    background: '#fbbf24',
                    color: '#000',
                    fontWeight: 700,
                    cursor: 'pointer'
                  }}
                >
                  Ver Podio
                </button>
              </div>
            ) : (
              <div style={{ textAlign: 'center', padding: '24px', color: 'var(--text-muted)' }}>
                Sala de espera activa. Selecciona una pregunta del banco a continuación para lanzarla a la pantalla y habilitar los pulsadores.
              </div>
            )}
          </div>

          {/* Banco de Preguntas */}
          <div className="glass-panel" style={{ padding: '24px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
              <div>
                <h2 style={{ fontSize: '20px', fontWeight: 800, color: '#fff', margin: 0 }}>
                  Banco de Preguntas ({questions.length})
                </h2>
                <p style={{ fontSize: '13px', color: 'var(--text-muted)', margin: '4px 0 0 0' }}>
                  Lanza preguntas a la pantalla gigante y a los dispositivos de los capitanes.
                </p>
              </div>

              <button
                onClick={() => setShowQuestionModal(true)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '10px 18px',
                  borderRadius: '10px',
                  border: 'none',
                  background: 'linear-gradient(135deg, var(--primary) 0%, #ff8c42 100%)',
                  color: '#fff',
                  fontWeight: 700,
                  fontSize: '14px',
                  cursor: 'pointer',
                  boxShadow: '0 4px 14px rgba(255, 101, 25, 0.35)'
                }}
              >
                <Plus size={18} />
                Nueva Pregunta
              </button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '16px' }}>
              {questions.map((q, idx) => {
                const isActive = gameState.currentQuestion?.id === q.id;
                return (
                  <div
                    key={q.id}
                    style={{
                      padding: '18px',
                      borderRadius: '12px',
                      background: isActive ? 'rgba(255, 101, 25, 0.08)' : 'rgba(255, 255, 255, 0.03)',
                      border: isActive ? '2px solid var(--primary)' : '1px solid var(--border-subtle)',
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'space-between',
                      gap: '14px'
                    }}
                  >
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
                        <span style={{
                          fontSize: '11px',
                          fontWeight: 800,
                          padding: '4px 8px',
                          borderRadius: '6px',
                          background: q.type === 'ORAL_DEFENSE' ? 'rgba(168, 85, 247, 0.2)' : 'rgba(59, 130, 246, 0.2)',
                          color: q.type === 'ORAL_DEFENSE' ? '#c084fc' : '#60a5fa'
                        }}>
                          {q.type === 'ORAL_DEFENSE' ? '🎤 DEFENSA ORAL' : '⚡ OPCIÓN MÚLTIPLE'}
                        </span>

                        <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--primary)' }}>
                          {q.points} pts • {q.timeLimit}s
                        </span>
                      </div>

                      <div style={{ fontSize: '15px', fontWeight: 600, color: '#fff', lineHeight: 1.4, marginBottom: '12px' }}>
                        {idx + 1}. {q.text}
                      </div>

                      {q.options && q.options.length > 0 && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginBottom: '12px' }}>
                          {q.options.map((opt, oIdx) => (
                            <div
                              key={oIdx}
                              style={{
                                fontSize: '12px',
                                padding: '6px 10px',
                                borderRadius: '6px',
                                background: q.correctOptionIndex === oIdx ? 'rgba(16, 185, 129, 0.15)' : 'rgba(255, 255, 255, 0.03)',
                                border: q.correctOptionIndex === oIdx ? '1px solid #10b981' : '1px solid transparent',
                                color: q.correctOptionIndex === oIdx ? '#34d399' : 'var(--text-muted)'
                              }}
                            >
                              <strong>{['A', 'B', 'C', 'D'][oIdx]}.</strong> {opt}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    <button
                      onClick={() => handleStartQuestion(q.id)}
                      disabled={isActive}
                      style={{
                        padding: '10px 14px',
                        borderRadius: '8px',
                        border: 'none',
                        background: isActive ? 'rgba(239, 68, 68, 0.2)' : 'var(--primary)',
                        color: isActive ? '#f87171' : '#fff',
                        fontWeight: 700,
                        fontSize: '13px',
                        cursor: isActive ? 'not-allowed' : 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '6px',
                        transition: 'all 0.2s'
                      }}
                    >
                      {isActive ? (
                        <>🔴 EN VIVO AHORA</>
                      ) : (
                        <>
                          <Play size={15} /> Lanzar Pregunta
                        </>
                      )}
                    </button>
                  </div>
                );
              })}
            </div>
          </div>

          {/* 3. Panel de Equipos, Visor de PINs y Control Manual de Puntos (+/-) */}
          <div className="glass-panel" style={{ padding: '24px' }}>
            <div style={{ marginBottom: '20px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
                <h2 style={{ fontSize: '20px', fontWeight: 800, color: '#fff', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Award size={22} color="var(--primary)" />
                  Equipos, PINs & Ajuste Manual de Puntos ({teams.length})
                </h2>
                <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                  Total equipos compitiendo en el evento
                </span>
              </div>
              <p style={{ fontSize: '13px', color: 'var(--text-muted)', margin: '6px 0 0 0' }}>
                Consulta el PIN secreto de 4 dígitos para miembros que olvidaron el código y realiza ajustes inmediatos de puntuación (+/-).
              </p>
            </div>

            {teams.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '36px', color: 'var(--text-muted)' }}>
                <Users size={36} style={{ opacity: 0.3, marginBottom: '8px' }} />
                <p style={{ fontSize: '15px' }}>Aún no hay equipos creados para este evento.</p>
                <p style={{ fontSize: '13px', color: 'var(--text-dim)', marginTop: '4px' }}>
                  Cuando el primer capitán cree su equipo, aparecerá aquí con su código PIN.
                </p>
              </div>
            ) : (
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
                gap: '16px'
              }}>
                {teams.map((t) => (
                  <div
                    key={t.id}
                    style={{
                      padding: '16px 18px',
                      borderRadius: '12px',
                      background: 'rgba(255, 255, 255, 0.03)',
                      border: '1px solid var(--border-subtle)',
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'space-between',
                      gap: '14px'
                    }}
                  >
                    {/* Header del Equipo */}
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <div style={{
                          width: '42px',
                          height: '42px',
                          borderRadius: '10px',
                          background: 'rgba(255, 101, 25, 0.15)',
                          border: '1px solid rgba(255, 101, 25, 0.3)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: '22px'
                        }}>
                          {t.avatar && t.avatar.startsWith('data:image') ? (
                            <img src={t.avatar} alt="Escudo" style={{ width: '100%', height: '100%', borderRadius: '10px', objectFit: 'cover' }} />
                          ) : (
                            t.avatar || '🛡️'
                          )}
                        </div>
                        <div>
                          <div style={{ fontSize: '16px', fontWeight: 800, color: '#fff' }}>
                            {t.name}
                          </div>
                          <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                            {t.memberCount} integrante{t.memberCount !== 1 ? 's' : ''}
                          </div>
                        </div>
                      </div>

                      {/* Visor de PIN de 4 dígitos */}
                      <div style={{
                        padding: '4px 10px',
                        borderRadius: '999px',
                        background: 'rgba(245, 158, 11, 0.15)',
                        border: '1px solid rgba(245, 158, 11, 0.4)',
                        color: '#fbbf24',
                        fontSize: '12px',
                        fontWeight: 800,
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px'
                      }}>
                        <Key size={13} />
                        PIN: {t.pin || '••••'}
                      </div>
                    </div>

                    {/* Puntaje Actual */}
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '10px 14px',
                      borderRadius: '8px',
                      background: 'rgba(0, 0, 0, 0.25)',
                      border: '1px solid var(--border-subtle)'
                    }}>
                      <span style={{ fontSize: '13px', color: 'var(--text-muted)', fontWeight: 600 }}>
                        Puntaje en Vivo:
                      </span>
                      <span style={{ fontSize: '20px', fontWeight: 900, color: 'var(--primary)' }}>
                        {t.score} pts
                      </span>
                    </div>

                    {/* Controles de Ajuste Manual de Puntos */}
                    <div>
                      <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-dim)', marginBottom: '6px', textTransform: 'uppercase' }}>
                        Ajuste Manual de Puntos:
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '6px' }}>
                        <button
                          onClick={() => handleAdjustPoints(t.id, -100)}
                          title="Restar 100 puntos"
                          style={{
                            padding: '6px 4px',
                            borderRadius: '6px',
                            border: '1px solid rgba(239, 68, 68, 0.3)',
                            background: 'rgba(239, 68, 68, 0.1)',
                            color: '#f87171',
                            fontSize: '12px',
                            fontWeight: 800,
                            cursor: 'pointer'
                          }}
                        >
                          -100
                        </button>
                        <button
                          onClick={() => handleAdjustPoints(t.id, -50)}
                          title="Restar 50 puntos"
                          style={{
                            padding: '6px 4px',
                            borderRadius: '6px',
                            border: '1px solid rgba(239, 68, 68, 0.3)',
                            background: 'rgba(239, 68, 68, 0.1)',
                            color: '#f87171',
                            fontSize: '12px',
                            fontWeight: 800,
                            cursor: 'pointer'
                          }}
                        >
                          -50
                        </button>
                        <button
                          onClick={() => handleAdjustPoints(t.id, 50)}
                          title="Sumar 50 puntos"
                          style={{
                            padding: '6px 4px',
                            borderRadius: '6px',
                            border: '1px solid rgba(16, 185, 129, 0.3)',
                            background: 'rgba(16, 185, 129, 0.12)',
                            color: '#34d399',
                            fontSize: '12px',
                            fontWeight: 800,
                            cursor: 'pointer'
                          }}
                        >
                          +50
                        </button>
                        <button
                          onClick={() => handleAdjustPoints(t.id, 100)}
                          title="Sumar 100 puntos"
                          style={{
                            padding: '6px 4px',
                            borderRadius: '6px',
                            border: '1px solid rgba(16, 185, 129, 0.4)',
                            background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.25) 0%, rgba(5, 150, 105, 0.3) 100%)',
                            color: '#34d399',
                            fontSize: '12px',
                            fontWeight: 800,
                            cursor: 'pointer'
                          }}
                        >
                          +100
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

      {/* PESTAÑA: ENCUENTRO & MURAL SOCIAL (FASE 3) */}
      {adminTab === 'social' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          {/* Card de Controles de la Dinámica Social */}
          <div className="glass-panel" style={{
            padding: '24px',
            border: '1px solid rgba(59, 130, 246, 0.3)',
            background: 'radial-gradient(ellipse at top, rgba(59, 130, 246, 0.12) 0%, rgba(13, 17, 23, 0.9) 70%)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '16px' }}>
              <div>
                <span style={{ fontSize: '11px', fontWeight: 800, color: '#60a5fa', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                  DINÁMICA DE INTEGRACIÓN • PASO 3
                </span>
                <h2 style={{ fontSize: '22px', fontWeight: 800, color: '#fff', margin: '4px 0 6px 0' }}>
                  Encuentro en Duplas & Mural Social
                </h2>
                <p style={{ fontSize: '13px', color: 'var(--text-muted)', margin: 0, maxWidth: '600px' }}>
                  Cruza aleatoriamente a los participantes de equipos diferentes para que chateen, se conozcan y se tomen fotografías para el proyector del auditorio.
                </p>
              </div>

              <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                <button
                  onClick={handleStartPairings}
                  disabled={isStartingPairings}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    padding: '12px 20px',
                    borderRadius: '10px',
                    border: 'none',
                    background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
                    color: '#fff',
                    fontWeight: 700,
                    fontSize: '14px',
                    cursor: isStartingPairings ? 'not-allowed' : 'pointer',
                    boxShadow: '0 4px 16px rgba(59, 130, 246, 0.4)'
                  }}
                >
                  <Users size={18} />
                  {isStartingPairings ? 'Emparejando...' : '🚀 Iniciar Emparejamiento Automático'}
                </button>

                <button
                  onClick={handleToggleChat}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    padding: '12px 18px',
                    borderRadius: '10px',
                    border: chatEnabled ? '1px solid rgba(239, 68, 68, 0.4)' : '1px solid rgba(16, 185, 129, 0.4)',
                    background: chatEnabled ? 'rgba(239, 68, 68, 0.15)' : 'rgba(16, 185, 129, 0.15)',
                    color: chatEnabled ? '#f87171' : '#34d399',
                    fontWeight: 700,
                    fontSize: '14px',
                    cursor: 'pointer'
                  }}
                >
                  {chatEnabled ? '⏸️ Pausar Chat' : '💬 Habilitar Chat'}
                </button>
              </div>
            </div>
          </div>

          {/* Bandeja de Moderación de Fotografías */}
          <div className="glass-panel" style={{ padding: '24px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
              <div>
                <h2 style={{ fontSize: '20px', fontWeight: 800, color: '#fff', margin: 0 }}>
                  Bandeja de Moderación de Fotografías ({moderationQueue.length})
                </h2>
                <p style={{ fontSize: '13px', color: 'var(--text-muted)', margin: '4px 0 0 0' }}>
                  Supervisa y autoriza las fotos tomadas por las duplas antes de que se proyecten en la pantalla gigante.
                </p>
              </div>

              <span style={{
                fontSize: '13px',
                fontWeight: 700,
                padding: '6px 14px',
                borderRadius: '8px',
                background: 'rgba(16, 185, 129, 0.15)',
                color: '#34d399',
                border: '1px solid rgba(16, 185, 129, 0.3)'
              }}>
                Aprobadas en Mural: {moderationQueue.filter((m) => m.isApprovedForMural).length}
              </span>
            </div>

            {moderationQueue.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '48px 16px', color: 'var(--text-muted)' }}>
                <Camera size={44} style={{ opacity: 0.3, marginBottom: '12px' }} />
                <p style={{ fontSize: '16px', fontWeight: 600, color: '#fff' }}>No hay fotografías en la bandeja aún</p>
                <p style={{ fontSize: '13px', maxWidth: '420px', margin: '6px auto 0 auto' }}>
                  Tan pronto los participantes se tomen una foto o selfie en su chat de dupla, aparecerán aquí para tu aprobación en tiempo real.
                </p>
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '18px' }}>
                {moderationQueue.map((m) => (
                  <div
                    key={m.id}
                    style={{
                      borderRadius: '14px',
                      background: m.isApprovedForMural ? 'rgba(16, 185, 129, 0.06)' : 'rgba(255, 255, 255, 0.03)',
                      border: m.isApprovedForMural ? '2px solid #10b981' : '1px solid var(--border-subtle)',
                      overflow: 'hidden',
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'space-between'
                    }}
                  >
                    <div>
                      {/* Imagen */}
                      {m.photoUrl ? (
                        <div style={{ height: '220px', overflow: 'hidden', background: '#000', position: 'relative' }}>
                          <img
                            src={m.photoUrl}
                            alt="Foto enviada"
                            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                          />
                          <div style={{
                            position: 'absolute',
                            top: '10px',
                            right: '10px',
                            padding: '4px 10px',
                            borderRadius: '999px',
                            fontSize: '11px',
                            fontWeight: 800,
                            background: m.isApprovedForMural ? '#10b981' : '#f59e0b',
                            color: m.isApprovedForMural ? '#fff' : '#000'
                          }}>
                            {m.isApprovedForMural ? '✅ EN MURAL' : '⏳ PENDIENTE'}
                          </div>
                        </div>
                      ) : (
                        <div style={{ padding: '20px', textAlign: 'center', color: 'var(--text-muted)' }}>
                          Sin foto adjunta
                        </div>
                      )}

                      {/* Datos de la Foto */}
                      <div style={{ padding: '16px' }}>
                        <div style={{ fontSize: '15px', fontWeight: 700, color: '#fff' }}>
                          {m.senderName} <span style={{ fontSize: '13px', fontWeight: 500, color: 'var(--primary)' }}>({m.senderTeamName})</span>
                        </div>
                        {m.content && (
                          <div style={{ fontSize: '13px', color: '#cbd5e1', marginTop: '6px', fontStyle: 'italic' }}>
                            "{m.content}"
                          </div>
                        )}
                        <div style={{ fontSize: '11px', color: 'var(--text-dim)', marginTop: '8px' }}>
                          Enviada a las {new Date(m.sentAt).toLocaleTimeString()}
                        </div>
                      </div>
                    </div>

                    {/* Botones de Moderación */}
                    <div style={{ display: 'flex', gap: '8px', padding: '12px 16px', borderTop: '1px solid var(--border-subtle)', background: 'rgba(0,0,0,0.2)' }}>
                      {!m.isApprovedForMural ? (
                        <button
                          onClick={() => handleModeratePhoto(m.id, true)}
                          style={{
                            flex: 1,
                            padding: '10px',
                            borderRadius: '8px',
                            border: 'none',
                            background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                            color: '#fff',
                            fontWeight: 700,
                            fontSize: '13px',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '6px'
                          }}
                        >
                          <CheckCircle2 size={16} />
                          Aprobar para Mural
                        </button>
                      ) : (
                        <button
                          onClick={() => handleModeratePhoto(m.id, false)}
                          style={{
                            flex: 1,
                            padding: '10px',
                            borderRadius: '8px',
                            border: '1px solid rgba(239, 68, 68, 0.4)',
                            background: 'rgba(239, 68, 68, 0.15)',
                            color: '#f87171',
                            fontWeight: 700,
                            fontSize: '13px',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '6px'
                          }}
                        >
                          <XCircle size={16} />
                          Retirar del Mural
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

      {/* PESTAÑA: MENSAJERÍA & PARTICIPANTES */}
      {adminTab === 'messaging' && (
        <>
          {/* 2. Grid Principal: Participantes y Editor */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
            gap: '24px',
            alignItems: 'start'
          }}>
        {/* Columna Izquierda: Lista de Participantes */}
        <section className="glass-panel" style={{ padding: '24px' }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: '18px',
            borderBottom: '1px solid var(--border-subtle)',
            paddingBottom: '12px'
          }}>
            <h2 style={{ fontSize: '18px', color: '#fff', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Users size={20} color="var(--primary)" />
              PARTICIPANTES ({participants.length})
            </h2>
            <button
              onClick={() => {
                setRecipientType('ALL');
                setSelectedParticipantId('');
              }}
              style={{
                fontSize: '12px',
                fontWeight: 700,
                padding: '6px 12px',
                borderRadius: '8px',
                background: recipientType === 'ALL' ? 'var(--primary)' : 'rgba(255, 255, 255, 0.08)',
                color: '#fff',
                cursor: 'pointer'
              }}
            >
              Seleccionar Todos
            </button>
          </div>

          {participants.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '36px 16px', color: 'var(--text-muted)' }}>
              <QrCode size={40} style={{ opacity: 0.3, marginBottom: '8px' }} />
              <p style={{ fontSize: '15px' }}>Ningún participante registrado aún.</p>
              <p style={{ fontSize: '13px', color: 'var(--text-dim)', marginTop: '4px' }}>
                Muestra el código QR para que los participantes se unan.
              </p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', maxHeight: '420px', overflowY: 'auto', paddingRight: '4px' }}>
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
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '12px 16px',
                      borderRadius: 'var(--radius-md)',
                      background: isSelected ? 'rgba(99, 102, 241, 0.2)' : 'rgba(255, 255, 255, 0.03)',
                      border: `1px solid ${isSelected ? 'var(--primary)' : 'var(--border-subtle)'}`,
                      cursor: 'pointer',
                      transition: 'all 0.15s ease',
                      flexWrap: 'wrap',
                      gap: '10px'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flex: 1, minWidth: '220px' }}>
                      <span style={{
                        width: '10px',
                        height: '10px',
                        borderRadius: '50%',
                        backgroundColor: p.isConnected ? 'var(--success)' : 'var(--danger)',
                        boxShadow: p.isConnected ? '0 0 8px var(--success)' : '0 0 8px var(--danger)'
                      }} className={p.isConnected ? 'pulse-indicator' : ''} />
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                          <span style={{ fontSize: '15px', fontWeight: 700, color: '#fff' }}>
                            {p.name}
                          </span>
                          {/* Rol */}
                          {isCaptain ? (
                            <span style={{
                              fontSize: '11px',
                              padding: '2px 8px',
                              borderRadius: '999px',
                              background: 'rgba(245, 158, 11, 0.2)',
                              border: '1px solid #fbbf24',
                              color: '#fbbf24',
                              fontWeight: 800,
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px'
                            }}>
                              <Crown size={11} /> Capitán
                            </span>
                          ) : (
                            <span style={{
                              fontSize: '11px',
                              padding: '2px 8px',
                              borderRadius: '999px',
                              background: 'rgba(255, 255, 255, 0.06)',
                              color: 'var(--text-muted)',
                              fontWeight: 600
                            }}>
                              Integrante
                            </span>
                          )}
                        </div>

                        {/* Equipo y PIN */}
                        <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px', display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                          {teamObj ? (
                            <>
                              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                                {teamObj.avatar && teamObj.avatar.startsWith('data:image') ? (
                                  <img src={teamObj.avatar} alt="Escudo" style={{ width: '16px', height: '16px', borderRadius: '4px', objectFit: 'cover' }} />
                                ) : (
                                  <span>{teamObj.avatar || '🛡️'}</span>
                                )}
                                {teamObj.name}
                              </span>
                              {teamObj.pin && (
                                <span style={{
                                  color: '#fbbf24',
                                  fontWeight: 700,
                                  background: 'rgba(245, 158, 11, 0.1)',
                                  padding: '1px 6px',
                                  borderRadius: '4px'
                                }}>
                                  PIN: {teamObj.pin}
                                </span>
                              )}
                            </>
                          ) : (
                            <span style={{ fontStyle: 'italic', color: 'var(--text-dim)' }}>Sin equipo asignado</span>
                          )}
                          <span>• {p.isConnected ? 'En línea' : 'Desconectado'}</span>
                        </div>
                      </div>
                    </div>

                    {/* Botones de Contingencia y Selección */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                      {/* Promover a Capitán si es Integrante y tiene equipo */}
                      {!isCaptain && p.teamId && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleTransferCaptain(p);
                          }}
                          title="Hacer Capitán a este integrante si el capitán original no puede responder"
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '4px',
                            fontSize: '11px',
                            padding: '5px 10px',
                            borderRadius: '6px',
                            border: '1px solid rgba(245, 158, 11, 0.4)',
                            background: 'rgba(245, 158, 11, 0.12)',
                            color: '#fbbf24',
                            fontWeight: 700,
                            cursor: 'pointer'
                          }}
                        >
                          <Crown size={12} />
                          Hacer Capitán
                        </button>
                      )}

                      {/* Botón de Expulsión */}
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleKickParticipant(p);
                        }}
                        title="Expulsar participante del evento"
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '4px',
                          fontSize: '11px',
                          padding: '5px 10px',
                          borderRadius: '6px',
                          border: '1px solid rgba(239, 68, 68, 0.35)',
                          background: 'rgba(239, 68, 68, 0.12)',
                          color: '#f87171',
                          fontWeight: 700,
                          cursor: 'pointer'
                        }}
                      >
                        <UserMinus size={12} />
                        Expulsar
                      </button>

                      {/* Botón Seleccionar Destinatario */}
                      <span style={{
                        fontSize: '11px',
                        padding: '5px 10px',
                        borderRadius: '6px',
                        background: isSelected ? 'var(--primary)' : 'rgba(255, 255, 255, 0.06)',
                        color: isSelected ? '#fff' : 'var(--text-muted)',
                        fontWeight: 700
                      }}>
                        {isSelected ? 'Destinatario ✓' : 'Seleccionar'}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* Columna Derecha: Editor de Mensajes y Plantillas */}
        <section className="glass-panel" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '18px' }}>
          <div style={{ borderBottom: '1px solid var(--border-subtle)', paddingBottom: '12px' }}>
            <h2 style={{ fontSize: '18px', color: '#fff', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Send size={20} color="var(--primary)" />
              ENVIAR MENSAJE
            </h2>
          </div>

          {/* Destinatario */}
          <div>
            <label style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '8px', display: 'block' }}>
              DESTINATARIO
            </label>
            <div style={{ display: 'flex', gap: '10px' }}>
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
                style={{
                  width: '100%',
                  padding: '12px 16px',
                  borderRadius: 'var(--radius-md)',
                  background: 'rgba(255, 255, 255, 0.05)',
                  border: '1px solid var(--border-subtle)',
                  color: '#fff',
                  fontSize: '15px',
                  fontWeight: 600
                }}
              >
                <option value="ALL" style={{ background: '#111827' }}>👥 Todos los participantes conectados ({connectedCount})</option>
                {participants.map((p) => (
                  <option key={p.id} value={p.id} style={{ background: '#111827' }}>
                    {p.isConnected ? '🟢' : '🔴'} {p.name} {p.isConnected ? '(En línea)' : '(Desconectado)'}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Plantillas Rápidas */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
              <label style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                MENSAJES PREGUARDADOS
              </label>
              <button
                onClick={openNewTemplateModal}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--primary)',
                  fontSize: '13px',
                  fontWeight: 600,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  cursor: 'pointer'
                }}
              >
                <Plus size={15} /> Nueva Plantilla
              </button>
            </div>

            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              {templates.map((tmpl) => (
                <div
                  key={tmpl.id}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    background: 'rgba(255, 255, 255, 0.06)',
                    borderRadius: '999px',
                    border: '1px solid var(--border-subtle)',
                    overflow: 'hidden'
                  }}
                >
                  <button
                    onClick={() => handleUseTemplate(tmpl)}
                    title="Cargar en el editor"
                    style={{
                      padding: '6px 14px',
                      background: 'none',
                      color: '#fff',
                      fontSize: '13px',
                      fontWeight: 600,
                      cursor: 'pointer'
                    }}
                  >
                    {tmpl.name}
                  </button>
                  <button
                    onClick={() => openEditTemplateModal(tmpl)}
                    title="Editar plantilla"
                    style={{
                      padding: '6px 8px',
                      background: 'none',
                      color: 'var(--text-dim)',
                      cursor: 'pointer'
                    }}
                  >
                    <Edit2 size={12} />
                  </button>
                  <button
                    onClick={() => handleDeleteTemplate(tmpl.id, tmpl.name)}
                    title="Eliminar plantilla"
                    style={{
                      padding: '6px 8px',
                      background: 'none',
                      color: '#f87171',
                      cursor: 'pointer'
                    }}
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Textarea del Mensaje */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
              <label style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                MENSAJE
              </label>
              <span style={{ fontSize: '12px', color: 'var(--text-dim)' }}>
                Usa <code style={{ color: 'var(--accent)', background: 'rgba(236,72,153,0.1)' }}>{'{nombre}'}</code> para personalizar
              </span>
            </div>

            <textarea
              rows={4}
              value={messageContent}
              onChange={(e) => setMessageContent(e.target.value)}
              placeholder="Escribe el mensaje..."
              style={{
                width: '100%',
                padding: '14px 16px',
                borderRadius: 'var(--radius-md)',
                background: 'rgba(255, 255, 255, 0.05)',
                border: '1px solid var(--border-subtle)',
                color: '#fff',
                fontSize: '16px',
                lineHeight: 1.4,
                resize: 'vertical'
              }}
            />
          </div>

          {sendSuccessMsg && (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '10px 14px',
              borderRadius: '8px',
              background: 'rgba(16, 185, 129, 0.15)',
              border: '1px solid rgba(16, 185, 129, 0.3)',
              color: '#34d399',
              fontSize: '14px',
              fontWeight: 600
            }}>
              <CheckCircle size={18} />
              {sendSuccessMsg}
            </div>
          )}

          {/* Botones de Envío */}
          <div style={{ display: 'flex', gap: '12px' }}>
            {recipientType === 'ALL' ? (
              <button
                onClick={handleSendMessage}
                disabled={isSending || !messageContent.trim()}
                style={{
                  flex: 1,
                  padding: '14px 20px',
                  borderRadius: 'var(--radius-md)',
                  background: 'linear-gradient(135deg, var(--primary) 0%, #8b5cf6 100%)',
                  color: '#fff',
                  fontSize: '16px',
                  fontWeight: 700,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '10px',
                  boxShadow: '0 10px 25px -5px var(--primary-glow)',
                  opacity: (!messageContent.trim() || isSending) ? 0.6 : 1,
                  cursor: (!messageContent.trim() || isSending) ? 'not-allowed' : 'pointer'
                }}
              >
                <Send size={18} />
                {isSending ? 'Enviando...' : 'ENVIAR A TODOS'}
              </button>
            ) : (
              <button
                onClick={handleSendMessage}
                disabled={isSending || !messageContent.trim() || !selectedParticipantId}
                style={{
                  flex: 1,
                  padding: '14px 20px',
                  borderRadius: 'var(--radius-md)',
                  background: 'linear-gradient(135deg, var(--accent) 0%, #d946ef 100%)',
                  color: '#fff',
                  fontSize: '16px',
                  fontWeight: 700,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '10px',
                  boxShadow: '0 10px 25px -5px var(--accent-glow)',
                  opacity: (!messageContent.trim() || isSending || !selectedParticipantId) ? 0.6 : 1,
                  cursor: (!messageContent.trim() || isSending || !selectedParticipantId) ? 'not-allowed' : 'pointer'
                }}
              >
                <Send size={18} />
                {isSending ? 'Enviando...' : `ENVIAR A ${selectedParticipant?.name || 'PARTICIPANTE'}`}
              </button>
            )}
          </div>
        </section>
      </div>

      {/* 3. Sección de Historial en Vivo */}
      <section className="glass-panel" style={{ padding: '24px' }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: '16px',
          borderBottom: '1px solid var(--border-subtle)',
          paddingBottom: '12px'
        }}>
          <h2 style={{ fontSize: '18px', color: '#fff', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Clock size={20} color="var(--primary)" />
            HISTORIAL DE MENSAJES EN TIEMPO REAL
          </h2>
          <span style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
            Total enviados: {history.length}
          </span>
        </div>

        {history.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '28px', color: 'var(--text-dim)', fontSize: '14px' }}>
            No hay mensajes registrados aún en este evento.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', maxHeight: '280px', overflowY: 'auto' }}>
            {history.map((log) => (
              <div
                key={log.id}
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  justifyContent: 'space-between',
                  gap: '16px',
                  padding: '12px 16px',
                  borderRadius: 'var(--radius-md)',
                  background: 'rgba(255, 255, 255, 0.03)',
                  border: '1px solid var(--border-subtle)'
                }}
              >
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                    <span style={{
                      fontSize: '12px',
                      fontWeight: 700,
                      color: 'var(--text-dim)'
                    }}>
                      {new Date(log.sentAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                    <span style={{
                      fontSize: '12px',
                      fontWeight: 700,
                      padding: '2px 8px',
                      borderRadius: '4px',
                      background: log.recipientType === 'ALL' ? 'rgba(99, 102, 241, 0.2)' : 'rgba(236, 72, 153, 0.2)',
                      color: log.recipientType === 'ALL' ? '#818cf8' : '#f472b6'
                    }}>
                      → {log.recipientType === 'ALL' ? 'Todos' : log.recipientName || 'Individual'}
                    </span>
                  </div>
                  <div style={{ fontSize: '15px', color: '#fff', whiteSpace: 'pre-line' }}>
                    "{log.content}"
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
        </>
      )}

      {/* Modal: Código QR */}
      {showQrModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0, 0, 0, 0.8)',
          backdropFilter: 'blur(8px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 9999,
          padding: '20px'
        }}>
          <div className="glass-panel" style={{
            maxWidth: '440px',
            width: '100%',
            padding: '32px',
            textAlign: 'center',
            position: 'relative',
            background: '#111827'
          }}>
            <button
              onClick={() => setShowQrModal(false)}
              style={{
                position: 'absolute',
                top: '16px',
                right: '16px',
                background: 'none',
                border: 'none',
                color: 'var(--text-muted)',
                cursor: 'pointer'
              }}
            >
              <X size={20} />
            </button>

            <h2 style={{ fontSize: '22px', marginBottom: '8px', color: '#fff' }}>
              Código QR de Participación
            </h2>
            <p style={{ color: 'var(--text-muted)', fontSize: '14px', marginBottom: '24px' }}>
              Escanea con la cámara de tu teléfono móvil para conectarte a la sesión.
            </p>

            <div style={{
              background: '#fff',
              padding: '20px',
              borderRadius: '16px',
              display: 'inline-block',
              boxShadow: '0 10px 30px rgba(0,0,0,0.5)',
              marginBottom: '20px'
            }}>
              <QRCodeSVG value={qrUrl} size={220} />
            </div>

            <div style={{ marginBottom: '16px' }}>
              <label style={{ fontSize: '12px', color: 'var(--text-dim)', display: 'block', marginBottom: '6px' }}>
                URL de Participación:
              </label>
              <input
                type="text"
                value={qrUrl}
                onChange={(e) => setQrUrl(e.target.value)}
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  borderRadius: '8px',
                  background: 'rgba(255, 255, 255, 0.06)',
                  border: '1px solid var(--border-subtle)',
                  color: '#fff',
                  fontSize: '13px',
                  textAlign: 'center'
                }}
              />
            </div>

            <div style={{ display: 'flex', gap: '10px' }}>
              <button
                onClick={() => {
                  navigator.clipboard.writeText(qrUrl);
                  alert('¡Enlace copiado al portapapeles!');
                }}
                style={{
                  flex: 1,
                  padding: '10px',
                  borderRadius: '8px',
                  background: 'rgba(255, 255, 255, 0.1)',
                  color: '#fff',
                  fontWeight: 600,
                  fontSize: '14px'
                }}
              >
                Copiar Enlace
              </button>
              <button
                onClick={() => window.open(qrUrl, '_blank')}
                style={{
                  flex: 1,
                  padding: '10px',
                  borderRadius: '8px',
                  background: 'var(--primary)',
                  color: '#fff',
                  fontWeight: 600,
                  fontSize: '14px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px'
                }}
              >
                <ExternalLink size={16} /> Abrir Pestaña
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Crear / Editar Plantilla */}
      {showTemplateModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0, 0, 0, 0.8)',
          backdropFilter: 'blur(8px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 9999,
          padding: '20px'
        }}>
          <div className="glass-panel" style={{
            maxWidth: '480px',
            width: '100%',
            padding: '30px',
            position: 'relative',
            background: '#111827'
          }}>
            <button
              onClick={() => setShowTemplateModal(false)}
              style={{
                position: 'absolute',
                top: '16px',
                right: '16px',
                background: 'none',
                border: 'none',
                color: 'var(--text-muted)',
                cursor: 'pointer'
              }}
            >
              <X size={20} />
            </button>

            <h2 style={{ fontSize: '20px', marginBottom: '16px', color: '#fff' }}>
              {editingTemplate ? 'Editar Plantilla' : 'Nueva Plantilla'}
            </h2>

            <form onSubmit={handleSaveTemplate} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <label style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: '6px' }}>
                  Nombre / Título de la plantilla
                </label>
                <input
                  type="text"
                  value={templateName}
                  onChange={(e) => setTemplateName(e.target.value)}
                  placeholder="Ej: 👋 Bienvenida personalizada"
                  required
                  style={{
                    width: '100%',
                    padding: '12px 14px',
                    borderRadius: '8px',
                    background: 'rgba(255, 255, 255, 0.05)',
                    border: '1px solid var(--border-subtle)',
                    color: '#fff',
                    fontSize: '15px'
                  }}
                />
              </div>

              <div>
                <label style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: '6px' }}>
                  Contenido del mensaje (soporta {'{nombre}'})
                </label>
                <textarea
                  rows={4}
                  value={templateBody}
                  onChange={(e) => setTemplateBody(e.target.value)}
                  placeholder="Hola {nombre} 👋 ..."
                  required
                  style={{
                    width: '100%',
                    padding: '12px 14px',
                    borderRadius: '8px',
                    background: 'rgba(255, 255, 255, 0.05)',
                    border: '1px solid var(--border-subtle)',
                    color: '#fff',
                    fontSize: '15px'
                  }}
                />
              </div>

              <div style={{ display: 'flex', gap: '10px', marginTop: '8px' }}>
                <button
                  type="button"
                  onClick={() => setShowTemplateModal(false)}
                  style={{
                    flex: 1,
                    padding: '12px',
                    borderRadius: '8px',
                    background: 'rgba(255, 255, 255, 0.1)',
                    color: '#fff',
                    fontWeight: 600
                  }}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  style={{
                    flex: 1,
                    padding: '12px',
                    borderRadius: '8px',
                    background: 'var(--primary)',
                    color: '#fff',
                    fontWeight: 700
                  }}
                >
                  Guardar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* Modal: Crear Pregunta de Trivia */}
      {showQuestionModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0, 0, 0, 0.8)',
          backdropFilter: 'blur(8px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 9999,
          padding: '20px'
        }}>
          <div className="glass-panel" style={{
            maxWidth: '520px',
            width: '100%',
            padding: '30px',
            position: 'relative',
            background: '#111827',
            maxHeight: '90vh',
            overflowY: 'auto'
          }}>
            <button
              onClick={() => setShowQuestionModal(false)}
              style={{
                position: 'absolute',
                top: '16px',
                right: '16px',
                background: 'none',
                border: 'none',
                color: 'var(--text-muted)',
                cursor: 'pointer'
              }}
            >
              <X size={20} />
            </button>

            <h2 style={{ fontSize: '20px', marginBottom: '16px', color: '#fff' }}>
              ➕ Nueva Pregunta de Trivia
            </h2>

            <form onSubmit={handleCreateQuestion} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: '6px' }}>
                  Texto de la pregunta
                </label>
                <textarea
                  rows={3}
                  value={newQuestionText}
                  onChange={(e) => setNewQuestionText(e.target.value)}
                  placeholder="Ej: ¿Quién construyó el arca según el libro de Génesis?"
                  required
                  style={{
                    width: '100%',
                    padding: '12px 14px',
                    borderRadius: '8px',
                    background: 'rgba(255, 255, 255, 0.05)',
                    border: '1px solid var(--border-subtle)',
                    color: '#fff',
                    fontSize: '14px'
                  }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: '6px' }}>
                    Tipo de Pregunta
                  </label>
                  <select
                    value={newQuestionType}
                    onChange={(e) => setNewQuestionType(e.target.value as QuestionType)}
                    style={{
                      width: '100%',
                      padding: '10px 12px',
                      borderRadius: '8px',
                      background: 'rgba(255, 255, 255, 0.05)',
                      border: '1px solid var(--border-subtle)',
                      color: '#fff',
                      fontSize: '13px'
                    }}
                  >
                    <option value="ORAL_DEFENSE">🎤 Defensa Oral</option>
                    <option value="MULTIPLE_CHOICE">⚡ Opción Múltiple</option>
                  </select>
                </div>

                <div>
                  <label style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: '6px' }}>
                    Puntos
                  </label>
                  <input
                    type="number"
                    value={newQuestionPoints}
                    onChange={(e) => setNewQuestionPoints(Number(e.target.value))}
                    min={10}
                    step={10}
                    style={{
                      width: '100%',
                      padding: '10px 12px',
                      borderRadius: '8px',
                      background: 'rgba(255, 255, 255, 0.05)',
                      border: '1px solid var(--border-subtle)',
                      color: '#fff',
                      fontSize: '13px'
                    }}
                  />
                </div>
              </div>

              <div>
                <label style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: '6px' }}>
                  Tiempo límite (segundos)
                </label>
                <input
                  type="number"
                  value={newQuestionTime}
                  onChange={(e) => setNewQuestionTime(Number(e.target.value))}
                  min={5}
                  max={120}
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    borderRadius: '8px',
                    background: 'rgba(255, 255, 255, 0.05)',
                    border: '1px solid var(--border-subtle)',
                    color: '#fff',
                    fontSize: '13px'
                  }}
                />
              </div>

              {newQuestionType === 'MULTIPLE_CHOICE' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '6px' }}>
                  <label style={{ fontSize: '13px', fontWeight: 600, color: 'var(--primary)' }}>
                    Opciones de Respuesta & Respuesta Correcta:
                  </label>
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
                        style={{ cursor: 'pointer', accentColor: 'var(--primary)' }}
                      />
                      <span style={{ fontWeight: 700, fontSize: '13px', color: '#fff', width: '20px' }}>{opt.label}.</span>
                      <input
                        type="text"
                        value={opt.val}
                        onChange={(e) => opt.setVal(e.target.value)}
                        placeholder={`Texto opción ${opt.label}`}
                        required={opt.idx < 2}
                        style={{
                          flex: 1,
                          padding: '8px 12px',
                          borderRadius: '6px',
                          background: 'rgba(255, 255, 255, 0.05)',
                          border: newCorrectOptionIndex === opt.idx ? '1px solid #10b981' : '1px solid var(--border-subtle)',
                          color: '#fff',
                          fontSize: '13px'
                        }}
                      />
                    </div>
                  ))}
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                    * Selecciona el botón circular al lado de la opción que es correcta.
                  </div>
                </div>
              )}

              <div style={{ display: 'flex', gap: '10px', marginTop: '12px' }}>
                <button
                  type="button"
                  onClick={() => setShowQuestionModal(false)}
                  style={{
                    flex: 1,
                    padding: '12px',
                    borderRadius: '8px',
                    background: 'rgba(255, 255, 255, 0.1)',
                    color: '#fff',
                    fontWeight: 600,
                    cursor: 'pointer'
                  }}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  style={{
                    flex: 1,
                    padding: '12px',
                    borderRadius: '8px',
                    background: 'var(--primary)',
                    color: '#fff',
                    fontWeight: 700,
                    cursor: 'pointer'
                  }}
                >
                  Guardar Pregunta
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal de Emergencia: Reseteo Maestro del Evento */}
      {showResetModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0, 0, 0, 0.85)',
          backdropFilter: 'blur(8px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 100,
          padding: '20px'
        }}>
          <div className="glass-panel" style={{
            maxWidth: '480px',
            width: '100%',
            padding: '28px',
            border: '2px solid #ef4444',
            background: 'radial-gradient(ellipse at top, rgba(239, 68, 68, 0.2) 0%, rgba(13, 17, 23, 0.98) 75%)',
            boxShadow: '0 0 40px rgba(239, 68, 68, 0.4)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
              <div style={{
                width: '46px',
                height: '46px',
                borderRadius: '50%',
                background: 'rgba(239, 68, 68, 0.2)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#f87171'
              }}>
                <ShieldAlert size={26} />
              </div>
              <div>
                <h3 style={{ fontSize: '20px', color: '#fff', margin: 0, fontWeight: 800 }}>
                  Reseteo Maestro del Evento
                </h3>
                <span style={{ fontSize: '12px', color: '#f87171', fontWeight: 700, textTransform: 'uppercase' }}>
                  Operación de Contingencia Crítica
                </span>
              </div>
            </div>

            <div style={{
              padding: '14px',
              borderRadius: '8px',
              background: 'rgba(239, 68, 68, 0.1)',
              border: '1px solid rgba(239, 68, 68, 0.25)',
              color: '#fca5a5',
              fontSize: '13px',
              lineHeight: 1.5,
              marginBottom: '18px'
            }}>
              <strong>⚠️ ADVERTENCIA:</strong> Esta acción borrará inmediatamente:
              <ul style={{ margin: '6px 0 0 16px', padding: 0 }}>
                <li>Todos los participantes conectados y registrados</li>
                <li>Todos los equipos formados y sus puntuaciones</li>
                <li>Los chats en duplas y las fotos compartidas</li>
              </ul>
              <p style={{ marginTop: '8px', marginBottom: 0, color: '#34d399', fontWeight: 600 }}>
                ✓ El banco de preguntas y las plantillas NO se borrarán.
              </p>
            </div>

            <div style={{ marginBottom: '20px' }}>
              <label style={{ fontSize: '13px', fontWeight: 700, color: '#fff', display: 'block', marginBottom: '8px' }}>
                Para confirmar, escribe exactamente <span style={{ color: '#ef4444', letterSpacing: '0.1em' }}>RESET</span> a continuación:
              </label>
              <input
                type="text"
                value={resetConfirmInput}
                onChange={(e) => setResetConfirmInput(e.target.value.toUpperCase())}
                placeholder="Escribe RESET aquí"
                style={{
                  width: '100%',
                  padding: '12px',
                  borderRadius: '8px',
                  background: 'rgba(0, 0, 0, 0.5)',
                  border: resetConfirmInput === 'RESET' ? '2px solid #ef4444' : '1px solid var(--border-subtle)',
                  color: '#fff',
                  fontSize: '16px',
                  fontWeight: 800,
                  textAlign: 'center',
                  letterSpacing: '0.15em'
                }}
              />
            </div>

            <div style={{ display: 'flex', gap: '12px' }}>
              <button
                type="button"
                onClick={() => {
                  setShowResetModal(false);
                  setResetConfirmInput('');
                }}
                disabled={isResetting}
                style={{
                  flex: 1,
                  padding: '12px',
                  borderRadius: '8px',
                  background: 'rgba(255, 255, 255, 0.08)',
                  color: '#fff',
                  fontWeight: 600,
                  fontSize: '14px',
                  cursor: 'pointer'
                }}
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleResetEvent}
                disabled={resetConfirmInput !== 'RESET' || isResetting}
                style={{
                  flex: 1,
                  padding: '12px',
                  borderRadius: '8px',
                  background: resetConfirmInput === 'RESET' ? 'linear-gradient(135deg, #ef4444 0%, #b91c1c 100%)' : 'rgba(255, 255, 255, 0.1)',
                  color: '#fff',
                  fontWeight: 800,
                  fontSize: '14px',
                  cursor: resetConfirmInput === 'RESET' && !isResetting ? 'pointer' : 'not-allowed',
                  opacity: resetConfirmInput === 'RESET' ? 1 : 0.4,
                  boxShadow: resetConfirmInput === 'RESET' ? '0 0 20px rgba(239, 68, 68, 0.4)' : 'none'
                }}
              >
                {isResetting ? 'Reiniciando...' : 'Confirmar Reseteo'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

