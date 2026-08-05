import { FormEvent, useState } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { authService } from '../services/auth.service';
import { ApiError } from '../services/api';
import { RetroBackground } from '../components/RetroBackground';
import { ChromeHeader } from '../components/ChromeHeader';

export function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const justRegistered = (location.state as { registered?: boolean } | null)?.registered;

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      await authService.login({ email, password });
      navigate('/confirmation');
    } catch (err) {
      const message = err instanceof ApiError ? err.message : 'Error al iniciar sesión.';
      setError(message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <RetroBackground />
      <div className="login-container">
        <div className="future-card">
          <ChromeHeader subtitle="Acceso al sistema" />

          <form onSubmit={handleSubmit} className="future-form" noValidate>
            <div className="retro-field">
              <div className="field-chrome">
                <input
                  type="email"
                  id="email"
                  placeholder=" "
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoComplete="email"
                />
                <label htmlFor="email">Correo</label>
                <div className="field-hologram"></div>
              </div>
            </div>

            <div className="retro-field">
              <div className="field-chrome">
                <input
                  type="password"
                  id="password"
                  placeholder=" "
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  autoComplete="current-password"
                />
                <label htmlFor="password">Contraseña</label>
                <div className="field-hologram"></div>
              </div>
            </div>

            {justRegistered && (
              <span className="retro-success-text">Cuenta creada. Ahora inicia sesión.</span>
            )}
            {error && <span className="retro-error">{error}</span>}

            <button type="submit" className="retro-button" disabled={loading}>
              <div className="button-chrome"></div>
              <span className="button-text">{loading ? 'Ingresando...' : 'Ingresar'}</span>
            </button>
          </form>

          <p className="future-signup">
            <span className="signup-text">¿No tienes cuenta?</span>
            <Link to="/register" className="future-link">Regístrate</Link>
          </p>
        </div>
      </div>
    </>
  );
}