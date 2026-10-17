import { useState, useEffect, useRef, useMemo } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { socket } from '../services/socket';
import { fetchStageData } from '../services/api';
import { TeamAvatar } from '../components/TeamAvatar';
import { CircularCarousel } from '../components/CircularCarousel';
import confetti from 'canvas-confetti';
import type { StageData, Team, GameState, GameStatus, MuralPhotoItem, WallMessage, StageAudioState } from '../../../shared/types/index.js';
import { Maximize, Minimize, Trophy, Camera, Radio, QrCode, Music, Volume2, VolumeX } from 'lucide-react';
import '../styles/stage.css';

const PUBLIC_URL_FALLBACK = 'https://encuentro-juvenil.onrender.com';
const COUNTDOWN_TOTAL = 7;
const OPTION_LETTERS = ['A', 'B', 'C', 'D', 'E', 'F'];

/** Rótulo de la barra superior según la fase del juego */
const PHASE_LABELS: Record<GameStatus, { tag: string; title: string }> = {
  LOBBY: { tag: 'Sala de espera', title: 'Registro de equipos' },
  QUESTION_READING: { tag: 'Trivia', title: 'Lectura de la pregunta' },
  COUNTDOWN_ACTIVE: { tag: 'Trivia', title: 'Pulsador por activarse' },
  QUESTION_ACTIVE: { tag: 'En juego', title: 'Pulsador habilitado' },
  BUZZER_LOCKED: { tag: 'Turno', title: 'Turno de respuesta' },
  EVALUATING: { tag: 'Jurado', title: 'Evaluación de la respuesta' },
  SHOWING_RESULT: { tag: 'Resultado', title: 'Veredicto' },
  LEADERBOARD: { tag: 'Clasificación', title: 'Tabla general de puntos' }
};

