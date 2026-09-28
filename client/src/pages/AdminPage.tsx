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
  ShieldCheck,
  Plus,
  Edit2,
  Trash2,
  CheckCircle,
  Clock,
  Sparkles,
  ExternalLink,
  X
} from 'lucide-react';
import type { Participant, MessageTemplate, MessageLog, RecipientType } from '../../../shared/types/index.js';

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

  // URL del QR: utiliza el túnel global público de Cloudflare activo para acceso desde cualquier celular del mundo
  const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
  const initialQrUrl = isLocalhost ? 'https://phd-functions-tobacco-sheer.trycloudflare.com/' : `${window.location.origin}/`;
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

    socket.on('admin:participants-update', onParticipantsUpdate);
    socket.on('admin:participant-joined', onParticipantJoined);
    socket.on('admin:participant-status', onParticipantStatus);
    socket.on('admin:message-logged', onMessageLogged);

    return () => {
      socket.off('admin:participants-update', onParticipantsUpdate);
      socket.off('admin:participant-joined', onParticipantJoined);
      socket.off('admin:participant-status', onParticipantStatus);
      socket.off('admin:message-logged', onMessageLogged);
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
            width: '60px',
            height: '60px',
            borderRadius: '16px',
            background: 'linear-gradient(135deg, var(--primary) 0%, #8b5cf6 100%)',
            color: '#fff',
            marginBottom: '16px',
            boxShadow: '0 10px 25px -5px var(--primary-glow)'
          }}>
            <ShieldCheck size={32} />
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
          <div style={{
            width: '44px',
            height: '44px',
            borderRadius: '12px',
            background: 'linear-gradient(135deg, var(--primary) 0%, #8b5cf6 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#fff',
            boxShadow: '0 6px 16px -3px var(--primary-glow)'
          }}>
            <Sparkles size={24} />
          </div>
          <div>
            <div style={{ fontSize: '12px', fontWeight: 800, color: 'var(--primary)', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
              CONTROL EN VIVO
            </div>
            <h1 style={{ fontSize: '22px', margin: 0, color: '#fff' }}>
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
                      transition: 'all 0.15s ease'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <span style={{
                        width: '10px',
                        height: '10px',
                        borderRadius: '50%',
                        backgroundColor: p.isConnected ? 'var(--success)' : 'var(--danger)',
                        boxShadow: p.isConnected ? '0 0 8px var(--success)' : '0 0 8px var(--danger)'
                      }} className={p.isConnected ? 'pulse-indicator' : ''} />
                      <div>
                        <div style={{ fontSize: '16px', fontWeight: 600, color: '#fff' }}>
                          {p.name}
                        </div>
                        <div style={{ fontSize: '12px', color: 'var(--text-dim)' }}>
                          {p.isConnected ? 'En línea' : 'Desconectado'} • {new Date(p.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </div>
                      </div>
                    </div>

                    <span style={{
                      fontSize: '12px',
                      padding: '4px 8px',
                      borderRadius: '6px',
                      background: isSelected ? 'var(--primary)' : 'rgba(255, 255, 255, 0.06)',
                      color: isSelected ? '#fff' : 'var(--text-muted)',
                      fontWeight: 600
                    }}>
                      {isSelected ? 'Destinatario ✓' : 'Seleccionar'}
                    </span>
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
    </div>
  );
}
