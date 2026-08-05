import { FormEvent, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { authService, UserRole } from '../services/auth.service';
import { ApiError } from '../services/api';
import { RetroBackground } from '../components/RetroBackground';
import { ChromeHeader } from '../components/ChromeHeader';

export function RegisterPage() {
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<UserRole>('cliente');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      await authService.register({ name, email, password, role });
      navigate('/login', { state: { registered: true } });
    } catch (err) {
      const message = err instanceof ApiError ? err.message : 'Error al registrar.';
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
          <ChromeHeader subtitle="Crear cuenta nueva" />

          <form onSubmit={handleSubmit} className="future-form" noValidate>
            <div className="retro-field">
              <div className="field-chrome">
                <input
                  type="text"
                  id="name"
                  placeholder=" "
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  autoComplete="name"
                />
                <label htmlFor="name">Nombre</label>
                <div className="field-hologram"></div>
              </div>
            </div>

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
                  minLength={8}
                  autoComplete="new-password"
                />
                <label htmlFor="password">Contraseña</label>
                <div className="field-hologram"></div>
              </div>
            </div>

            <div className="retro-field retro-field--select">
              <div className="field-chrome">
                <label htmlFor="role">Rol</label>
                <select id="role" value={role} onChange={(e) => setRole(e.target.value as UserRole)}>
                  <option value="cliente">Cliente</option>
                  <option value="admin">Admin</option>
                </select>
              </div>
            </div>

            {error && <span className="retro-error">{error}</span>}

            <button type="submit" className="retro-button" disabled={loading}>
              <div className="button-chrome"></div>
              <span className="button-text">{loading ? 'Registrando...' : 'Registrarme'}</span>
            </button>
          </form>

          <p className="future-signup">
            <span className="signup-text">¿Ya tienes cuenta?</span>
            <Link to="/login" className="future-link">Inicia sesión</Link>
          </p>
        </div>
      </div>
    </>
  );
}