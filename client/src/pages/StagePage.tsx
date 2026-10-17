import { useState, useEffect, useRef, useMemo } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { socket } from '../services/socket';
import { fetchStageData } from '../services/api';
import { TeamAvatar } from '../components/TeamAvatar';
import { CircularCarousel } from '../components/CircularCarousel';
import confetti from 'canvas-confetti';
import type { StageData, Team, GameState, GameStatus, MuralPhotoItem } from '../../../shared/types/index.js';
import { Maximize, Minimize, Trophy, Camera } from 'lucide-react';
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

  // Mural social de fotografías
  const [stageViewMode, setStageViewMode] = useState<'game' | 'mural'>('game');
  const [muralPhotos, setMuralPhotos] = useState<MuralPhotoItem[]>([]);

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

    return () => {
      socket.off('connect', registerStage);
      socket.off('disconnect');
      socket.off('stage:update');
      socket.off('game:state-update');
      socket.off('game:timer-tick');
      socket.off('game:countdown-tick');
      socket.off('game:score-updated');
      socket.off('stage:mural-update');
    };
  }, []);

  // Reloj de la barra superior
  useEffect(() => {
    const id = setInterval(() => setClock(new Date()), 15000);
    return () => clearInterval(id);
  }, []);

  // Si arranca una pregunta mientras se proyecta el mural, volvemos al juego automáticamente
  useEffect(() => {
    if (gameState.status !== 'LOBBY') setStageViewMode('game');
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
  const status = gameState.status;
  const question = gameState.currentQuestion;
  const phase = isMural ? { tag: 'Mural', title: 'Mural de integración' } : PHASE_LABELS[status];
  const isQuestionPhase =
    !isMural &&
    !!question &&
    (status === 'QUESTION_READING' ||
      status === 'COUNTDOWN_ACTIVE' ||
      status === 'QUESTION_ACTIVE' ||
      status === 'BUZZER_LOCKED' ||
      status === 'EVALUATING' ||
      status === 'SHOWING_RESULT');
  const showTicker = rankedTeams.length > 0 && (isMural || status !== 'LOBBY');

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
        <button className={`st-ctrl ${!isMural ? 'is-active' : ''}`} onClick={() => setStageViewMode('game')}>
          <Trophy size={14} /> Juego
        </button>
        <button className={`st-ctrl ${isMural ? 'is-active' : ''}`} onClick={() => setStageViewMode('mural')}>
          <Camera size={14} /> Mural ({muralPhotos.length})
        </button>
        <button className="st-ctrl" onClick={toggleFullscreen} title="Pantalla completa">
          {isFullscreen ? <Minimize size={14} /> : <Maximize size={14} />}
          {isFullscreen ? 'Salir' : 'Pantalla completa'}
        </button>
      </div>

      {/* ================================================================ CONTENIDO */}
      <main className="st-main" key={isMural ? 'mural' : status}>
        {/* ----------------------------------------------------------- MURAL */}
        {isMural && <MuralView photos={muralPhotos} />}

        {/* ----------------------------------------------------------- LOBBY */}
        {!isMural && status === 'LOBBY' && (
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
        {!isMural && status === 'LEADERBOARD' && (
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
   Mural de integración: anillo 3D a pantalla completa, sin marcos
   ========================================================================== */
function MuralView({ photos }: { photos: MuralPhotoItem[] }) {
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

  if (photos.length === 0) {
    return (
      <div className="st-mural">
        <div className="st-empty">
          <span className="st-kicker">Mural de integración</span>
          <h3>Todavía no hay fotografías aprobadas</h3>
          <p>
            Cada dupla puede tomarse una foto desde el chat de su teléfono. Las imágenes aprobadas por los
            coordinadores se proyectarán aquí.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="st-mural">
      <div className="st-section-head">
        <h2 className="st-section-title">Mural de integración</h2>
        <span className="st-section-meta">{photos.length} fotografías aprobadas</span>
      </div>
      <div className="st-mural-stage">
        <CircularCarousel
          items={items}
          preset="cylinder"
          intro="rise"
          cardWidth={320}
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
      </div>
    </div>
  );
}
