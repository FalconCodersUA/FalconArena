import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom';
import { clearToken, isAuthenticated } from '../../lib/auth';

export default function AppShell() {
  const navigate = useNavigate();
  const authed = isAuthenticated();

  function logout() {
    clearToken();
    navigate('/login', { replace: true });
  }

  return (
    <div className="page">
      <header className="shell-header">
        <Link to="/tournaments" className="brand">
          FalconArena
        </Link>

        <nav className="shell-nav" aria-label="Primary">
          <NavLink to="/tournaments" className="nav-link">
            Tournaments
          </NavLink>
          {authed ? (
            <button type="button" className="button button-soft" onClick={logout}>
              Logout
            </button>
          ) : (
            <NavLink to="/login" className="button button-primary">
              Login
            </NavLink>
          )}
        </nav>
      </header>

      <section className="page-section">
        <Outlet />
      </section>
    </div>
  );
}
