import { useState, useEffect } from 'react';
import { ParticipantPage } from './pages/ParticipantPage';
import { AdminPage } from './pages/AdminPage';
import { StagePage } from './pages/StagePage';
import { Users, ShieldCheck, Tv, ExternalLink } from 'lucide-react';

export default function App() {
  const [currentView, setCurrentView] = useState<'participant' | 'admin' | 'stage'>('participant');

  // Detectar ruta inicial
  useEffect(() => {
    const detectRoute = () => {
      const path = window.location.pathname;
      const hash = window.location.hash;

      if (path.includes('stage') || hash === '#stage' || path.includes('proyector')) {
        setCurrentView('stage');
      } else if (path.includes('admin') || hash === '#admin') {
        setCurrentView('admin');
      } else {
        setCurrentView('participant');
      }
    };

    detectRoute();
    window.addEventListener('popstate', detectRoute);
    return () => window.removeEventListener('popstate', detectRoute);
  }, []);

  const navigateTo = (view: 'participant' | 'admin' | 'stage') => {
    setCurrentView(view);
    if (view === 'admin') {
      window.history.pushState({}, '', '/admin');
    } else if (view === 'stage') {
      window.history.pushState({}, '', '/stage');
    } else {
      window.history.pushState({}, '', '/');
    }
  };

  const showDemoNav = currentView === 'admin' || window.location.search.includes('demo=true');

  return (
    <div style={{ position: 'relative', minHeight: '100vh' }}>
      {/* Barra de navegación visible únicamente en el panel admin o con ?demo=true */}
      {showDemoNav && (
        <nav style={{
          position: 'fixed',
          bottom: '16px',
          left: '50%',
          transform: 'translateX(-50%)',
          zIndex: 9000,
          background: 'rgba(15, 23, 42, 0.85)',
          backdropFilter: 'blur(12px)',
          border: '1px solid rgba(255, 255, 255, 0.12)',
          borderRadius: '999px',
          padding: '6px 8px',
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          boxShadow: '0 10px 30px rgba(0, 0, 0, 0.6)'
        }}>
          <button
            onClick={() => navigateTo('participant')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '8px 14px',
              borderRadius: '999px',
              background: currentView === 'participant' ? 'var(--primary)' : 'transparent',
              color: currentView === 'participant' ? '#fff' : 'var(--text-muted)',
              fontSize: '13px',
              fontWeight: 700,
              cursor: 'pointer'
            }}
          >
            <Users size={16} />
            Móvil (/join)
          </button>

          <button
            onClick={() => navigateTo('stage')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '8px 14px',
              borderRadius: '999px',
              background: currentView === 'stage' ? 'var(--primary)' : 'transparent',
              color: currentView === 'stage' ? '#fff' : 'var(--text-muted)',
              fontSize: '13px',
              fontWeight: 700,
              cursor: 'pointer'
            }}
          >
            <Tv size={16} />
            Auditorio (/stage)
          </button>

          <button
            onClick={() => navigateTo('admin')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '8px 14px',
              borderRadius: '999px',
              background: currentView === 'admin' ? 'var(--primary)' : 'transparent',
              color: currentView === 'admin' ? '#fff' : 'var(--text-muted)',
              fontSize: '13px',
              fontWeight: 700,
              cursor: 'pointer'
            }}
          >
            <ShieldCheck size={16} />
            Admin (/admin)
          </button>

          <button
            onClick={() => window.open(window.location.origin, '_blank')}
            title="Abrir otra ventana como participante"
            style={{
              display: 'flex',
              alignItems: 'center',
              padding: '8px 12px',
              borderRadius: '999px',
              background: 'rgba(255, 255, 255, 0.08)',
              color: 'var(--text-muted)',
              fontSize: '12px',
              cursor: 'pointer'
            }}
          >
            <ExternalLink size={14} />
          </button>
        </nav>
      )}

      {/* Renderizado de la vista activa */}
      {currentView === 'participant' && <ParticipantPage />}
      {currentView === 'stage' && <StagePage />}
      {currentView === 'admin' && <AdminPage />}
    </div>
  );
}
