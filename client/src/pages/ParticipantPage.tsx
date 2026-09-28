import { useState, useEffect } from 'react';
import { socket } from '../services/socket';
import confetti from 'canvas-confetti';
import { Sparkles, AlertTriangle, ArrowRight } from 'lucide-react';
import type { LiveMessagePayload, Participant } from '../../../shared/types/index.js';

export function ParticipantPage() {
  const [name, setName] = useState('');
  const [isRegistered, setIsRegistered] = useState(false);
  const [participant, setParticipant] = useState<Participant | null>(null);
  const [isConnected, setIsConnected] = useState(socket.connected);
  const [messages, setMessages] = useState<LiveMessagePayload[]>([]);
  const [errorMsg, setErrorMsg] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Cargar sesión previa si existe
  useEffect(() => {
    const savedToken = localStorage.getItem('encuentro_session_token');
    const savedName = localStorage.getItem('encuentro_participant_name');
    if (savedToken && savedName) {
      setName(savedName);
      // Intentar reconectar automáticamente con el socket
      socket.emit('participant:join', { name: savedName, sessionToken: savedToken }, (res) => {
        if (res.success && res.participant) {
          setParticipant(res.participant);
          setIsRegistered(true);
        }
      });
    }
  }, []);

  // Listeners de Socket.IO
  useEffect(() => {
    function onConnect() {
      setIsConnected(true);
      // Si ya estaba registrado, re-autenticar con el sessionToken
      const savedToken = localStorage.getItem('encuentro_session_token');
      const savedName = localStorage.getItem('encuentro_participant_name');
      if (savedToken && savedName) {
        socket.emit('participant:join', { name: savedName, sessionToken: savedToken }, (res) => {
          if (res.success && res.participant) {
            setParticipant(res.participant);
            setIsRegistered(true);
          }
        });
      }
    }

    function onDisconnect() {
      setIsConnected(false);
    }

    function onMessageReceived(msg: LiveMessagePayload) {
      setMessages((prev) => [msg, ...prev]);

      // Disparar confeti sutil de celebración al recibir mensaje
      try {
        confetti({
          particleCount: 45,
          spread: 60,
          origin: { y: 0.35 },
          colors: ['#6366f1', '#ec4899', '#10b981', '#fbbf24']
        });
      } catch (e) {
        // Ignore confetti error
      }
    }

    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);
    socket.on('message:received', onMessageReceived);

    return () => {
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
      socket.off('message:received', onMessageReceived);
    };
  }, []);

  const handleJoin = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setErrorMsg('Por favor introduce tu nombre');
      return;
    }
    setErrorMsg('');
    setIsSubmitting(true);

    const savedToken = localStorage.getItem('encuentro_session_token') || undefined;

    socket.emit('participant:join', { name: name.trim(), sessionToken: savedToken }, (res) => {
      setIsSubmitting(false);
      if (res.success && res.participant) {
        setParticipant(res.participant);
        setIsRegistered(true);
        localStorage.setItem('encuentro_session_token', res.participant.sessionToken);
        localStorage.setItem('encuentro_participant_name', res.participant.name);
      } else {
        setErrorMsg(res.error || 'No se pudo conectar. Intenta de nuevo.');
      }
    });
  };

  const handleResetSession = () => {
    localStorage.removeItem('encuentro_session_token');
    localStorage.removeItem('encuentro_participant_name');
    setIsRegistered(false);
    setParticipant(null);
    setName('');
    setMessages([]);
  };

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
      {/* Banner de Reconexión / Estado */}
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

      {/* Pantalla 1: Registro Inicial */}
      {!isRegistered ? (
        <div className="glass-panel" style={{
          maxWidth: '460px',
          width: '100%',
          padding: '40px 28px',
          textAlign: 'center',
          animation: 'fadeIn 0.4s ease'
        }}>
          <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: '64px',
            height: '64px',
            borderRadius: '20px',
            background: 'linear-gradient(135deg, var(--primary) 0%, #8b5cf6 100%)',
            color: '#fff',
            marginBottom: '20px',
            boxShadow: '0 12px 24px -6px var(--primary-glow)'
          }}>
            <Sparkles size={32} />
          </div>

          <div style={{
            fontSize: '12px',
            letterSpacing: '0.12em',
            textTransform: 'uppercase',
            fontWeight: 800,
            color: 'var(--primary)',
            marginBottom: '8px'
          }}>
            ENCUENTRO JUVENIL
          </div>

          <h1 style={{
            fontSize: '32px',
            marginBottom: '8px',
            color: '#fff'
          }}>
            ¡Bienvenido! 👋
          </h1>

          <p style={{
            color: 'var(--text-muted)',
            fontSize: '16px',
            marginBottom: '28px'
          }}>
            ¿Cuál es tu nombre?
          </p>

          <form onSubmit={handleJoin} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <input
              type="text"
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Escribe tu nombre..."
              maxLength={40}
              disabled={isSubmitting}
              style={{
                width: '100%',
                padding: '16px 20px',
                borderRadius: 'var(--radius-md)',
                background: 'rgba(255, 255, 255, 0.06)',
                border: '2px solid var(--border-subtle)',
                color: '#fff',
                fontSize: '18px',
                textAlign: 'center',
                fontWeight: 600,
                transition: 'all 0.2s ease',
              }}
              onFocus={(e) => (e.target.style.borderColor = 'var(--primary)')}
              onBlur={(e) => (e.target.style.borderColor = 'var(--border-subtle)')}
            />

            {errorMsg && (
              <div style={{
                color: '#f87171',
                fontSize: '14px',
                fontWeight: 500
              }}>
                {errorMsg}
              </div>
            )}

            <button
              type="submit"
              disabled={isSubmitting || !name.trim()}
              style={{
                width: '100%',
                padding: '16px 24px',
                borderRadius: 'var(--radius-md)',
                background: 'linear-gradient(135deg, var(--primary) 0%, #8b5cf6 100%)',
                color: '#fff',
                fontSize: '17px',
                fontWeight: 700,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '10px',
                boxShadow: '0 12px 24px -6px var(--primary-glow)',
                opacity: (!name.trim() || isSubmitting) ? 0.6 : 1,
                cursor: (!name.trim() || isSubmitting) ? 'not-allowed' : 'pointer'
              }}
            >
              {isSubmitting ? 'Conectando...' : (
                <>
                  CONTINUAR
                  <ArrowRight size={20} />
                </>
              )}
            </button>
          </form>
        </div>
      ) : (
        /* Pantalla 2: Conectado y Recibiendo Mensajes en Vivo */
        <div style={{
          maxWidth: '520px',
          width: '100%',
          display: 'flex',
          flexDirection: 'column',
          gap: '20px'
        }}>
          {/* Header de Estado */}
          <div className="glass-panel" style={{
            padding: '24px 20px',
            textAlign: 'center',
            position: 'relative'
          }}>
            <div style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              padding: '6px 14px',
              borderRadius: '999px',
              background: isConnected ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)',
              border: `1px solid ${isConnected ? 'rgba(16, 185, 129, 0.4)' : 'rgba(239, 68, 68, 0.4)'}`,
              marginBottom: '16px'
            }}>
              <span style={{
                width: '10px',
                height: '10px',
                borderRadius: '50%',
                backgroundColor: isConnected ? 'var(--success)' : 'var(--danger)',
                boxShadow: isConnected ? '0 0 10px var(--success)' : '0 0 10px var(--danger)'
              }} className={isConnected ? 'pulse-indicator' : ''} />
              <span style={{
                fontSize: '14px',
                fontWeight: 700,
                color: isConnected ? '#34d399' : '#f87171'
              }}>
                {isConnected ? '🟢 CONECTADO' : '🔴 DESCONECTADO'}
              </span>
            </div>

            <h1 style={{
              fontSize: '28px',
              marginBottom: '8px',
              color: '#fff'
            }}>
              Hola {participant?.name || name} 👋
            </h1>

            <p style={{
              color: 'var(--text-muted)',
              fontSize: '15px'
            }}>
              Estamos preparando algo para ti. Espera el siguiente mensaje...
            </p>

            <button
              onClick={handleResetSession}
              style={{
                marginTop: '16px',
                background: 'transparent',
                border: 'none',
                color: 'var(--text-dim)',
                fontSize: '12px',
                textDecoration: 'underline',
                cursor: 'pointer'
              }}
            >
              Cambiar nombre o desconectar
            </button>
          </div>

          {/* Mensajes Recibidos en Vivo */}
          {messages.length > 0 && (
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '14px'
            }}>
              <div style={{
                fontSize: '13px',
                fontWeight: 700,
                textTransform: 'uppercase',
                letterSpacing: '0.08em',
                color: 'var(--text-muted)',
                paddingLeft: '4px'
              }}>
                Mensajes en vivo ({messages.length})
              </div>

              {messages.map((msg, index) => (
                <div
                  key={msg.id || index}
                  className="glass-panel"
                  style={{
                    padding: '24px',
                    borderRadius: 'var(--radius-lg)',
                    borderLeft: index === 0 ? '4px solid var(--accent)' : '1px solid var(--border-subtle)',
                    background: index === 0 ? 'rgba(236, 72, 153, 0.08)' : 'var(--bg-card)',
                    boxShadow: index === 0 ? '0 12px 30px -8px var(--accent-glow)' : 'none',
                    animation: 'slideUp 0.35s ease-out'
                  }}
                >
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    marginBottom: '10px'
                  }}>
                    <span style={{
                      fontSize: '12px',
                      fontWeight: 700,
                      color: index === 0 ? 'var(--accent)' : 'var(--text-muted)',
                      textTransform: 'uppercase',
                      letterSpacing: '0.05em'
                    }}>
                      {index === 0 ? '✨ Mensaje nuevo' : 'Mensaje'}
                    </span>
                    <span style={{
                      fontSize: '12px',
                      color: 'var(--text-dim)'
                    }}>
                      {new Date(msg.sentAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>

                  <div style={{
                    fontSize: '20px',
                    fontWeight: 600,
                    lineHeight: 1.4,
                    color: '#fff',
                    whiteSpace: 'pre-line'
                  }}>
                    {msg.content}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
