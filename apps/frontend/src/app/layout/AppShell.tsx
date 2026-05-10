import { FormEvent, useEffect, useMemo, useRef, useState } from 'react';
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useI18n } from '../../i18n/I18nProvider';
import { SUPPORTED_LANGUAGES } from '../../i18n/messages';
import { ApiError, apiRequest, resolveApiAssetUrl } from '../../lib/api';
import QuietLoadingInline from '../../components/QuietLoadingInline';
import BrandMark from './BrandMark';
import {
  AuthRole,
  clearToken,
  getAuthUser,
  isAuthenticated,
  setAuthUser,
} from '../../lib/auth';
import { formatDateTime, setSystemDefaultTimeZone } from '../../lib/dateTime';
import { normalizeApiErrorMessage } from '../../lib/errorMessages';

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
  createdAt: string | null;
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

type SearchCatalogTournament = {
  id: string;
  title: string;
  status: 'DRAFT' | 'REGISTRATION' | 'RUNNING' | 'FINISHED';
};

type SearchCatalogTeam = {
  id: string;
  name: string;
  organization: string | null;
  membersCount: number;
};

type SearchCatalogDialog = {
  id: string;
  otherUser: {
    id: string;
    email: string;
    fullName: string;
    role: AuthRole;
  };
  lastMessage: {
    body: string;
  } | null;
  isUnread: boolean;
};

type SearchItem = {
  path: string;
  label: string;
  meta?: string;
  category: string;
};

type ThemeMode = 'light' | 'blue' | 'dark';

const THEME_STORAGE_KEY = 'falconarena_theme';

function getStoredTheme(): ThemeMode {
  const value = localStorage.getItem(THEME_STORAGE_KEY);
  return value === 'blue' || value === 'dark' ? value : 'light';
}

const THEME_SEQUENCE: ThemeMode[] = ['light', 'blue', 'dark'];

function getNextThemeMode(themeMode: ThemeMode): ThemeMode {
  const currentIndex = THEME_SEQUENCE.indexOf(themeMode);
  return THEME_SEQUENCE[(currentIndex + 1) % THEME_SEQUENCE.length];
}

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

function toTimestamp(value: string | null | undefined) {
  if (!value) {
    return 0;
  }

  const parsed = new Date(value).getTime();
  return Number.isFinite(parsed) ? parsed : 0;
}

