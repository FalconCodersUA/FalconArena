import { FormEvent, useEffect, useMemo, useRef, useState } from 'react';
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
import { setSystemDefaultTimeZone } from '../../lib/dateTime';

type MeResponse = {
  id: string;
  email: string;
  fullName: string;
  role: AuthRole;
};

type TopbarNotification = {
  id: string;
  type: string;
  title: string;
  body: string;
  linkUrl: string | null;
  createdAt: string;
  isUnread: boolean;
};

type ProfileSettingsResponse = {
  edit?: {
    avatarUrl?: string;
  };
};

type PlatformDefaultsResponse = {
  defaultProjectTimeZone: string;
};

function profileAvatarKey(userId: string) {
  return `falconarena_avatar_url_${userId}`;
}

function getCachedProfileAvatar(userId: string) {
  return localStorage.getItem(profileAvatarKey(userId)) ?? '';
}

function setCachedProfileAvatar(userId: string, avatarUrl: string) {
  if (avatarUrl) {
    localStorage.setItem(profileAvatarKey(userId), avatarUrl);
  } else {
    localStorage.removeItem(profileAvatarKey(userId));
  }
}

function toTimestamp(value: string) {
  const parsed = new Date(value).getTime();
  return Number.isFinite(parsed) ? parsed : 0;
}

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
  const [currentUserId, setCurrentUserId] = useState<string>(() => getAuthUser()?.id ?? '');
  const [profileAvatarUrl, setProfileAvatarUrl] = useState<string>(() => {
    const cachedUser = getAuthUser();
    if (!cachedUser) {
      return '';
    }

    return getCachedProfileAvatar(cachedUser.id);
  });
  const [searchQuery, setSearchQuery] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const [alertsOpen, setAlertsOpen] = useState(false);
  const [alertsLoading, setAlertsLoading] = useState(false);
  const [alertsError, setAlertsError] = useState('');
  const [alerts, setAlerts] = useState<TopbarNotification[]>([]);
  const [unreadAlertsCount, setUnreadAlertsCount] = useState(0);
  const [unreadAlertIds, setUnreadAlertIds] = useState<string[]>([]);
  const [showOnlyUnreadAlerts, setShowOnlyUnreadAlerts] = useState(false);
  const searchRef = useRef<HTMLDivElement | null>(null);
  const alertsRef = useRef<HTMLDivElement | null>(null);
  const isAuthRoute = location.pathname === '/app/login' || location.pathname === '/app/register';

  useEffect(() => {
    async function syncPlatformDefaults() {
      try {
        const defaults = await apiRequest<PlatformDefaultsResponse>('/platform/defaults');
        setSystemDefaultTimeZone(defaults.defaultProjectTimeZone);
      } catch {
        // Keep existing local fallback when platform defaults are unavailable.
      }
    }

    void syncPlatformDefaults();
  }, []);

  useEffect(() => {
    if (!authed) {
      setFullName('');
      setCurrentUserId('');
      setProfileAvatarUrl('');
      setUnreadAlertsCount(0);
      setUnreadAlertIds([]);
      setShowOnlyUnreadAlerts(false);
      return;
    }

    const cached = getAuthUser();
    if (cached) {
      setFullName(cached.fullName);
      setCurrentUserId(cached.id);
      setProfileAvatarUrl(getCachedProfileAvatar(cached.id));
    }

    async function syncMe() {
      try {
        const me = await apiRequest<MeResponse>('/auth/me');
        setAuthUser(me);
        setFullName(me.fullName);
        setCurrentUserId(me.id);

        try {
          const settings = await apiRequest<ProfileSettingsResponse>('/profile/settings');
          const nextAvatarUrl = settings.edit?.avatarUrl?.trim() ?? '';
          setProfileAvatarUrl(nextAvatarUrl);
          setCachedProfileAvatar(me.id, nextAvatarUrl);
        } catch {
          setProfileAvatarUrl((current) => current || getCachedProfileAvatar(me.id));
        }
      } catch (requestError) {
        if (requestError instanceof ApiError && requestError.status === 401) {
          clearToken();
          setFullName('');
          setCurrentUserId('');
          setProfileAvatarUrl('');
          setUnreadAlertsCount(0);
          setUnreadAlertIds([]);
          setShowOnlyUnreadAlerts(false);
          navigate('/app/login', { replace: true });
        }
      }
    }

    void syncMe();
  }, [authed, navigate]);

  function logout() {
    clearToken();
    setFullName('');
    setCurrentUserId('');
    setProfileAvatarUrl('');
    setUnreadAlertsCount(0);
    setUnreadAlertIds([]);
    setShowOnlyUnreadAlerts(false);
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
  const authRole = getAuthUser()?.role ?? null;
  const canManageIntegrations = authRole === 'ADMIN';

  const searchItems = useMemo(
    () =>
      [
        { path: dashboardPath, label: t('shell.dashboard') },
        { path: '/app/teams', label: t('shell.teams') },
        { path: '/app/tournaments', label: t('shell.tournamentsNav') },
        { path: '/app/archive', label: t('shell.archive') },
        { path: '/app/leaderboard', label: t('shell.leaderboard') },
        { path: '/app/messages', label: t('shell.messages') },
        { path: '/app/profile', label: t('shell.settings') },
        canManageIntegrations
          ? { path: '/app/integrations', label: t('shell.integrations') }
          : null,
      ].filter((item): item is { path: string; label: string } => !!item),
    [canManageIntegrations, dashboardPath, t],
  );
  const normalizedSearchQuery = searchQuery.trim().toLowerCase();
  const filteredSearchItems = useMemo(() => {
    if (!normalizedSearchQuery) {
      return searchItems;
    }

    return searchItems.filter((item) =>
      item.label.toLowerCase().includes(normalizedSearchQuery),
    );
  }, [normalizedSearchQuery, searchItems]);
  const visibleAlerts = useMemo(() => {
    if (!showOnlyUnreadAlerts) {
      return alerts;
    }

    const unreadSet = new Set(unreadAlertIds);
    return alerts.filter((item) => unreadSet.has(item.id));
  }, [alerts, showOnlyUnreadAlerts, unreadAlertIds]);

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

    if (location.pathname.startsWith('/app/archive')) {
      return t('shell.archive');
    }

    if (location.pathname.startsWith('/app/profile')) {
      return t('shell.settings');
    }

    if (location.pathname.startsWith('/app/integrations')) {
      return t('shell.integrations');
    }

    if (location.pathname.startsWith('/app/leaderboard')) {
      return t('shell.leaderboard');
    }

    return t('shell.home');
  })();

  useEffect(() => {
    function handleGlobalPointer(event: MouseEvent) {
      const target = event.target as Node;

      if (searchRef.current && !searchRef.current.contains(target)) {
        setSearchOpen(false);
      }

      if (alertsRef.current && !alertsRef.current.contains(target)) {
        setAlertsOpen(false);
      }
    }

    function handleGlobalKeydown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setSearchOpen(false);
        setAlertsOpen(false);
      }
    }

    window.addEventListener('mousedown', handleGlobalPointer);
    window.addEventListener('keydown', handleGlobalKeydown);
    return () => {
      window.removeEventListener('mousedown', handleGlobalPointer);
      window.removeEventListener('keydown', handleGlobalKeydown);
    };
  }, []);

  useEffect(() => {
    function handleProfileUpdated(event: Event) {
      if (!currentUserId) {
        return;
      }

      const detail = (event as CustomEvent<{ avatarUrl?: string }>).detail;
      const nextAvatarUrl = detail?.avatarUrl?.trim() ?? '';
      setProfileAvatarUrl(nextAvatarUrl);
      setCachedProfileAvatar(currentUserId, nextAvatarUrl);
    }

    window.addEventListener('falconarena-profile-updated', handleProfileUpdated as EventListener);
    return () => {
      window.removeEventListener('falconarena-profile-updated', handleProfileUpdated as EventListener);
    };
  }, [currentUserId]);

  useEffect(() => {
    if (!authed || !currentUserId || isAuthRoute) {
      return;
    }

    void loadTopbarAlerts({ showLoading: false, markAsSeen: false });
  }, [authed, currentUserId, isAuthRoute]);

  useEffect(() => {
    if (!authed || !currentUserId || isAuthRoute) {
      return;
    }

    let cancelled = false;
    const intervalId = window.setInterval(() => {
      if (cancelled || document.hidden) {
        return;
      }

      void loadTopbarAlerts({ showLoading: false, markAsSeen: false });
    }, 45000);

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
    };
  }, [authed, currentUserId, isAuthRoute]);

  async function loadTopbarAlerts({
    showLoading,
    markAsSeen,
  }: {
    showLoading: boolean;
    markAsSeen: boolean;
  }) {
    if (showLoading) {
      setAlertsLoading(true);
    }
    setAlertsError('');

    try {
      const data = await apiRequest<TopbarNotification[]>('/notifications');
      const sorted = [...data].sort(
        (left, right) => toTimestamp(right.createdAt) - toTimestamp(left.createdAt),
      );
      const limited = sorted.slice(0, 6);
      const unreadIds = sorted.filter((item) => item.isUnread).map((item) => item.id);

      if (markAsSeen) {
        if (unreadIds.length > 0) {
          await apiRequest('/notifications/read-state', {
            method: 'PATCH',
            body: {
              notificationIds: unreadIds,
            },
          });
        }
        setAlerts(limited.map((item) => ({ ...item, isUnread: false })));
        setUnreadAlertIds(unreadIds);
        setUnreadAlertsCount(0);
      } else {
        setAlerts(limited);
        const unreadCount = unreadIds.length;
        setUnreadAlertIds(unreadIds);
        setUnreadAlertsCount(unreadCount);
      }
    } catch (requestError) {
      setAlertsError(requestError instanceof Error ? requestError.message : t('messagesPage.loadFailed'));
      setAlerts([]);
      setUnreadAlertIds([]);
      setUnreadAlertsCount(0);
    } finally {
      if (showLoading) {
        setAlertsLoading(false);
      }
    }
  }

  async function toggleAlerts() {
    if (!authed) {
      navigate('/app/login');
      return;
    }

    const nextOpen = !alertsOpen;
    setAlertsOpen(nextOpen);
    setSearchOpen(false);

    if (nextOpen) {
      setShowOnlyUnreadAlerts(false);
      await loadTopbarAlerts({ showLoading: true, markAsSeen: true });
    }
  }

  function openNotificationInMessages(notificationId: string) {
    setAlertsOpen(false);
    setSearchOpen(false);
    navigate(`/app/messages?section=notifications&notification=${notificationId}`);
  }

  function onSearchSubmit(event: FormEvent) {
    event.preventDefault();
    const target = filteredSearchItems[0];
    if (!target) {
      return;
    }

    setSearchOpen(false);
    setSearchQuery('');
    navigate(target.path);
  }

  function goToSearchItem(path: string) {
    setSearchOpen(false);
    setSearchQuery('');
    navigate(path);
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

            <NavLink to="/app/archive" className="app-sidebar-link">
              <span className="app-sidebar-icon" aria-hidden>
                <svg viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path
                    d="M4.5 5.5H15.5V15.5H4.5V5.5Z"
                    stroke="currentColor"
                    strokeWidth="1.5"
                  />
                  <path
                    d="M7 4V7M13 4V7M7.2 10H12.8M7.2 13H10.8"
                    stroke="currentColor"
                    strokeWidth="1.4"
                    strokeLinecap="round"
                  />
                </svg>
              </span>
              <span>{t('shell.archive')}</span>
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
                    d="M8.7 2.8H11.3L11.7 4.3C12.2 4.4 12.7 4.6 13.1 4.9L14.5 4.2L16.3 6L15.6 7.4C15.9 7.8 16.1 8.3 16.2 8.8L17.7 9.2V11.8L16.2 12.2C16.1 12.7 15.9 13.2 15.6 13.6L16.3 15L14.5 16.8L13.1 16.1C12.7 16.4 12.2 16.6 11.7 16.7L11.3 18.2H8.7L8.3 16.7C7.8 16.6 7.3 16.4 6.9 16.1L5.5 16.8L3.7 15L4.4 13.6C4.1 13.2 3.9 12.7 3.8 12.2L2.3 11.8V9.2L3.8 8.8C3.9 8.3 4.1 7.8 4.4 7.4L3.7 6L5.5 4.2L6.9 4.9C7.3 4.6 7.8 4.4 8.3 4.3L8.7 2.8Z"
                    stroke="currentColor"
                    strokeWidth="1.3"
                    strokeLinejoin="round"
                  />
                  <circle cx="10" cy="10" r="2.1" stroke="currentColor" strokeWidth="1.3" />
                </svg>
              </span>
              <span>{t('shell.settings')}</span>
            </NavLink>

            {canManageIntegrations ? (
              <NavLink to="/app/integrations" className="app-sidebar-link">
                <span className="app-sidebar-icon" aria-hidden>
                  <svg viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path
                      d="M5.6 5.8H14.4M5.6 10H14.4M5.6 14.2H11.6"
                      stroke="currentColor"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                    />
                    <circle cx="13.8" cy="14.2" r="1.5" fill="currentColor" />
                    <circle cx="6.2" cy="10" r="1.5" fill="currentColor" />
                    <circle cx="11.4" cy="5.8" r="1.5" fill="currentColor" />
                  </svg>
                </span>
                <span>{t('shell.integrations')}</span>
              </NavLink>
            ) : null}
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
              <div className="app-search" ref={searchRef}>
                <form className="app-search-form" aria-label={t('shell.searchPlaceholder')} onSubmit={onSearchSubmit}>
                  <span className="app-search-icon" aria-hidden>
                    <svg viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <circle cx="9" cy="9" r="5" stroke="currentColor" strokeWidth="1.6" />
                      <path d="M12.8 12.8L16 16" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
                    </svg>
                  </span>
                  <input
                    type="text"
                    placeholder={t('shell.searchPlaceholder')}
                    value={searchQuery}
                    onChange={(event) => setSearchQuery(event.target.value)}
                    onFocus={() => {
                      setSearchOpen(true);
                      setAlertsOpen(false);
                    }}
                  />
                </form>
                {searchOpen ? (
                  <div className="app-search-dropdown">
                    {filteredSearchItems.length === 0 ? (
                      <p className="app-search-empty">{t('shell.searchNoResults')}</p>
                    ) : (
                      filteredSearchItems.map((item) => (
                        <button
                          key={`search-item-${item.path}-${item.label}`}
                          type="button"
                          className="app-search-item"
                          onClick={() => goToSearchItem(item.path)}
                        >
                          {item.label}
                        </button>
                      ))
                    )}
                  </div>
                ) : null}
              </div>

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
                  <svg
                    className="app-topbar-settings-icon"
                    viewBox="0 0 20 20"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <path
                      d="M8.7 2.8H11.3L11.7 4.3C12.2 4.4 12.7 4.6 13.1 4.9L14.5 4.2L16.3 6L15.6 7.4C15.9 7.8 16.1 8.3 16.2 8.8L17.7 9.2V11.8L16.2 12.2C16.1 12.7 15.9 13.2 15.6 13.6L16.3 15L14.5 16.8L13.1 16.1C12.7 16.4 12.2 16.6 11.7 16.7L11.3 18.2H8.7L8.3 16.7C7.8 16.6 7.3 16.4 6.9 16.1L5.5 16.8L3.7 15L4.4 13.6C4.1 13.2 3.9 12.7 3.8 12.2L2.3 11.8V9.2L3.8 8.8C3.9 8.3 4.1 7.8 4.4 7.4L3.7 6L5.5 4.2L6.9 4.9C7.3 4.6 7.8 4.4 8.3 4.3L8.7 2.8Z"
                      stroke="currentColor"
                      strokeWidth="1.3"
                      strokeLinejoin="round"
                    />
                    <circle cx="10" cy="10" r="2.1" stroke="currentColor" strokeWidth="1.3" />
                  </svg>
                </Link>
              ) : null}

              <div className="app-topbar-alerts-wrap" ref={alertsRef}>
                <button
                  type="button"
                  className={`app-topbar-icon${alertsOpen ? ' active' : ''}`}
                  aria-label={t('shell.alertsAria')}
                  onClick={() => void toggleAlerts()}
                >
                  <svg viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path
                      d="M10 4.3C8 4.3 6.3 6 6.3 8V10.1C6.3 11 6 11.8 5.4 12.5L4.7 13.4H15.3L14.6 12.5C14 11.8 13.7 11 13.7 10.1V8C13.7 6 12 4.3 10 4.3Z"
                      stroke="currentColor"
                      strokeWidth="1.5"
                      strokeLinejoin="round"
                    />
                    <circle cx="10" cy="15.5" r="1.3" fill="currentColor" />
                  </svg>
                  {unreadAlertsCount > 0 ? (
                    <span className="app-topbar-alerts-badge" aria-hidden>
                      {unreadAlertsCount > 99 ? '99+' : unreadAlertsCount}
                    </span>
                  ) : null}
                </button>
                {alertsOpen ? (
                  <div className="app-alerts-popover" role="dialog" aria-label={t('shell.alertsAria')}>
                    <div className="app-alerts-head">
                      <strong>{t('shell.notificationsTitle')}</strong>
                      <button
                        type="button"
                        className="app-alerts-link"
                        onClick={() => goToSearchItem('/app/messages?section=notifications')}
                      >
                        {t('shell.viewAll')}
                      </button>
                    </div>
                    <label className="app-alerts-filter">
                      <input
                        type="checkbox"
                        checked={showOnlyUnreadAlerts}
                        onChange={(event) => setShowOnlyUnreadAlerts(event.target.checked)}
                      />
                      {t('shell.notificationsOnlyUnread')}
                    </label>
                    {alertsLoading ? <p className="app-alerts-state">{t('messagesPage.loading')}</p> : null}
                    {!alertsLoading && alertsError ? (
                      <div className="app-alerts-state-wrap">
                        <p className="app-alerts-state">{alertsError}</p>
                        <button
                          type="button"
                          className="button button-soft"
                          onClick={() => void loadTopbarAlerts({ showLoading: true, markAsSeen: false })}
                        >
                          {t('messagesPage.retry')}
                        </button>
                      </div>
                    ) : null}
                    {!alertsLoading && !alertsError && visibleAlerts.length === 0 ? (
                      <p className="app-alerts-state">
                        {showOnlyUnreadAlerts
                          ? t('shell.notificationsNoUnread')
                          : t('shell.notificationsEmpty')}
                      </p>
                    ) : null}
                    {!alertsLoading && !alertsError && visibleAlerts.length > 0 ? (
                      <div className="app-alerts-list">
                        {visibleAlerts.map((item) => (
                          <article key={item.id} className="app-alert-item">
                            <strong>{item.title}</strong>
                            <p>{item.body}</p>
                            <div className="app-alert-meta">
                              <span>{new Date(item.createdAt).toLocaleString(language === 'uk' ? 'uk-UA' : 'en-US')}</span>
                              <button
                                type="button"
                                className="app-alert-meta-btn"
                                onClick={() => openNotificationInMessages(item.id)}
                              >
                                {t('shell.openInMessages')}
                              </button>
                              {item.linkUrl ? (
                                <a href={item.linkUrl} target="_blank" rel="noreferrer">
                                  {t('messagesPage.openLink')}
                                </a>
                              ) : null}
                            </div>
                          </article>
                        ))}
                      </div>
                    ) : null}
                  </div>
                ) : null}
              </div>

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
                  {profileAvatarUrl ? (
                    <img src={profileAvatarUrl} alt={t('shell.profile')} />
                  ) : (
                    initialsFromName(fullName)
                  )}
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
