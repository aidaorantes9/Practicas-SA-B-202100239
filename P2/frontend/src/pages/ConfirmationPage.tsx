import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { authService, User } from '../services/auth.service';
import { resourcesService } from '../services/resources.service';
import { ApiError } from '../services/api';
import { RetroBackground } from '../components/RetroBackground';
import { ChromeHeader } from '../components/ChromeHeader';

export function ConfirmationPage() {
  const navigate = useNavigate();
  const [user, setUser] = useState<User | null>(null);
  const [loadingUser, setLoadingUser] = useState(true);
  const [resourceResult, setResourceResult] = useState<string | null>(null);
  const [renewedNotice, setRenewedNotice] = useState(false);

  useEffect(() => {
    authService
      .me()
      .then((res) => setUser(res.user))
      .catch(() => navigate('/login'))
      .finally(() => setLoadingUser(false));
  }, [navigate]);

  useEffect(() => {
    function handleTokenRenewed() {
      setRenewedNotice(true);
      setTimeout(() => setRenewedNotice(false), 4000);
    }
    window.addEventListener('token-renewed', handleTokenRenewed);
    return () => window.removeEventListener('token-renewed', handleTokenRenewed);
  }, []);

  async function handleLogout() {
    await authService.logout();
    navigate('/login');
  }

  async function tryResource(resource: 'route1' | 'route2') {
    setResourceResult(null);
    try {
      const res =
        resource === 'route1'
          ? await resourcesService.getRoute1()
          : await resourcesService.getRoute2();
      setResourceResult(`✅ ${res.message}`);
    } catch (err) {
      const message = err instanceof ApiError ? err.message : 'Error inesperado.';
      setResourceResult(`❌ ${message}`);
    }
  }

  if (loadingUser) {
    return (
      <>
        <RetroBackground />
        <div className="login-container">
          <div className="future-card">
            <p className="retro-subtitle" style={{ textAlign: 'center' }}>Cargando...</p>
          </div>
        </div>
      </>
    );
  }

  if (!user) return null;

  return (
    <>
      <RetroBackground />
      <div className="login-container">
        <div className="future-card">
          <ChromeHeader subtitle="¡Login exitoso!" />
          {renewedNotice && (
            <p className="retro-success-text">🔄 Tu sesión se renovó automáticamente</p>
          )}

          <div className="user-card">
            <p><strong>Nombre:</strong> {user.name}</p>
            <p><strong>Correo:</strong> {user.email}</p>
            <p><strong>Rol:</strong> {user.role}</p>
          </div>

          <p className="retro-subtitle" style={{ marginBottom: '12px', display: 'block' }}>
            Probar rutas protegidas por rol
          </p>
          <div className="resource-buttons">
            <button onClick={() => tryResource('route1')} className="retro-button retro-button--ghost">
              <div className="button-chrome"></div>
              <span className="button-text">Route 1 (Admin)</span>
            </button>
            <button onClick={() => tryResource('route2')} className="retro-button retro-button--ghost">
              <div className="button-chrome"></div>
              <span className="button-text">Route 2 (Ambos)</span>
            </button>
          </div>
          {resourceResult && <p className="resource-result">{resourceResult}</p>}

          <button onClick={handleLogout} className="retro-button retro-button--danger">
            <div className="button-chrome"></div>
            <span className="button-text">Cerrar sesión</span>
          </button>
        </div>
      </div>
    </>
  );
}