function formatTopbarNotificationDate(value: string | null | undefined, language: string) {
  if (!value || toTimestamp(value) === 0) {
    return '-';
  }

  return formatDateTime(value, language);
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

function languageToggleLabel(language: (typeof SUPPORTED_LANGUAGES)[number]) {
  return language === 'uk' ? 'UA' : 'EN';
}

export default function AppShell() {
  const location = useLocation();
  const navigate = useNavigate();
  const authed = isAuthenticated();
  const { language, setLanguage, t } = useI18n();
  const [themeMode, setThemeMode] = useState<ThemeMode>(() => getStoredTheme());
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
  const [mobileSearchExpanded, setMobileSearchExpanded] = useState(false);
  const [searchCatalogItems, setSearchCatalogItems] = useState<SearchItem[]>([]);
  const [showScrollTop, setShowScrollTop] = useState(false);
  const [quickActionsOpen, setQuickActionsOpen] = useState(false);
  const [quickSearchOpen, setQuickSearchOpen] = useState(false);
  const [alertsOpen, setAlertsOpen] = useState(false);
  const [alertsLoading, setAlertsLoading] = useState(false);
  const [alertsError, setAlertsError] = useState('');
  const [alerts, setAlerts] = useState<TopbarNotification[]>([]);
  const [unreadAlertsCount, setUnreadAlertsCount] = useState(0);
  const [unreadAlertIds, setUnreadAlertIds] = useState<string[]>([]);
  const [unreadDialogsCount, setUnreadDialogsCount] = useState(0);
  const [showOnlyUnreadAlerts, setShowOnlyUnreadAlerts] = useState(false);
  const searchRef = useRef<HTMLDivElement | null>(null);
  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const quickSearchInputRef = useRef<HTMLInputElement | null>(null);
  const alertsRef = useRef<HTMLDivElement | null>(null);
  const quickActionsRef = useRef<HTMLDivElement | null>(null);
  const contentRef = useRef<HTMLElement | null>(null);
  const isAuthRoute = location.pathname === '/app/login' || location.pathname === '/app/register';
  const routeLocationKey = `${location.pathname}${location.search}${location.hash}`;

  useEffect(() => {
    if (contentRef.current) {
      contentRef.current.scrollTop = 0;
    }
  }, [routeLocationKey]);

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
    document.documentElement.dataset.theme = themeMode;
    document.body.dataset.theme = themeMode;
    localStorage.setItem(THEME_STORAGE_KEY, themeMode);
  }, [themeMode]);

  useEffect(() => {
    if (!authed) {
      setFullName('');
      setCurrentUserId('');
      setProfileAvatarUrl('');
      setUnreadAlertsCount(0);
      setUnreadAlertIds([]);
      setUnreadDialogsCount(0);
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
          setUnreadDialogsCount(0);
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
    setUnreadDialogsCount(0);
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

  const homePath = authed ? '/app/dashboard' : '/app/about';
  const dashboardPath = '/app/dashboard';
  const isRoleWorkspacePath = /^\/app\/(admin|team|jury)(\/|$)/.test(location.pathname);
  const isDashboardView =
    location.pathname.startsWith('/app/dashboard') || isRoleWorkspacePath;
  const authRole = getAuthUser()?.role ?? null;
  const canManageUsers = authRole === 'ADMIN';
  const canManageIntegrations = authRole === 'ADMIN';
  const canViewMonitoring = authRole === 'ADMIN';

  const searchItems = useMemo(
    () =>
      [
        authed
          ? {
              path: dashboardPath,
              label: t('shell.dashboard'),
              category: t('shell.searchCategories.sections'),
            }
          : null,
        {
          path: '/app/tournaments',
          label: t('shell.tournamentsNav'),
          category: t('shell.searchCategories.sections'),
        },
        {
          path: '/app/teams',
          label: t('shell.teams'),
          category: t('shell.searchCategories.sections'),
        },
        {
          path: '/app/leaderboard',
          label: t('shell.leaderboard'),
          category: t('shell.searchCategories.sections'),
        },
        {
          path: '/app/archive',
          label: t('shell.archive'),
          category: t('shell.searchCategories.sections'),
        },
        authed
          ? {
              path: '/app/messages',
              label: t('shell.messages'),
              category: t('shell.searchCategories.sections'),
            }
          : null,
        {
          path: '/app/about',
          label: t('shell.about'),
          category: t('shell.searchCategories.sections'),
        },
        {
          path: '/app/presentation',
          label: t('shell.presentation'),
          category: t('shell.searchCategories.sections'),
        },
        canManageUsers
          ? {
              path: '/app/users',
              label: t('shell.users'),
              category: t('shell.searchCategories.sections'),
            }
          : null,
        authed
          ? {
              path: '/app/profile',
              label: t('shell.settings'),
              category: t('shell.searchCategories.sections'),
            }
          : null,
        canManageIntegrations
          ? {
              path: '/app/integrations',
              label: t('shell.integrations'),
              category: t('shell.searchCategories.sections'),
            }
          : null,
        canViewMonitoring
          ? {
              path: '/app/monitoring',
              label: t('shell.monitoring'),
              category: t('shell.searchCategories.sections'),
            }
          : null,
      ].filter((item): item is SearchItem => !!item),
    [authed, canManageIntegrations, canManageUsers, canViewMonitoring, dashboardPath, t],
  );
  const searchPool = useMemo(() => {
    const deduplicated = new Map<string, SearchItem>();

    [...searchItems, ...searchCatalogItems].forEach((item) => {
      const key = `${item.path}:${item.label}:${item.category}`;
      if (!deduplicated.has(key)) {
        deduplicated.set(key, item);
      }
    });

    return [...deduplicated.values()];
  }, [searchCatalogItems, searchItems]);
  const normalizedSearchQuery = searchQuery.trim().toLowerCase();
  const filteredSearchItems = useMemo(() => {
    if (!normalizedSearchQuery) {
      return searchPool.slice(0, 8);
    }

    return searchPool
      .filter((item) =>
        [item.label, item.meta, item.category]
          .filter(Boolean)
          .some((value) => value!.toLowerCase().includes(normalizedSearchQuery)),
      )
      .slice(0, 10);
  }, [normalizedSearchQuery, searchPool]);
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

    if (location.pathname === '/app') {
      return authed ? t('shell.dashboard') : t('shell.about');
    }

    if (location.pathname.startsWith('/app/tournaments')) {
      return t('shell.tournamentsNav');
    }

    if (location.pathname.startsWith('/app/about')) {
      return t('shell.about');
    }

    if (location.pathname.startsWith('/app/presentation')) {
      return t('shell.presentation');
    }

    if (location.pathname.startsWith('/app/teams')) {
      return t('shell.teams');
    }

    if (location.pathname.startsWith('/app/messages')) {
      return t('shell.messages');
    }

    if (location.pathname.startsWith('/app/users')) {
      return t('shell.users');
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

    if (location.pathname.startsWith('/app/monitoring')) {
      return t('shell.monitoring');
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
        setMobileSearchExpanded(false);
      }

      if (alertsRef.current && !alertsRef.current.contains(target)) {
        setAlertsOpen(false);
      }

      if (quickActionsRef.current && !quickActionsRef.current.contains(target)) {
        setQuickSearchOpen(false);
      }
    }

    function handleGlobalKeydown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setSearchOpen(false);
        setMobileSearchExpanded(false);
        setAlertsOpen(false);
        setQuickActionsOpen(false);
        setQuickSearchOpen(false);
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
    function handleWindowScroll() {
      setShowScrollTop(window.scrollY > 320);
    }

    handleWindowScroll();
    window.addEventListener('scroll', handleWindowScroll, { passive: true });

    return () => {
      window.removeEventListener('scroll', handleWindowScroll);
    };
  }, []);

  useEffect(() => {
    if (!showScrollTop) {
      setQuickActionsOpen(false);
      setQuickSearchOpen(false);
    }
  }, [showScrollTop]);

  useEffect(() => {
    if (!showScrollTop) {
      setQuickActionsOpen(false);
      setQuickSearchOpen(false);
    }
  }, [showScrollTop]);

  useEffect(() => {
    setQuickSearchOpen(false);
  }, [routeLocationKey]);

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
    void loadTopbarDialogsUnreadCount();
  }, [authed, currentUserId, isAuthRoute]);

  useEffect(() => {
    let cancelled = false;

    async function loadSearchCatalog() {
      const catalog: SearchItem[] = [];

      try {
        const tournaments = await apiRequest<SearchCatalogTournament[]>('/tournaments');
        if (cancelled) {
          return;
        }

        tournaments.forEach((tournament) => {
          catalog.push({
            path: `/app/tournaments/${tournament.id}`,
            label: tournament.title,
            meta: t(`tournaments.status.${tournament.status}`),
            category: t('shell.searchCategories.tournaments'),
          });
        });

        const teamSource = tournaments
          .filter((item) => item.status === 'RUNNING' || item.status === 'REGISTRATION')
          .slice(0, 4);

        const teamsByTournament = await Promise.allSettled(
          teamSource.map(async (tournament) => {
            const teams = await apiRequest<SearchCatalogTeam[]>(`/tournaments/${tournament.id}/teams`);
            return { tournament, teams };
          }),
        );

        if (cancelled) {
          return;
        }

        teamsByTournament.forEach((entry) => {
          if (entry.status !== 'fulfilled') {
            return;
          }

          entry.value.teams.slice(0, 12).forEach((team) => {
            catalog.push({
              path: `/app/teams?tournamentId=${entry.value.tournament.id}`,
              label: team.name,
              meta: entry.value.tournament.title,
              category: t('shell.searchCategories.teams'),
            });
          });
        });
      } catch {
        // Keep search functional even when dynamic catalog endpoints are unavailable.
      }

      if (authed) {
        try {
          const dialogs = await apiRequest<SearchCatalogDialog[]>('/messages/dialogs');
          if (!cancelled) {
            dialogs.slice(0, 12).forEach((dialog) => {
              catalog.push({
                path: `/app/messages?section=dialogs&dialog=${dialog.id}`,
                label: dialog.otherUser.fullName || dialog.otherUser.email,
                meta: dialog.lastMessage?.body || dialog.otherUser.email,
                category: t('shell.searchCategories.dialogs'),
              });
            });
          }
        } catch {
          // Ignore dialog search failures to avoid blocking the rest of the shell.
        }
      }

      if (!cancelled) {
        setSearchCatalogItems(catalog);
      }
    }

    void loadSearchCatalog();

    return () => {
      cancelled = true;
    };
  }, [authed, t]);

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
      void loadTopbarDialogsUnreadCount();
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
      setAlertsError(normalizeApiErrorMessage(requestError, t, t('messagesPage.loadFailed')));
      setAlerts([]);
      setUnreadAlertIds([]);
      setUnreadAlertsCount(0);
    } finally {
      if (showLoading) {
        setAlertsLoading(false);
      }
    }
  }

  async function loadTopbarDialogsUnreadCount() {
    try {
      const dialogs = await apiRequest<SearchCatalogDialog[]>('/messages/dialogs');
      setUnreadDialogsCount(dialogs.filter((item) => item.isUnread).length);
    } catch {
      setUnreadDialogsCount(0);
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

  function openDialogsInbox() {
    setAlertsOpen(false);
    setSearchOpen(false);
    navigate('/app/messages?section=dialogs');
  }

  function openMobileSearch() {
    setMobileSearchExpanded(true);
    setSearchOpen(true);
    setAlertsOpen(false);
    window.setTimeout(() => searchInputRef.current?.focus(), 0);
  }

  function onSearchSubmit(event: FormEvent) {
    event.preventDefault();
    const target = filteredSearchItems[0];
    if (!target) {
      return;
    }

    setSearchOpen(false);
    setSearchQuery('');
    setMobileSearchExpanded(false);
    setQuickSearchOpen(false);
    navigate(target.path);
  }

  function goToSearchItem(path: string) {
    setSearchOpen(false);
    setSearchQuery('');
    setMobileSearchExpanded(false);
    setQuickSearchOpen(false);
    navigate(path);
  }

  function handleScrollTop() {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function openQuickSearch() {
    setQuickActionsOpen(true);
    setSearchOpen(false);
    setMobileSearchExpanded(false);
    setQuickSearchOpen((current) => !current);
    window.setTimeout(() => quickSearchInputRef.current?.focus(), 0);
  }

  function openQuickAlerts() {
    void toggleAlerts();
  }

  function switchQuickLanguage() {
    setLanguage(language === 'uk' ? 'en' : 'uk');
  }

  function toggleTheme() {
    setThemeMode((current) => getNextThemeMode(current));
  }

  const nextThemeMode = getNextThemeMode(themeMode);
  const themeToggleLabel = t(`shell.themeTo${nextThemeMode[0].toUpperCase()}${nextThemeMode.slice(1)}`);
  const nextLanguageLabel = languageToggleLabel(language === 'uk' ? 'en' : 'uk');

  if (isAuthRoute) {
    return (
      <div className="page auth-page">
        <section className="page-section auth-page-section">
          <header className="auth-shell-header">
            <div className="auth-nav-actions">
              <button type="button" className="auth-nav-link" onClick={goBack}>
                {t('shell.back')}
              </button>
              <Link to={homePath} className="auth-nav-link">
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
                  {languageToggleLabel(item)}
                </button>
              ))}
            </div>
          </header>

          <div className="app-route-stage">
            <Outlet />
          </div>
        </section>
      </div>
    );
  }

  return (
    <div className="page app-page">
      <div className="app-shell-surface">
        <aside className="app-sidebar">
          <Link to={homePath} className="app-brand">
            <span className="app-brand-mark" aria-hidden>
              <BrandMark />
            </span>
            <span className="app-brand-wordmark">
              <span>Falcon</span>
              <span>Arena</span>
            </span>
          </Link>

          <nav className="app-sidebar-nav" aria-label={t('shell.navAria')}>
            {authed ? (
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
            ) : null}

            <NavLink to="/app/tournaments" className="app-sidebar-link">
              <span className="app-sidebar-icon" aria-hidden>
                <svg viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path
                    d="M6.2 4.8H8.7V6.8C8.7 8 7.8 8.9 6.6 8.9H6.2C5 8.9 4.1 8 4.1 6.8V4.8H6.2ZM11.3 4.8H13.8H15.9V6.8C15.9 8 15 8.9 13.8 8.9H13.4C12.2 8.9 11.3 8 11.3 6.8V4.8ZM7.4 9.2C7.6 10.7 8.6 11.9 10 12.4C11.4 11.9 12.4 10.7 12.6 9.2M10 12.4V15.1M7.6 15.2H12.4"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </span>
              <span>{t('shell.tournamentsNav')}</span>
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

            {authed ? (
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
            ) : null}

            <NavLink to="/app/about" className="app-sidebar-link">
              <span className="app-sidebar-icon" aria-hidden>
                <svg viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <circle cx="10" cy="10" r="6.2" stroke="currentColor" strokeWidth="1.5" />
                  <path
                    d="M10 8.8V13.2M10 6.5V6.55"
                    stroke="currentColor"
                    strokeWidth="1.7"
                    strokeLinecap="round"
                  />
                </svg>
              </span>
              <span>{t('shell.about')}</span>
            </NavLink>

            {canManageUsers ? (
              <NavLink to="/app/users" className="app-sidebar-link">
                <span className="app-sidebar-icon" aria-hidden>
                  <svg viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path
                      d="M10 10.2C11.878 10.2 13.4 8.678 13.4 6.8C13.4 4.922 11.878 3.4 10 3.4C8.122 3.4 6.6 4.922 6.6 6.8C6.6 8.678 8.122 10.2 10 10.2Z"
                      stroke="currentColor"
                      strokeWidth="1.4"
                    />
                    <path
                      d="M4.7 16.2C4.7 13.9 7 12.1 10 12.1C13 12.1 15.3 13.9 15.3 16.2"
                      stroke="currentColor"
                      strokeWidth="1.4"
                      strokeLinecap="round"
                    />
                    <path
                      d="M15.2 10.8L17 11.5V13.1C17 14.8 15.9 16.3 14.2 16.8C12.5 16.3 11.4 14.8 11.4 13.1V11.5L13.2 10.8L14.2 10.3L15.2 10.8Z"
                      stroke="currentColor"
                      strokeWidth="1.3"
                      strokeLinejoin="round"
                    />
                  </svg>
                </span>
                <span>{t('shell.users')}</span>
              </NavLink>
            ) : null}

            {authed ? (
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
            ) : null}

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

            {canViewMonitoring ? (
              <NavLink to="/app/monitoring" className="app-sidebar-link">
                <span className="app-sidebar-icon" aria-hidden>
                  <svg viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path
                      d="M4.5 14.5L7.3 11.1L9.6 13.2L14.2 7.5L15.5 8.7"
                      stroke="currentColor"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                    <path
                      d="M4 4.5H16V15.5H4V4.5Z"
                      stroke="currentColor"
                      strokeWidth="1.3"
                    />
                  </svg>
                </span>
                <span>{t('shell.monitoring')}</span>
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
            <div className="app-topbar-heading">
              <h1 className="app-topbar-title">{pageTitle}</h1>
            </div>
            <div className="app-topbar-actions">
              <div className={`app-search${mobileSearchExpanded ? ' is-mobile-expanded' : ''}`} ref={searchRef}>
                <form className="app-search-form" aria-label={t('shell.searchPlaceholder')} onSubmit={onSearchSubmit}>
                  <button
                    type="button"
                    className="app-search-icon"
                    aria-label={t('shell.searchPlaceholder')}
                    onClick={openMobileSearch}
                  >
                    <svg viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <circle cx="9" cy="9" r="5" stroke="currentColor" strokeWidth="1.6" />
                      <path d="M12.8 12.8L16 16" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
                    </svg>
                  </button>
                  <input
                    ref={searchInputRef}
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
                          key={`search-item-${item.path}-${item.label}-${item.category}`}
                          type="button"
                          className="app-search-item"
                          onClick={() => goToSearchItem(item.path)}
                        >
                          <span>{item.label}</span>
                          {item.meta || item.category ? (
                            <small>
                              {[item.category, item.meta].filter(Boolean).join(' · ')}
                            </small>
                          ) : null}
                        </button>
                      ))
                    )}
                  </div>
                ) : null}
              </div>

              <button
                type="button"
                className={`app-topbar-icon app-theme-toggle is-${themeMode}${
                  themeMode !== 'light' ? ' active' : ''
                }`}
                aria-label={themeToggleLabel}
                title={themeToggleLabel}
                onClick={toggleTheme}
              >
                {nextThemeMode === 'light' ? (
                  <svg viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <circle cx="10" cy="10" r="3.9" fill="currentColor" />
                    <path
                      d="M10 1.9V3.8M10 16.2V18.1M18.1 10H16.2M3.8 10H1.9M15.75 4.25L14.42 5.58M5.58 14.42L4.25 15.75M15.75 15.75L14.42 14.42M5.58 5.58L4.25 4.25"
                      stroke="currentColor"
                      strokeWidth="1.65"
                      strokeLinecap="round"
                    />
                  </svg>
                ) : nextThemeMode === 'dark' ? (
                  <svg viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <mask id="theme-moon-mask">
                      <rect width="20" height="20" fill="white" />
                      <circle cx="12.8" cy="7.35" r="6.15" fill="black" />
                    </mask>
                    <circle cx="9.45" cy="10.4" r="7.35" fill="currentColor" mask="url(#theme-moon-mask)" />
                  </svg>
                ) : (
                  <svg viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path
                      d="M6.1 14.1H14.2C15.85 14.1 17.2 12.86 17.2 11.32C17.2 9.86 16.02 8.66 14.5 8.55C13.98 6.72 12.28 5.4 10.28 5.4C8.42 5.4 6.82 6.54 6.18 8.16H5.95C4.22 8.16 2.8 9.49 2.8 11.12C2.8 12.78 4.28 14.1 6.1 14.1Z"
                      fill="currentColor"
                    />
                    <path
                      d="M6.05 14.1H14.2"
                      stroke="currentColor"
                      strokeWidth="1.35"
                      strokeLinecap="round"
                      opacity="0.42"
                    />
                  </svg>
                )}
              </button>

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
                    {languageToggleLabel(item)}
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
                  className={`app-topbar-icon app-topbar-mail${unreadDialogsCount > 0 ? ' has-unread' : ''}`}
                  aria-label={t('shell.messagesInboxAria')}
                  onClick={openDialogsInbox}
                >
                  <svg viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path
                      d="M4.2 5.4H15.8C16.35 5.4 16.8 5.85 16.8 6.4V13.6C16.8 14.15 16.35 14.6 15.8 14.6H4.2C3.65 14.6 3.2 14.15 3.2 13.6V6.4C3.2 5.85 3.65 5.4 4.2 5.4Z"
                      stroke="currentColor"
                      strokeWidth="1.5"
                    />
                    <path
                      d="M4 6L10 10.4L16 6"
                      stroke="currentColor"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                  {unreadDialogsCount > 0 ? (
                    <span className="app-topbar-mail-badge" aria-hidden>
                      {unreadDialogsCount > 99 ? '99+' : unreadDialogsCount}
                    </span>
                  ) : null}
                </button>

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
                    {alertsLoading ? <QuietLoadingInline label={t('messagesPage.loading')} compact /> : null}
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
                              <span>{formatTopbarNotificationDate(item.createdAt, language)}</span>
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
                    <img src={resolveApiAssetUrl(profileAvatarUrl)} alt={t('shell.profile')} />
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

          <section ref={contentRef} className="page-section app-content">
            <div className="app-route-stage">
              <Outlet />
            </div>
          </section>
          <div
            ref={quickActionsRef}
            className={`app-quick-actions${quickActionsOpen ? ' open' : ''}${
              showScrollTop ? ' is-visible' : ' is-hidden'
            }`}
            aria-hidden={!showScrollTop}
          >
              <button
                type="button"
                className="app-quick-actions-toggle"
                aria-label={t('shell.quickActions')}
                aria-expanded={quickActionsOpen}
                tabIndex={showScrollTop ? 0 : -1}
                onClick={() => setQuickActionsOpen((current) => !current)}
              >
                <svg viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden>
                  <circle cx="6" cy="6" r="2.15" fill="currentColor" />
                  <circle cx="14" cy="6" r="2.15" fill="currentColor" />
                  <circle cx="6" cy="14" r="2.15" fill="currentColor" />
                  <circle cx="14" cy="14" r="2.15" fill="currentColor" />
                </svg>
              </button>

              <div className="app-quick-actions-menu" aria-hidden={!quickActionsOpen}>
                <div className={`app-quick-search-row${quickSearchOpen ? ' open' : ''}`}>
                  <button
                    type="button"
                    className="app-quick-action"
                    aria-label={t('shell.searchPlaceholder')}
                    title={t('shell.searchPlaceholder')}
                    tabIndex={showScrollTop && quickActionsOpen ? 0 : -1}
                    onClick={openQuickSearch}
                  >
                    <svg viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden>
                      <circle cx="9" cy="9" r="5" stroke="currentColor" strokeWidth="1.6" />
                      <path d="M12.8 12.8L16 16" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
                    </svg>
                  </button>

                  <form
                    className="app-quick-search-panel"
                    aria-hidden={!quickSearchOpen}
                    aria-label={t('shell.searchPlaceholder')}
                    onSubmit={onSearchSubmit}
                  >
                    <input
                      ref={quickSearchInputRef}
                      type="text"
                      placeholder={t('shell.searchPlaceholder')}
                      value={searchQuery}
                      tabIndex={showScrollTop && quickActionsOpen && quickSearchOpen ? 0 : -1}
                      onChange={(event) => setSearchQuery(event.target.value)}
                    />
                    <div className="app-quick-search-results">
                      {filteredSearchItems.length === 0 ? (
                        <p>{t('shell.searchNoResults')}</p>
                      ) : (
                        filteredSearchItems.slice(0, 6).map((item) => (
                          <button
                            key={`quick-search-item-${item.path}-${item.label}-${item.category}`}
                            type="button"
                            tabIndex={showScrollTop && quickActionsOpen && quickSearchOpen ? 0 : -1}
                            onClick={() => goToSearchItem(item.path)}
                          >
                            <span>{item.label}</span>
                            {item.meta || item.category ? (
                              <small>{[item.category, item.meta].filter(Boolean).join(' · ')}</small>
                            ) : null}
                          </button>
                        ))
                      )}
                    </div>
                  </form>
                </div>

                <button
                  type="button"
                  className={`app-quick-action app-quick-theme is-${themeMode}`}
                  aria-label={themeToggleLabel}
                  title={themeToggleLabel}
                  tabIndex={showScrollTop && quickActionsOpen ? 0 : -1}
                  onClick={() => {
                    toggleTheme();
                  }}
                >
                  {nextThemeMode === 'light' ? (
                    <svg viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden>
                      <circle cx="10" cy="10" r="3.9" fill="currentColor" />
                      <path
                        d="M10 1.9V3.8M10 16.2V18.1M18.1 10H16.2M3.8 10H1.9M15.75 4.25L14.42 5.58M5.58 14.42L4.25 15.75M15.75 15.75L14.42 14.42M5.58 5.58L4.25 4.25"
                        stroke="currentColor"
                        strokeWidth="1.65"
                        strokeLinecap="round"
                      />
                    </svg>
                  ) : nextThemeMode === 'dark' ? (
                    <svg viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden>
                      <mask id="quick-theme-moon-mask">
                        <rect width="20" height="20" fill="white" />
                        <circle cx="12.8" cy="7.35" r="6.15" fill="black" />
                      </mask>
                      <circle cx="9.45" cy="10.4" r="7.35" fill="currentColor" mask="url(#quick-theme-moon-mask)" />
                    </svg>
                  ) : (
                    <svg viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden>
                      <path
                        d="M6.1 14.1H14.2C15.85 14.1 17.2 12.86 17.2 11.32C17.2 9.86 16.02 8.66 14.5 8.55C13.98 6.72 12.28 5.4 10.28 5.4C8.42 5.4 6.82 6.54 6.18 8.16H5.95C4.22 8.16 2.8 9.49 2.8 11.12C2.8 12.78 4.28 14.1 6.1 14.1Z"
                        fill="currentColor"
                      />
                    </svg>
                  )}
                </button>

                <button
                  type="button"
                  className="app-quick-action app-quick-language"
                  aria-label={t('shell.languageAria')}
                  title={t('shell.languageAria')}
                  tabIndex={showScrollTop && quickActionsOpen ? 0 : -1}
                  onClick={switchQuickLanguage}
                >
                  {nextLanguageLabel}
                </button>

                {authed ? (
                  <Link
                    to="/app/profile"
                    className="app-quick-action"
                    aria-label={t('shell.profile')}
                    title={t('shell.profile')}
                    tabIndex={showScrollTop && quickActionsOpen ? 0 : -1}
                  >
                    <svg viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden>
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

                <button
                  type="button"
                  className={`app-quick-action${unreadDialogsCount > 0 ? ' has-unread' : ''}`}
                  aria-label={t('shell.messagesInboxAria')}
                  title={t('shell.messagesInboxAria')}
                  tabIndex={showScrollTop && quickActionsOpen ? 0 : -1}
                  onClick={() => {
                    openDialogsInbox();
                  }}
                >
                  <svg viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden>
                    <path
                      d="M4.2 5.4H15.8C16.35 5.4 16.8 5.85 16.8 6.4V13.6C16.8 14.15 16.35 14.6 15.8 14.6H4.2C3.65 14.6 3.2 14.15 3.2 13.6V6.4C3.2 5.85 3.65 5.4 4.2 5.4Z"
                      stroke="currentColor"
                      strokeWidth="1.5"
                    />
                    <path
                      d="M4 6L10 10.4L16 6"
                      stroke="currentColor"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                  {unreadDialogsCount > 0 ? <span className="app-quick-badge" aria-hidden>{unreadDialogsCount > 99 ? '99+' : unreadDialogsCount}</span> : null}
                </button>

                <button
                  type="button"
                  className={`app-quick-action${unreadAlertsCount > 0 ? ' has-unread' : ''}`}
                  aria-label={t('shell.alertsAria')}
                  title={t('shell.alertsAria')}
                  tabIndex={showScrollTop && quickActionsOpen ? 0 : -1}
                  onClick={openQuickAlerts}
                >
                  <svg viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden>
                    <path
                      d="M10 4.3C8 4.3 6.3 6 6.3 8V10.1C6.3 11 6 11.8 5.4 12.5L4.7 13.4H15.3L14.6 12.5C14 11.8 13.7 11 13.7 10.1V8C13.7 6 12 4.3 10 4.3Z"
                      stroke="currentColor"
                      strokeWidth="1.5"
                      strokeLinejoin="round"
                    />
                    <circle cx="10" cy="15.5" r="1.3" fill="currentColor" />
                  </svg>
                  {unreadAlertsCount > 0 ? <span className="app-quick-badge" aria-hidden>{unreadAlertsCount > 99 ? '99+' : unreadAlertsCount}</span> : null}
                </button>

                {authed ? (
                  <button
                    type="button"
                    className="app-quick-action"
                    aria-label={t('shell.logout')}
                    title={t('shell.logout')}
                    tabIndex={showScrollTop && quickActionsOpen ? 0 : -1}
                    onClick={() => {
                      logout();
                    }}
                  >
                    <svg viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden>
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
                ) : (
                  <Link
                    to="/app/login"
                    className="app-quick-action"
                    aria-label={t('shell.login')}
                    title={t('shell.login')}
                    tabIndex={showScrollTop && quickActionsOpen ? 0 : -1}
                  >
                    <svg viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden>
                      <path
                        d="M11.5 5.2C11.03 5.02 10.53 4.93 10 4.93C7.75 4.93 5.93 6.75 5.93 9C5.93 11.25 7.75 13.07 10 13.07C10.53 13.07 11.03 12.98 11.5 12.8"
                        stroke="currentColor"
                        strokeWidth="1.5"
                        strokeLinecap="round"
                      />
                      <path
                        d="M9.8 9H15.2M15.2 9L13.3 7.1M15.2 9L13.3 10.9"
                        stroke="currentColor"
                        strokeWidth="1.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </Link>
                )}

                {authed ? (
                  <Link
                    to="/app/profile"
                    className="app-quick-action app-quick-avatar"
                    aria-label={t('shell.profile')}
                    title={t('shell.profile')}
                    tabIndex={showScrollTop && quickActionsOpen ? 0 : -1}
                  >
                    {profileAvatarUrl ? (
                      <img src={resolveApiAssetUrl(profileAvatarUrl)} alt="" />
                    ) : (
                      initialsFromName(fullName)
                    )}
                  </Link>
                ) : null}
              </div>
            </div>
          <button
            type="button"
            className={`app-scroll-top${showScrollTop ? ' is-visible' : ' is-hidden'}`}
            aria-label={t('shell.scrollTop')}
            aria-hidden={!showScrollTop}
            tabIndex={showScrollTop ? 0 : -1}
            onClick={handleScrollTop}
          >
            <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path
                d="M7.5 14.5L12 10L16.5 14.5"
                stroke="currentColor"
                strokeWidth="2.4"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            <span className="app-scroll-top-label">ARENA</span>
          </button>
        </main>
      </div>
    </div>
  );
}
