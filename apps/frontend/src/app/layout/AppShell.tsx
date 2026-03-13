import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom';
import { clearToken, isAuthenticated } from '../../lib/auth';
import { useI18n } from '../../i18n/I18nProvider';
import { SUPPORTED_LANGUAGES } from '../../i18n/messages';

export default function AppShell() {
  const navigate = useNavigate();
  const authed = isAuthenticated();
  const { language, setLanguage, t } = useI18n();

  function logout() {
    clearToken();
    navigate('/app/login', { replace: true });
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
          {authed ? (
            <NavLink to="/app/team" className="nav-link">
              {t('shell.team')}
            </NavLink>
          ) : null}
          {authed ? (
            <NavLink to="/app/jury" className="nav-link">
              {t('shell.jury')}
            </NavLink>
          ) : null}
          {authed ? (
            <button type="button" className="button button-soft" onClick={logout}>
              {t('shell.logout')}
            </button>
          ) : (
            <NavLink to="/app/login" className="button button-primary">
              {t('shell.login')}
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
