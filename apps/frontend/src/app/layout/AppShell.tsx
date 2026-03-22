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

function initialsFromName(fullName: string | undefined, fallback = 'FA') {
  if (!fullName) {
    return fallback;
  }

  const parts = fullName
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  if (parts.length === 0) {
    return fallback;
  }

  const value = parts
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join('');

  return value || fallback;
}

export default function AppShell() {
  const location = useLocation();
  const navigate = useNavigate();
  const authed = isAuthenticated();
  const { language, setLanguage, t } = useI18n();
  const [fullName, setFullName] = useState<string>(() => getAuthUser()?.fullName ?? '');
  const isAuthRoute = location.pathname === '/app/login' || location.pathname === '/app/register';

  useEffect(() => {
    if (!authed) {
      setFullName('');
      return;
    }

    const cached = getAuthUser();
    if (cached) {
      setFullName(cached.fullName);
    }

    async function syncMe() {
      try {
        const me = await apiRequest<MeResponse>('/auth/me');
        setAuthUser(me);
        setFullName(me.fullName);
      } catch (requestError) {
        if (requestError instanceof ApiError && requestError.status === 401) {
          clearToken();
          setFullName('');
          navigate('/app/login', { replace: true });
        }
      }
    }

    void syncMe();
  }, [authed, navigate]);

  function logout() {
    clearToken();
    setFullName('');
    navigate('/app/login', { replace: true });
  }

  function goBack() {
    if (window.history.length > 1) {
      navigate(-1);
      return;
    }

    navigate('/app');
  }

  const dashboardPath = authed ? '/app/dashboard' : '/app/tournaments';
  const isRoleWorkspacePath = /^\/app\/(admin|team|jury)(\/|$)/.test(location.pathname);
  const isDashboardView =
    location.pathname.startsWith('/app/dashboard') || isRoleWorkspacePath;

  const pageTitle = (() => {
    if (isDashboardView) {
      return t('shell.dashboard');
    }

    if (
      location.pathname === '/app' ||
      location.pathname.startsWith('/app/tournaments')
    ) {
      return t('shell.tournamentsNav');
    }

    if (location.pathname.startsWith('/app/teams')) {
      return t('shell.teams');
    }

    if (location.pathname.startsWith('/app/messages')) {
      return t('shell.messages');
    }

    if (location.pathname.startsWith('/app/profile')) {
      return t('shell.settings');
    }

    if (location.pathname.startsWith('/app/leaderboard')) {
      return t('shell.leaderboard');
    }

    return t('shell.home');
  })();

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
    <div className="page app-page">
      <div className="app-shell-surface">
        <aside className="app-sidebar">
          <Link to="/app" className="app-brand">
            <span className="app-brand-mark" aria-hidden>
              <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="1.5" />
                <path
                  d="M7.5 13.2L10.2 15.8L16.5 9.4"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </span>
            <span>FalconArena</span>
          </Link>

          <nav className="app-sidebar-nav" aria-label={t('shell.navAria')}>
            <NavLink
              to={dashboardPath}
              className={({ isActive }) =>
                `app-sidebar-link${isActive || isDashboardView ? ' active' : ''}`
              }
            >
              <span className="app-sidebar-icon" aria-hidden>
                <svg viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M3 9.2L10 3L17 9.2V17H3V9.2Z" fill="currentColor" />
                </svg>
              </span>
              <span>{t('shell.dashboard')}</span>
            </NavLink>

            <NavLink to="/app/teams" className="app-sidebar-link">
              <span className="app-sidebar-icon" aria-hidden>
                <svg viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <circle cx="7" cy="8" r="2.3" fill="currentColor" />
                  <circle cx="13" cy="8.5" r="2" fill="currentColor" opacity="0.72" />
                  <path d="M3.5 16C3.5 13.9 5.3 12.4 7.8 12.4C10.3 12.4 12.2 13.9 12.2 16" fill="currentColor" />
                  <path d="M11.3 16C11.3 14.4 12.7 13.2 14.5 13.2C16.3 13.2 17.6 14.4 17.6 16" fill="currentColor" opacity="0.72" />
                </svg>
              </span>
              <span>{t('shell.teams')}</span>
            </NavLink>

            <NavLink to="/app/tournaments" className="app-sidebar-link">
              <span className="app-sidebar-icon" aria-hidden>
                <svg viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path
                    d="M4 16H16M6 14V9M10 14V6M14 14V11"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                  />
                </svg>
              </span>
              <span>{t('shell.tournamentsNav')}</span>
            </NavLink>

            <NavLink to="/app/leaderboard" className="app-sidebar-link">
              <span className="app-sidebar-icon" aria-hidden>
                <svg viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path
                    d="M5 16H15M6.4 14V11.2M10 14V8M13.6 14V9.6"
                    stroke="currentColor"
                    strokeWidth="1.6"
                    strokeLinecap="round"
                  />
                </svg>
              </span>
              <span>{t('shell.leaderboard')}</span>
            </NavLink>

            <NavLink to="/app/messages" className="app-sidebar-link">
              <span className="app-sidebar-icon" aria-hidden>
                <svg viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path
                    d="M5 6.5H15M5 10H12M5 13.5H10"
                    stroke="currentColor"
                    strokeWidth="1.6"
                    strokeLinecap="round"
                  />
                  <circle cx="14.2" cy="13.4" r="2.2" stroke="currentColor" strokeWidth="1.4" />
                </svg>
              </span>
              <span>{t('shell.messages')}</span>
            </NavLink>

            <NavLink to="/app/profile" className="app-sidebar-link">
              <span className="app-sidebar-icon" aria-hidden>
                <svg viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path
                    d="M10 3.5L11.5 4.8L13.5 4.4L14.1 6.4L16 7.4L15.1 9.3L15.6 11.3L13.6 11.7L12.4 13.2L10.5 12.4L8.6 13.2L7.4 11.7L5.4 11.3L5.9 9.3L5 7.4L6.9 6.4L7.5 4.4L9.5 4.8L10 3.5Z"
                    fill="currentColor"
                  />
                  <circle cx="10" cy="9.2" r="1.8" fill="#fff" />
                </svg>
              </span>
              <span>{t('shell.settings')}</span>
            </NavLink>
          </nav>

          <div className="app-sidebar-footer">
            {authed ? (
              <button type="button" className="button button-soft app-sidebar-logout" onClick={logout}>
                {t('shell.logout')}
              </button>
            ) : (
              <div className="app-sidebar-auth">
                <NavLink to="/app/register" className="button button-soft">
                  {t('shell.register')}
                </NavLink>
                <NavLink to="/app/login" className="button button-primary">
                  {t('shell.login')}
                </NavLink>
              </div>
            )}
          </div>
        </aside>

        <main className="app-main">
          <header className="app-topbar">
            <h1 className="app-topbar-title">{pageTitle}</h1>
            <div className="app-topbar-actions">
              <label className="app-search" aria-label={t('shell.searchPlaceholder')}>
                <span className="app-search-icon" aria-hidden>
                  <svg viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <circle cx="9" cy="9" r="5" stroke="currentColor" strokeWidth="1.6" />
                    <path d="M12.8 12.8L16 16" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
                  </svg>
                </span>
                <input type="text" placeholder={t('shell.searchPlaceholder')} readOnly />
              </label>

              <div
                className="language-switch app-topbar-language"
                role="group"
                aria-label={t('shell.languageAria')}
              >
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

              {authed ? (
                <Link to="/app/profile" className="app-topbar-icon" aria-label={t('shell.profile')}>
                  <svg viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path
                      d="M10 3.4L11.4 4.6L13.3 4.3L13.9 6.1L15.8 7L14.9 8.8L15.4 10.7L13.5 11.1L12.3 12.6L10.5 11.8L8.7 12.6L7.5 11.1L5.6 10.7L6.1 8.8L5.2 7L7.1 6.1L7.7 4.3L9.6 4.6L10 3.4Z"
                      stroke="currentColor"
                      strokeWidth="1.3"
                      fill="currentColor"
                      fillOpacity="0.16"
                    />
                    <circle cx="10" cy="8.6" r="1.7" fill="currentColor" />
                  </svg>
                </Link>
              ) : null}

              <button type="button" className="app-topbar-icon" aria-label={t('shell.alertsAria')}>
                <svg viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path
                    d="M10 4.3C8 4.3 6.3 6 6.3 8V10.1C6.3 11 6 11.8 5.4 12.5L4.7 13.4H15.3L14.6 12.5C14 11.8 13.7 11 13.7 10.1V8C13.7 6 12 4.3 10 4.3Z"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinejoin="round"
                  />
                  <circle cx="10" cy="15.5" r="1.3" fill="currentColor" />
                </svg>
              </button>

              {authed ? (
                <button type="button" className="app-topbar-icon" aria-label={t('shell.logout')} onClick={logout}>
                  <svg viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path
                      d="M8.5 5.2C8.97 5.02 9.47 4.93 10 4.93C12.25 4.93 14.07 6.75 14.07 9C14.07 11.25 12.25 13.07 10 13.07C9.47 13.07 8.97 12.98 8.5 12.8"
                      stroke="currentColor"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                    />
                    <path
                      d="M10.2 9H4.8M4.8 9L6.7 7.1M4.8 9L6.7 10.9"
                      stroke="currentColor"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </button>
              ) : null}

              {authed ? (
                <Link to="/app/profile" className="app-avatar" aria-label={t('shell.profile')}>
                  {initialsFromName(fullName)}
                </Link>
              ) : (
                <div className="app-topbar-guest-actions">
                  <Link to="/app/register" className="button button-soft app-topbar-register">
                    {t('shell.register')}
                  </Link>
                  <Link to="/app/login" className="button button-primary app-topbar-login">
                    {t('shell.login')}
                  </Link>
                </div>
              )}
            </div>
          </header>

          <section className="page-section app-content">
            <Outlet />
          </section>
        </main>
      </div>
    </div>
  );
}
