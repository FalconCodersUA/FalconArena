import { useEffect, useState } from 'react';
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useI18n } from '../../i18n/I18nProvider';
import { SUPPORTED_LANGUAGES } from '../../i18n/messages';
import { ApiError, apiRequest } from '../../lib/api';
import {
  AuthRole,
  clearToken,
  getAuthUser,
  isAuthenticated,
  setAuthUser,
} from '../../lib/auth';

type MeResponse = {
  id: string;
  email: string;
  fullName: string;
  role: AuthRole;
};

export default function AppShell() {
  const location = useLocation();
  const navigate = useNavigate();
  const authed = isAuthenticated();
  const { language, setLanguage, t } = useI18n();
  const [role, setRole] = useState<AuthRole | null>(() => getAuthUser()?.role ?? null);
  const isAuthRoute = location.pathname === '/app/login' || location.pathname === '/app/register';

  useEffect(() => {
    if (!authed) {
      setRole(null);
      return;
    }

    const cached = getAuthUser();
    if (cached) {
      setRole(cached.role);
    }

    async function syncMe() {
      try {
        const me = await apiRequest<MeResponse>('/auth/me');
        setAuthUser(me);
        setRole(me.role);
      } catch (requestError) {
        if (requestError instanceof ApiError && requestError.status === 401) {
          clearToken();
          setRole(null);
          navigate('/app/login', { replace: true });
        }
      }
    }

    void syncMe();
  }, [authed, navigate]);

  function logout() {
    clearToken();
    setRole(null);
    navigate('/app/login', { replace: true });
  }

  function goBack() {
    if (window.history.length > 1) {
      navigate(-1);
      return;
    }

    navigate('/app');
  }

  if (isAuthRoute) {
    return (
      <div className="page auth-page">
        <header className="auth-shell-header">
          <div className="auth-nav-actions">
            <button type="button" className="auth-nav-link" onClick={goBack}>
              {t('shell.back')}
            </button>
            <Link to="/app" className="auth-nav-link">
              {t('shell.home')}
            </Link>
          </div>
          <div className="language-switch auth-language-switch" role="group" aria-label={t('shell.languageAria')}>
            {SUPPORTED_LANGUAGES.map((item) => (
              <button
                key={item}
                type="button"
                className={`lang-button${language === item ? ' active' : ''}`}
                onClick={() => setLanguage(item)}
              >
                {item.toUpperCase()}
              </button>
            ))}
          </div>
        </header>

        <section className="page-section auth-page-section">
          <Outlet />
        </section>
      </div>
    );
  }

  return (
    <div className="page">
      <header className="shell-header">
        <Link to="/app" className="brand">
          FalconArena
        </Link>

        <nav className="shell-nav" aria-label={t('shell.navAria')}>
          <div className="language-switch" role="group" aria-label={t('shell.languageAria')}>
            {SUPPORTED_LANGUAGES.map((item) => (
              <button
                key={item}
                type="button"
                className={`lang-button${language === item ? ' active' : ''}`}
                onClick={() => setLanguage(item)}
              >
                {item.toUpperCase()}
              </button>
            ))}
          </div>

          <NavLink to="/app" end className="nav-link">
            {t('shell.home')}
          </NavLink>
          <NavLink to="/app/leaderboard" className="nav-link">
            {t('shell.leaderboard')}
          </NavLink>
          {authed ? (
            <NavLink to="/app/profile" className="nav-link">
              {t('shell.profile')}
            </NavLink>
          ) : null}
          {authed && role === 'TEAM' ? (
            <NavLink to="/app/team" className="nav-link">
              {t('shell.team')}
            </NavLink>
          ) : null}
          {authed && role === 'JURY' ? (
            <NavLink to="/app/jury" className="nav-link">
              {t('shell.jury')}
            </NavLink>
          ) : null}
          {authed && (role === 'ADMIN' || role === 'ORGANIZER') ? (
            <NavLink to="/app/admin" className="nav-link">
              {t('shell.admin')}
            </NavLink>
          ) : null}
          {authed ? (
            <button type="button" className="button button-soft" onClick={logout}>
              {t('shell.logout')}
            </button>
          ) : (
            <>
              <NavLink to="/app/register" className="button button-soft">
                {t('shell.register')}
              </NavLink>
              <NavLink to="/app/login" className="button button-primary">
                {t('shell.login')}
              </NavLink>
            </>
          )}
        </nav>
      </header>

      <section className="page-section">
        <Outlet />
      </section>
    </div>
  );
}
