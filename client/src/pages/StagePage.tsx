import { useState, useEffect } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { socket } from '../services/socket';
import { fetchStageData } from '../services/api';
import { TeamAvatar } from '../components/TeamAvatar';
import confetti from 'canvas-confetti';
import type { StageData, Team, GameState, MuralPhotoItem } from '../../../shared/types/index.js';
import {
  Users,
  Shield,
  Maximize,
  Minimize,
  Radio,
  Clock,
  Trophy,
  CheckCircle2,
  XCircle,
  Award,
  Camera,
  Flame
} from 'lucide-react';

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

  // Fase 3: Mural Social de Fotografías
  const [stageViewMode, setStageViewMode] = useState<'game' | 'mural'>('game');
  const [muralPhotos, setMuralPhotos] = useState<MuralPhotoItem[]>([]);
  const [currentPhotoIdx, setCurrentPhotoIdx] = useState(0);

  useEffect(() => {
    const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
    const url = isLocalhost ? 'https://participating-resorts-permitted-hurricane.trycloudflare.com' : window.location.origin;
    setJoinUrl(url);

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
      // Disparar confeti si se muestra podio o respuesta correcta
      if (state.status === 'LEADERBOARD' || (state.status === 'SHOWING_RESULT' && state.result?.grade === 'CORRECT')) {
        try {
          confetti({
            particleCount: 80,
            spread: 90,
            origin: { y: 0.4 },
            colors: ['#ff6519', '#ff8a3d', '#ffffff', '#10b981']
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
      socket.off('stage:update');
      socket.off('game:state-update');
      socket.off('game:timer-tick');
      socket.off('game:countdown-tick');
      socket.off('game:score-updated');
      socket.off('stage:mural-update');
    };
  }, []);

  // Rotación automática del carrusel de fotografías cada 6 segundos
  useEffect(() => {
    if (muralPhotos.length <= 1) return;
    const interval = setInterval(() => {
      setCurrentPhotoIdx((prev) => (prev + 1) % muralPhotos.length);
    }, 6000);
    return () => clearInterval(interval);
  }, [muralPhotos.length]);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
      setIsFullscreen(true);
    } else {
      document.exitFullscreen().catch(() => {});
      setIsFullscreen(false);
    }
  };

  // Ordenar equipos por puntaje para el podio
  const rankedTeams = [...stageData.teams].sort((a, b) => (b.score || 0) - (a.score || 0));

  return (
    <div style={{
      minHeight: '100vh',
      backgroundColor: '#070a12',
      color: '#f8fafc',
      fontFamily: 'system-ui, -apple-system, sans-serif',
      padding: '24px 36px',
      display: 'flex',
      flexDirection: 'column',
      boxSizing: 'border-box',
      overflowX: 'hidden',
      position: 'relative'
    }}>
      {/* Fondo Proyectado: Marca de Agua Gigante del Logo RVC con Opacidad Sutil */}
      <div
        style={{
          position: 'fixed',
          inset: 0,
          backgroundImage: 'radial-gradient(circle at center, transparent 30%, #070a12 90%), url(/logo-rvc.png)',
          backgroundPosition: 'center center',
          backgroundRepeat: 'no-repeat',
          backgroundSize: 'min(75vh, 75vw)',
          opacity: 0.13,
          pointerEvents: 'none',
          zIndex: 0,
          filter: 'contrast(120%)'
        }}
      />

      {/* Gradientes Ambientales Superpuestos */}
      <div
        style={{
          position: 'fixed',
          inset: 0,
          backgroundImage: `
            radial-gradient(circle at 15% 15%, rgba(255, 101, 25, 0.18) 0%, transparent 45%),
            radial-gradient(circle at 85% 85%, rgba(14, 25, 48, 0.7) 0%, transparent 50%),
            radial-gradient(circle at 50% 50%, rgba(255, 120, 40, 0.05) 0%, transparent 60%)
          `,
          pointerEvents: 'none',
          zIndex: 0
        }}
      />

      {/* Barra Superior del Auditorio con Identidad RVC */}
      <header style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingBottom: '20px',
        borderBottom: '1px solid rgba(255, 101, 25, 0.2)',
        marginBottom: '28px',
        position: 'relative',
        zIndex: 1
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '18px' }}>
          {/* Emblema Tipográfico RVC */}
          <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '8px 20px',
            borderRadius: '16px',
            background: 'linear-gradient(135deg, rgba(255, 101, 25, 0.3) 0%, rgba(14, 22, 38, 0.8) 100%)',
            border: '2px solid var(--primary)',
            boxShadow: '0 0 25px rgba(255, 101, 25, 0.5), inset 0 0 15px rgba(255, 101, 25, 0.2)',
            letterSpacing: '0.08em'
          }}>
            <span style={{
              fontSize: '28px',
              fontWeight: 900,
              color: '#ffffff',
              textShadow: '0 2px 12px rgba(255, 101, 25, 0.85)',
              lineHeight: 1
            }}>
              RVC
            </span>
          </div>

          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <span style={{
                fontSize: '11px',
                fontWeight: 900,
                letterSpacing: '0.15em',
                textTransform: 'uppercase',
                color: '#ff8a3d',
                background: 'rgba(255, 101, 25, 0.15)',
                padding: '3px 10px',
                borderRadius: '999px',
                border: '1px solid rgba(255, 101, 25, 0.35)'
              }}>
                {gameState.status === 'LOBBY' ? 'SALA DE ESPERA' : 'COMPETENCIA EN VIVO'}
              </span>
              <span style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                fontSize: '12px',
                fontWeight: 700,
                color: isConnected ? '#34d399' : '#f87171',
                background: isConnected ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)',
                padding: '3px 10px',
                borderRadius: '999px'
              }}>
                <Radio size={12} className={isConnected ? 'pulse-indicator' : ''} />
                {isConnected ? 'EN VIVO' : 'CONECTANDO...'}
              </span>
            </div>

            <h1 style={{
              margin: '4px 0 0 0',
              fontSize: '28px',
              fontWeight: 900,
              letterSpacing: '-0.02em',
              background: 'linear-gradient(to right, #ffffff, #ffb885)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent'
            }}>
              {gameState.status === 'LOBBY' && 'Encuentro Juvenil — Sala de Espera'}
              {gameState.status === 'QUESTION_READING' && '📖 Ronda de Trivia — Lectura Previa'}
              {gameState.status === 'COUNTDOWN_ACTIVE' && '⚡ Ronda de Trivia — ¡Atentos al Pulsador!'}
              {gameState.status === 'QUESTION_ACTIVE' && 'Ronda de Trivia — ¡Pulsador Activo!'}
              {gameState.status === 'BUZZER_LOCKED' && '¡Turno de Respuesta Concedido!'}
              {gameState.status === 'EVALUATING' && 'Deliberación del Jurado / Calificación'}
              {gameState.status === 'SHOWING_RESULT' && 'Resultado de la Pregunta'}
              {gameState.status === 'LEADERBOARD' && '🏆 Tabla de Posiciones y Podio'}
            </h1>
          </div>
        </div>

        {/* Métricas Globales y Botón Pantalla Completa */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            background: 'rgba(14, 22, 38, 0.8)',
            border: '1px solid rgba(255, 101, 25, 0.3)',
            padding: '8px 18px',
            borderRadius: '16px',
            backdropFilter: 'blur(10px)'
          }}>
            <Shield size={22} color="#ff6519" />
            <div style={{ textAlign: 'left' }}>
              <div style={{ fontSize: '11px', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Equipos</div>
              <div style={{ fontSize: '20px', fontWeight: 900, color: '#fff' }}>{stageData.teams.length}</div>
            </div>
          </div>

          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            background: 'rgba(14, 22, 38, 0.8)',
            border: '1px solid rgba(16, 185, 129, 0.3)',
            padding: '8px 18px',
            borderRadius: '16px',
            backdropFilter: 'blur(10px)'
          }}>
            <Users size={22} color="#10b981" />
            <div style={{ textAlign: 'left' }}>
              <div style={{ fontSize: '11px', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Conectados</div>
              <div style={{ fontSize: '20px', fontWeight: 900, color: '#34d399' }}>{stageData.connectedCount}</div>
            </div>
          </div>

          <button
            onClick={toggleFullscreen}
            title="Pantalla Completa (F11)"
            style={{
              background: 'rgba(255, 255, 255, 0.08)',
              border: '1px solid rgba(255, 255, 255, 0.15)',
              color: '#fff',
              padding: '10px 16px',
              borderRadius: '14px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              fontSize: '13px',
              fontWeight: 700,
              transition: 'background 0.2s ease'
            }}
          >
            {isFullscreen ? <Minimize size={18} /> : <Maximize size={18} />}
            {isFullscreen ? 'Salir' : 'Maximizar'}
          </button>

          {/* Selector de Modo: Juego / Mural Social */}
          <div style={{
            display: 'flex',
            gap: '4px',
            background: 'rgba(255, 255, 255, 0.06)',
            padding: '4px',
            borderRadius: '14px',
            border: '1px solid rgba(255, 255, 255, 0.12)'
          }}>
            <button
              onClick={() => setStageViewMode('game')}
              style={{
                padding: '8px 14px',
                borderRadius: '10px',
                border: 'none',
                background: stageViewMode === 'game' ? 'var(--primary)' : 'transparent',
                color: '#fff',
                fontSize: '13px',
                fontWeight: 700,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px'
              }}
            >
              <Trophy size={15} />
              Juego
            </button>
            <button
              onClick={() => setStageViewMode('mural')}
              style={{
                padding: '8px 14px',
                borderRadius: '10px',
                border: 'none',
                background: stageViewMode === 'mural' ? 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)' : 'transparent',
                color: '#fff',
                fontSize: '13px',
                fontWeight: 700,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px'
              }}
            >
              <Camera size={15} />
              Mural ({muralPhotos.length})
            </button>
          </div>
        </div>
      </header>

      {/* ========================================================================= */}
      {/* VISTA MURAL SOCIAL: PROYECCIÓN ROTATIVA DE DUPLAS (Fase 3) */}
      {/* ========================================================================= */}
      {stageViewMode === 'mural' && (
        <div style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          position: 'relative',
          zIndex: 1,
          padding: '10px 0'
        }}>
          {muralPhotos.length === 0 ? (
            <div style={{
              textAlign: 'center',
              maxWidth: '680px',
              padding: '60px 40px',
              borderRadius: '24px',
              background: 'rgba(14, 22, 38, 0.75)',
              border: '2px dashed rgba(59, 130, 246, 0.4)',
              backdropFilter: 'blur(16px)'
            }}>
              <div style={{
                width: '88px',
                height: '88px',
                borderRadius: '50%',
                background: 'linear-gradient(135deg, rgba(59, 130, 246, 0.2) 0%, rgba(37, 99, 235, 0.4) 100%)',
                border: '2px solid #60a5fa',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 24px auto',
                boxShadow: '0 0 35px rgba(59, 130, 246, 0.4)'
              }}>
                <Camera size={44} color="#60a5fa" />
              </div>
              <h2 style={{ fontSize: '32px', fontWeight: 900, color: '#fff', margin: '0 0 12px 0' }}>
                📸 Mural de Integración — Encuentro Juvenil
              </h2>
              <p style={{ fontSize: '18px', color: '#cbd5e1', lineHeight: 1.6, margin: '0 0 24px 0' }}>
                ¡Es momento de conocerse y compartir! Abran el chat de su dupla en sus teléfonos móviles, tómense una selfie o foto de grupo y envíenla para que se proyecte aquí.
              </p>
              <div style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '10px',
                padding: '10px 24px',
                borderRadius: '999px',
                background: 'rgba(255, 101, 25, 0.15)',
                border: '1px solid var(--primary)',
                color: '#ffb885',
                fontSize: '14px',
                fontWeight: 700
              }}>
                ⚡ Las fotos aprobadas por los coordinadores rotarán en este mural
              </div>
            </div>
          ) : (
            <div style={{
              maxWidth: '960px',
              width: '100%',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '24px',
              animation: 'fadeIn 0.5s ease'
            }}>
              {(() => {
                const photo = muralPhotos[currentPhotoIdx % muralPhotos.length];
                return (
                  <div style={{
                    width: '100%',
                    borderRadius: '24px',
                    overflow: 'hidden',
                    background: 'rgba(14, 22, 38, 0.85)',
                    border: '2px solid rgba(59, 130, 246, 0.4)',
                    boxShadow: '0 20px 60px rgba(0,0,0,0.8), 0 0 40px rgba(59, 130, 246, 0.25)',
                    backdropFilter: 'blur(16px)',
                    display: 'flex',
                    flexDirection: 'column'
                  }}>
                    <div style={{
                      maxHeight: '520px',
                      overflow: 'hidden',
                      position: 'relative',
                      background: '#020617',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center'
                    }}>
                      <img
                        src={photo.photoUrl}
                        alt="Fotografía de integración"
                        style={{
                          width: '100%',
                          maxHeight: '520px',
                          objectFit: 'contain',
                          display: 'block'
                        }}
                      />
                      <div style={{
                        position: 'absolute',
                        top: '18px',
                        right: '18px',
                        padding: '6px 16px',
                        borderRadius: '999px',
                        background: 'rgba(0,0,0,0.7)',
                        border: '1px solid rgba(255,255,255,0.2)',
                        color: '#fff',
                        fontSize: '13px',
                        fontWeight: 700,
                        backdropFilter: 'blur(8px)'
                      }}>
                        {currentPhotoIdx + 1} / {muralPhotos.length}
                      </div>
                    </div>

                    <div style={{
                      padding: '24px 32px',
                      background: 'linear-gradient(to bottom, rgba(14, 22, 38, 0.95), rgba(7, 10, 18, 0.98))',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      flexWrap: 'wrap',
                      gap: '16px'
                    }}>
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px' }}>
                          <span style={{ fontSize: '20px', fontWeight: 900, color: '#fff' }}>
                            {photo.senderName}
                          </span>
                          <span style={{
                            fontSize: '12px',
                            fontWeight: 800,
                            padding: '3px 10px',
                            borderRadius: '8px',
                            background: 'rgba(255, 101, 25, 0.2)',
                            color: 'var(--primary)',
                            border: '1px solid rgba(255, 101, 25, 0.4)'
                          }}>
                            {photo.senderTeamName}
                          </span>
                          {photo.partnerNames.length > 0 && (
                            <span style={{ fontSize: '15px', color: '#94a3b8' }}>
                              junto a su dupla <strong style={{ color: '#60a5fa' }}>{photo.partnerNames.join(', ')}</strong>
                            </span>
                          )}
                        </div>

                        {photo.caption && (
                          <div style={{ fontSize: '18px', color: '#ffeedd', fontStyle: 'italic', marginTop: '4px' }}>
                            "{photo.caption}"
                          </div>
                        )}
                      </div>

                      <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                        {muralPhotos.slice(0, 12).map((_, idx) => (
                          <button
                            key={idx}
                            onClick={() => setCurrentPhotoIdx(idx)}
                            style={{
                              width: idx === currentPhotoIdx % muralPhotos.length ? '24px' : '8px',
                              height: '8px',
                              borderRadius: '999px',
                              background: idx === currentPhotoIdx % muralPhotos.length ? '#3b82f6' : 'rgba(255,255,255,0.2)',
                              border: 'none',
                              cursor: 'pointer',
                              transition: 'all 0.3s ease'
                            }}
                          />
                        ))}
                      </div>
                    </div>
                  </div>
                );
              })()}
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* VISTA A: SALA DE ESPERA / LOBBY (Fase 1) */}
      {/* ========================================================================= */}
      {stageViewMode === 'game' && gameState.status === 'LOBBY' && (
        <div style={{
          display: 'grid',
          gridTemplateColumns: '370px 1fr',
          gap: '32px',
          flex: 1,
          position: 'relative',
          zIndex: 1
        }}>
          {/* Columna Izquierda: Tarjeta QR */}
          <aside style={{
            background: 'rgba(14, 22, 38, 0.85)',
            border: '1px solid rgba(255, 101, 25, 0.3)',
            borderRadius: '24px',
            padding: '30px 24px',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            textAlign: 'center',
            boxShadow: '0 20px 45px rgba(0, 0, 0, 0.6), 0 0 30px rgba(255, 101, 25, 0.15)',
            backdropFilter: 'blur(16px)',
            height: 'fit-content',
            position: 'sticky',
            top: '24px'
          }}>
            <div style={{
              fontSize: '12px',
              fontWeight: 900,
              textTransform: 'uppercase',
              letterSpacing: '0.14em',
              color: '#ff8a3d',
              marginBottom: '8px'
            }}>
              ÚNETE DESDE TU TELÉFONO
            </div>

            <h2 style={{ margin: '0 0 18px 0', fontSize: '22px', fontWeight: 900, color: '#ffffff' }}>
              Escanea para participar 📱
            </h2>

            <div style={{
              background: '#ffffff',
              padding: '16px',
              borderRadius: '20px',
              boxShadow: '0 16px 36px rgba(0, 0, 0, 0.5), 0 0 35px rgba(255, 101, 25, 0.35)',
              marginBottom: '20px',
              display: 'inline-flex'
            }}>
              <QRCodeSVG
                value={joinUrl || window.location.origin}
                size={220}
                level="H"
                includeMargin={false}
              />
            </div>

            <div style={{
              background: 'rgba(0, 0, 0, 0.5)',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              padding: '10px 16px',
              borderRadius: '12px',
              fontSize: '13px',
              color: '#ffb885',
              fontFamily: 'monospace',
              wordBreak: 'break-all',
              marginBottom: '24px',
              width: '100%',
              boxSizing: 'border-box'
            }}>
              {joinUrl || window.location.origin}
            </div>

            <div style={{
              width: '100%',
              textAlign: 'left',
              display: 'flex',
              flexDirection: 'column',
              gap: '12px',
              borderTop: '1px solid rgba(255, 255, 255, 0.08)',
              paddingTop: '20px'
            }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
                <span style={{
                  background: 'linear-gradient(135deg, #ff6519, #ea580c)',
                  width: '24px',
                  height: '24px',
                  borderRadius: '50%',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '12px',
                  fontWeight: 900,
                  color: '#fff',
                  flexShrink: 0
                }}>1</span>
                <p style={{ margin: 0, fontSize: '13px', color: '#cbd5e1', lineHeight: '1.4' }}>
                  <strong>Capitanes:</strong> Creen el equipo, suban su foto o escudo y reciban su PIN.
                </p>
              </div>

              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
                <span style={{
                  background: 'linear-gradient(135deg, #ff8a3d, #ff5400)',
                  width: '24px',
                  height: '24px',
                  borderRadius: '50%',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '12px',
                  fontWeight: 900,
                  color: '#fff',
                  flexShrink: 0
                }}>2</span>
                <p style={{ margin: 0, fontSize: '13px', color: '#cbd5e1', lineHeight: '1.4' }}>
                  <strong>Integrantes:</strong> Seleccionen su equipo e ingresen el PIN del capitán.
                </p>
              </div>
            </div>
          </aside>

          {/* Columna Derecha: Muro de Equipos */}
          <section style={{ display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '18px' }}>
              <h2 style={{ margin: 0, fontSize: '22px', fontWeight: 900, color: '#f8fafc' }}>
                Equipos en la Arena ({stageData.teams.length})
              </h2>
              <span style={{ fontSize: '13px', color: '#ffb885', fontWeight: 600 }}>
                Sincronizado en tiempo real
              </span>
            </div>

            {stageData.teams.length === 0 ? (
              <div style={{
                flex: 1,
                minHeight: '380px',
                background: 'rgba(14, 22, 38, 0.5)',
                border: '2px dashed rgba(255, 101, 25, 0.25)',
                borderRadius: '24px',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '40px',
                textAlign: 'center'
              }}>
                <div style={{
                  width: '84px',
                  height: '84px',
                  borderRadius: '50%',
                  background: 'rgba(255, 101, 25, 0.12)',
                  border: '2px solid rgba(255, 101, 25, 0.4)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginBottom: '18px',
                  animation: 'pulse-glow 2s infinite ease-in-out'
                }}>
                  <Shield size={40} color="#ff6519" />
                </div>
                <h3 style={{ fontSize: '24px', margin: '0 0 8px 0', color: '#fff', fontWeight: 800 }}>
                  Esperando a los primeros equipos...
                </h3>
                <p style={{ margin: 0, color: '#94a3b8', fontSize: '15px', maxWidth: '440px' }}>
                  Pide a los líderes que escaneen el código QR y registren su grupo para aparecer en la pantalla grande.
                </p>
              </div>
            ) : (
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(310px, 1fr))',
                gap: '20px'
              }}>
                {stageData.teams.map((team: Team) => (
                  <div
                    key={team.id}
                    style={{
                      background: 'rgba(14, 22, 38, 0.85)',
                      border: '1px solid rgba(255, 101, 25, 0.25)',
                      borderRadius: '22px',
                      padding: '20px',
                      boxShadow: '0 12px 28px rgba(0, 0, 0, 0.45)',
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'space-between',
                      gap: '16px'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: '14px' }}>
                      <TeamAvatar avatar={team.avatar} teamName={team.name} size={58} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <h3 style={{ margin: '0 0 4px 0', fontSize: '19px', fontWeight: 900, color: '#fff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {team.name}
                        </h3>
                        {team.motto && (
                          <p style={{ margin: 0, fontSize: '13px', fontStyle: 'italic', color: '#94a3b8' }}>
                            "{team.motto}"
                          </p>
                        )}
                      </div>
                    </div>

                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      paddingTop: '12px',
                      borderTop: '1px solid rgba(255, 255, 255, 0.08)'
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <Users size={16} color="#ff8a3d" />
                        <span style={{ fontSize: '13px', fontWeight: 700, color: '#f1f5f9' }}>
                          {team.memberCount || 0} integrantes
                        </span>
                      </div>
                      <div style={{
                        fontSize: '11px',
                        fontWeight: 800,
                        color: '#34d399',
                        background: 'rgba(16, 185, 129, 0.12)',
                        padding: '4px 10px',
                        borderRadius: '999px',
                        border: '1px solid rgba(16, 185, 129, 0.3)'
                      }}>
                        LISTO
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      )}

      {/* ========================================================================= */}
      {/* VISTA B: PREGUNTA ACTIVA / BUZZER / EVALUACIÓN (Fase 2) */}
      {/* ========================================================================= */}
      {(gameState.status === 'QUESTION_READING' ||
        gameState.status === 'COUNTDOWN_ACTIVE' ||
        gameState.status === 'QUESTION_ACTIVE' ||
        gameState.status === 'BUZZER_LOCKED' ||
        gameState.status === 'EVALUATING' ||
        gameState.status === 'SHOWING_RESULT') &&
        gameState.currentQuestion && (
        <div style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          maxWidth: '1100px',
          margin: '0 auto',
          width: '100%',
          position: 'relative',
          zIndex: 1,
          gap: '28px',
          animation: 'fadeIn 0.4s ease'
        }}>
          {/* Header de la Pregunta: Tipo de Pregunta y Temporizador */}
          <div style={{
            width: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: 'rgba(14, 22, 38, 0.85)',
            border: '1px solid rgba(255, 101, 25, 0.3)',
            borderRadius: '20px',
            padding: '14px 28px',
            boxShadow: '0 10px 25px rgba(0, 0, 0, 0.4)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <span style={{
                background: 'linear-gradient(135deg, var(--primary) 0%, #ea580c 100%)',
                color: '#fff',
                fontSize: '13px',
                fontWeight: 900,
                padding: '6px 14px',
                borderRadius: '10px',
                letterSpacing: '0.08em',
                textTransform: 'uppercase'
              }}>
                PREGUNTA #{gameState.currentQuestion.order}
              </span>

              <span style={{
                fontSize: '14px',
                fontWeight: 800,
                color: '#ffb885',
                display: 'flex',
                alignItems: 'center',
                gap: '6px'
              }}>
                {gameState.currentQuestion.type === 'ORAL_DEFENSE' ? (
                  <>🎙️ Modalidad: Respuesta con Defensa Oral</>
                ) : (
                  <>🔢 Modalidad: Opción Múltiple</>
                )}
              </span>
            </div>

            {/* Temporizador y Puntos */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
              <div style={{
                fontSize: '14px',
                fontWeight: 800,
                color: '#34d399',
                background: 'rgba(16, 185, 129, 0.12)',
                padding: '6px 14px',
                borderRadius: '10px',
                border: '1px solid rgba(16, 185, 129, 0.3)'
              }}>
                +{gameState.currentQuestion.points} PUNTOS
              </div>

              {gameState.status === 'QUESTION_READING' ? (
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  background: 'rgba(59, 130, 246, 0.15)',
                  border: '1px solid rgba(59, 130, 246, 0.4)',
                  padding: '6px 16px',
                  borderRadius: '12px',
                  color: '#60a5fa'
                }}>
                  <Clock size={20} />
                  <span style={{ fontSize: '15px', fontWeight: 800 }}>
                    📖 LECTURA PREVIA
                  </span>
                </div>
              ) : gameState.status === 'COUNTDOWN_ACTIVE' ? (
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  background: 'rgba(245, 158, 11, 0.25)',
                  border: '2px solid #f59e0b',
                  padding: '6px 18px',
                  borderRadius: '12px',
                  color: '#fbbf24',
                  animation: 'pulse-glow 0.8s infinite'
                }}>
                  <Flame size={20} />
                  <span style={{ fontSize: '24px', fontWeight: 900, fontFamily: 'monospace' }}>
                    {gameState.countdownRemaining ?? 7}s
                  </span>
                </div>
              ) : (
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  background: gameState.timeRemaining <= 5 ? 'rgba(239, 68, 68, 0.2)' : 'rgba(255, 101, 25, 0.15)',
                  border: `1px solid ${gameState.timeRemaining <= 5 ? 'rgba(239, 68, 68, 0.5)' : 'rgba(255, 101, 25, 0.4)'}`,
                  padding: '6px 16px',
                  borderRadius: '12px',
                  color: gameState.timeRemaining <= 5 ? '#f87171' : '#fff'
                }}>
                  <Clock size={20} className={gameState.timeRemaining <= 5 ? 'pulse-indicator' : ''} />
                  <span style={{ fontSize: '24px', fontWeight: 900, fontFamily: 'monospace' }}>
                    {gameState.timeRemaining}s
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Tarjeta Gigante del Enunciado de la Pregunta */}
          <div style={{
            width: '100%',
            background: 'rgba(14, 22, 38, 0.9)',
            border: '2px solid rgba(255, 101, 25, 0.4)',
            borderRadius: '28px',
            padding: '44px 36px',
            textAlign: 'center',
            boxShadow: '0 20px 50px rgba(0, 0, 0, 0.7), 0 0 40px rgba(255, 101, 25, 0.2)',
            backdropFilter: 'blur(16px)'
          }}>
            <h2 style={{
              margin: 0,
              fontSize: '34px',
              fontWeight: 900,
              lineHeight: '1.4',
              color: '#ffffff',
              letterSpacing: '-0.02em',
              textShadow: '0 4px 12px rgba(0, 0, 0, 0.8)'
            }}>
              "{gameState.currentQuestion.text}"
            </h2>
          </div>

          {/* CUENTA REGRESIVA GIGANTE EN PANTALLA DE PROYECCIÓN */}
          {gameState.status === 'COUNTDOWN_ACTIVE' && (
            <div style={{
              width: '100%',
              padding: '24px',
              borderRadius: '24px',
              background: 'radial-gradient(circle, rgba(245, 158, 11, 0.3) 0%, rgba(14, 22, 38, 0.95) 75%)',
              border: '3px solid #f59e0b',
              textAlign: 'center',
              boxShadow: '0 0 50px rgba(245, 158, 11, 0.55)',
              animation: 'pulse-glow 0.8s infinite ease-in-out'
            }}>
              <div style={{ fontSize: '18px', fontWeight: 900, color: '#fbbf24', letterSpacing: '0.15em', textTransform: 'uppercase', marginBottom: '6px' }}>
                ⚡ ¡PREPÁRENSE CAPITANES! EL PULSADOR SE ACTIVA EN:
              </div>
              <div style={{ fontSize: '96px', fontWeight: 900, color: '#ffffff', textShadow: '0 0 45px rgba(245, 158, 11, 1)', lineHeight: 1 }}>
                {gameState.countdownRemaining ?? 7}
              </div>
              <div style={{ fontSize: '16px', color: '#ffedd5', marginTop: '10px', fontWeight: 700 }}>
                ¡El primer capitán en pulsar se lleva el turno de respuesta!
              </div>
            </div>
          )}

          {/* MENSAJE DE LECTURA PREVIA EN PROYECTOR */}
          {gameState.status === 'QUESTION_READING' && (
            <div style={{
              width: '100%',
              padding: '14px 24px',
              borderRadius: '18px',
              background: 'rgba(59, 130, 246, 0.15)',
              border: '1px solid rgba(59, 130, 246, 0.4)',
              textAlign: 'center',
              color: '#93c5fd',
              fontSize: '16px',
              fontWeight: 700
            }}>
              📖 Lean el enunciado y opciones con su equipo. El moderador iniciará la cuenta regresiva de 7s para pulsar.
            </div>
          )}

          {/* OPCIONES MÚLTIPLES (SI APLICA) */}
          {gameState.currentQuestion.type === 'MULTIPLE_CHOICE' && gameState.currentQuestion.options && (
            <div style={{
              width: '100%',
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: '18px'
            }}>
              {gameState.currentQuestion.options.map((option, idx) => {
                const letters = ['A', 'B', 'C', 'D'];
                const isSelected = gameState.selectedChoice === idx;
                const isCorrect = gameState.status === 'SHOWING_RESULT' && gameState.currentQuestion?.correctOptionIndex === idx;

                let border = '1px solid rgba(255, 255, 255, 0.12)';
                let bg = 'rgba(14, 22, 38, 0.8)';
                let color = '#fff';

                if (isCorrect) {
                  border = '2px solid #10b981';
                  bg = 'rgba(16, 185, 129, 0.25)';
                  color = '#34d399';
                } else if (isSelected && !isCorrect && gameState.status === 'SHOWING_RESULT') {
                  border = '2px solid #ef4444';
                  bg = 'rgba(239, 68, 68, 0.25)';
                  color = '#f87171';
                } else if (isSelected) {
                  border = '2px solid var(--primary)';
                  bg = 'rgba(255, 101, 25, 0.25)';
                }

                return (
                  <div
                    key={idx}
                    style={{
                      background: bg,
                      border,
                      borderRadius: '18px',
                      padding: '20px 24px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '16px',
                      boxShadow: '0 8px 20px rgba(0, 0, 0, 0.4)',
                      transition: 'all 0.3s ease'
                    }}
                  >
                    <span style={{
                      width: '42px',
                      height: '42px',
                      borderRadius: '12px',
                      background: isCorrect ? '#10b981' : 'linear-gradient(135deg, var(--primary), #ea580c)',
                      color: '#fff',
                      fontSize: '18px',
                      fontWeight: 900,
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0
                    }}>
                      {letters[idx]}
                    </span>
                    <span style={{ fontSize: '20px', fontWeight: 800, color }}>
                      {option}
                    </span>
                  </div>
                );
              })}
            </div>
          )}

          {/* BANNER DRAMÁTICO DE BUZZER GANADOR (CUANDO ALGUIEN PULSÓ) */}
          {gameState.status === 'BUZZER_LOCKED' && gameState.buzzerWinner && (
            <div style={{
              width: '100%',
              background: 'linear-gradient(135deg, rgba(255, 101, 25, 0.3) 0%, rgba(14, 22, 38, 0.95) 100%)',
              border: '2px solid var(--primary)',
              borderRadius: '24px',
              padding: '24px 32px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              boxShadow: '0 0 40px rgba(255, 101, 25, 0.5)',
              animation: 'pulse-glow 1.8s infinite ease-in-out'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
                <TeamAvatar
                  avatar={gameState.buzzerWinner.teamAvatar}
                  teamName={gameState.buzzerWinner.teamName}
                  size={74}
                />
                <div>
                  <div style={{ fontSize: '13px', fontWeight: 900, color: '#ff8a3d', letterSpacing: '0.12em', textTransform: 'uppercase' }}>
                    ⚡ ¡PULSADOR GANADO EN PRIMER LUGAR!
                  </div>
                  <h3 style={{ margin: '2px 0 0 0', fontSize: '32px', fontWeight: 900, color: '#fff' }}>
                    {gameState.buzzerWinner.teamName}
                  </h3>
                  <p style={{ margin: 0, fontSize: '14px', color: '#cbd5e1' }}>
                    Capitán: <strong>{gameState.buzzerWinner.captainName}</strong>
                  </p>
                </div>
              </div>

              <div style={{ textAlign: 'right' }}>
                <span style={{
                  display: 'inline-block',
                  background: 'rgba(255, 255, 255, 0.1)',
                  padding: '8px 18px',
                  borderRadius: '12px',
                  fontSize: '14px',
                  fontWeight: 800,
                  color: '#fff'
                }}>
                  {gameState.currentQuestion.type === 'ORAL_DEFENSE'
                    ? '🎙️ Respondiendo oralmente...'
                    : '📱 Seleccionando opción...'}
                </span>
              </div>
            </div>
          )}

          {/* VEREDICTO FINAL DE LA PREGUNTA */}
          {gameState.status === 'SHOWING_RESULT' && gameState.result && (
            <div style={{
              width: '100%',
              background: gameState.result.grade === 'CORRECT'
                ? 'rgba(16, 185, 129, 0.2)'
                : gameState.result.grade === 'PARTIAL'
                ? 'rgba(245, 158, 11, 0.2)'
                : 'rgba(239, 68, 68, 0.2)',
              border: `2px solid ${
                gameState.result.grade === 'CORRECT'
                  ? '#10b981'
                  : gameState.result.grade === 'PARTIAL'
                  ? '#f59e0b'
                  : '#ef4444'
              }`,
              borderRadius: '24px',
              padding: '24px 32px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              boxShadow: '0 10px 30px rgba(0, 0, 0, 0.6)'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                {gameState.result.grade === 'CORRECT' && <CheckCircle2 size={48} color="#34d399" />}
                {gameState.result.grade === 'PARTIAL' && <Award size={48} color="#fbbf24" />}
                {gameState.result.grade === 'INCORRECT' && <XCircle size={48} color="#f87171" />}

                <div>
                  <h3 style={{ margin: 0, fontSize: '26px', fontWeight: 900, color: '#fff' }}>
                    {gameState.result.grade === 'CORRECT' && '¡RESPUESTA CORRECTA! 🎉'}
                    {gameState.result.grade === 'PARTIAL' && 'RESPUESTA PARCIAL 🟡'}
                    {gameState.result.grade === 'INCORRECT' && 'RESPUESTA INCORRECTA ❌'}
                  </h3>
                  <p style={{ margin: '4px 0 0 0', fontSize: '15px', color: '#cbd5e1' }}>
                    Equipo: <strong>{gameState.result.teamName}</strong>
                  </p>
                </div>
              </div>

              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: '32px', fontWeight: 900, color: gameState.result.grade === 'CORRECT' ? '#34d399' : '#fff' }}>
                  +{gameState.result.pointsAwarded} PTS
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* VISTA C: PODIO Y TABLA DE POSICIONES (LEADERBOARD) */}
      {/* ========================================================================= */}
      {gameState.status === 'LEADERBOARD' && (
        <div style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          maxWidth: '1000px',
          margin: '0 auto',
          width: '100%',
          position: 'relative',
          zIndex: 1,
          animation: 'fadeIn 0.5s ease'
        }}>
          <div style={{ textAlign: 'center', marginBottom: '32px' }}>
            <div style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              background: 'rgba(255, 101, 25, 0.15)',
              padding: '6px 16px',
              borderRadius: '999px',
              border: '1px solid rgba(255, 101, 25, 0.35)',
              color: '#ff8a3d',
              fontSize: '13px',
              fontWeight: 900,
              textTransform: 'uppercase',
              letterSpacing: '0.12em',
              marginBottom: '10px'
            }}>
              <Trophy size={18} />
              TABLA GENERAL DE PUNTOS
            </div>
            <h2 style={{
              margin: 0,
              fontSize: '36px',
              fontWeight: 900,
              background: 'linear-gradient(to right, #ffffff, #ffb885)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent'
            }}>
              Marcador Oficial en Vivo 🏆
            </h2>
          </div>

          {/* Podio Top 3 */}
          {rankedTeams.length >= 3 && (
            <div style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1.2fr 1fr',
              gap: '20px',
              width: '100%',
              alignItems: 'flex-end',
              marginBottom: '36px'
            }}>
              {/* 2do Lugar (Plata) */}
              <div style={{
                background: 'rgba(14, 22, 38, 0.85)',
                border: '2px solid rgba(203, 213, 225, 0.4)',
                borderRadius: '24px',
                padding: '24px 20px',
                textAlign: 'center',
                boxShadow: '0 10px 30px rgba(0, 0, 0, 0.5)'
              }}>
                <span style={{ fontSize: '28px' }}>🥈</span>
                <div style={{ margin: '10px auto' }}>
                  <TeamAvatar avatar={rankedTeams[1].avatar} teamName={rankedTeams[1].name} size={64} />
                </div>
                <h3 style={{ margin: '6px 0 2px 0', fontSize: '20px', fontWeight: 900, color: '#fff' }}>
                  {rankedTeams[1].name}
                </h3>
                <div style={{ fontSize: '24px', fontWeight: 900, color: '#cbd5e1' }}>
                  {rankedTeams[1].score || 0} pts
                </div>
              </div>

              {/* 1er Lugar (Oro - Destacado) */}
              <div style={{
                background: 'linear-gradient(135deg, rgba(255, 101, 25, 0.25) 0%, rgba(14, 22, 38, 0.95) 100%)',
                border: '2px solid #ffb703',
                borderRadius: '28px',
                padding: '34px 24px',
                textAlign: 'center',
                boxShadow: '0 0 45px rgba(255, 183, 3, 0.35)',
                transform: 'translateY(-14px)'
              }}>
                <span style={{ fontSize: '40px' }}>👑</span>
                <div style={{ margin: '10px auto' }}>
                  <TeamAvatar avatar={rankedTeams[0].avatar} teamName={rankedTeams[0].name} size={84} />
                </div>
                <h3 style={{ margin: '8px 0 2px 0', fontSize: '24px', fontWeight: 900, color: '#fff' }}>
                  {rankedTeams[0].name}
                </h3>
                <div style={{ fontSize: '32px', fontWeight: 900, color: '#fde047' }}>
                  {rankedTeams[0].score || 0} pts
                </div>
              </div>

              {/* 3er Lugar (Bronce) */}
              <div style={{
                background: 'rgba(14, 22, 38, 0.85)',
                border: '2px solid rgba(217, 119, 6, 0.4)',
                borderRadius: '24px',
                padding: '24px 20px',
                textAlign: 'center',
                boxShadow: '0 10px 30px rgba(0, 0, 0, 0.5)'
              }}>
                <span style={{ fontSize: '28px' }}>🥉</span>
                <div style={{ margin: '10px auto' }}>
                  <TeamAvatar avatar={rankedTeams[2].avatar} teamName={rankedTeams[2].name} size={64} />
                </div>
                <h3 style={{ margin: '6px 0 2px 0', fontSize: '20px', fontWeight: 900, color: '#fff' }}>
                  {rankedTeams[2].name}
                </h3>
                <div style={{ fontSize: '24px', fontWeight: 900, color: '#f59e0b' }}>
                  {rankedTeams[2].score || 0} pts
                </div>
              </div>
            </div>
          )}

          {/* Lista completa de Posiciones */}
          <div style={{
            width: '100%',
            display: 'flex',
            flexDirection: 'column',
            gap: '10px'
          }}>
            {rankedTeams.map((team, idx) => (
              <div
                key={team.id}
                style={{
                  background: 'rgba(14, 22, 38, 0.8)',
                  border: '1px solid rgba(255, 255, 255, 0.08)',
                  borderRadius: '16px',
                  padding: '14px 24px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  boxShadow: '0 6px 16px rgba(0,0,0,0.3)'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                  <span style={{
                    fontSize: '18px',
                    fontWeight: 900,
                    color: idx < 3 ? 'var(--primary)' : '#94a3b8',
                    width: '32px'
                  }}>
                    #{idx + 1}
                  </span>
                  <TeamAvatar avatar={team.avatar} teamName={team.name} size={42} />
                  <div>
                    <h4 style={{ margin: 0, fontSize: '18px', fontWeight: 800, color: '#fff' }}>
                      {team.name}
                    </h4>
                    <span style={{ fontSize: '12px', color: '#94a3b8' }}>
                      {team.memberCount || 0} participantes
                    </span>
                  </div>
                </div>

                <div style={{ fontSize: '22px', fontWeight: 900, color: '#34d399' }}>
                  {team.score || 0} pts
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
