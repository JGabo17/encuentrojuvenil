import { useState, useEffect, useRef } from 'react';
import { socket } from '../services/socket';
import { fetchTeams } from '../services/api';
import { compressImageToDataUrl } from '../utils/imageCompressor';
import { TeamAvatar } from '../components/TeamAvatar';
import confetti from 'canvas-confetti';
import {
  AlertTriangle,
  ArrowRight,
  Shield,
  Users,
  Copy,
  Check,
  Crown,
  KeyRound,
  LogOut,
  UploadCloud,
  Image as ImageIcon,
  X,
  Flame,
  Trophy,
  Camera,
  Send,
  MessageCircle
} from 'lucide-react';
import type { LiveMessagePayload, Participant, Team, GameState, PairingData, ChatMessageItem } from '../../../shared/types/index.js';

export function ParticipantPage() {
  const [mode, setMode] = useState<'captain' | 'member'>('captain');
  const [isRegistered, setIsRegistered] = useState(false);
  const [participant, setParticipant] = useState<Participant | null>(null);
  const [currentTeam, setCurrentTeam] = useState<Team | null>(null);
  const [isConnected, setIsConnected] = useState(socket.connected);
  const [messages, setMessages] = useState<LiveMessagePayload[]>([]);
  const [errorMsg, setErrorMsg] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [copiedPin, setCopiedPin] = useState(false);

  const [gameState, setGameState] = useState<GameState>({
    status: 'LOBBY',
    currentQuestion: null,
    timeRemaining: 0,
    buzzerWinner: null,
    selectedChoice: null,
    result: null
  });
  const [buzzStatus, setBuzzStatus] = useState<'idle' | 'buzzing' | 'won' | 'lost'>('idle');

  // Fase 3: Encuentro e Integración (Chat en duplas)
  const [activeTab, setActiveTab] = useState<'trivia' | 'social'>('trivia');
  const [pairingData, setPairingData] = useState<PairingData | null>(null);
  const [chatEnabled, setChatEnabled] = useState(false);
  const [chatInput, setChatInput] = useState('');
  const [chatPhotoUrl, setChatPhotoUrl] = useState<string | null>(null);
  const [isSendingChat, setIsSendingChat] = useState(false);
  const chatFileInputRef = useRef<HTMLInputElement | null>(null);
  const chatScrollRef = useRef<HTMLDivElement | null>(null);

  // Formulario Capitán
  const [captainName, setCaptainName] = useState('');
  const [teamName, setTeamName] = useState('');
  const [teamMotto, setTeamMotto] = useState('');
  const [teamPhotoUrl, setTeamPhotoUrl] = useState<string | null>(null);
  const [isProcessingPhoto, setIsProcessingPhoto] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Formulario Integrante
  const [memberName, setMemberName] = useState('');
  const [selectedTeamId, setSelectedTeamId] = useState('');
  const [memberPin, setMemberPin] = useState('');

  // Equipos disponibles
  const [availableTeams, setAvailableTeams] = useState<Team[]>([]);

  // Cargar equipos disponibles
  const loadTeams = () => {
    fetchTeams()
      .then((teams) => {
        setAvailableTeams(teams);
        if (teams.length > 0 && !selectedTeamId) {
          setSelectedTeamId(teams[0].id);
        }
      })
      .catch((err) => console.error('Error cargando equipos:', err));
  };

  useEffect(() => {
    loadTeams();

    // Obtener estado inicial del juego
    socket.emit('game:get-state', (res) => {
      if (res?.state) setGameState(res.state);
    });

    // Intentar reconectar si ya tiene sesión guardada
    const savedToken = localStorage.getItem('encuentro_session_token');
    const savedName = localStorage.getItem('encuentro_participant_name');

    if (savedToken && savedName) {
      socket.emit('participant:join', { name: savedName, sessionToken: savedToken }, (res) => {
        if (res.success && res.participant) {
          setParticipant(res.participant);
          if (res.participant.team) {
            setCurrentTeam(res.participant.team);
          }
          setIsRegistered(true);
        }
      });
    }
  }, []);

  // Socket Listeners
  useEffect(() => {
    function onConnect() {
      setIsConnected(true);
      const savedToken = localStorage.getItem('encuentro_session_token');
      const savedName = localStorage.getItem('encuentro_participant_name');
      if (savedToken && savedName) {
        socket.emit('participant:join', { name: savedName, sessionToken: savedToken }, (res) => {
          if (res.success && res.participant) {
            setParticipant(res.participant);
            if (res.participant.team) {
              setCurrentTeam(res.participant.team);
            }
            setIsRegistered(true);
          }
        });
      }
      socket.emit('game:get-state', (res) => {
        if (res?.state) setGameState(res.state);
      });
    }

    function onDisconnect() {
      setIsConnected(false);
    }

    function onTeamsUpdate(teams: Team[]) {
      setAvailableTeams(teams);
      if (currentTeam) {
        const updated = teams.find((t) => t.id === currentTeam.id);
        if (updated) setCurrentTeam((prev) => ({ ...prev, ...updated }));
      }
    }

    function onGameStateUpdate(state: GameState) {
      setGameState(state);
      if (state.status === 'QUESTION_ACTIVE') {
        setBuzzStatus('idle');
      }
      if (state.status === 'LEADERBOARD' || (state.status === 'SHOWING_RESULT' && state.result?.grade === 'CORRECT')) {
        try {
          confetti({
            particleCount: 50,
            spread: 70,
            origin: { y: 0.4 },
            colors: ['#ff6519', '#ff8a3d', '#ffffff']
          });
        } catch (e) {}
      }
    }

    function onGameTimerTick({ timeRemaining }: { timeRemaining: number }) {
      setGameState((prev) => ({ ...prev, timeRemaining }));
    }

    function onCountdownTick({ countdownRemaining }: { countdownRemaining: number }) {
      setGameState((prev) => ({ ...prev, countdownRemaining }));
    }

    function onMessageReceived(msg: LiveMessagePayload) {
      setMessages((prev) => [msg, ...prev]);
      try {
        confetti({
          particleCount: 45,
          spread: 60,
          origin: { y: 0.35 },
          colors: ['#ff6519', '#ff8a3d', '#ffffff', '#10b981']
        });
      } catch (e) {}
    }

    function onPairingAssigned(pairing: PairingData) {
      setPairingData(pairing);
      setActiveTab('social');
      socket.emit('participant:get-pairing');
      try {
        confetti({
          particleCount: 70,
          spread: 80,
          origin: { y: 0.5 },
          colors: ['#3b82f6', '#10b981', '#ff6519', '#ffffff']
        });
      } catch (e) {}
    }

    function onNewChatMessage(msg: ChatMessageItem) {
      setPairingData((prev) => {
        if (!prev) return prev;
        const exists = prev.messages.some((m) => m.id === msg.id);
        if (exists) return prev;
        return {
          ...prev,
          messages: [...prev.messages, msg]
        };
      });
      setTimeout(() => {
        if (chatScrollRef.current) {
          chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
        }
      }, 50);
    }

    function onChatStatusChange(data: { chatEnabled: boolean }) {
      setChatEnabled(data.chatEnabled);
    }

    function onParticipantKicked(data: { reason: string }) {
      localStorage.removeItem('encuentro_session_token');
      localStorage.removeItem('encuentro_participant_name');
      localStorage.removeItem('encuentro_token');
      localStorage.removeItem('encuentro_participant');
      alert(`⚠️ Notificación del Moderador: ${data.reason}`);
      window.location.reload();
    }

    function onRoleUpdated(data: { role: any }) {
      setParticipant((prev) => (prev ? { ...prev, role: data.role } : null));
      alert('👑 ¡Has sido asignado como Capitán de tu equipo! Tu pulsador digital está activado.');
    }

    function onEventReset() {
      localStorage.removeItem('encuentro_session_token');
      localStorage.removeItem('encuentro_participant_name');
      localStorage.removeItem('encuentro_token');
      localStorage.removeItem('encuentro_participant');
      alert('🔄 El evento ha sido reiniciado por el moderador.');
      window.location.reload();
    }

    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);
    socket.on('teams:update', onTeamsUpdate);
    socket.on('game:state-update', onGameStateUpdate);
    socket.on('game:timer-tick', onGameTimerTick);
    socket.on('game:countdown-tick', onCountdownTick);
    socket.on('message:received', onMessageReceived);
    socket.on('pairing:assigned', onPairingAssigned);
    socket.on('chat:new-message', onNewChatMessage);
    socket.on('chat:status-change', onChatStatusChange);
    socket.on('participant:kicked', onParticipantKicked);
    socket.on('participant:role-updated', onRoleUpdated);
    socket.on('event:reset', onEventReset);

    // Cargar información inicial de duplas
    socket.emit('participant:get-pairing', (res) => {
      if (res?.success) {
        if (res.pairing) setPairingData(res.pairing);
        setChatEnabled(Boolean(res.chatEnabled));
      }
    });

    return () => {
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
      socket.off('teams:update', onTeamsUpdate);
      socket.off('game:state-update', onGameStateUpdate);
      socket.off('game:timer-tick', onGameTimerTick);
      socket.off('game:countdown-tick', onCountdownTick);
      socket.off('message:received', onMessageReceived);
      socket.off('pairing:assigned', onPairingAssigned);
      socket.off('chat:new-message', onNewChatMessage);
      socket.off('chat:status-change', onChatStatusChange);
      socket.off('participant:kicked', onParticipantKicked);
      socket.off('participant:role-updated', onRoleUpdated);
      socket.off('event:reset', onEventReset);
    };
  }, [currentTeam]);

  // Manejar subida de foto del equipo (comprimiendo en el navegador)
  const handlePhotoSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setIsProcessingPhoto(true);
      setErrorMsg('');
      const compressedDataUrl = await compressImageToDataUrl(file, 300, 0.82);
      setTeamPhotoUrl(compressedDataUrl);
    } catch (err: any) {
      setErrorMsg(err.message || 'Error al procesar la foto');
    } finally {
      setIsProcessingPhoto(false);
    }
  };

  const handleRemovePhoto = () => {
    setTeamPhotoUrl(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // Manejador: Crear Equipo (Capitán)
  const handleCreateTeam = (e: React.FormEvent) => {
    e.preventDefault();
    if (!captainName.trim()) return setErrorMsg('Por favor introduce tu nombre de líder/capitán.');
    if (!teamName.trim()) return setErrorMsg('Por favor introduce el nombre para tu equipo.');

    setErrorMsg('');
    setIsSubmitting(true);

    const savedToken = localStorage.getItem('encuentro_session_token') || undefined;

    socket.emit(
      'team:create',
      {
        captainName: captainName.trim(),
        teamName: teamName.trim(),
        motto: teamMotto.trim() || undefined,
        avatar: teamPhotoUrl || 'DEFAULT', // Si es DEFAULT o no tiene imagen, el componente genera el escudo por iniciales
        sessionToken: savedToken
      },
      (res) => {
        setIsSubmitting(false);
        if (res.success && res.participant && res.team) {
          setParticipant(res.participant);
          setCurrentTeam(res.team);
          setIsRegistered(true);
          localStorage.setItem('encuentro_session_token', res.participant.sessionToken);
          localStorage.setItem('encuentro_participant_name', res.participant.name);

          try {
            confetti({
              particleCount: 70,
              spread: 80,
              origin: { y: 0.4 },
              colors: ['#ff6519', '#ff8a3d', '#ffffff']
            });
          } catch (e) {}
        } else {
          setErrorMsg(res.error || 'Error al crear el equipo. Intenta nuevamente.');
        }
      }
    );
  };

  // Manejador: Unirse a Equipo con PIN (Integrante)
  const handleJoinTeam = (e: React.FormEvent) => {
    e.preventDefault();
    if (!memberName.trim()) return setErrorMsg('Por favor introduce tu nombre.');
    if (!selectedTeamId) return setErrorMsg('Selecciona un equipo de la lista.');
    if (!memberPin.trim()) return setErrorMsg('Ingresa el código PIN de 4 dígitos proporcionado por tu capitán.');

    setErrorMsg('');
    setIsSubmitting(true);

    const savedToken = localStorage.getItem('encuentro_session_token') || undefined;

    socket.emit(
      'team:join',
      {
        teamId: selectedTeamId,
        pin: memberPin.trim(),
        name: memberName.trim(),
        sessionToken: savedToken
      },
      (res) => {
        setIsSubmitting(false);
        if (res.success && res.participant && res.team) {
          setParticipant(res.participant);
          setCurrentTeam(res.team);
          setIsRegistered(true);
          localStorage.setItem('encuentro_session_token', res.participant.sessionToken);
          localStorage.setItem('encuentro_participant_name', res.participant.name);

          try {
            confetti({
              particleCount: 50,
              spread: 60,
              origin: { y: 0.4 },
              colors: ['#ff6519', '#ff8a3d', '#ffffff']
            });
          } catch (e) {}
        } else {
          setErrorMsg(res.error || 'PIN incorrecto o error al unirse al equipo.');
        }
      }
    );
  };

  const handleCopyPin = (pin: string) => {
    navigator.clipboard.writeText(pin);
    setCopiedPin(true);
    setTimeout(() => setCopiedPin(false), 2000);
  };

  const handleResetSession = () => {
    if (confirm('¿Estás seguro de que deseas salir del equipo y cerrar sesión?')) {
      localStorage.removeItem('encuentro_session_token');
      localStorage.removeItem('encuentro_participant_name');
      setIsRegistered(false);
      setParticipant(null);
      setCurrentTeam(null);
      setMessages([]);
      loadTeams();
    }
  };

  // Fase 2: Acción del Pulsador (Capitán)
  const handleBuzz = () => {
    if (participant?.role !== 'CAPTAIN') return;
    try {
      if ('vibrate' in navigator) navigator.vibrate([100, 50, 100]);
    } catch (e) {}

    setBuzzStatus('buzzing');
    socket.emit('captain:buzz', (res) => {
      if (res?.success && res.won) {
        setBuzzStatus('won');
      } else {
        setBuzzStatus('lost');
        if (res?.error) setErrorMsg(res.error);
      }
    });
  };

  // Fase 2: Responder Opción Múltiple (Capitán)
  const handleChoiceSubmit = (choiceIndex: number) => {
    if (participant?.role !== 'CAPTAIN') return;
    socket.emit('captain:submit-choice', { choiceIndex }, (res) => {
      if (!res?.success && res?.error) {
        setErrorMsg(res.error);
      }
    });
  };

  // Fase 3: Acciones del Chat de Dupla
  const handleSendChatMessage = (textToSend?: string) => {
    const text = textToSend !== undefined ? textToSend : chatInput;
    if ((!text.trim() && !chatPhotoUrl) || !pairingData) return;

    setIsSendingChat(true);
    socket.emit(
      'chat:send-message',
      {
        pairingId: pairingData.id,
        content: text.trim(),
        photoUrl: chatPhotoUrl || undefined
      },
      (res) => {
        setIsSendingChat(false);
        if (res?.success) {
          setChatInput('');
          setChatPhotoUrl(null);
          if (res.message) {
            setPairingData((prev) => {
              if (!prev) return prev;
              const exists = prev.messages.some((m) => m.id === res.message!.id);
              if (exists) return prev;
              return { ...prev, messages: [...prev.messages, res.message!] };
            });
            setTimeout(() => {
              if (chatScrollRef.current) {
                chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
              }
            }, 50);
          }
        } else {
          alert(res?.error || 'Error al enviar mensaje');
        }
      }
    );
  };

  const handleChatPhotoSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const compressed = await compressImageToDataUrl(file, 480, 0.72);
      setChatPhotoUrl(compressed);
    } catch (err: any) {
      alert('Error procesando imagen: ' + err.message);
    } finally {
      if (chatFileInputRef.current) chatFileInputRef.current.value = '';
    }
  };

  const quickGreetings = [
    '👋 ¡Hola! Mucho gusto',
    '🔥 ¡Gran equipo el tuyo!',
    '🙏 ¡Bendiciones en este encuentro!',
    '📸 ¡Tomémonos una foto juntos!'
  ];

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'center',
      alignItems: 'center',
      padding: '20px',
      position: 'relative'
    }}>
      {/* Alerta flotante de conexión */}
      {!isConnected && (
        <div style={{
          position: 'fixed',
          top: '16px',
          left: '50%',
          transform: 'translateX(-50%)',
          zIndex: 999,
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          backgroundColor: 'rgba(239, 68, 68, 0.95)',
          color: '#fff',
          padding: '10px 20px',
          borderRadius: '999px',
          fontSize: '14px',
          fontWeight: 600,
          boxShadow: '0 8px 24px rgba(239, 68, 68, 0.4)',
          backdropFilter: 'blur(8px)',
          animation: 'pulse-glow 1.5s infinite ease-in-out'
        }}>
          <AlertTriangle size={18} />
          ⚠️ Conexión perdida. Intentando reconectar...
        </div>
      )}

      {/* VISTA 1: REGISTRO (CAPITÁN O INTEGRANTE) */}
      {!isRegistered ? (
        <div className="glass-panel" style={{
          maxWidth: '480px',
          width: '100%',
          padding: '30px 24px',
          textAlign: 'center',
          animation: 'fadeIn 0.3s ease',
          boxShadow: '0 20px 45px rgba(0,0,0,0.6)',
          border: '1px solid rgba(255, 101, 25, 0.25)'
        }}>
          {/* Logo Oficial RVC con Glow 3D */}
          <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            position: 'relative',
            marginBottom: '14px'
          }}>
            <div style={{
              position: 'absolute',
              inset: '-8px',
              borderRadius: '50%',
              background: 'radial-gradient(circle, rgba(255, 87, 34, 0.45) 0%, transparent 70%)',
              animation: 'pulse-glow 2.5s infinite ease-in-out'
            }} />
            <img
              src="/logo-rvc.png"
              alt="Logo RVC"
              style={{
                width: '74px',
                height: '74px',
                objectFit: 'contain',
                position: 'relative',
                zIndex: 1,
                filter: 'drop-shadow(0 0 14px rgba(255, 87, 34, 0.85))'
              }}
            />
          </div>

          <div style={{
            fontSize: '11px',
            letterSpacing: '0.16em',
            textTransform: 'uppercase',
            fontWeight: 800,
            color: 'var(--primary)',
            marginBottom: '4px'
          }}>
            ENCUENTRO JUVENIL
          </div>

          <h1 style={{
            fontSize: '26px',
            fontWeight: 900,
            marginBottom: '6px',
            color: '#fff',
            letterSpacing: '-0.02em'
          }}>
            Ingreso al Evento ⚡
          </h1>

          <p style={{
            color: 'var(--text-muted)',
            fontSize: '14px',
            marginBottom: '20px'
          }}>
            Elige tu rol para comenzar la experiencia:
          </p>

          {/* Selector de Pestañas: Capitán vs Integrante */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: '8px',
            background: 'rgba(0, 0, 0, 0.35)',
            padding: '5px',
            borderRadius: '14px',
            marginBottom: '22px',
            border: '1px solid rgba(255, 255, 255, 0.06)'
          }}>
            <button
              type="button"
              onClick={() => { setMode('captain'); setErrorMsg(''); }}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                padding: '11px 14px',
                borderRadius: '10px',
                border: 'none',
                background: mode === 'captain'
                  ? 'linear-gradient(135deg, var(--primary) 0%, #ea580c 100%)'
                  : 'transparent',
                color: mode === 'captain' ? '#fff' : 'var(--text-muted)',
                fontWeight: 700,
                fontSize: '13px',
                cursor: 'pointer',
                boxShadow: mode === 'captain' ? '0 4px 14px rgba(255, 101, 25, 0.3)' : 'none',
                transition: 'all 0.2s ease'
              }}
            >
              <Crown size={16} />
              Soy Capitán
            </button>

            <button
              type="button"
              onClick={() => { setMode('member'); setErrorMsg(''); loadTeams(); }}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                padding: '11px 14px',
                borderRadius: '10px',
                border: 'none',
                background: mode === 'member'
                  ? 'linear-gradient(135deg, var(--primary) 0%, #ea580c 100%)'
                  : 'transparent',
                color: mode === 'member' ? '#fff' : 'var(--text-muted)',
                fontWeight: 700,
                fontSize: '13px',
                cursor: 'pointer',
                boxShadow: mode === 'member' ? '0 4px 14px rgba(255, 101, 25, 0.3)' : 'none',
                transition: 'all 0.2s ease'
              }}
            >
              <Users size={16} />
              Soy Integrante
            </button>
          </div>

          {/* MENSAJE DE ERROR */}
          {errorMsg && (
            <div style={{
              background: 'rgba(239, 68, 68, 0.15)',
              border: '1px solid rgba(239, 68, 68, 0.3)',
              color: '#fca5a5',
              padding: '10px 14px',
              borderRadius: '10px',
              fontSize: '13px',
              marginBottom: '18px',
              textAlign: 'left'
            }}>
              {errorMsg}
            </div>
          )}

          {/* MODO A: CREAR EQUIPO (CAPITÁN) */}
          {mode === 'captain' ? (
            <form onSubmit={handleCreateTeam} style={{ display: 'flex', flexDirection: 'column', gap: '16px', textAlign: 'left' }}>
              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '6px' }}>
                  Tu nombre (Líder / Capitán)
                </label>
                <input
                  type="text"
                  placeholder="Ej. Lucas, Valentina..."
                  value={captainName}
                  onChange={(e) => setCaptainName(e.target.value)}
                  maxLength={40}
                  required
                  style={{
                    width: '100%',
                    padding: '12px 14px',
                    borderRadius: '10px',
                    background: 'rgba(255, 255, 255, 0.05)',
                    border: '1px solid rgba(255, 255, 255, 0.12)',
                    color: '#fff',
                    fontSize: '15px',
                    boxSizing: 'border-box'
                  }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '6px' }}>
                  Nombre del Equipo
                </label>
                <input
                  type="text"
                  placeholder="Ej. Los Halcones, Rescate Juvenil..."
                  value={teamName}
                  onChange={(e) => setTeamName(e.target.value)}
                  maxLength={40}
                  required
                  style={{
                    width: '100%',
                    padding: '12px 14px',
                    borderRadius: '10px',
                    background: 'rgba(255, 255, 255, 0.05)',
                    border: '1px solid rgba(255, 255, 255, 0.12)',
                    color: '#fff',
                    fontSize: '15px',
                    boxSizing: 'border-box'
                  }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '6px' }}>
                  Lema del equipo (Opcional)
                </label>
                <input
                  type="text"
                  placeholder="Ej. ¡Siempre unidos hacia la meta!"
                  value={teamMotto}
                  onChange={(e) => setTeamMotto(e.target.value)}
                  maxLength={80}
                  style={{
                    width: '100%',
                    padding: '12px 14px',
                    borderRadius: '10px',
                    background: 'rgba(255, 255, 255, 0.05)',
                    border: '1px solid rgba(255, 255, 255, 0.12)',
                    color: '#fff',
                    fontSize: '14px',
                    boxSizing: 'border-box'
                  }}
                />
              </div>

              {/* Subida Opcional de Foto/Logo para el Equipo (sin emojis obligatorios) */}
              <div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                  <label style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-muted)' }}>
                    Logo o Escudo del Equipo <span style={{ color: 'var(--primary)', fontWeight: 700 }}>(Opcional)</span>
                  </label>
                  {teamPhotoUrl && (
                    <button
                      type="button"
                      onClick={handleRemovePhoto}
                      style={{
                        background: 'transparent',
                        border: 'none',
                        color: '#f87171',
                        fontSize: '12px',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px'
                      }}
                    >
                      <X size={14} /> Quitar
                    </button>
                  )}
                </div>

                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handlePhotoSelect}
                  style={{ display: 'none' }}
                />

                {teamPhotoUrl ? (
                  /* Vista previa de la foto subida */
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '14px',
                    padding: '12px 14px',
                    borderRadius: '12px',
                    background: 'rgba(255, 101, 25, 0.1)',
                    border: '1px solid rgba(255, 101, 25, 0.3)'
                  }}>
                    <TeamAvatar avatar={teamPhotoUrl} teamName={teamName || 'Equipo'} size={52} />
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: '13px', fontWeight: 700, color: '#fff' }}>¡Logo cargado con éxito!</div>
                      <div style={{ fontSize: '11px', color: '#94a3b8' }}>Se verá en el proyector y en los teléfonos.</div>
                    </div>
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      style={{
                        padding: '6px 12px',
                        borderRadius: '8px',
                        background: 'rgba(255, 255, 255, 0.1)',
                        border: 'none',
                        color: '#fff',
                        fontSize: '12px',
                        cursor: 'pointer'
                      }}
                    >
                      Cambiar
                    </button>
                  </div>
                ) : (
                  /* Botón para subir foto o mantener automático */
                  <div
                    onClick={() => fileInputRef.current?.click()}
                    style={{
                      border: '2px dashed rgba(255, 255, 255, 0.15)',
                      borderRadius: '12px',
                      padding: '16px',
                      textAlign: 'center',
                      cursor: 'pointer',
                      background: 'rgba(255, 255, 255, 0.02)',
                      transition: 'border-color 0.2s ease',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      gap: '8px'
                    }}
                  >
                    <div style={{
                      width: '40px',
                      height: '40px',
                      borderRadius: '50%',
                      background: 'rgba(255, 101, 25, 0.15)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: 'var(--primary)'
                    }}>
                      {isProcessingPhoto ? <UploadCloud size={20} className="pulse-indicator" /> : <ImageIcon size={20} />}
                    </div>
                    <div>
                      <span style={{ fontSize: '13px', fontWeight: 700, color: '#fff' }}>
                        {isProcessingPhoto ? 'Comprimiendo imagen...' : 'Subir foto o escudo desde tu galería'}
                      </span>
                      <p style={{ margin: '2px 0 0 0', fontSize: '11px', color: 'var(--text-muted)' }}>
                        Si no subes foto, se generará un escudo automático con las iniciales de tu equipo.
                      </p>
                    </div>
                  </div>
                )}
              </div>

              <button
                type="submit"
                disabled={isSubmitting || !captainName.trim() || !teamName.trim()}
                style={{
                  marginTop: '8px',
                  padding: '14px 20px',
                  borderRadius: '12px',
                  background: 'linear-gradient(135deg, var(--primary) 0%, #ea580c 100%)',
                  color: '#fff',
                  fontSize: '15px',
                  fontWeight: 800,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  cursor: (isSubmitting || !captainName.trim() || !teamName.trim()) ? 'not-allowed' : 'pointer',
                  opacity: (isSubmitting || !captainName.trim() || !teamName.trim()) ? 0.6 : 1,
                  boxShadow: '0 10px 20px -5px var(--primary-glow)'
                }}
              >
                {isSubmitting ? 'Creando equipo...' : (
                  <>
                    CREAR EQUIPO Y RECIBIR PIN
                    <ArrowRight size={18} />
                  </>
                )}
              </button>
            </form>
          ) : (
            /* MODO B: UNIRSE A EQUIPO (INTEGRANTE) */
            <form onSubmit={handleJoinTeam} style={{ display: 'flex', flexDirection: 'column', gap: '16px', textAlign: 'left' }}>
              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '6px' }}>
                  Tu nombre personal
                </label>
                <input
                  type="text"
                  placeholder="Ej. Daniel, Sofía..."
                  value={memberName}
                  onChange={(e) => setMemberName(e.target.value)}
                  maxLength={40}
                  required
                  style={{
                    width: '100%',
                    padding: '12px 14px',
                    borderRadius: '10px',
                    background: 'rgba(255, 255, 255, 0.05)',
                    border: '1px solid rgba(255, 255, 255, 0.12)',
                    color: '#fff',
                    fontSize: '15px',
                    boxSizing: 'border-box'
                  }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '6px' }}>
                  Selecciona tu Equipo
                </label>
                {availableTeams.length === 0 ? (
                  <div style={{
                    padding: '14px',
                    borderRadius: '10px',
                    background: 'rgba(234, 179, 8, 0.1)',
                    border: '1px solid rgba(234, 179, 8, 0.25)',
                    color: '#fef08a',
                    fontSize: '13px'
                  }}>
                    Aún no hay equipos creados. Pídele a tu capitán que cree el grupo primero.
                  </div>
                ) : (
                  <select
                    value={selectedTeamId}
                    onChange={(e) => setSelectedTeamId(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '12px 14px',
                      borderRadius: '10px',
                      background: '#101726',
                      border: '1px solid rgba(255, 101, 25, 0.3)',
                      color: '#fff',
                      fontSize: '15px',
                      boxSizing: 'border-box',
                      cursor: 'pointer'
                    }}
                  >
                    {availableTeams.map((team) => (
                      <option key={team.id} value={team.id}>
                        {team.name} ({team.memberCount || 0} integrantes)
                      </option>
                    ))}
                  </select>
                )}
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '6px' }}>
                  PIN de 4 dígitos del equipo
                </label>
                <div style={{ position: 'relative' }}>
                  <input
                    type="password"
                    inputMode="numeric"
                    placeholder="••••"
                    maxLength={4}
                    value={memberPin}
                    onChange={(e) => setMemberPin(e.target.value.replace(/\D/g, ''))}
                    required
                    style={{
                      width: '100%',
                      padding: '12px 14px 12px 42px',
                      borderRadius: '10px',
                      background: 'rgba(255, 255, 255, 0.05)',
                      border: '1px solid rgba(255, 255, 255, 0.12)',
                      color: '#fff',
                      fontSize: '18px',
                      letterSpacing: '0.2em',
                      boxSizing: 'border-box'
                    }}
                  />
                  <KeyRound size={18} color="var(--primary)" style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)' }} />
                </div>
                <span style={{ fontSize: '12px', color: '#94a3b8', display: 'block', marginTop: '4px' }}>
                  Pídele este código al capitán de tu equipo.
                </span>
              </div>

              <button
                type="submit"
                disabled={isSubmitting || !memberName.trim() || !selectedTeamId || memberPin.length !== 4}
                style={{
                  marginTop: '8px',
                  padding: '14px 20px',
                  borderRadius: '12px',
                  background: 'linear-gradient(135deg, var(--primary) 0%, #ea580c 100%)',
                  color: '#fff',
                  fontSize: '15px',
                  fontWeight: 800,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  cursor: (isSubmitting || !memberName.trim() || !selectedTeamId || memberPin.length !== 4) ? 'not-allowed' : 'pointer',
                  opacity: (isSubmitting || !memberName.trim() || !selectedTeamId || memberPin.length !== 4) ? 0.6 : 1,
                  boxShadow: '0 10px 20px -5px var(--primary-glow)'
                }}
              >
                {isSubmitting ? 'Uniéndote al equipo...' : (
                  <>
                    UNIRME AL EQUIPO
                    <ArrowRight size={18} />
                  </>
                )}
              </button>
            </form>
          )}
        </div>
      ) : (
        /* VISTA 2: DENTRO DEL EQUIPO (SALA DE ESPERA ACTIVA) */
        <div style={{
          maxWidth: '520px',
          width: '100%',
          display: 'flex',
          flexDirection: 'column',
          gap: '18px',
          animation: 'fadeIn 0.3s ease'
        }}>
          {/* Tarjeta de Identidad del Equipo */}
          <div className="glass-panel" style={{
            padding: '24px 20px',
            textAlign: 'center',
            position: 'relative',
            border: '1px solid rgba(255, 101, 25, 0.25)'
          }}>
            {/* Header con Logo RVC y Badge de Conexión */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: '14px'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <img
                  src="/logo-rvc.png"
                  alt="RVC"
                  style={{
                    width: '30px',
                    height: '30px',
                    objectFit: 'contain',
                    filter: 'drop-shadow(0 0 6px rgba(255, 87, 34, 0.6))'
                  }}
                />
                <span style={{ fontSize: '13px', fontWeight: 900, color: '#fff', letterSpacing: '0.06em' }}>
                  RVC JOVEN
                </span>
              </div>

              <div style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '4px 10px',
                borderRadius: '999px',
                background: isConnected ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                border: `1px solid ${isConnected ? 'rgba(16, 185, 129, 0.4)' : 'rgba(239, 68, 68, 0.4)'}`
              }}>
                <span style={{
                  width: '8px',
                  height: '8px',
                  borderRadius: '50%',
                  backgroundColor: isConnected ? '#34d399' : '#f87171'
                }} className={isConnected ? 'pulse-indicator' : ''} />
                <span style={{ fontSize: '11px', fontWeight: 700, color: isConnected ? '#34d399' : '#f87171' }}>
                  {isConnected ? 'EN LÍNEA' : 'DESCONECTADO'}
                </span>
              </div>
            </div>

            {/* Escudo/Avatar del Equipo */}
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '12px' }}>
              <TeamAvatar
                avatar={currentTeam?.avatar}
                teamName={currentTeam?.name || 'Equipo'}
                size={76}
              />
            </div>

            <h2 style={{
              fontSize: '24px',
              fontWeight: 900,
              color: '#fff',
              margin: '0 0 4px 0',
              letterSpacing: '-0.02em'
            }}>
              {currentTeam?.name || 'Mi Equipo'}
            </h2>

            {currentTeam?.motto && (
              <p style={{
                margin: '0 0 12px 0',
                fontSize: '13px',
                fontStyle: 'italic',
                color: '#94a3b8'
              }}>
                "{currentTeam.motto}"
              </p>
            )}

            {/* Rol Badge */}
            <div style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '4px 12px',
              borderRadius: '999px',
              fontSize: '12px',
              fontWeight: 700,
              background: participant?.role === 'CAPTAIN' ? 'rgba(255, 101, 25, 0.18)' : 'rgba(255, 255, 255, 0.08)',
              color: participant?.role === 'CAPTAIN' ? '#ff9d5c' : '#e2e8f0',
              border: `1px solid ${participant?.role === 'CAPTAIN' ? 'rgba(255, 101, 25, 0.4)' : 'rgba(255, 255, 255, 0.1)'}`
            }}>
              {participant?.role === 'CAPTAIN' ? <Crown size={14} /> : <Users size={14} />}
              {participant?.role === 'CAPTAIN' ? '👑 Eres el Capitán del Equipo' : '👥 Integrante del Equipo'}
            </div>

            {/* CUADRO EXCLUSIVO DE PIN PARA EL CAPITÁN */}
            {participant?.role === 'CAPTAIN' && currentTeam?.pin && (
              <div style={{
                marginTop: '18px',
                background: 'rgba(255, 101, 25, 0.08)',
                border: '1px dashed rgba(255, 101, 25, 0.45)',
                borderRadius: '14px',
                padding: '14px',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '8px'
              }}>
                <span style={{ fontSize: '12px', fontWeight: 800, color: 'var(--primary)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                  PIN EXCLUSIVO PARA TU EQUIPO
                </span>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <span style={{
                    fontSize: '28px',
                    fontWeight: 900,
                    letterSpacing: '0.25em',
                    color: '#fff',
                    fontFamily: 'monospace'
                  }}>
                    {currentTeam.pin}
                  </span>
                  <button
                    onClick={() => handleCopyPin(currentTeam.pin!)}
                    style={{
                      background: 'rgba(255, 255, 255, 0.12)',
                      border: 'none',
                      borderRadius: '8px',
                      padding: '6px 10px',
                      color: '#fff',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px',
                      fontSize: '12px',
                      fontWeight: 600
                    }}
                  >
                    {copiedPin ? <Check size={14} color="#34d399" /> : <Copy size={14} />}
                    {copiedPin ? 'Copiado' : 'Copiar'}
                  </button>
                </div>
                <span style={{ fontSize: '11px', color: '#cbd5e1' }}>
                  Comparte este PIN con tus compañeros para que se unan a tu equipo.
                </span>
              </div>
            )}
          </div>

          {/* NAVEGACIÓN ENTRE TRIVIA Y CHAT DE DUPLA */}
          <div style={{
            display: 'flex',
            gap: '8px',
            background: 'rgba(255, 255, 255, 0.05)',
            padding: '4px',
            borderRadius: '12px',
            border: '1px solid var(--border-subtle)'
          }}>
            <button
              onClick={() => setActiveTab('trivia')}
              style={{
                flex: 1,
                padding: '10px 14px',
                borderRadius: '8px',
                border: 'none',
                background: activeTab === 'trivia' ? 'var(--primary)' : 'transparent',
                color: '#fff',
                fontWeight: 700,
                fontSize: '13px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '6px',
                transition: 'all 0.2s'
              }}
            >
              <Flame size={16} />
              Trivia & Buzzer
            </button>
            <button
              onClick={() => setActiveTab('social')}
              style={{
                flex: 1,
                padding: '10px 14px',
                borderRadius: '8px',
                border: 'none',
                background: activeTab === 'social' ? 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)' : 'transparent',
                color: '#fff',
                fontWeight: 700,
                fontSize: '13px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '6px',
                position: 'relative',
                transition: 'all 0.2s'
              }}
            >
              <MessageCircle size={16} />
              Chat de Dupla
              {pairingData && (
                <span style={{
                  width: '8px',
                  height: '8px',
                  borderRadius: '50%',
                  background: '#10b981',
                  boxShadow: '0 0 8px #10b981'
                }} />
              )}
            </button>
          </div>

          {/* CONTENIDO DE LA PESTAÑA: TRIVIA */}
          {activeTab === 'trivia' && (
            <>
              {/* MÓDULO INTERACTIVO DE TRIVIA Y PULSADOR */}
              {gameState.status === 'LOBBY' ? (
            /* Estado 1: Esperando en Lobby */
            <div className="glass-panel" style={{
              padding: '20px',
              textAlign: 'center',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '10px'
            }}>
              <div style={{
                width: '42px',
                height: '42px',
                borderRadius: '50%',
                background: 'rgba(255, 101, 25, 0.15)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--primary)'
              }}>
                <Shield size={22} />
              </div>
              <h3 style={{ margin: 0, fontSize: '18px', color: '#fff' }}>
                ¡Tu equipo está listo! ⚡
              </h3>
              <p style={{ margin: 0, fontSize: '13px', color: 'var(--text-muted)', lineHeight: '1.5' }}>
                {participant?.role === 'CAPTAIN'
                  ? 'Como capitán, tú tendrás el pulsador durante la competencia. Mantente atento a la pantalla del proyector.'
                  : 'Tu equipo está conectado. Ayuda a tu capitán a deliberar las respuestas durante la trivia.'}
              </p>
            </div>
          ) : (
            /* Estado 2: Trivia Activa (Pregunta / Pulsador / Veredicto / Podio) */
            <div className="glass-panel" style={{
              padding: '24px 20px',
              display: 'flex',
              flexDirection: 'column',
              gap: '18px',
              border: '2px solid rgba(255, 101, 25, 0.4)',
              boxShadow: '0 12px 35px rgba(0, 0, 0, 0.6), 0 0 25px rgba(255, 101, 25, 0.25)',
              animation: 'fadeIn 0.3s ease'
            }}>
              {/* Header de Pregunta Móvil */}
              {gameState.currentQuestion && (
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                    <span style={{
                      fontSize: '11px',
                      fontWeight: 900,
                      color: '#fff',
                      background: 'var(--primary)',
                      padding: '3px 10px',
                      borderRadius: '8px',
                      letterSpacing: '0.08em'
                    }}>
                      PREGUNTA #{gameState.currentQuestion.order}
                    </span>

                    {gameState.status === 'QUESTION_READING' ? (
                      <span style={{
                        fontSize: '12px',
                        fontWeight: 800,
                        color: '#60a5fa',
                        background: 'rgba(59, 130, 246, 0.15)',
                        padding: '3px 10px',
                        borderRadius: '8px'
                      }}>
                        📖 Lectura Previa
                      </span>
                    ) : gameState.status === 'COUNTDOWN_ACTIVE' ? (
                      <span style={{
                        fontSize: '13px',
                        fontWeight: 900,
                        color: '#fbbf24',
                        background: 'rgba(245, 158, 11, 0.25)',
                        padding: '3px 10px',
                        borderRadius: '8px',
                        animation: 'pulse-glow 0.8s infinite'
                      }}>
                        ⚡ ¡Prepárense! {gameState.countdownRemaining ?? 7}s
                      </span>
                    ) : (
                      <span style={{
                        fontSize: '14px',
                        fontWeight: 900,
                        color: gameState.timeRemaining <= 5 ? '#f87171' : '#34d399',
                        fontFamily: 'monospace'
                      }}>
                        ⏱️ {gameState.timeRemaining}s
                      </span>
                    )}
                  </div>

                  <h3 style={{
                    margin: '0 0 6px 0',
                    fontSize: '18px',
                    fontWeight: 800,
                    color: '#fff',
                    lineHeight: '1.4'
                  }}>
                    "{gameState.currentQuestion.text}"
                  </h3>
                  <span style={{ fontSize: '12px', color: '#ffb885' }}>
                    {gameState.currentQuestion.type === 'ORAL_DEFENSE' ? '🎙️ Defensa Oral (+'+gameState.currentQuestion.points+' pts)' : '🔢 Opción Múltiple (+'+gameState.currentQuestion.points+' pts)'}
                  </span>

                  {/* Vista previa de las opciones para lectura del equipo */}
                  {gameState.currentQuestion.type === 'MULTIPLE_CHOICE' && gameState.currentQuestion.options && (
                    <div style={{
                      marginTop: '12px',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '6px',
                      textAlign: 'left'
                    }}>
                      {gameState.currentQuestion.options.map((opt, idx) => (
                        <div
                          key={idx}
                          style={{
                            padding: '8px 12px',
                            borderRadius: '8px',
                            background: 'rgba(255, 255, 255, 0.05)',
                            border: '1px solid rgba(255, 255, 255, 0.1)',
                            fontSize: '13px',
                            color: '#e2e8f0',
                            fontWeight: 600
                          }}
                        >
                          <strong style={{ color: '#ffb885', marginRight: '6px' }}>{['A', 'B', 'C', 'D'][idx]}:</strong> {opt}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* FASE 0: LECTURA PREVIA */}
              {gameState.status === 'QUESTION_READING' && (
                <div style={{
                  textAlign: 'center',
                  padding: '18px 14px',
                  background: 'rgba(59, 130, 246, 0.12)',
                  border: '1px solid rgba(59, 130, 246, 0.35)',
                  borderRadius: '16px',
                  margin: '12px 0'
                }}>
                  <div style={{ fontSize: '16px', fontWeight: 800, color: '#60a5fa', marginBottom: '4px' }}>
                    📖 Lee la pregunta con tu equipo
                  </div>
                  <p style={{ margin: 0, fontSize: '13px', color: '#cbd5e1' }}>
                    El moderador activará en breve la cuenta regresiva de 7s para desbloquear el pulsador.
                  </p>
                </div>
              )}

              {/* FASE 0.5: CUENTA REGRESIVA DE 7s HACIA ATRÁS */}
              {gameState.status === 'COUNTDOWN_ACTIVE' && (
                <div style={{
                  textAlign: 'center',
                  padding: '24px 16px',
                  background: 'radial-gradient(circle, rgba(245, 158, 11, 0.25), rgba(15, 23, 42, 0.9))',
                  border: '2px solid #f59e0b',
                  borderRadius: '20px',
                  margin: '14px 0',
                  boxShadow: '0 0 35px rgba(245, 158, 11, 0.4)'
                }}>
                  <div style={{ fontSize: '13px', textTransform: 'uppercase', letterSpacing: '0.12em', fontWeight: 800, color: '#fbbf24', marginBottom: '4px' }}>
                    ⚡ ¡ATENTOS CAPITANES!
                  </div>
                  <div style={{ fontSize: '64px', fontWeight: 900, color: '#fff', textShadow: '0 0 25px rgba(245, 158, 11, 0.9)', lineHeight: 1 }}>
                    {gameState.countdownRemaining ?? 7}
                  </div>
                  <p style={{ margin: '8px 0 0 0', fontSize: '13px', color: '#ffedd5', fontWeight: 600 }}>
                    ¡Pulsador listo para activarse en 0!
                  </p>
                </div>
              )}

              {/* FASE A: PULSADOR ACTIVO (Pregunta en juego) */}
              {gameState.status === 'QUESTION_ACTIVE' && (
                <div style={{ textAlign: 'center', padding: '10px 0' }}>
                  {participant?.role === 'CAPTAIN' ? (
                    <div>
                      <button
                        onClick={handleBuzz}
                        style={{
                          width: '180px',
                          height: '180px',
                          borderRadius: '50%',
                          background: 'radial-gradient(circle at 35% 35%, #ff8a3d, #ff5400 60%, #b43a05 100%)',
                          border: '6px solid #fff',
                          boxShadow: '0 0 50px rgba(255, 101, 25, 0.85), 0 10px 30px rgba(0,0,0,0.6)',
                          color: '#fff',
                          fontSize: '20px',
                          fontWeight: 900,
                          cursor: buzzStatus === 'buzzing' ? 'not-allowed' : 'pointer',
                          opacity: buzzStatus === 'buzzing' ? 0.75 : 1,
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'center',
                          justifyContent: 'center',
                          margin: '10px auto',
                          animation: 'pulse-glow 1.4s infinite ease-in-out'
                        }}
                      >
                        <Flame size={44} />
                        <span style={{ marginTop: '4px', letterSpacing: '0.05em' }}>
                          {buzzStatus === 'buzzing' ? '¡ENVIANDO!' : '¡PULSAR!'}
                        </span>
                      </button>
                      <p style={{ margin: '12px 0 0 0', fontSize: '12px', color: '#cbd5e1' }}>
                        ¡Presiona rápido antes que los otros capitanes!
                      </p>
                    </div>
                  ) : (
                    <div style={{
                      padding: '18px',
                      borderRadius: '16px',
                      background: 'rgba(255, 101, 25, 0.15)',
                      border: '1px solid rgba(255, 101, 25, 0.4)',
                      textAlign: 'center'
                    }}>
                      <div style={{ fontSize: '16px', fontWeight: 800, color: '#fff', marginBottom: '4px' }}>
                        🗣️ ¡Pregunta activa!
                      </div>
                      <p style={{ margin: 0, fontSize: '13px', color: '#ffb885' }}>
                        Delibera rápido con tu capitán para que pulse el botón.
                      </p>
                    </div>
                  )}
                </div>
              )}

              {/* FASE B: BUZZER BLOQUEADO (Alguien pulsó) */}
              {gameState.status === 'BUZZER_LOCKED' && gameState.buzzerWinner && (
                <div>
                  {gameState.buzzerWinner.teamId === currentTeam?.id ? (
                    /* ¡MI EQUIPO GANÓ EL TURNO! */
                    <div style={{
                      padding: '18px',
                      borderRadius: '18px',
                      background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.25), rgba(14, 22, 38, 0.8))',
                      border: '2px solid #10b981',
                      textAlign: 'center'
                    }}>
                      <div style={{ fontSize: '20px', fontWeight: 900, color: '#34d399', marginBottom: '6px' }}>
                        🎉 ¡TU EQUIPO TIENE EL TURNO!
                      </div>

                      {gameState.currentQuestion?.type === 'ORAL_DEFENSE' ? (
                        <p style={{ margin: 0, fontSize: '14px', color: '#fff' }}>
                          🎙️ Habla con voz clara hacia el moderador para defender la respuesta.
                        </p>
                      ) : (
                        /* Si es Opción Múltiple */
                        <div>
                          {participant?.role === 'CAPTAIN' ? (
                            <div>
                              <p style={{ margin: '0 0 12px 0', fontSize: '13px', color: '#cbd5e1' }}>
                                Selecciona la opción correcta en pantalla:
                              </p>
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                {gameState.currentQuestion?.options?.map((opt, idx) => (
                                  <button
                                    key={idx}
                                    onClick={() => handleChoiceSubmit(idx)}
                                    style={{
                                      padding: '12px 16px',
                                      borderRadius: '12px',
                                      background: 'rgba(255, 255, 255, 0.1)',
                                      border: '1px solid rgba(255, 255, 255, 0.2)',
                                      color: '#fff',
                                      fontSize: '15px',
                                      fontWeight: 700,
                                      cursor: 'pointer',
                                      textAlign: 'left'
                                    }}
                                  >
                                    <strong>{['A', 'B', 'C', 'D'][idx]}:</strong> {opt}
                                  </button>
                                ))}
                              </div>
                            </div>
                          ) : (
                            <p style={{ margin: 0, fontSize: '14px', color: '#cbd5e1' }}>
                              Tu capitán está eligiendo la opción en su teléfono...
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                  ) : (
                    /* OTRO EQUIPO GANÓ EL TURNO */
                    <div style={{
                      padding: '16px',
                      borderRadius: '16px',
                      background: 'rgba(239, 68, 68, 0.15)',
                      border: '1px solid rgba(239, 68, 68, 0.4)',
                      textAlign: 'center'
                    }}>
                      <div style={{ fontSize: '15px', fontWeight: 800, color: '#f87171' }}>
                        ⚠️ {gameState.buzzerWinner.teamName} pulsó primero
                      </div>
                      <p style={{ margin: '4px 0 0 0', fontSize: '13px', color: '#cbd5e1' }}>
                        Mantente atento para la siguiente ronda.
                      </p>
                    </div>
                  )}
                </div>
              )}

              {/* FASE C: MOSTRANDO RESULTADO */}
              {gameState.status === 'SHOWING_RESULT' && gameState.result && (
                <div style={{
                  padding: '16px',
                  borderRadius: '16px',
                  textAlign: 'center',
                  background: gameState.result.grade === 'CORRECT' ? 'rgba(16, 185, 129, 0.2)' : 'rgba(239, 68, 68, 0.2)',
                  border: `1px solid ${gameState.result.grade === 'CORRECT' ? '#10b981' : '#ef4444'}`
                }}>
                  <div style={{ fontSize: '18px', fontWeight: 900, color: '#fff' }}>
                    {gameState.result.grade === 'CORRECT' ? '¡Respuesta Correcta! ✅' : gameState.result.grade === 'PARTIAL' ? 'Respuesta Parcial 🟡' : 'Respuesta Incorrecta ❌'}
                  </div>
                  <div style={{ fontSize: '14px', color: '#cbd5e1', marginTop: '4px' }}>
                    {gameState.result.teamName}: +{gameState.result.pointsAwarded} pts
                  </div>
                </div>
              )}

              {/* FASE D: PODIO / MARCADOR */}
              {gameState.status === 'LEADERBOARD' && (
                <div style={{ textAlign: 'center', padding: '10px 0' }}>
                  <Trophy size={40} color="#fde047" style={{ margin: '0 auto 8px auto' }} />
                  <h3 style={{ margin: 0, fontSize: '20px', color: '#fff' }}>
                    ¡Mira la pantalla gigante!
                  </h3>
                  <p style={{ margin: '4px 0 12px 0', fontSize: '13px', color: '#94a3b8' }}>
                    Tu equipo acumula: <strong style={{ color: '#34d399', fontSize: '16px' }}>{currentTeam?.score || 0} pts</strong>
                  </p>
                </div>
              )}
            </div>
          )}
          </>
          )}

          {/* CONTENIDO DE LA PESTAÑA: CHAT DE DUPLA (FASE 3) */}
          {activeTab === 'social' && (
            <div className="glass-panel" style={{
              padding: '20px',
              display: 'flex',
              flexDirection: 'column',
              gap: '16px',
              border: '1px solid rgba(59, 130, 246, 0.35)',
              background: 'radial-gradient(ellipse at top, rgba(59, 130, 246, 0.1) 0%, rgba(13, 17, 23, 0.95) 70%)'
            }}>
              {!pairingData ? (
                /* Aún no se ha iniciado el emparejamiento */
                <div style={{ textAlign: 'center', padding: '30px 16px', color: 'var(--text-muted)' }}>
                  <div style={{
                    width: '60px',
                    height: '60px',
                    borderRadius: '50%',
                    background: 'rgba(59, 130, 246, 0.15)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    margin: '0 auto 16px auto',
                    color: '#60a5fa'
                  }}>
                    <MessageCircle size={30} />
                  </div>
                  <h3 style={{ color: '#fff', fontSize: '18px', margin: '0 0 8px 0' }}>
                    Esperando la Fase de Integración 🤝
                  </h3>
                  <p style={{ fontSize: '13px', lineHeight: 1.5, margin: 0 }}>
                    Al finalizar las rondas de preguntas, el moderador iniciará el emparejamiento automático.
                    Conocerás a un compañero de otro equipo para chatear y enviar fotos al mural del auditorio.
                  </p>
                </div>
              ) : (
                /* Dupla Asignada y Chat Activo */
                <>
                  {/* Tarjeta de la Dupla Asignada */}
                  <div style={{
                    padding: '16px',
                    borderRadius: '12px',
                    background: 'rgba(59, 130, 246, 0.12)',
                    border: '1px solid rgba(59, 130, 246, 0.3)'
                  }}>
                    <div style={{ fontSize: '11px', fontWeight: 800, color: '#60a5fa', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '8px' }}>
                      🤝 TU DUPLA DE ENCUENTRO
                    </div>
                    {pairingData.partners.map((partner) => (
                      <div key={partner.id} style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <TeamAvatar avatar={partner.teamAvatar} teamName={partner.teamName} size={44} />
                        <div>
                          <div style={{ fontSize: '17px', fontWeight: 800, color: '#fff' }}>
                            {partner.name}
                          </div>
                          <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                            Equipo: <strong style={{ color: '#60a5fa' }}>{partner.teamName}</strong>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Aviso de moderación si el chat está pausado */}
                  {!chatEnabled && (
                    <div style={{
                      padding: '10px 14px',
                      borderRadius: '8px',
                      background: 'rgba(245, 158, 11, 0.15)',
                      border: '1px solid rgba(245, 158, 11, 0.3)',
                      color: '#fbbf24',
                      fontSize: '12px',
                      textAlign: 'center'
                    }}>
                      ⏸️ El moderador ha pausado temporalmente el chat. Podrás escribir tan pronto se reanude.
                    </div>
                  )}

                  {/* Contenedor de Mensajes */}
                  <div
                    ref={chatScrollRef}
                    style={{
                      maxHeight: '260px',
                      minHeight: '140px',
                      overflowY: 'auto',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '10px',
                      padding: '10px 4px'
                    }}
                  >
                    {pairingData.messages.length === 0 ? (
                      <div style={{ textAlign: 'center', padding: '24px 10px', color: 'var(--text-muted)', fontSize: '13px' }}>
                        ¡Rompe el hielo! Envía un saludo o tómense una fotografía juntos con los botones de abajo.
                      </div>
                    ) : (
                      pairingData.messages.map((m) => {
                        const isMine = m.senderId === participant?.id;
                        return (
                          <div
                            key={m.id}
                            style={{
                              alignSelf: isMine ? 'flex-end' : 'flex-start',
                              maxWidth: '85%',
                              display: 'flex',
                              flexDirection: 'column',
                              gap: '4px'
                            }}
                          >
                            <span style={{ fontSize: '10px', color: 'var(--text-muted)', paddingLeft: isMine ? '0' : '4px', textAlign: isMine ? 'right' : 'left' }}>
                              {isMine ? 'Tú' : `${m.senderName} (${m.senderTeamName})`}
                            </span>
                            <div style={{
                              padding: '10px 14px',
                              borderRadius: isMine ? '14px 14px 2px 14px' : '14px 14px 14px 2px',
                              background: isMine
                                ? 'linear-gradient(135deg, var(--primary) 0%, #ea580c 100%)'
                                : 'rgba(255, 255, 255, 0.08)',
                              color: '#fff',
                              fontSize: '14px',
                              wordBreak: 'break-word',
                              border: isMine ? 'none' : '1px solid var(--border-subtle)',
                              boxShadow: isMine ? '0 4px 12px rgba(255, 101, 25, 0.3)' : 'none'
                            }}>
                              {m.photoUrl && (
                                <div style={{ marginBottom: m.content ? '8px' : '0' }}>
                                  <img
                                    src={m.photoUrl}
                                    alt="Foto de encuentro"
                                    style={{
                                      width: '100%',
                                      maxHeight: '200px',
                                      objectFit: 'cover',
                                      borderRadius: '8px'
                                    }}
                                  />
                                  <div style={{ fontSize: '10px', color: '#ffedd5', marginTop: '4px', fontStyle: 'italic' }}>
                                    📸 Postulada para el mural del auditorio
                                  </div>
                                </div>
                              )}
                              {m.content}
                            </div>
                            <span style={{ fontSize: '9px', color: 'var(--text-dim)', textAlign: isMine ? 'right' : 'left' }}>
                              {new Date(m.sentAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          </div>
                        );
                      })
                    )}
                  </div>

                  {/* Botones de Saludo Rápido */}
                  <div style={{
                    display: 'flex',
                    gap: '6px',
                    overflowX: 'auto',
                    paddingBottom: '4px',
                    scrollbarWidth: 'none'
                  }}>
                    {quickGreetings.map((g, gIdx) => (
                      <button
                        key={gIdx}
                        onClick={() => handleSendChatMessage(g)}
                        disabled={!chatEnabled || isSendingChat}
                        style={{
                          whiteSpace: 'nowrap',
                          padding: '6px 12px',
                          borderRadius: '999px',
                          border: '1px solid rgba(255, 255, 255, 0.1)',
                          background: 'rgba(255, 255, 255, 0.05)',
                          color: '#e2e8f0',
                          fontSize: '11px',
                          cursor: !chatEnabled || isSendingChat ? 'not-allowed' : 'pointer',
                          opacity: !chatEnabled ? 0.6 : 1
                        }}
                      >
                        {g}
                      </button>
                    ))}
                  </div>

                  {/* Preview de Fotografía Seleccionada */}
                  {chatPhotoUrl && (
                    <div style={{
                      position: 'relative',
                      display: 'inline-block',
                      alignSelf: 'flex-start',
                      borderRadius: '8px',
                      overflow: 'hidden',
                      border: '2px solid var(--primary)'
                    }}>
                      <img src={chatPhotoUrl} alt="Preview" style={{ height: '70px', width: '70px', objectFit: 'cover' }} />
                      <button
                        onClick={() => setChatPhotoUrl(null)}
                        style={{
                          position: 'absolute',
                          top: '2px',
                          right: '2px',
                          background: 'rgba(0,0,0,0.7)',
                          color: '#fff',
                          border: 'none',
                          borderRadius: '50%',
                          width: '18px',
                          height: '18px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          cursor: 'pointer'
                        }}
                      >
                        <X size={12} />
                      </button>
                    </div>
                  )}

                  {/* Input y Botón de Envío */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <input
                      ref={chatFileInputRef}
                      type="file"
                      accept="image/*"
                      capture="environment"
                      onChange={handleChatPhotoSelect}
                      style={{ display: 'none' }}
                    />
                    <button
                      type="button"
                      onClick={() => chatFileInputRef.current?.click()}
                      disabled={!chatEnabled}
                      title="Tomar fotografía o selfie"
                      style={{
                        padding: '10px',
                        borderRadius: '10px',
                        border: '1px solid var(--border-subtle)',
                        background: chatPhotoUrl ? 'var(--primary)' : 'rgba(255, 255, 255, 0.08)',
                        color: '#fff',
                        cursor: !chatEnabled ? 'not-allowed' : 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center'
                      }}
                    >
                      <Camera size={18} />
                    </button>

                    <input
                      type="text"
                      value={chatInput}
                      onChange={(e) => setChatInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleSendChatMessage();
                      }}
                      placeholder={chatEnabled ? "Escribe un mensaje de ánimo..." : "Chat pausado temporalmente..."}
                      disabled={!chatEnabled || isSendingChat}
                      style={{
                        flex: 1,
                        padding: '10px 14px',
                        borderRadius: '10px',
                        background: 'rgba(255, 255, 255, 0.05)',
                        border: '1px solid var(--border-subtle)',
                        color: '#fff',
                        fontSize: '13px'
                      }}
                    />

                    <button
                      type="button"
                      onClick={() => handleSendChatMessage()}
                      disabled={!chatEnabled || isSendingChat || (!chatInput.trim() && !chatPhotoUrl)}
                      style={{
                        padding: '10px 14px',
                        borderRadius: '10px',
                        border: 'none',
                        background: 'var(--primary)',
                        color: '#fff',
                        cursor: (!chatEnabled || (!chatInput.trim() && !chatPhotoUrl)) ? 'not-allowed' : 'pointer',
                        opacity: (!chatEnabled || (!chatInput.trim() && !chatPhotoUrl)) ? 0.6 : 1,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center'
                      }}
                    >
                      <Send size={16} />
                    </button>
                  </div>
                </>
              )}
            </div>
          )}

          {/* Mensajes Recibidos en Vivo del Moderador */}
          {messages.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <div style={{ fontSize: '12px', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)' }}>
                Mensajes del Moderador
              </div>
              {messages.map((m) => (
                <div
                  key={m.id}
                  style={{
                    background: 'rgba(255, 101, 25, 0.12)',
                    border: '1px solid rgba(255, 101, 25, 0.3)',
                    borderRadius: '12px',
                    padding: '14px 16px',
                    color: '#fff',
                    fontSize: '14px'
                  }}
                >
                  {m.content}
                </div>
              ))}
            </div>
          )}

          {/* Botón Salir / Desconectar */}
          <button
            onClick={handleResetSession}
            style={{
              margin: '8px auto',
              background: 'transparent',
              border: 'none',
              color: 'var(--text-muted)',
              fontSize: '13px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}
          >
            <LogOut size={14} />
            Salir del equipo o cambiar de cuenta
          </button>
        </div>
      )}
    </div>
  );
}
