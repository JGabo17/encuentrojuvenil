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
  LogOut,
  UploadCloud,
  ImageIcon,
  X,
  Flame,
  Trophy,
  Camera,
  Send,
  MessageCircle,
  Clock
} from 'lucide-react';
import type { LiveMessagePayload, Participant, Team, GameState, PairingData } from '../../../shared/types/index.js';
import '../styles/participant.css';

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
            colors: ['#ff5a1f', '#ffffff', '#13233a']
          });
        } catch (e) {}
      }
    }

    function onTimerTick({ timeRemaining }: { timeRemaining: number }) {
      setGameState((prev) => ({ ...prev, timeRemaining }));
    }

    function onCountdownTick({ countdownRemaining }: { countdownRemaining: number }) {
      setGameState((prev) => ({ ...prev, countdownRemaining }));
    }

    function onLiveMessage(payload: LiveMessagePayload) {
      setMessages((prev) => [payload, ...prev]);
      try {
        if ('vibrate' in navigator) navigator.vibrate([200, 100, 200]);
      } catch (e) {}
    }

    function onPairingAssigned(data: PairingData) {
      setPairingData(data);
      setChatEnabled(true);
      try {
        if ('vibrate' in navigator) navigator.vibrate([100, 50, 100, 50, 200]);
      } catch (e) {}
      socket.emit('participant:get-pairing', (res) => {
        if (res?.success && res.pairing) {
          setPairingData(res.pairing);
          setChatEnabled(res.chatEnabled ?? true);
        }
      });
    }

    function onChatMessage(message: any) {
      setPairingData((prev) => {
        if (!prev) return prev;
        const exists = prev.messages.some((m) => m.id === message.id);
        if (exists) return prev;
        return {
          ...prev,
          messages: [...prev.messages, message]
        };
      });
      setTimeout(() => {
        if (chatScrollRef.current) {
          chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
        }
      }, 50);
    }

    function onChatStatus({ chatEnabled }: { chatEnabled: boolean }) {
      setChatEnabled(chatEnabled);
    }

    function onResetSession() {
      localStorage.removeItem('encuentro_session_token');
      localStorage.removeItem('encuentro_participant_name');
      setIsRegistered(false);
      setParticipant(null);
      setCurrentTeam(null);
      setMessages([]);
      loadTeams();
    }

    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);
    socket.on('stage:update', (data) => {
      if (data?.teams) onTeamsUpdate(data.teams);
    });
    socket.on('game:state-update', onGameStateUpdate);
    socket.on('game:timer-tick', onTimerTick);
    socket.on('game:countdown-tick', onCountdownTick);
    socket.on('message:received', onLiveMessage);
    socket.on('pairing:assigned', onPairingAssigned);
    socket.on('chat:new-message', onChatMessage);
    socket.on('chat:status-change', onChatStatus);
    socket.on('event:reset', onResetSession);

    return () => {
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
      socket.off('stage:update');
      socket.off('game:state-update', onGameStateUpdate);
      socket.off('game:timer-tick', onTimerTick);
      socket.off('game:countdown-tick', onCountdownTick);
      socket.off('message:received', onLiveMessage);
      socket.off('pairing:assigned', onPairingAssigned);
      socket.off('chat:new-message', onChatMessage);
      socket.off('chat:status-change', onChatStatus);
      socket.off('event:reset', onResetSession);
    };
  }, [currentTeam]);

  // Cargar estado del chat de duplas al abrir la pestaña social
  useEffect(() => {
    if (isRegistered && activeTab === 'social') {
      socket.emit('participant:get-pairing', (res) => {
        if (res?.success && res.pairing) {
          setPairingData(res.pairing);
          setChatEnabled(res.chatEnabled ?? true);
        }
      });
    }
  }, [isRegistered, activeTab]);

  // Manejo de Fotos
  const handlePhotoSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setIsProcessingPhoto(true);
      const compressed = await compressImageToDataUrl(file, 256, 0.78);
      setTeamPhotoUrl(compressed);
    } catch (err: any) {
      alert('Error procesando imagen: ' + err.message);
    } finally {
      setIsProcessingPhoto(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  // Creación de Equipo
  const handleCreateTeam = (e: React.FormEvent) => {
    e.preventDefault();
    if (!captainName.trim() || !teamName.trim()) return;

    setIsSubmitting(true);
    setErrorMsg('');

    socket.emit(
      'team:create',
      {
        captainName: captainName.trim(),
        teamName: teamName.trim(),
        motto: teamMotto.trim() || undefined,
        avatar: teamPhotoUrl || teamName.trim()
      },
      (res) => {
        setIsSubmitting(false);
        if (res?.success && res.team && res.participant) {
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
              colors: ['#ff5a1f', '#ffffff', '#13233a']
            });
          } catch (e) {}
        } else {
          setErrorMsg(res?.error || 'Error al crear equipo');
        }
      }
    );
  };

  // Unirse a Equipo
  const handleJoinTeam = (e: React.FormEvent) => {
    e.preventDefault();
    if (!memberName.trim() || !selectedTeamId || memberPin.length !== 4) return;

    setIsSubmitting(true);
    setErrorMsg('');

    socket.emit(
      'team:join',
      {
        name: memberName.trim(),
        teamId: selectedTeamId,
        pin: memberPin.trim()
      },
      (res) => {
        setIsSubmitting(false);
        if (res?.success && res.team && res.participant) {
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
              colors: ['#ff5a1f', '#ffffff', '#13233a']
            });
          } catch (e) {}
        } else {
          setErrorMsg(res?.error || 'PIN incorrecto o error al unirse al equipo.');
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
    if (confirm('¿Deseas salir del equipo y cerrar sesión?')) {
      localStorage.removeItem('encuentro_session_token');
      localStorage.removeItem('encuentro_participant_name');
      setIsRegistered(false);
      setParticipant(null);
      setCurrentTeam(null);
      setMessages([]);
      loadTeams();
    }
  };

  // Acción del Pulsador (Capitán)
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

  // Responder Opción Múltiple (Capitán)
  const handleChoiceSubmit = (choiceIndex: number) => {
    if (participant?.role !== 'CAPTAIN') return;
    socket.emit('captain:submit-choice', { choiceIndex }, (res) => {
      if (!res?.success && res?.error) {
        setErrorMsg(res.error);
      }
    });
  };

  // Acciones del Chat de Dupla
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
    'Hola, mucho gusto',
    'Excelente equipo el tuyo',
    'Saludos desde mi equipo',
    'Tomémonos una foto'
  ];

  return (
    <div className="pt-container">
      {/* Header oficial del móvil */}
      <header className="pt-header">
        <div className="pt-brand">
          <img src="/logo-rvc.png" alt="RVC" />
          <div>
            <div className="pt-brand-title">Encuentro Juvenil</div>
            <div className="pt-brand-sub">RVC · Terminal Móvil</div>
          </div>
        </div>

        <div className="pt-status-pill">
          <span className={`pt-status-dot ${isConnected ? '' : 'is-off'}`} />
          {isConnected ? 'Conectado' : 'Sin señal'}
        </div>
      </header>

      {/* Alerta de desconexión */}
      {!isConnected && (
        <div className="pt-alert pt-alert-error" style={{ marginBottom: '14px' }}>
          <AlertTriangle size={18} style={{ flexShrink: 0 }} />
          <span>Conexión interrumpida. Reintentando enlace con el servidor...</span>
        </div>
      )}

      {/* ================================================================ VISTA 1: REGISTRO */}
      {!isRegistered ? (
        <div className="pt-card">
          <div className="pt-reg-hero">
            <img src="/logo-rvc.png" alt="RVC" />
            <h1 className="pt-reg-title">Ingreso al Evento</h1>
            <p className="pt-reg-sub">Selecciona tu rol para acceder a la competencia</p>
          </div>

          <div className="pt-segmented">
            <button
              type="button"
              className={`pt-seg-btn ${mode === 'captain' ? 'is-active' : ''}`}
              onClick={() => { setMode('captain'); setErrorMsg(''); }}
            >
              <Crown size={14} /> Capitán
            </button>
            <button
              type="button"
              className={`pt-seg-btn ${mode === 'member' ? 'is-active' : ''}`}
              onClick={() => { setMode('member'); setErrorMsg(''); loadTeams(); }}
            >
              <Users size={14} /> Integrante
            </button>
          </div>

          {errorMsg && (
            <div className="pt-alert pt-alert-error">
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Formulario Capitán */}
          {mode === 'captain' ? (
            <form onSubmit={handleCreateTeam} className="pt-form">
              <div className="pt-field">
                <label className="pt-label">Nombre del Capitán</label>
                <input
                  type="text"
                  placeholder="Ej. Lucas Silva"
                  value={captainName}
                  onChange={(e) => setCaptainName(e.target.value)}
                  maxLength={40}
                  required
                  className="pt-input"
                />
              </div>

              <div className="pt-field">
                <label className="pt-label">Nombre del Equipo</label>
                <input
                  type="text"
                  placeholder="Ej. Halcones Dorados"
                  value={teamName}
                  onChange={(e) => setTeamName(e.target.value)}
                  maxLength={40}
                  required
                  className="pt-input"
                />
              </div>

              <div className="pt-field">
                <label className="pt-label">Lema del Equipo (Opcional)</label>
                <input
                  type="text"
                  placeholder="Ej. Convicción y valentía"
                  value={teamMotto}
                  onChange={(e) => setTeamMotto(e.target.value)}
                  maxLength={80}
                  className="pt-input"
                />
              </div>

              <div className="pt-field">
                <label className="pt-label">Escudo o Logo del Equipo (Opcional)</label>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handlePhotoSelect}
                  style={{ display: 'none' }}
                />

                {teamPhotoUrl ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', background: '#0b0c0e', padding: '10px 12px', border: '1px solid var(--border-subtle)', borderRadius: '4px' }}>
                    <TeamAvatar avatar={teamPhotoUrl} teamName={teamName || 'Equipo'} size={44} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: '13px', fontWeight: 600, color: '#fff' }}>Escudo cargado</div>
                      <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Visible en el proyector oficial</div>
                    </div>
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      style={{ padding: '6px 12px', background: 'transparent', border: '1px solid var(--border-strong)', color: '#fff', fontSize: '12px', borderRadius: '3px' }}
                    >
                      Cambiar
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    style={{
                      padding: '14px',
                      background: '#0b0c0e',
                      border: '1px dashed var(--border-strong)',
                      borderRadius: '4px',
                      color: 'var(--text-muted)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '8px',
                      fontSize: '13px',
                      fontWeight: 600
                    }}
                  >
                    {isProcessingPhoto ? <UploadCloud size={16} className="pulse-indicator" /> : <ImageIcon size={16} />}
                    {isProcessingPhoto ? 'Comprimiendo imagen...' : 'Cargar escudo desde galería'}
                  </button>
                )}
              </div>

              <button
                type="submit"
                disabled={isSubmitting || !captainName.trim() || !teamName.trim()}
                className="pt-btn-primary"
              >
                {isSubmitting ? 'Registrando...' : 'Crear y Registrar Equipo'}
                <ArrowRight size={16} />
              </button>
            </form>
          ) : (
            /* Formulario Integrante */
            <form onSubmit={handleJoinTeam} className="pt-form">
              <div className="pt-field">
                <label className="pt-label">Tu Nombre Completo</label>
                <input
                  type="text"
                  placeholder="Ej. Andrea Morales"
                  value={memberName}
                  onChange={(e) => setMemberName(e.target.value)}
                  maxLength={40}
                  required
                  className="pt-input"
                />
              </div>

              <div className="pt-field">
                <label className="pt-label">Selecciona tu Equipo</label>
                {availableTeams.length === 0 ? (
                  <div className="pt-alert pt-alert-warning">
                    <span>Aún no hay equipos creados. Solicita al capitán que registre el equipo primero.</span>
                  </div>
                ) : (
                  <select
                    value={selectedTeamId}
                    onChange={(e) => setSelectedTeamId(e.target.value)}
                    className="pt-input"
                    style={{ cursor: 'pointer' }}
                  >
                    {availableTeams.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name} ({t.memberCount || 0} integrantes)
                      </option>
                    ))}
                  </select>
                )}
              </div>

              <div className="pt-field">
                <label className="pt-label">PIN de Acceso (4 Dígitos)</label>
                <input
                  type="password"
                  inputMode="numeric"
                  placeholder="••••"
                  maxLength={4}
                  value={memberPin}
                  onChange={(e) => setMemberPin(e.target.value.replace(/\D/g, ''))}
                  required
                  className="pt-input pt-input-pin"
                />
                <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                  Solicita este código de 4 dígitos al capitán de tu equipo.
                </span>
              </div>

              <button
                type="submit"
                disabled={isSubmitting || !memberName.trim() || !selectedTeamId || memberPin.length !== 4}
                className="pt-btn-primary"
              >
                {isSubmitting ? 'Verificando PIN...' : 'Unirse al Equipo'}
                <ArrowRight size={16} />
              </button>
            </form>
          )}
        </div>
      ) : (
        /* ================================================================ VISTA 2: DENTRO DEL EQUIPO */
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          {/* Tarjeta de Identidad del Equipo */}
          <section className="pt-team-card">
            <div className="pt-team-row">
              <TeamAvatar avatar={currentTeam?.avatar} teamName={currentTeam?.name || 'Equipo'} size={54} />
              <div className="pt-team-details">
                <h2 className="pt-team-name">{currentTeam?.name || 'Mi Equipo'}</h2>
                {currentTeam?.motto && <div className="pt-team-motto">"{currentTeam.motto}"</div>}
                <span className={`pt-team-role ${participant?.role === 'CAPTAIN' ? 'is-captain' : 'is-member'}`}>
                  {participant?.role === 'CAPTAIN' ? 'Capitán' : 'Integrante'} · {participant?.name}
                </span>
              </div>
            </div>

            {/* PIN visible para el capitán con copiado en 1 clic */}
            {participant?.role === 'CAPTAIN' && currentTeam?.pin && (
              <div className="pt-team-pin-box">
                <div>
                  <span className="eyebrow" style={{ display: 'block' }}>PIN del Equipo</span>
                  <span className="pt-team-pin-val">{currentTeam.pin}</span>
                </div>
                <button
                  type="button"
                  onClick={() => handleCopyPin(currentTeam.pin!)}
                  style={{
                    background: 'rgba(255, 255, 255, 0.08)',
                    border: '1px solid var(--border-subtle)',
                    padding: '6px 12px',
                    borderRadius: '3px',
                    color: '#fff',
                    fontSize: '11px',
                    fontWeight: 700,
                    letterSpacing: '0.06em',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px'
                  }}
                >
                  {copiedPin ? <Check size={12} color="#2fb36d" /> : <Copy size={12} />}
                  {copiedPin ? 'Copiado' : 'Copiar PIN'}
                </button>
              </div>
            )}
          </section>

          {/* Selector de Pestañas: Trivia vs Social */}
          <nav className="pt-nav-tabs">
            <button
              type="button"
              className={`pt-tab ${activeTab === 'trivia' ? 'is-active' : ''}`}
              onClick={() => setActiveTab('trivia')}
            >
              <Flame size={16} /> Trivia & Pulsador
            </button>
            <button
              type="button"
              className={`pt-tab ${activeTab === 'social' ? 'is-active' : ''}`}
              onClick={() => setActiveTab('social')}
            >
              <MessageCircle size={16} /> Chat de Integración
              {pairingData && <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: 'var(--success)' }} />}
            </button>
          </nav>

          {/* ============================================================ PESTAÑA 1: TRIVIA */}
          {activeTab === 'trivia' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              {gameState.status === 'LOBBY' ? (
                /* Estado Lobby */
                <div className="pt-card" style={{ textAlign: 'center', padding: '32px 20px' }}>
                  <div style={{ width: '44px', height: '44px', borderRadius: '50%', background: '#17191d', border: '1px solid var(--border-subtle)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px auto' }}>
                    <Shield size={20} color="var(--primary)" />
                  </div>
                  <h3 style={{ fontFamily: 'var(--font-display)', fontSize: '24px', fontWeight: 700, textTransform: 'uppercase', color: '#fff', margin: 0 }}>
                    Equipo en Espera
                  </h3>
                  <p style={{ fontSize: '13px', color: 'var(--text-muted)', margin: '6px 0 0 0', lineHeight: 1.5 }}>
                    {participant?.role === 'CAPTAIN'
                      ? 'Como capitán, tú operarás el pulsador táctil. Mantente atento a la pantalla del escenario.'
                      : 'Tu equipo está registrado. Prepárate para deliberar con tu capitán en cada pregunta.'}
                  </p>
                </div>
              ) : (
                /* Estado Pregunta Activa */
                <div className="pt-card">
                  {gameState.currentQuestion && (
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingBottom: '10px', borderBottom: '1px solid var(--border-subtle)', marginBottom: '12px' }}>
                        <span className="eyebrow" style={{ color: 'var(--primary)' }}>
                          Pregunta #{String(gameState.currentQuestion.order).padStart(2, '0')}
                        </span>
                        <span style={{ fontFamily: 'var(--font-mono)', fontSize: '13px', fontWeight: 700, color: gameState.timeRemaining <= 5 ? 'var(--danger)' : '#fff' }}>
                          <Clock size={12} style={{ display: 'inline', marginRight: '4px' }} />
                          {gameState.timeRemaining}s
                        </span>
                      </div>

                      <h3 style={{ fontSize: '17px', fontWeight: 600, color: '#fff', lineHeight: 1.35, margin: '0 0 6px 0' }}>
                        "{gameState.currentQuestion.text}"
                      </h3>
                      <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                        {gameState.currentQuestion.type === 'ORAL_DEFENSE' ? 'Defensa Oral' : 'Opción Múltiple'} · {gameState.currentQuestion.points} pts
                      </div>
                    </div>
                  )}

                  {/* FASE: LECTURA PREVIA */}
                  {gameState.status === 'QUESTION_READING' && (
                    <div className="pt-alert" style={{ background: '#17191d', border: '1px solid var(--border-strong)', color: '#fff' }}>
                      <span>Lectura previa. Delibera con tu equipo mientras el moderador habilita el pulsador.</span>
                    </div>
                  )}

                  {/* FASE: CUENTA REGRESIVA 7s */}
                  {gameState.status === 'COUNTDOWN_ACTIVE' && (
                    <div style={{ textAlign: 'center', padding: '16px 0' }}>
                      <span className="eyebrow" style={{ color: 'var(--warning)', letterSpacing: '0.18em' }}>Pulsador activo en</span>
                      <div style={{ fontFamily: 'var(--font-display)', fontSize: '64px', fontWeight: 800, color: '#fff', lineHeight: 1, margin: '8px 0' }}>
                        {gameState.countdownRemaining ?? 7}
                      </div>
                      <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Atentos capitanes</span>
                    </div>
                  )}

                  {/* FASE: PREGUNTA ACTIVA / PULSADOR */}
                  {gameState.status === 'QUESTION_ACTIVE' && (
                    <div className="pt-buzzer-zone">
                      {participant?.role === 'CAPTAIN' ? (
                        <>
                          <button
                            type="button"
                            onClick={handleBuzz}
                            disabled={buzzStatus === 'buzzing'}
                            className={`pt-buzzer-btn ${buzzStatus === 'buzzing' ? 'is-disabled' : ''}`}
                          >
                            <span>{buzzStatus === 'buzzing' ? 'Enviando...' : 'Pulsar'}</span>
                          </button>
                          <span className="eyebrow">Presiona primero para obtener el turno</span>
                        </>
                      ) : (
                        <div className="pt-alert" style={{ background: '#17191d', border: '1px solid var(--border-subtle)', color: 'var(--text-muted)', width: '100%', textAlign: 'center' }}>
                          <span style={{ width: '100%' }}>Pregunta activa. Tu capitán tiene el pulsador en su teléfono.</span>
                        </div>
                      )}
                    </div>
                  )}

                  {/* FASE: TURNO CONCEDIDO */}
                  {gameState.status === 'BUZZER_LOCKED' && gameState.buzzerWinner && (
                    <div>
                      {gameState.buzzerWinner.teamId === currentTeam?.id ? (
                        <div style={{ background: 'rgba(47, 179, 109, 0.1)', border: '1px solid var(--success)', padding: '16px', borderRadius: '4px', textAlign: 'center' }}>
                          <span className="eyebrow" style={{ color: 'var(--success)' }}>Turno de tu equipo</span>
                          <h4 style={{ fontFamily: 'var(--font-display)', fontSize: '22px', fontWeight: 700, textTransform: 'uppercase', color: '#fff', margin: '4px 0 10px 0' }}>
                            ¡Pulsador ganado!
                          </h4>

                          {gameState.currentQuestion?.type === 'ORAL_DEFENSE' ? (
                            <p style={{ fontSize: '13px', color: '#fff', margin: 0 }}>
                              Responde de forma clara hacia el jurado o moderador del escenario.
                            </p>
                          ) : (
                            <div className="pt-quiz-options">
                              {participant?.role === 'CAPTAIN' ? (
                                gameState.currentQuestion?.options?.map((opt, idx) => (
                                  <button
                                    key={idx}
                                    type="button"
                                    onClick={() => handleChoiceSubmit(idx)}
                                    className="pt-quiz-opt"
                                  >
                                    <span className="pt-quiz-letter">{['A', 'B', 'C', 'D'][idx]}</span>
                                    <span className="pt-quiz-text">{opt}</span>
                                  </button>
                                ))
                              ) : (
                                <p style={{ fontSize: '13px', color: 'var(--text-muted)', margin: 0 }}>
                                  Tu capitán está seleccionando la opción en su pantalla.
                                </p>
                              )}
                            </div>
                          )}
                        </div>
                      ) : (
                        <div className="pt-alert" style={{ background: '#17191d', border: '1px solid var(--border-subtle)' }}>
                          <span>Turno otorgado a <strong>{gameState.buzzerWinner.teamName}</strong>. Espera la siguiente ronda.</span>
                        </div>
                      )}
                    </div>
                  )}

                  {/* FASE: EVALUANDO */}
                  {gameState.status === 'EVALUATING' && (
                    <div className="pt-alert" style={{ background: '#17191d', border: '1px solid var(--border-subtle)', textAlign: 'center', width: '100%' }}>
                      <span style={{ width: '100%' }}>El jurado está evaluando la respuesta en el escenario...</span>
                    </div>
                  )}

                  {/* FASE: VEREDICTO */}
                  {gameState.status === 'SHOWING_RESULT' && gameState.result && (
                    <div style={{
                      padding: '16px',
                      borderRadius: '4px',
                      background: gameState.result.grade === 'CORRECT' ? 'rgba(47, 179, 109, 0.12)' : 'rgba(229, 72, 77, 0.12)',
                      border: `1px solid ${gameState.result.grade === 'CORRECT' ? 'var(--success)' : 'var(--danger)'}`,
                      textAlign: 'center'
                    }}>
                      <span className="eyebrow" style={{ color: gameState.result.grade === 'CORRECT' ? 'var(--success)' : 'var(--danger)' }}>
                        Veredicto oficial
                      </span>
                      <h4 style={{ fontFamily: 'var(--font-display)', fontSize: '24px', fontWeight: 700, textTransform: 'uppercase', color: '#fff', margin: '4px 0' }}>
                        {gameState.result.grade === 'CORRECT' ? 'Respuesta Correcta' : gameState.result.grade === 'PARTIAL' ? 'Respuesta Parcial' : 'Respuesta Incorrecta'}
                      </h4>
                      <div style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
                        {gameState.result.teamName}: +{gameState.result.pointsAwarded} pts
                      </div>
                    </div>
                  )}

                  {/* FASE: PODIO */}
                  {gameState.status === 'LEADERBOARD' && (
                    <div style={{ textAlign: 'center', padding: '16px 0' }}>
                      <Trophy size={36} color="var(--primary)" style={{ margin: '0 auto 8px auto' }} />
                      <h3 style={{ fontFamily: 'var(--font-display)', fontSize: '22px', textTransform: 'uppercase', color: '#fff', margin: 0 }}>
                        Consulta la pantalla gigante
                      </h3>
                      <p style={{ fontSize: '13px', color: 'var(--text-muted)', margin: '4px 0 0 0' }}>
                        Puntaje actual de tu equipo: <strong style={{ color: '#fff' }}>{currentTeam?.score || 0} pts</strong>
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* ============================================================ PESTAÑA 2: SOCIAL */}
          {activeTab === 'social' && (
            <div className="pt-chat-box">
              {!pairingData ? (
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '24px', textAlign: 'center' }}>
                  <MessageCircle size={32} color="var(--text-dim)" style={{ marginBottom: '10px' }} />
                  <h4 style={{ fontFamily: 'var(--font-display)', fontSize: '20px', textTransform: 'uppercase', color: '#fff', margin: 0 }}>
                    Fase de Integración
                  </h4>
                  <p style={{ fontSize: '13px', color: 'var(--text-muted)', margin: '6px 0 0 0', maxWidth: '300px' }}>
                    Al finalizar las preguntas, el moderador iniciará las duplas para compartir en el mural del auditorio.
                  </p>
                </div>
              ) : (
                <>
                  <div className="pt-chat-head">
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <TeamAvatar
                        avatar={pairingData.partners[0]?.teamAvatar}
                        teamName={pairingData.partners[0]?.teamName || 'Dupla'}
                        size={36}
                      />
                      <div>
                        <div style={{ fontSize: '14px', fontWeight: 700, color: '#fff', textTransform: 'uppercase' }}>
                          {pairingData.partners.map((p) => p.name).join(' & ')}
                        </div>
                        <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                          Equipo: {pairingData.partners.map((p) => p.teamName).join(' / ')}
                        </div>
                      </div>
                    </div>
                    {!chatEnabled && (
                      <span className="eyebrow" style={{ color: 'var(--warning)' }}>Pausado</span>
                    )}
                  </div>

                  {/* Mensajes */}
                  <div className="pt-chat-msgs" ref={chatScrollRef}>
                    {pairingData.messages.length === 0 ? (
                      <div style={{ textAlign: 'center', padding: '24px', color: 'var(--text-dim)', fontSize: '13px' }}>
                        Inicia la conversación o envía una fotografía para proyectarla en el mural.
                      </div>
                    ) : (
                      pairingData.messages.map((m) => {
                        const isMine = m.senderId === participant?.id;
                        return (
                          <div
                            key={m.id}
                            className={`pt-msg-bubble ${isMine ? 'is-mine' : 'is-partner'}`}
                          >
                            {!isMine && (
                              <div style={{ fontSize: '10px', color: 'var(--text-dim)', marginBottom: '3px', textTransform: 'uppercase', fontWeight: 700 }}>
                                {m.senderName}
                              </div>
                            )}
                            {m.photoUrl && (
                              <img
                                src={m.photoUrl}
                                alt="Foto"
                                style={{ width: '100%', maxHeight: '180px', objectFit: 'cover', borderRadius: '2px', marginBottom: m.content ? '6px' : 0 }}
                              />
                            )}
                            {m.content}
                          </div>
                        );
                      })
                    )}
                  </div>

                  {/* Saludos rápidos */}
                  <div style={{ display: 'flex', gap: '6px', padding: '6px 10px', overflowX: 'auto', background: '#121417', borderTop: '1px solid var(--border-subtle)' }}>
                    {quickGreetings.map((g, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => handleSendChatMessage(g)}
                        disabled={!chatEnabled || isSendingChat}
                        style={{
                          whiteSpace: 'nowrap',
                          padding: '5px 10px',
                          background: '#0b0c0e',
                          border: '1px solid var(--border-subtle)',
                          borderRadius: '2px',
                          color: 'var(--text-muted)',
                          fontSize: '11px',
                          fontWeight: 600
                        }}
                      >
                        {g}
                      </button>
                    ))}
                  </div>

                  {/* Preview de foto adjunta */}
                  {chatPhotoUrl && (
                    <div style={{ padding: '8px 10px', background: '#121417', display: 'flex', alignItems: 'center', gap: '8px', borderTop: '1px solid var(--border-subtle)' }}>
                      <img src={chatPhotoUrl} alt="Adjunto" style={{ width: '40px', height: '40px', objectFit: 'cover', borderRadius: '2px' }} />
                      <span style={{ fontSize: '12px', color: '#fff', flex: 1 }}>Fotografía lista para enviar</span>
                      <button
                        type="button"
                        onClick={() => setChatPhotoUrl(null)}
                        style={{ background: 'transparent', color: 'var(--text-muted)', border: 'none', padding: '4px' }}
                      >
                        <X size={16} />
                      </button>
                    </div>
                  )}

                  {/* Input bar */}
                  <div className="pt-chat-input-bar">
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
                      style={{
                        padding: '8px',
                        background: chatPhotoUrl ? 'var(--primary)' : 'transparent',
                        color: chatPhotoUrl ? '#0b0c0e' : '#fff',
                        border: '1px solid var(--border-subtle)',
                        borderRadius: '3px'
                      }}
                      title="Tomar fotografía"
                    >
                      <Camera size={16} />
                    </button>

                    <input
                      type="text"
                      value={chatInput}
                      onChange={(e) => setChatInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleSendChatMessage();
                      }}
                      placeholder={chatEnabled ? "Escribe un mensaje..." : "Chat en pausa"}
                      disabled={!chatEnabled || isSendingChat}
                      className="pt-input"
                      style={{ flex: 1, padding: '8px 12px', fontSize: '13px' }}
                    />

                    <button
                      type="button"
                      onClick={() => handleSendChatMessage()}
                      disabled={!chatEnabled || isSendingChat || (!chatInput.trim() && !chatPhotoUrl)}
                      className="pt-btn-primary"
                      style={{ margin: 0, padding: '8px 14px', fontSize: '13px' }}
                    >
                      <Send size={14} />
                    </button>
                  </div>
                </>
              )}
            </div>
          )}

          {/* Mensajes en vivo del moderador */}
          {messages.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <span className="eyebrow">Mensaje oficial de moderación</span>
              {messages.map((m) => (
                <div key={m.id} className="pt-alert pt-alert-warning">
                  <span>{m.content}</span>
                </div>
              ))}
            </div>
          )}

          {/* Salir de sesión */}
          <button
            type="button"
            onClick={handleResetSession}
            style={{
              margin: '8px auto',
              background: 'transparent',
              color: 'var(--text-dim)',
              fontSize: '12px',
              fontWeight: 600,
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}
          >
            <LogOut size={13} /> Cambiar de equipo / Cerrar sesión
          </button>
        </div>
      )}
    </div>
  );
}