export function StagePage() {
  const [stageData, setStageData] = useState<StageData>({
    teams: [],
    totalParticipants: 0,
    connectedCount: 0
  });
  const [gameState, setGameState] = useState<GameState>({
    status: 'LOBBY',
    currentQuestion: null,
    timeRemaining: 0,
    buzzerWinner: null,
    selectedChoice: null,
    result: null
  });

  const [joinUrl, setJoinUrl] = useState('');
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isConnected, setIsConnected] = useState(socket.connected);
  const [clock, setClock] = useState(() => new Date());

  // Control de vista del operador: 'auto' (sigue al moderador), 'lobby' (fuerza QR y sala de espera), 'leaderboard' (fuerza podio), 'mural' (fuerza mural de fotos)
  const [stageViewMode, setStageViewMode] = useState<'auto' | 'lobby' | 'leaderboard' | 'mural'>('auto');
  const [muralPhotos, setMuralPhotos] = useState<MuralPhotoItem[]>([]);

  // Muro de mensajes de los jóvenes (ya filtrados por el servidor)
  const [wallMessages, setWallMessages] = useState<WallMessage[]>([]);
  const [wallEnabled, setWallEnabled] = useState(true);

  // Controles de audio de la pista musical ambiental (sincronizada con el Admin)
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [isAudioPlaying, setIsAudioPlaying] = useState(false);
  const [audioBlocked, setAudioBlocked] = useState(false);
  const [remoteAudio, setRemoteAudio] = useState<StageAudioState>({
    playing: false,
    volume: 0.6,
    muted: false,
    trackTitle: 'Cambiaré Mis Tristezas / Eres Fiel'
  });

  // Controles del operador: se ocultan solos para no ensuciar la proyección
  const [controlsVisible, setControlsVisible] = useState(false);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
    setJoinUrl(isLocalhost ? PUBLIC_URL_FALLBACK : window.location.origin);

    fetchStageData()
      .then((data) => {
        if (data) setStageData(data);
      })
      .catch((err) => console.error('Error cargando stage inicial:', err));

    function registerStage() {
      setIsConnected(true);
      socket.emit('stage:join', (res) => {
        if (res.success && res.data) {
          setStageData(res.data);
          if (res.data.muralPhotos) setMuralPhotos(res.data.muralPhotos);
          if (res.gameState) setGameState(res.gameState);
          if (res.audioState) setRemoteAudio(res.audioState);
          if ((res as any).viewMode) setStageViewMode((res as any).viewMode);
        }
      });
      socket.emit('stage:get-wall', (res) => {
        if (res?.success) {
          setWallEnabled(res.enabled);
          setWallMessages(res.messages);
        }
      });
    }

    if (socket.connected) {
      registerStage();
    }

    socket.on('connect', registerStage);
    socket.on('disconnect', () => setIsConnected(false));
    socket.on('stage:update', (data: StageData) => {
      setStageData(data);
    });
    socket.on('stage:view-change', ({ mode }: { mode: any }) => {
      if (mode) setStageViewMode(mode);
    });

    socket.on('game:state-update', (state: GameState) => {
      setGameState(state);
      if (state.status === 'LEADERBOARD' || (state.status === 'SHOWING_RESULT' && state.result?.grade === 'CORRECT')) {
        try {
          confetti({
            particleCount: 70,
            spread: 70,
            startVelocity: 38,
            origin: { y: 0.35 },
            colors: ['#ff5a1f', '#ffffff', '#13233a']
          });
        } catch (e) {}
      }
    });

    socket.on('game:timer-tick', ({ timeRemaining }) => {
      setGameState((prev) => ({ ...prev, timeRemaining }));
    });

    socket.on('game:countdown-tick', ({ countdownRemaining }) => {
      setGameState((prev) => ({ ...prev, countdownRemaining }));
    });

    socket.on('game:score-updated', (teams: Team[]) => {
      setStageData((prev) => ({ ...prev, teams }));
    });

    socket.on('stage:mural-update', (photos: MuralPhotoItem[]) => {
      setMuralPhotos(photos);
    });

    socket.on('stage:wall-update', (wall) => {
      setWallEnabled(wall.enabled);
      setWallMessages(wall.messages);
    });

    function onChatStatusChange(data: { chatEnabled: boolean }) {
      // Si el moderador activó el chat y no hay trivia en juego, proyectar el mural automáticamente
      if (data.chatEnabled) {
        setStageViewMode((prev) => (prev === 'auto' ? 'mural' : prev));
      }
    }
    socket.on('chat:status-change', onChatStatusChange);

    function onStageAudioUpdate(audioState: StageAudioState) {
      setRemoteAudio(audioState);
      const audio = audioRef.current;
      if (!audio) return;
      if (audioState.seekTime) {
        audio.currentTime = 0;
      }
      audio.volume = audioState.muted ? 0 : audioState.volume;
    }
    socket.on('stage:audio-update', onStageAudioUpdate);

    return () => {
      socket.off('connect', registerStage);
      socket.off('disconnect');
      socket.off('stage:update');
      socket.off('stage:view-change');
      socket.off('game:state-update');
      socket.off('game:timer-tick');
      socket.off('game:countdown-tick');
      socket.off('game:score-updated');
      socket.off('stage:mural-update');
      socket.off('stage:wall-update');
      socket.off('chat:status-change', onChatStatusChange);
      socket.off('stage:audio-update', onStageAudioUpdate);
    };
  }, []);

  // Reloj de la barra superior
  useEffect(() => {
    const id = setInterval(() => setClock(new Date()), 15000);
    return () => clearInterval(id);
  }, []);

  // Si arranca una pregunta mientras se proyecta otra cosa, volvemos al juego en vivo automáticamente
  useEffect(() => {
    if (gameState.status !== 'LOBBY' && gameState.status !== 'LEADERBOARD') {
      setStageViewMode('auto');
    }
  }, [gameState.status]);

  // Mostrar controles al mover el mouse y ocultarlos a los 2.5 s
  useEffect(() => {
    const reveal = () => {
      setControlsVisible(true);
      if (hideTimer.current) clearTimeout(hideTimer.current);
      hideTimer.current = setTimeout(() => setControlsVisible(false), 2500);
    };
    window.addEventListener('mousemove', reveal);
    return () => {
      window.removeEventListener('mousemove', reveal);
      if (hideTimer.current) clearTimeout(hideTimer.current);
    };
  }, []);

  useEffect(() => {
    const onChange = () => setIsFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener('fullscreenchange', onChange);
    return () => document.removeEventListener('fullscreenchange', onChange);
  }, []);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
    } else {
      document.exitFullscreen().catch(() => {});
    }
  };

  const rankedTeams = useMemo(
    () => [...stageData.teams].sort((a, b) => (b.score || 0) - (a.score || 0)),
    [stageData.teams]
  );
  const maxScore = Math.max(1, ...rankedTeams.map((t) => t.score || 0));

  const isMural = stageViewMode === 'mural';
  const isForcedLobby = stageViewMode === 'lobby';
  const isForcedLeaderboard = stageViewMode === 'leaderboard';
  const status = gameState.status;
  const question = gameState.currentQuestion;

  const isQuestionPhase =
    !isMural &&
    !isForcedLobby &&
    !isForcedLeaderboard &&
    !!question &&
    (status === 'QUESTION_READING' ||
      status === 'COUNTDOWN_ACTIVE' ||
      status === 'QUESTION_ACTIVE' ||
      status === 'BUZZER_LOCKED' ||
      status === 'EVALUATING' ||
      status === 'SHOWING_RESULT');

  // Reproducción de la pista musical ambiental gobernada por el Admin:
  // Suena si el Admin le dio PLAY (o si el chat/mural están activos según el estado remoto)
  // y se silencia temporalmente si comienza una pregunta de trivia para no tapar la voz del moderador.
  const shouldPlayAudio = remoteAudio.playing && !isQuestionPhase;

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    audio.volume = remoteAudio.muted ? 0 : remoteAudio.volume;

    if (shouldPlayAudio) {
      const p = audio.play();
      if (p !== undefined) {
        p.then(() => {
          setIsAudioPlaying(true);
          setAudioBlocked(false);
        }).catch((err) => {
          console.warn('[Stage Audio] Autoplay bloqueado por política del navegador:', err);
          setIsAudioPlaying(false);
          setAudioBlocked(true);
        });
      }
    } else {
      audio.pause();
      setIsAudioPlaying(false);
    }
  }, [shouldPlayAudio, remoteAudio.volume, remoteAudio.muted]);

  // Si el navegador exigió interacción previa para el audio, desbloquear con el primer clic o tecla
  useEffect(() => {
    if (!audioBlocked) return;
    const unlock = () => {
      if (audioRef.current && shouldPlayAudio) {
        audioRef.current.play().then(() => {
          setIsAudioPlaying(true);
          setAudioBlocked(false);
        }).catch(() => {});
      }
    };
    window.addEventListener('click', unlock, { once: true });
    window.addEventListener('keydown', unlock, { once: true });
    return () => {
      window.removeEventListener('click', unlock);
      window.removeEventListener('keydown', unlock);
    };
  }, [audioBlocked, shouldPlayAudio]);

  const showLobby = !isMural && !isForcedLeaderboard && (isForcedLobby || (!isQuestionPhase && status === 'LOBBY'));

  const phase = isMural
    ? { tag: 'Mural', title: 'Mural de integración' }
    : isForcedLobby
    ? { tag: 'Sala de espera', title: 'Registro de equipos y bienvenida' }
    : isForcedLeaderboard
    ? { tag: 'Clasificación', title: 'Tabla general de puntos' }
    : PHASE_LABELS[status] || { tag: 'Encuentro', title: 'Transmisión' };

  const showTicker = rankedTeams.length > 0 && (isMural || !showLobby);

  const clockText = clock.toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' });

  return (
    <div className="st">
      {/* ================================================================ BARRA SUPERIOR */}
      <header className="st-top">
        <div className="st-brand">
          <img src="/logo-rvc.png" alt="RVC" />
          <div className="st-brand-text">
            <span className="st-brand-name">Encuentro Juvenil</span>
            <span className="st-brand-sub">RVC · Transmisión en vivo</span>
          </div>
        </div>

        <div className="st-phase">
          <span className="st-phase-tag">{phase.tag}</span>
          <h1 className="st-phase-title">{phase.title}</h1>
        </div>

        <div className="st-stats">
          <div className="st-stat">
            <span className="st-stat-label">Equipos</span>
            <span className="st-stat-value">{stageData.teams.length}</span>
          </div>
          <div className="st-stat">
            <span className="st-stat-label">Conectados</span>
            <span className="st-stat-value">{stageData.connectedCount}</span>
          </div>
          <div className="st-stat">
            <span className="st-stat-label st-live">
              <span className={`st-live-dot ${isConnected ? '' : 'is-off'}`} />
              {isConnected ? 'En vivo' : 'Sin señal'}
            </span>
            <span className="st-stat-value">{clockText}</span>
          </div>
        </div>
      </header>

      {/* Controles del operador (aparecen al mover el mouse) */}
      <div className={`st-controls ${controlsVisible ? 'is-visible' : ''}`}>
        <button
          className={`st-ctrl ${stageViewMode === 'auto' ? 'is-active' : ''}`}
          onClick={() => setStageViewMode('auto')}
          title="Seguimiento automático del moderador en vivo"
        >
          <Radio size={14} /> En Vivo (Auto)
        </button>
        <button
          className={`st-ctrl ${stageViewMode === 'lobby' ? 'is-active' : ''}`}
          onClick={() => setStageViewMode('lobby')}
          title="Proyectar sala de bienvenida y código QR para que los participantes se unan"
        >
          <QrCode size={14} /> Sala QR / Equipos
        </button>
        <button
          className={`st-ctrl ${stageViewMode === 'leaderboard' ? 'is-active' : ''}`}
          onClick={() => setStageViewMode('leaderboard')}
          title="Ver tabla de posiciones"
        >
          <Trophy size={14} /> Clasificación
        </button>
        <button
          className={`st-ctrl ${stageViewMode === 'mural' ? 'is-active' : ''}`}
          onClick={() => setStageViewMode('mural')}
          title="Mural fotográfico 3D"
        >
          <Camera size={14} /> Mural ({muralPhotos.length})
        </button>
        <button
          className={`st-ctrl ${isAudioPlaying ? 'is-active' : ''}`}
          onClick={() => {
            if (isAudioPlaying) {
              setRemoteAudio((prev) => ({ ...prev, playing: false }));
              audioRef.current?.pause();
              setIsAudioPlaying(false);
            } else {
              setRemoteAudio((prev) => ({ ...prev, playing: true, muted: false }));
              audioRef.current?.play().then(() => {
                setIsAudioPlaying(true);
                setAudioBlocked(false);
              }).catch(() => {});
            }
          }}
          title={isAudioPlaying ? 'Silenciar pista ambiental' : 'Reproducir pista ambiental'}
        >
          {isAudioPlaying ? <Volume2 size={14} /> : <VolumeX size={14} />}
          <span>{isAudioPlaying ? 'Pista: En vivo' : 'Pista: Pausada'}</span>
        </button>
        <button className="st-ctrl" onClick={toggleFullscreen} title="Pantalla completa">
          {isFullscreen ? <Minimize size={14} /> : <Maximize size={14} />}
          {isFullscreen ? 'Salir' : 'Pantalla completa'}
        </button>
      </div>

      {/* Pista musical de fondo en bucle */}
      <audio ref={audioRef} src="/audio/mural_track.mp3" loop preload="auto" />

      {/* Botón flotante para activar el audio si el navegador bloqueó el autoplay inicial */}
      {audioBlocked && shouldPlayAudio && (
        <button
          type="button"
          onClick={() => {
            if (audioRef.current) {
              audioRef.current.play().then(() => {
                setIsAudioPlaying(true);
                setAudioBlocked(false);
              }).catch(() => {});
            }
          }}
          className="st-audio-toast"
          title="Haz clic para activar el audio del auditorio"
        >
          <Music size={16} className="st-pulse" />
          <span>Pista de fondo lista · Haz clic aquí para activar audio</span>
        </button>
      )}

      {/* ================================================================ CONTENIDO */}
      <main className="st-main" key={isMural ? 'mural' : showLobby ? 'lobby' : status}>
        {/* ----------------------------------------------------------- MURAL */}
        {isMural && <MuralView photos={muralPhotos} wall={wallEnabled ? wallMessages : []} />}

        {/* ----------------------------------------------------------- LOBBY */}
        {!isMural && showLobby && (
          <div className="st-lobby">
            <aside className="st-join">
              <span className="st-kicker">Únete desde tu teléfono</span>
              <h2 className="st-join-title">Escanea para participar</h2>

              <div className="st-qr">
                <QRCodeSVG value={joinUrl || window.location.origin} size={280} level="H" includeMargin={false} />
              </div>
              <div className="st-url">{(joinUrl || window.location.origin).replace(/^https?:\/\//, '')}</div>

              <div className="st-steps">
                <div className="st-step">
                  <span className="st-step-num">01</span>
                  <p className="st-step-text">
                    <strong>Capitanes:</strong> creen el equipo, suban su escudo y compartan el PIN.
                  </p>
                </div>
                <div className="st-step">
                  <span className="st-step-num">02</span>
                  <p className="st-step-text">
                    <strong>Integrantes:</strong> elijan su equipo e ingresen el PIN del capitán.
                  </p>
                </div>
              </div>
            </aside>

            <section className="st-roster">
              <div className="st-section-head">
                <h2 className="st-section-title">Equipos inscritos</h2>
                <span className="st-section-meta">
                  {stageData.teams.length} equipos · {stageData.totalParticipants || 0} participantes
                </span>
              </div>

              {stageData.teams.length === 0 ? (
                <div className="st-empty">
                  <span className="st-kicker">Esperando inscripciones</span>
                  <h3>Aún no hay equipos registrados</h3>
                  <p>Los equipos aparecerán aquí en tiempo real en cuanto los capitanes completen su registro.</p>
                </div>
              ) : (
                <>
                  <div className="st-table-head">
                    <span>#</span>
                    <span />
                    <span>Equipo</span>
                    <span style={{ textAlign: 'right' }}>Integrantes</span>
                    <span style={{ textAlign: 'right' }}>Estado</span>
                  </div>
                  <div className="st-rows">
                    {stageData.teams.map((team, idx) => (
                      <div className="st-row" key={team.id} style={{ animationDelay: `${Math.min(idx, 12) * 40}ms` }}>
                        <span className="st-row-idx">{String(idx + 1).padStart(2, '0')}</span>
                        <TeamAvatar avatar={team.avatar} teamName={team.name} size={48} />
                        <div className="st-row-name">
                          <strong>{team.name}</strong>
                          {team.motto && <span>{team.motto}</span>}
                        </div>
                        <span className="st-row-num">{team.memberCount || 0}</span>
                        <span className="st-row-status">Listo</span>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </section>
          </div>
        )}

        {/* -------------------------------------------------------- PREGUNTA */}
        {isQuestionPhase && question && <QuestionView gameState={gameState} />}

        {/* ----------------------------------------------------- CLASIFICACIÓN */}
        {!isMural && !showLobby && !isQuestionPhase && (
          <div className="st-board">
            {rankedTeams.length === 0 ? (
              <div className="st-empty">
                <h3>Sin equipos en competencia</h3>
              </div>
            ) : (
              <>
                <section className="st-leader">
                  <span className="st-kicker">Primer lugar</span>
                  <div className="st-leader-rank">01</div>
                  <div style={{ marginTop: '24px' }}>
                    <TeamAvatar avatar={rankedTeams[0].avatar} teamName={rankedTeams[0].name} size={96} />
                  </div>
                  <div className="st-leader-name">{rankedTeams[0].name}</div>
                  {rankedTeams[0].motto && <div className="st-leader-motto">{rankedTeams[0].motto}</div>}
                  <div className="st-leader-score">
                    <strong>{rankedTeams[0].score || 0}</strong>
                    <span>Puntos</span>
                  </div>
                </section>

                <section className="st-roster st-standings">
                  <div className="st-section-head">
                    <h2 className="st-section-title">Clasificación</h2>
                    <span className="st-section-meta">Marcador oficial</span>
                  </div>
                  <div className="st-table-head">
                    <span>Pos</span>
                    <span />
                    <span>Equipo</span>
                    <span style={{ textAlign: 'right' }}>Puntos</span>
                  </div>
                  <div className="st-rows">
                    {rankedTeams.map((team, idx) => (
                      <div
                        className={`st-row ${idx < 3 ? 'is-top' : ''}`}
                        key={team.id}
                        style={{ animationDelay: `${Math.min(idx, 12) * 60}ms` }}
                      >
                        <span className={`st-rank ${idx < 3 ? 'is-top' : ''}`}>{String(idx + 1).padStart(2, '0')}</span>
                        <TeamAvatar avatar={team.avatar} teamName={team.name} size={44} />
                        <div className="st-row-name">
                          <strong>{team.name}</strong>
                          <div className="st-score-bar">
                            <span style={{ width: `${((team.score || 0) / maxScore) * 100}%` }} />
                          </div>
                        </div>
                        <span className="st-row-num">{team.score || 0}</span>
                      </div>
                    ))}
                  </div>
                </section>
              </>
            )}
          </div>
        )}
      </main>

      {/* ================================================================ TICKER DE PUNTOS */}
      {showTicker ? (
        <footer className="st-ticker">
          <span className="st-ticker-label">Marcador</span>
          <div className="st-ticker-track">
            <div
              className="st-ticker-items"
              style={{ ['--st-ticker-duration' as string]: `${Math.max(24, rankedTeams.length * 6)}s` }}
            >
              {[...rankedTeams, ...rankedTeams].map((team, idx) => (
                <span className="st-ticker-item" key={`${team.id}-${idx}`}>
                  <b>{String((idx % rankedTeams.length) + 1).padStart(2, '0')}</b>
                  <span>{team.name}</span>
                  <em>{team.score || 0}</em>
                </span>
              ))}
            </div>
          </div>
        </footer>
      ) : (
        <div />
      )}
    </div>
  );
}

/* ==========================================================================
   Vista de pregunta: lectura, cuenta regresiva, pulsador, turno y veredicto
   ========================================================================== */
function QuestionView({ gameState }: { gameState: GameState }) {
  const question = gameState.currentQuestion!;
  const status = gameState.status;
  const isLong = question.text.length > 140;
  const timeLimit = question.timeLimit || 1;
  const timePct = Math.max(0, Math.min(100, (gameState.timeRemaining / timeLimit) * 100));
  const isLowTime = status === 'QUESTION_ACTIVE' && gameState.timeRemaining <= 5;
  const correctIdx = gameState.result?.correctOptionIndex ?? question.correctOptionIndex;
  const countdown = gameState.countdownRemaining ?? COUNTDOWN_TOTAL;
  const circumference = 2 * Math.PI * 48;

  let timerLabel = 'Tiempo';
  let timerValue: string = `${gameState.timeRemaining}s`;
  if (status === 'QUESTION_READING') {
    timerLabel = 'Estado';
    timerValue = 'Lectura';
  } else if (status === 'COUNTDOWN_ACTIVE') {
    timerLabel = 'Pulsador en';
    timerValue = `${countdown}s`;
  } else if (status === 'BUZZER_LOCKED' || status === 'EVALUATING') {
    timerLabel = 'Estado';
    timerValue = status === 'EVALUATING' ? 'Evaluando' : 'Respondiendo';
  } else if (status === 'SHOWING_RESULT') {
    timerLabel = 'Estado';
    timerValue = 'Finalizada';
  }

  return (
    <div className="st-q">
      <div>
        <div className="st-q-meta">
          <div>
            <div className="st-q-meta-label">Pregunta</div>
            <div className="st-q-meta-value is-accent">{String(question.order).padStart(2, '0')}</div>
          </div>
          <div>
            <div className="st-q-meta-label">Modalidad</div>
            <div className="st-q-meta-value">
              {question.type === 'ORAL_DEFENSE' ? 'Defensa oral' : 'Opción múltiple'}
            </div>
          </div>
          <div>
            <div className="st-q-meta-label">Valor</div>
            <div className="st-q-meta-value">{question.points} pts</div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div className="st-q-meta-label">{timerLabel}</div>
            <div className={`st-q-meta-value ${isLowTime ? 'is-danger' : ''}`}>{timerValue}</div>
          </div>
        </div>
        {status === 'QUESTION_ACTIVE' && (
          <div className={`st-timer-bar ${isLowTime ? 'is-danger' : ''}`}>
            <span style={{ width: `${timePct}%` }} />
          </div>
        )}
      </div>

      <h2 className={`st-q-text ${isLong ? 'is-long' : ''}`}>{question.text}</h2>

      {status === 'QUESTION_READING' && (
        <p className="st-notice">Lean la pregunta con su equipo. El moderador habilitará el pulsador en breve.</p>
      )}
      {status === 'QUESTION_ACTIVE' && (
        <p className="st-notice">Pulsador habilitado. El primer capitán en presionar obtiene el turno.</p>
      )}

      {question.type === 'MULTIPLE_CHOICE' && question.options && question.options.length > 0 && (
        <div className="st-options">
          {question.options.map((option, idx) => {
            const isSelected = gameState.selectedChoice === idx;
            let cls = '';
            if (status === 'SHOWING_RESULT') {
              if (correctIdx === idx) cls = 'is-correct';
              else if (isSelected) cls = 'is-wrong';
              else cls = 'is-dim';
            } else if (isSelected) {
              cls = 'is-selected';
            }
            return (
              <div className={`st-option ${cls}`} key={idx}>
                <span className="st-option-letter">{OPTION_LETTERS[idx]}</span>
                <span className="st-option-text">{option}</span>
              </div>
            );
          })}
        </div>
      )}

      {/* Rótulo: equipo con el turno */}
      {(status === 'BUZZER_LOCKED' || status === 'EVALUATING') && gameState.buzzerWinner && (
        <div className="st-lower" style={{ marginTop: question.type === 'MULTIPLE_CHOICE' ? 0 : 'auto' }}>
          <span className="st-lower-bar" />
          <div className="st-lower-crest">
            <TeamAvatar avatar={gameState.buzzerWinner.teamAvatar} teamName={gameState.buzzerWinner.teamName} size={72} />
          </div>
          <div className="st-lower-body">
            <span className="st-lower-label">Turno de respuesta</span>
            <span className="st-lower-title">{gameState.buzzerWinner.teamName}</span>
            <span className="st-lower-sub">Capitán: {gameState.buzzerWinner.captainName}</span>
          </div>
          <div className="st-lower-side">
            <span className="st-lower-status">
              {status === 'EVALUATING'
                ? 'En evaluación'
                : question.type === 'ORAL_DEFENSE'
                ? 'Respuesta oral'
                : 'Eligiendo opción'}
            </span>
          </div>
        </div>
      )}

      {/* Rótulo: veredicto */}
      {status === 'SHOWING_RESULT' && gameState.result && (
        <div
          className={`st-lower ${
            gameState.result.grade === 'CORRECT' ? 'is-correct' : gameState.result.grade === 'PARTIAL' ? 'is-partial' : 'is-wrong'
          }`}
          style={{ marginTop: question.type === 'MULTIPLE_CHOICE' ? 0 : 'auto' }}
        >
          <span className="st-lower-bar" />
          <div className="st-lower-crest">
            <TeamAvatar
              avatar={gameState.buzzerWinner?.teamAvatar}
              teamName={gameState.result.teamName}
              size={72}
            />
          </div>
          <div className="st-lower-body">
            <span className="st-lower-label">
              {gameState.result.grade === 'CORRECT' && 'Respuesta correcta'}
              {gameState.result.grade === 'PARTIAL' && 'Respuesta parcial'}
              {gameState.result.grade === 'INCORRECT' && 'Respuesta incorrecta'}
            </span>
            <span className="st-lower-title">{gameState.result.teamName}</span>
          </div>
          <div className="st-lower-side">
            <span className="st-lower-points">+{gameState.result.pointsAwarded}</span>
            <span className="st-lower-status">Puntos</span>
          </div>
        </div>
      )}

      {/* Cuenta regresiva a pantalla completa */}
      {status === 'COUNTDOWN_ACTIVE' && (
        <div className="st-countdown">
          <span className="st-countdown-caption">El pulsador se activa en</span>
          <div className="st-countdown-ring">
            <svg viewBox="0 0 100 100">
              <circle className="track" cx="50" cy="50" r="48" />
              <circle
                className="progress"
                cx="50"
                cy="50"
                r="48"
                strokeDasharray={circumference}
                strokeDashoffset={circumference * (1 - countdown / COUNTDOWN_TOTAL)}
              />
            </svg>
            <div className="st-countdown-num">
              <span key={countdown}>{countdown}</span>
            </div>
          </div>
          <p className="st-countdown-q">{question.text}</p>
        </div>
      )}
    </div>
  );
}

/* ==========================================================================
   Muro de mensajes: dos carriles laterales con tarjetas que entran y salen
   solas, sin tapar el carrusel. Cada WALL_INTERVAL_MS aparece un mensaje nuevo
   (los recién enviados tienen prioridad) y el más antiguo del carril se retira.
   ========================================================================== */
const WALL_INTERVAL_MS = 4800;
const WALL_MAX_PER_LANE = 3;
const WALL_EXIT_MS = 700;

interface WallCard {
  key: string;
  msg: WallMessage;
  leaving: boolean;
}

function useWallFeed(messages: WallMessage[]) {
  const [left, setLeft] = useState<WallCard[]>([]);
  const [right, setRight] = useState<WallCard[]>([]);

  const leftRef = useRef(left);
  const rightRef = useRef(right);
  leftRef.current = left;
  rightRef.current = right;

  const messagesRef = useRef<WallMessage[]>(messages);
  const seenRef = useRef<Set<string>>(new Set());
  const queueRef = useRef<WallMessage[]>([]);
  const initializedRef = useRef(false);
  const cursorRef = useRef(0);
  const turnRef = useRef(0);
  const counterRef = useRef(0);

  // Detectar mensajes nuevos y retirar de pantalla los que el admin oculte
  useEffect(() => {
    messagesRef.current = messages;
    const ids = new Set(messages.map((m) => m.id));

    if (!initializedRef.current && messages.length > 0) {
      initializedRef.current = true;
      messages.forEach((m) => seenRef.current.add(m.id));
      queueRef.current = messages.slice(-4); // al abrir la vista, arrancamos con lo más reciente
    } else {
      messages.forEach((m) => {
        if (!seenRef.current.has(m.id)) {
          seenRef.current.add(m.id);
          queueRef.current.push(m);
        }
      });
    }
    queueRef.current = queueRef.current.filter((m) => ids.has(m.id));

    const keep = (prev: WallCard[]) => (prev.some((c) => !ids.has(c.msg.id)) ? prev.filter((c) => ids.has(c.msg.id)) : prev);
    setLeft(keep);
    setRight(keep);
  }, [messages]);

  // Ritmo de aparición
  useEffect(() => {
    const push = (setter: React.Dispatch<React.SetStateAction<WallCard[]>>, msg: WallMessage) => {
      const card: WallCard = { key: `${msg.id}-${counterRef.current++}`, msg, leaving: false };
      setter((prev) => {
        const next = [...prev, card];
        const active = next.filter((c) => !c.leaving);
        if (active.length > WALL_MAX_PER_LANE) {
          const oldest = active[0];
          return next.map((c) => (c === oldest ? { ...c, leaving: true } : c));
        }
        return next;
      });
    };

    const tick = () => {
      const visible = new Set(
        [...leftRef.current, ...rightRef.current].filter((c) => !c.leaving).map((c) => c.msg.id)
      );

      let msg: WallMessage | undefined;
      while (queueRef.current.length > 0) {
        const candidate = queueRef.current.shift()!;
        if (!visible.has(candidate.id)) {
          msg = candidate;
          break;
        }
      }

      if (!msg) {
        const all = messagesRef.current;
        for (let i = 0; i < all.length; i++) {
          const candidate = all[cursorRef.current % all.length];
          cursorRef.current += 1;
          if (!visible.has(candidate.id)) {
            msg = candidate;
            break;
          }
        }
      }
      if (!msg) return;

      const side = turnRef.current++ % 2 === 0 ? setLeft : setRight;
      push(side, msg);
    };

    const first = setTimeout(tick, 600);
    const id = setInterval(tick, WALL_INTERVAL_MS);
    return () => {
      clearTimeout(first);
      clearInterval(id);
    };
  }, []);

  // Eliminar del DOM las tarjetas que ya terminaron su animación de salida
  useEffect(() => {
    if (!left.some((c) => c.leaving)) return;
    const t = setTimeout(() => setLeft((p) => p.filter((c) => !c.leaving)), WALL_EXIT_MS + 60);
    return () => clearTimeout(t);
  }, [left]);

  useEffect(() => {
    if (!right.some((c) => c.leaving)) return;
    const t = setTimeout(() => setRight((p) => p.filter((c) => !c.leaving)), WALL_EXIT_MS + 60);
    return () => clearTimeout(t);
  }, [right]);

  return { left, right };
}

function WallLane({ cards, side }: { cards: WallCard[]; side: 'left' | 'right' }) {
  return (
    <div className={`st-wall-lane is-${side}`} aria-hidden="true">
      {cards.map((card) => (
        <figure key={card.key} className={`st-wall-card ${card.leaving ? 'is-leaving' : ''}`}>
          <blockquote>{card.msg.content}</blockquote>
          <figcaption>
            <strong>{card.msg.senderName}</strong>
            <span>{card.msg.senderTeamName}</span>
          </figcaption>
        </figure>
      ))}
    </div>
  );
}

/* ==========================================================================
   Mural de integración: anillo 3D en el centro y mensajes en vivo a los costados
   ========================================================================== */
function MuralView({ photos, wall }: { photos: MuralPhotoItem[]; wall: WallMessage[] }) {
  const items = useMemo(() => {
    if (photos.length === 0) return [];
    const base = photos.map((p) => ({
      src: p.photoUrl,
      alt: `Fotografía de ${p.senderName}`,
      title: p.partnerNames?.length ? `${p.senderName} y ${p.partnerNames.join(', ')}` : p.senderName,
      subtitle: p.caption ? `“${p.caption}” · ${p.senderTeamName}` : p.senderTeamName
    }));
    // Con pocas fotos el anillo se ve vacío: repetimos hasta completar al menos 8 tarjetas
    const filled = [...base];
    while (filled.length < 8) filled.push(...base);
    return filled.slice(0, Math.max(8, base.length));
  }, [photos]);

  const { left, right } = useWallFeed(wall);

  return (
    <div className="st-mural">
      <div className="st-section-head">
        <h2 className="st-section-title">Mural de integración</h2>
        <span className="st-section-meta">{photos.length} fotografías aprobadas</span>
      </div>
      <div className="st-mural-body">
        <WallLane cards={left} side="left" />

        <div className="st-mural-stage">
          {photos.length === 0 ? (
            <div className="st-empty">
              <span className="st-kicker">Mural de integración</span>
              <h3>Todavía no hay fotografías aprobadas</h3>
              <p>
                Cada dupla puede tomarse una foto desde el chat de su teléfono. Las imágenes aprobadas por los
                coordinadores se proyectarán aquí.
              </p>
            </div>
          ) : (
            <CircularCarousel
              items={items}
              preset="cylinder"
              intro="rise"
              cardWidth={300}
              aspectRatio={0.8}
              gap={28}
              tilt={-4}
              speed={10}
              captions
              draggable
              pauseOnHover={false}
              parallax={0.12}
              stretch={0.3}
              depthFade={0.72}
              fadeColor="#0b0c0e"
              innerShade={0.75}
              cornerRadius={4}
            />
          )}
        </div>

        <WallLane cards={right} side="right" />
      </div>
    </div>
  );
}
