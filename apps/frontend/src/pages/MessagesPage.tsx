import { FormEvent, useEffect, useMemo, useState } from 'react';
import { useLocation } from 'react-router-dom';
import QuietLoadingCard from '../components/QuietLoadingCard';
import QuietLoadingInline from '../components/QuietLoadingInline';
import { apiRequest } from '../lib/api';
import { formatDateTime } from '../lib/dateTime';
import { normalizeApiErrorMessage } from '../lib/errorMessages';
import { useI18n } from '../i18n/I18nProvider';

type UserRole = 'ADMIN' | 'TEAM' | 'JURY' | 'ORGANIZER';
type AnnouncementAudience = 'ALL' | 'TEAM' | 'JURY' | 'ADMIN' | 'ORGANIZER';
type AnnouncementVisibility = 'AUTHENTICATED' | 'PUBLIC';
type NotificationType =
  | 'REGISTRATION_STARTED'
  | 'ROUND_STARTED'
  | 'SUBMISSION_RECEIVED'
  | 'SUBMISSION_CLOSED'
  | 'GENERAL';
type MessagesSection = 'all' | 'notifications' | 'announcements' | 'dialogs';

type AuthMe = {
  id: string;
  email: string;
  fullName: string;
  role: UserRole;
};

type Announcement = {
  id: string;
  tournamentId: string | null;
  title: string;
  body: string;
  audience: AnnouncementAudience;
  visibility: AnnouncementVisibility;
  linkUrl: string | null;
  isPinned: boolean;
  isActive: boolean;
  publishedAt: string;
  createdAt: string;
  updatedAt: string;
  isUnread: boolean;
};

type TournamentOption = {
  id: string;
  title: string;
  status: string;
};

type NotificationItem = {
  id: string;
  type: NotificationType;
  title: string;
  body: string;
  linkUrl: string | null;
  createdAt: string;
  isUnread: boolean;
};

type DialogMessage = {
  id: string;
  conversationId: string;
  senderId: string;
  body: string;
  createdAt: string;
  updatedAt: string;
};

type DialogListItem = {
  id: string;
  createdAt: string;
  updatedAt: string;
  otherUser: {
    id: string;
    email: string;
    fullName: string;
    role: UserRole;
  };
  lastMessage: DialogMessage | null;
  isUnread: boolean;
};

type DialogDetailsResponse = {
  dialog: DialogListItem;
  messages: DialogMessage[];
};

const ANNOUNCEMENT_AUDIENCES: AnnouncementAudience[] = [
  'ALL',
  'TEAM',
  'JURY',
  'ADMIN',
  'ORGANIZER',
];

const ANNOUNCEMENT_VISIBILITIES: AnnouncementVisibility[] = ['AUTHENTICATED', 'PUBLIC'];

function isManagerRole(role: UserRole | null | undefined): role is 'ADMIN' | 'ORGANIZER' {
  return role === 'ADMIN' || role === 'ORGANIZER';
}

function isValidHttpUrl(value: string) {
  try {
    const parsed = new URL(value);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

function announcementsPath(role: UserRole, includeInactive: boolean) {
  if (isManagerRole(role) && includeInactive) {
    return '/announcements?includeInactive=true';
  }

  return '/announcements';
}

function ensureListResponse<T>(value: unknown, errorMessage: string): T[] {
  if (!Array.isArray(value)) {
    throw new Error(errorMessage);
  }

  return value as T[];
}

function initialsFromName(fullName: string) {
  const value = fullName
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((item) => item.charAt(0).toUpperCase())
    .join('');

  return value || 'FA';
}

export default function MessagesPage() {
  const { language, t } = useI18n();
  const location = useLocation();

  const [me, setMe] = useState<AuthMe | null>(null);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true);
  const [notificationsError, setNotificationsError] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [managerError, setManagerError] = useState('');
  const [pendingActionId, setPendingActionId] = useState('');

  const [includeInactive, setIncludeInactive] = useState(false);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [audience, setAudience] = useState<AnnouncementAudience>('ALL');
  const [visibility, setVisibility] = useState<AnnouncementVisibility>('AUTHENTICATED');
  const [selectedTournamentId, setSelectedTournamentId] = useState('');
  const [linkUrl, setLinkUrl] = useState('');
  const [isPinned, setIsPinned] = useState(false);
  const [isActive, setIsActive] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dialogs, setDialogs] = useState<DialogListItem[]>([]);
  const [dialogsLoading, setDialogsLoading] = useState(false);
  const [dialogsError, setDialogsError] = useState('');
  const [selectedDialogId, setSelectedDialogId] = useState('');
  const [dialogMessages, setDialogMessages] = useState<DialogMessage[]>([]);
  const [dialogMessagesLoading, setDialogMessagesLoading] = useState(false);
  const [dialogMessagesError, setDialogMessagesError] = useState('');
  const [dialogNotice, setDialogNotice] = useState('');
  const [dialogActionLoading, setDialogActionLoading] = useState(false);
  const [newDialogEmail, setNewDialogEmail] = useState('');
  const [newMessageBody, setNewMessageBody] = useState('');
  const [focusedNotificationId, setFocusedNotificationId] = useState('');
  const [focusedAnnouncementId, setFocusedAnnouncementId] = useState('');
  const [activeSection, setActiveSection] = useState<MessagesSection>('all');
  const [lastRealtimeSyncAt, setLastRealtimeSyncAt] = useState('');
  const [managerTournaments, setManagerTournaments] = useState<TournamentOption[]>([]);

  const isManager = isManagerRole(me?.role);
  const unreadNotificationsCount = useMemo(
    () => notifications.filter((item) => item.isUnread).length,
    [notifications],
  );
  const pinnedCount = useMemo(
    () => announcements.filter((item) => item.isPinned).length,
    [announcements],
  );
  const activeCount = useMemo(
    () => announcements.filter((item) => item.isActive).length,
    [announcements],
  );
  const unreadDialogsCount = useMemo(
    () => dialogs.filter((item) => item.isUnread).length,
    [dialogs],
  );
  const selectedDialog = useMemo(
    () => dialogs.find((item) => item.id === selectedDialogId) ?? null,
    [dialogs, selectedDialogId],
  );
  const tournamentLabelById = useMemo(
    () => new Map(managerTournaments.map((item) => [item.id, item.title])),
    [managerTournaments],
  );
  const requestedDialogId = useMemo(() => {
    const query = new URLSearchParams(location.search);
    return query.get('dialog') ?? '';
  }, [location.search]);
  const requestedAnnouncementId = useMemo(() => {
    const query = new URLSearchParams(location.search);
    return query.get('announcement') ?? '';
  }, [location.search]);
  const requestedNotificationId = useMemo(() => {
    const query = new URLSearchParams(location.search);
    return query.get('notification') ?? '';
  }, [location.search]);
  const requestedSection = useMemo<MessagesSection>(() => {
    const query = new URLSearchParams(location.search);
    const rawSection = query.get('section');
    if (requestedNotificationId) {
      return 'notifications';
    }
    if (requestedDialogId) {
      return 'dialogs';
    }
    if (requestedAnnouncementId) {
      return 'announcements';
    }
    if (
      rawSection === 'notifications' ||
      rawSection === 'announcements' ||
      rawSection === 'dialogs'
    ) {
      return rawSection;
    }
    return 'all';
  }, [location.search, requestedAnnouncementId, requestedDialogId, requestedNotificationId]);
  const showNotifications =
    activeSection === 'all' || activeSection === 'notifications';
  const showAnnouncements =
    activeSection === 'all' || activeSection === 'announcements';
  const showDialogs = activeSection === 'all' || activeSection === 'dialogs';

  function getSectionTargetId(section: MessagesSection) {
    if (section === 'notifications') {
      return 'messages-notifications';
    }

    if (section === 'announcements') {
      return 'messages-announcements-feed';
    }

    if (section === 'dialogs') {
      return 'messages-dialogs';
    }

    return 'messages-sections';
  }

  function selectMessagesSection(section: MessagesSection, shouldScroll = true) {
    setActiveSection(section);

    if (!shouldScroll) {
      return;
    }

    window.setTimeout(() => {
      document.getElementById(getSectionTargetId(section))?.scrollIntoView({
        behavior: 'smooth',
        block: 'start',
      });
    }, 0);
  }

  async function markNotificationsRead(items: NotificationItem[]) {
    const unreadIds = items.filter((item) => item.isUnread).map((item) => item.id);
    if (unreadIds.length === 0) {
      return;
    }

    await apiRequest('/notifications/read-state', {
      method: 'PATCH',
      body: {
        notificationIds: unreadIds,
      },
    });
  }

  async function loadNotifications(markAsRead = false) {
    setNotificationsError('');

    try {
      const payload = await apiRequest<unknown>('/notifications');
      const data = ensureListResponse<NotificationItem>(
        payload,
        t('messagesPage.notifications.loadFailed'),
      );
      if (markAsRead) {
        await markNotificationsRead(data);
        setNotifications(data.map((item) => ({ ...item, isUnread: false })));
        return;
      }

      setNotifications(data);
    } catch (requestError) {
      setNotificationsError(
        normalizeApiErrorMessage(requestError, t, t('messagesPage.notifications.loadFailed')),
      );
    }
  }

  async function markAnnouncementsRead(items: Announcement[]) {
    if (items.length === 0) {
      return;
    }

    const newestAnnouncement = [...items].sort(
      (left, right) =>
        new Date(right.publishedAt).getTime() - new Date(left.publishedAt).getTime(),
    )[0];

    if (!newestAnnouncement) {
      return;
    }

    await apiRequest('/announcements/read-state', {
      method: 'PATCH',
      body: {
        publishedAt: newestAnnouncement.publishedAt,
      },
    });
  }

  async function loadAnnouncements(
    role: UserRole,
    includeInactiveValue: boolean,
    showRefreshing: boolean,
  ) {
    if (showRefreshing) {
      setRefreshing(true);
    }
    setError('');

    try {
      const payload = await apiRequest<unknown>(
        announcementsPath(role, includeInactiveValue),
      );
      const data = ensureListResponse<Announcement>(
        payload,
        t('messagesPage.loadFailed'),
      );
      if (!includeInactiveValue) {
        await markAnnouncementsRead(data);
        setAnnouncements(data.map((item) => ({ ...item, isUnread: false })));
      } else {
        setAnnouncements(data);
      }
    } catch (requestError) {
      setError(normalizeApiErrorMessage(requestError, t, t('messagesPage.loadFailed')));
    } finally {
      if (showRefreshing) {
        setRefreshing(false);
      }
    }
  }

  async function loadManagerTournaments(role: UserRole) {
    if (!isManagerRole(role)) {
      setManagerTournaments([]);
      return;
    }

    try {
      const payload = await apiRequest<unknown>('/tournaments');
      setManagerTournaments(
        ensureListResponse<TournamentOption>(payload, t('messagesPage.loadFailed')),
      );
    } catch {
      setManagerTournaments([]);
    }
  }

  async function loadDialogs(showLoading: boolean) {
    if (showLoading) {
      setDialogsLoading(true);
    }
    setDialogsError('');

    try {
      const payload = await apiRequest<unknown>('/messages/dialogs');
      const data = ensureListResponse<DialogListItem>(
        payload,
        t('messagesPage.dialogs.loadFailed'),
      );
      setDialogs(data);

      if (data.length === 0) {
        setSelectedDialogId('');
        setDialogMessages([]);
        setDialogMessagesError('');
        return;
      }

      setSelectedDialogId((current) => {
        if (requestedDialogId && data.some((item) => item.id === requestedDialogId)) {
          return requestedDialogId;
        }

        return current && data.some((item) => item.id === current) ? current : data[0].id;
      });
    } catch (requestError) {
      setDialogsError(
        normalizeApiErrorMessage(requestError, t, t('messagesPage.dialogs.loadFailed')),
      );
    } finally {
      if (showLoading) {
        setDialogsLoading(false);
      }
    }
  }

  async function loadDialogMessages(dialogId: string, showLoading: boolean) {
    if (!dialogId) {
      setDialogMessages([]);
      setDialogMessagesError('');
      return;
    }

    if (showLoading) {
      setDialogMessagesLoading(true);
    }
    setDialogMessagesError('');

    try {
      const data = await apiRequest<DialogDetailsResponse>(`/messages/dialogs/${dialogId}`);
      setDialogMessages(data.messages);
      setDialogs((current) =>
        current.map((dialog) =>
          dialog.id === dialogId
            ? {
                ...dialog,
                ...data.dialog,
                lastMessage: dialog.lastMessage,
                isUnread: false,
              }
            : dialog,
        ),
      );
    } catch (requestError) {
      setDialogMessagesError(
        normalizeApiErrorMessage(
          requestError,
          t,
          t('messagesPage.dialogs.messagesLoadFailed'),
        ),
      );
      setDialogMessages([]);
    } finally {
      if (showLoading) {
        setDialogMessagesLoading(false);
      }
    }
  }

  async function loadInitial() {
    setLoading(true);
    setError('');

    try {
      const meData = await apiRequest<AuthMe>('/auth/me');
      setMe(meData);
      await loadNotifications(
        requestedSection === 'all' || requestedSection === 'notifications',
      );
      await loadManagerTournaments(meData.role);
      await loadAnnouncements(meData.role, false, false);
      await loadDialogs(false);
      setLastRealtimeSyncAt(new Date().toISOString());
    } catch (requestError) {
      setNotifications([]);
      setAnnouncements([]);
      setMe(null);
      setDialogs([]);
      setSelectedDialogId('');
      setDialogMessages([]);
      setError(normalizeApiErrorMessage(requestError, t, t('messagesPage.loadFailed')));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadInitial();
  }, []);

  useEffect(() => {
    if (!selectedDialogId) {
      setDialogMessages([]);
      setDialogMessagesError('');
      return;
    }

    void loadDialogMessages(selectedDialogId, true);
  }, [selectedDialogId]);

  useEffect(() => {
    if (!requestedDialogId || dialogs.length === 0) {
      return;
    }

    if (dialogs.some((item) => item.id === requestedDialogId)) {
      setSelectedDialogId(requestedDialogId);
    }
  }, [requestedDialogId, dialogs]);

  useEffect(() => {
    setActiveSection(requestedSection);
  }, [requestedSection]);

  useEffect(() => {
    if (!showNotifications || unreadNotificationsCount === 0) {
      return;
    }

    void loadNotifications(true);
  }, [showNotifications, unreadNotificationsCount]);

  useEffect(() => {
    if (!requestedNotificationId || notifications.length === 0) {
      return;
    }

    const element = document.getElementById(`notification-${requestedNotificationId}`);
    if (!element) {
      return;
    }

    element.scrollIntoView({ behavior: 'smooth', block: 'center' });
    setFocusedNotificationId(requestedNotificationId);
    const timeoutId = window.setTimeout(() => {
      setFocusedNotificationId((current) =>
        current === requestedNotificationId ? '' : current,
      );
    }, 2200);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [requestedNotificationId, notifications]);

  useEffect(() => {
    if (!requestedAnnouncementId || announcements.length === 0) {
      return;
    }

    const element = document.getElementById(`announcement-${requestedAnnouncementId}`);
    if (!element) {
      return;
    }

    element.scrollIntoView({ behavior: 'smooth', block: 'center' });
    setFocusedAnnouncementId(requestedAnnouncementId);
    const timeoutId = window.setTimeout(() => {
      setFocusedAnnouncementId((current) =>
        current === requestedAnnouncementId ? '' : current,
      );
    }, 2200);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [requestedAnnouncementId, announcements]);

  useEffect(() => {
    if (!me) {
      return;
    }

    let cancelled = false;
    const intervalId = window.setInterval(() => {
      if (cancelled || document.hidden) {
        return;
      }

      void (async () => {
        await loadNotifications(showNotifications);

        if (showAnnouncements) {
          await loadAnnouncements(me.role, includeInactive, false);
        }

        if (showDialogs) {
          await loadDialogs(false);
          if (selectedDialogId) {
            await loadDialogMessages(selectedDialogId, false);
          }
        }

        if (!cancelled) {
          setLastRealtimeSyncAt(new Date().toISOString());
        }
      })();
    }, 20000);

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
    };
  }, [includeInactive, me, selectedDialogId, showNotifications, showAnnouncements, showDialogs]);

  function refreshFeed() {
    if (!me) {
      return;
    }

    void loadAnnouncements(me.role, includeInactive, true);
  }

  function refreshNotifications() {
    void loadNotifications(showNotifications);
  }

  function handleIncludeInactiveChange(nextValue: boolean) {
    setIncludeInactive(nextValue);
    if (!me) {
      return;
    }

    void loadAnnouncements(me.role, nextValue, true);
  }

  async function handleCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const trimmedTitle = title.trim();
    const trimmedBody = body.trim();
    const trimmedLink = linkUrl.trim();

    if (trimmedTitle.length < 3 || trimmedTitle.length > 140) {
      setManagerError(t('messagesPage.validation.titleLength'));
      return;
    }

    if (trimmedBody.length < 10 || trimmedBody.length > 5000) {
      setManagerError(t('messagesPage.validation.bodyLength'));
      return;
    }

    if (trimmedLink && !isValidHttpUrl(trimmedLink)) {
      setManagerError(t('messagesPage.validation.linkInvalid'));
      return;
    }

    if (visibility === 'PUBLIC' && !selectedTournamentId) {
      setManagerError(t('messagesPage.validation.publicTournamentRequired'));
      return;
    }

    setSaving(true);
    setManagerError('');
    setNotice('');

    try {
      const payload: {
        title: string;
        body: string;
        audience: AnnouncementAudience;
        visibility: AnnouncementVisibility;
        isPinned: boolean;
        isActive: boolean;
        tournamentId?: string;
        linkUrl?: string;
      } = {
        title: trimmedTitle,
        body: trimmedBody,
        audience,
        visibility,
        isPinned,
        isActive,
      };

      if (selectedTournamentId) {
        payload.tournamentId = selectedTournamentId;
      }

      if (trimmedLink) {
        payload.linkUrl = trimmedLink;
      }

      await apiRequest<Announcement>('/announcements', {
        method: 'POST',
        body: payload,
      });

      setTitle('');
      setBody('');
      setLinkUrl('');
      setAudience('ALL');
      setVisibility('AUTHENTICATED');
      setSelectedTournamentId('');
      setIsPinned(false);
      setIsActive(true);
      setNotice(t('messagesPage.created'));

      if (me) {
        await loadAnnouncements(me.role, includeInactive, false);
      }
    } catch (requestError) {
      setManagerError(normalizeApiErrorMessage(requestError, t, t('messagesPage.saveFailed')));
    } finally {
      setSaving(false);
    }
  }

  async function togglePinned(item: Announcement) {
    setPendingActionId(item.id);
    setManagerError('');
    setNotice('');

    try {
      const updated = await apiRequest<Announcement>(`/announcements/${item.id}`, {
        method: 'PATCH',
        body: { isPinned: !item.isPinned },
      });
      setAnnouncements((current) =>
        current.map((entry) => (entry.id === item.id ? updated : entry)),
      );
      setNotice(t('messagesPage.updated'));
    } catch (requestError) {
      setManagerError(normalizeApiErrorMessage(requestError, t, t('messagesPage.saveFailed')));
    } finally {
      setPendingActionId('');
    }
  }

  async function toggleActive(item: Announcement) {
    setPendingActionId(item.id);
    setManagerError('');
    setNotice('');

    try {
      const updated = await apiRequest<Announcement>(`/announcements/${item.id}`, {
        method: 'PATCH',
        body: { isActive: !item.isActive },
      });
      setAnnouncements((current) =>
        current.map((entry) => (entry.id === item.id ? updated : entry)),
      );
      setNotice(t('messagesPage.updated'));
    } catch (requestError) {
      setManagerError(normalizeApiErrorMessage(requestError, t, t('messagesPage.saveFailed')));
    } finally {
      setPendingActionId('');
    }
  }

  function refreshDialogs() {
    void loadDialogs(true);
  }

  async function handleCreateDialog(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmedEmail = newDialogEmail.trim();

    if (!trimmedEmail) {
      setDialogMessagesError(t('messagesPage.dialogs.validation.emailRequired'));
      return;
    }

    setDialogActionLoading(true);
    setDialogMessagesError('');
    setDialogNotice('');

    try {
      const created = await apiRequest<DialogListItem>('/messages/dialogs', {
        method: 'POST',
        body: { recipientEmail: trimmedEmail },
      });

      setDialogs((current) => {
        const filtered = current.filter((item) => item.id !== created.id);
        return [created, ...filtered];
      });
      setSelectedDialogId(created.id);
      setNewDialogEmail('');
      setDialogNotice(t('messagesPage.dialogs.created'));
      await loadDialogMessages(created.id, false);
    } catch (requestError) {
      setDialogMessagesError(
        normalizeApiErrorMessage(requestError, t, t('messagesPage.dialogs.createFailed')),
      );
    } finally {
      setDialogActionLoading(false);
    }
  }

  async function handleSendMessage(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!selectedDialogId) {
      setDialogMessagesError(t('messagesPage.dialogs.validation.selectDialog'));
      return;
    }

    const trimmedBody = newMessageBody.trim();
    if (!trimmedBody) {
      setDialogMessagesError(t('messagesPage.dialogs.validation.messageRequired'));
      return;
    }

    setDialogActionLoading(true);
    setDialogMessagesError('');
    setDialogNotice('');

    try {
      const message = await apiRequest<DialogMessage>(`/messages/dialogs/${selectedDialogId}`, {
        method: 'POST',
        body: { body: trimmedBody },
      });

      setDialogMessages((current) => [...current, message]);
      setDialogs((current) => {
        const updated = current.map((dialog) =>
          dialog.id === selectedDialogId
            ? {
                ...dialog,
                lastMessage: message,
                updatedAt: message.createdAt,
                isUnread: false,
              }
            : dialog,
        );
        const active = updated.find((dialog) => dialog.id === selectedDialogId);
        const rest = updated.filter((dialog) => dialog.id !== selectedDialogId);
        return active ? [active, ...rest] : updated;
      });
      setNewMessageBody('');
      setDialogNotice(t('messagesPage.dialogs.sent'));
    } catch (requestError) {
      setDialogMessagesError(
        normalizeApiErrorMessage(requestError, t, t('messagesPage.dialogs.sendFailed')),
      );
    } finally {
      setDialogActionLoading(false);
    }
  }

  if (loading) {
    return <QuietLoadingCard label={t('messagesPage.loading')} />;
  }

  if (error && !me) {
    return (
      <article className="card state-card">
        <p className="form-error">{error}</p>
        <button type="button" className="button button-soft" onClick={() => void loadInitial()}>
          {t('messagesPage.retry')}
        </button>
      </article>
    );
  }

  return (
    <section className="team-dashboard">
      <header className="section-header">
        <p className="eyebrow">{t('messagesPage.eyebrow')}</p>
        <h1>{t('messagesPage.title')}</h1>
        <p className="lead">{t('messagesPage.lead')}</p>
      </header>

      <article className="card panel-card messages-workspace-card">
        <div className="messages-workspace-head">
          <div className="messages-workspace-copy">
            <p className="eyebrow dashboard-workspace-eyebrow">
              {t('messagesPage.workspaceEyebrow')}
            </p>
            <h2>{t('messagesPage.workspaceTitle')}</h2>
            <p>{t('messagesPage.workspaceLead')}</p>
          </div>
          <div className="dashboard-workspace-status messages-workspace-status">
            <span>{t('messagesPage.workspaceStatusLabel')}</span>
            <strong>{unreadNotificationsCount + unreadDialogsCount}</strong>
            <p>{t('messagesPage.workspaceStatusLead')}</p>
          </div>
        </div>

        <div className="dashboard-toolset-grid messages-toolset-grid">
          <button
            type="button"
            className="dashboard-tool-card dashboard-tool-card--teal dashboard-tool-button"
            onClick={() => selectMessagesSection('notifications')}
          >
            <span>{t('messagesPage.sections.notifications')}</span>
            <strong>{t('messagesPage.workspaceCards.notificationsTitle')}</strong>
            <p>{t('messagesPage.workspaceCards.notificationsLead')}</p>
            <em>
              {unreadNotificationsCount} {t('messagesPage.workspaceCards.unreadSuffix')}
            </em>
          </button>
          <button
            type="button"
            className="dashboard-tool-card dashboard-tool-card--purple dashboard-tool-button"
            onClick={() => selectMessagesSection('announcements')}
          >
            <span>{t('messagesPage.sections.announcements')}</span>
            <strong>{t('messagesPage.workspaceCards.announcementsTitle')}</strong>
            <p>{t('messagesPage.workspaceCards.announcementsLead')}</p>
            <em>
              {pinnedCount} {t('messagesPage.workspaceCards.pinnedSuffix')}
            </em>
          </button>
          <button
            type="button"
            className="dashboard-tool-card dashboard-tool-card--orange dashboard-tool-button"
            onClick={() => selectMessagesSection('dialogs')}
          >
            <span>{t('messagesPage.sections.dialogs')}</span>
            <strong>{t('messagesPage.workspaceCards.dialogsTitle')}</strong>
            <p>{t('messagesPage.workspaceCards.dialogsLead')}</p>
            <em>
              {dialogs.length} {t('messagesPage.workspaceCards.dialogsSuffix')}
            </em>
          </button>
          <button
            type="button"
            className="dashboard-tool-card dashboard-tool-card--berry dashboard-tool-button"
            onClick={() => {
              refreshNotifications();
              refreshFeed();
              refreshDialogs();
            }}
          >
            <span>{t('messagesPage.workspaceCards.syncLabel')}</span>
            <strong>{t('messagesPage.workspaceCards.syncTitle')}</strong>
            <p>{t('messagesPage.workspaceCards.syncLead')}</p>
            <em>
              {lastRealtimeSyncAt
                ? new Date(lastRealtimeSyncAt).toLocaleTimeString(
                    language === 'uk' ? 'uk-UA' : 'en-US',
                    {
                      hour: '2-digit',
                      minute: '2-digit',
                    },
                  )
                : t('messagesPage.workspaceCards.syncEmpty')}
            </em>
          </button>
        </div>
      </article>

      <article className="card panel-card messages-summary-panel">
        <div className="summary-grid compact-summary-grid">
          <div className="summary-card">
            <span>{t('messagesPage.summary.notificationsUnread')}</span>
            <strong>{unreadNotificationsCount}</strong>
            <p>{t('messagesPage.summary.notificationsUnreadHint')}</p>
          </div>
          <div className="summary-card">
            <span>{t('messagesPage.summary.total')}</span>
            <strong>{announcements.length}</strong>
            <p>{t('messagesPage.summary.totalHint')}</p>
          </div>
          <div className="summary-card">
            <span>{t('messagesPage.summary.pinned')}</span>
            <strong>{pinnedCount}</strong>
            <p>{t('messagesPage.summary.pinnedHint')}</p>
          </div>
          <div className="summary-card">
            <span>{t('messagesPage.summary.active')}</span>
            <strong>{activeCount}</strong>
            <p>{t('messagesPage.summary.activeHint')}</p>
          </div>
          <div className="summary-card">
            <span>{t('messagesPage.summary.dialogsUnread')}</span>
            <strong>{unreadDialogsCount}</strong>
            <p>{t('messagesPage.summary.dialogsUnreadHint')}</p>
          </div>
        </div>
      </article>

      <article id="messages-sections" className="card panel-card messages-tabs-panel">
        <div className="filters-row messages-section-tabs">
          {(['all', 'notifications', 'announcements', 'dialogs'] as MessagesSection[]).map((section) => (
            <button
              key={section}
              type="button"
              className={`filter-button${activeSection === section ? ' active' : ''}`}
              onClick={() => selectMessagesSection(section)}
            >
              {t(`messagesPage.sections.${section}`)}
            </button>
          ))}
        </div>
        <p className="inline-hint">
          {t('messagesPage.realtimeActive')}
          {lastRealtimeSyncAt
            ? ` ${t('messagesPage.lastUpdated')}: ${new Date(lastRealtimeSyncAt).toLocaleTimeString(language === 'uk' ? 'uk-UA' : 'en-US', {
                hour: '2-digit',
                minute: '2-digit',
              })}`
            : ''}
        </p>
      </article>

      {showNotifications ? (
        <article id="messages-notifications" className="card panel-card">
          <div className="messages-controls">
            <div className="messages-controls-text">
              <h2>{t('messagesPage.notifications.title')}</h2>
              <p className="inline-hint">{t('messagesPage.notifications.lead')}</p>
            </div>
            <button
              type="button"
              className="button button-soft announcement-action-btn"
              onClick={refreshNotifications}
            >
              {t('messagesPage.refresh')}
            </button>
          </div>

          <div className="messages-status-slot">
            {notificationsError ? (
              <div className="messages-status-note is-error">
                <p>{notificationsError}</p>
              </div>
            ) : null}
            {!notificationsError && notifications.length === 0 ? (
              <div className="messages-status-note is-empty">
                <p>{t('messagesPage.notifications.empty')}</p>
              </div>
            ) : null}
          </div>

          {notifications.length > 0 ? (
            <div className="announcements-feed">
              {notifications.map((item) => (
                <article
                  key={item.id}
                  id={`notification-${item.id}`}
                  className={`announcement-item${item.isUnread ? ' unread' : ''}${
                    focusedNotificationId === item.id ? ' focused' : ''
                  }`}
                >
                  <div className="announcement-head">
                    <h3>{item.title}</h3>
                    <div className="announcement-tags">
                      {item.isUnread ? (
                        <span className="status-pill">{t('messagesPage.unread')}</span>
                      ) : null}
                      <span className="status-pill">
                        {t(`messagesPage.notifications.types.${item.type}`)}
                      </span>
                    </div>
                  </div>

                  <p className="announcement-body">{item.body}</p>

                  <div className="announcement-meta">
                    <span>
                      {t('messagesPage.notifications.createdAt')}:{' '}
                      {formatDateTime(item.createdAt, language)}
                    </span>
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
        </article>
      ) : null}

      {showAnnouncements ? (
        <>
          {isManager ? (
            <article id="messages-announcements-manage" className="card panel-card">
              <div className="messages-controls">
                <div className="messages-controls-text">
                  <h2>{t('messagesPage.manager.title')}</h2>
                  <p className="inline-hint">{t('messagesPage.manager.lead')}</p>
                </div>
                <div className="filters-row">
                  <label className="checkbox-inline">
                    <input
                      type="checkbox"
                      checked={includeInactive}
                      onChange={(event) => handleIncludeInactiveChange(event.target.checked)}
                    />
                    {t('messagesPage.manager.includeInactive')}
                  </label>
                  <button
                    type="button"
                    className="button button-soft announcement-action-btn"
                    onClick={refreshFeed}
                    disabled={refreshing}
                  >
                    {refreshing ? t('messagesPage.refreshing') : t('messagesPage.refresh')}
                  </button>
                </div>
              </div>

              <form className="panel-form" onSubmit={handleCreate}>
                <label className="field">
                  <span>{t('messagesPage.form.title')}</span>
                  <input
                    value={title}
                    onChange={(event) => setTitle(event.target.value)}
                    maxLength={140}
                  />
                </label>

                <label className="field">
                  <span>{t('messagesPage.form.body')}</span>
                  <textarea
                    value={body}
                    onChange={(event) => setBody(event.target.value)}
                    maxLength={5000}
                  />
                </label>

                <label className="field" htmlFor="announcement-audience-select">
                  <span>{t('messagesPage.form.audience')}</span>
                  <select
                    id="announcement-audience-select"
                    className="select-input"
                    value={audience}
                    disabled={visibility === 'PUBLIC'}
                    onChange={(event) =>
                      setAudience(event.target.value as AnnouncementAudience)
                    }
                  >
                    {ANNOUNCEMENT_AUDIENCES.map((item) => (
                      <option key={item} value={item}>
                        {t(`messagesPage.audience.${item}`)}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="field" htmlFor="announcement-visibility-select">
                  <span>{t('messagesPage.form.visibility')}</span>
                  <select
                    id="announcement-visibility-select"
                    className="select-input"
                    value={visibility}
                    onChange={(event) => {
                      const nextVisibility = event.target.value as AnnouncementVisibility;
                      setVisibility(nextVisibility);
                      if (nextVisibility === 'PUBLIC') {
                        setAudience('ALL');
                      }
                    }}
                  >
                    {ANNOUNCEMENT_VISIBILITIES.map((item) => (
                      <option key={item} value={item}>
                        {t(`messagesPage.visibility.${item}`)}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="field" htmlFor="announcement-tournament-select">
                  <span>{t('messagesPage.form.tournament')}</span>
                  <select
                    id="announcement-tournament-select"
                    className="select-input"
                    value={selectedTournamentId}
                    onChange={(event) => setSelectedTournamentId(event.target.value)}
                  >
                    <option value="">{t('messagesPage.form.platformWide')}</option>
                    {managerTournaments.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.title}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="field">
                  <span>{t('messagesPage.form.link')}</span>
                  <input
                    value={linkUrl}
                    onChange={(event) => setLinkUrl(event.target.value)}
                    placeholder="https://..."
                  />
                </label>

                <div className="announcement-toggles">
                  <label className="checkbox-inline">
                    <input
                      type="checkbox"
                      checked={isPinned}
                      onChange={(event) => setIsPinned(event.target.checked)}
                    />
                    {t('messagesPage.form.isPinned')}
                  </label>
                  <label className="checkbox-inline">
                    <input
                      type="checkbox"
                      checked={isActive}
                      onChange={(event) => setIsActive(event.target.checked)}
                    />
                    {t('messagesPage.form.isActive')}
                  </label>
                </div>

                {managerError ? <p className="form-error">{managerError}</p> : null}
                {notice ? <p className="form-success">{notice}</p> : null}

                <button type="submit" className="button button-primary" disabled={saving}>
                  {saving ? t('messagesPage.form.saving') : t('messagesPage.form.submit')}
                </button>
              </form>
            </article>
          ) : (
            <article id="messages-announcements-view" className="card panel-card">
              <div className="state-callout featured">
                <strong>{t('messagesPage.viewer.title')}</strong>
                <p>{t('messagesPage.viewer.lead')}</p>
              </div>
              <button
                type="button"
                className="button button-soft announcement-action-btn"
                onClick={refreshFeed}
                disabled={refreshing}
              >
                {refreshing ? t('messagesPage.refreshing') : t('messagesPage.refresh')}
              </button>
            </article>
          )}

          <article id="messages-announcements-feed" className="card panel-card">
            <h2>{t('messagesPage.feedTitle')}</h2>
            {error ? <p className="form-error">{error}</p> : null}
            {refreshing ? <p>{t('messagesPage.refreshing')}</p> : null}
            {!refreshing && announcements.length === 0 ? (
              <div className="state-callout featured">
                <strong>{t('messagesPage.feedTitle')}</strong>
                <p>{t('messagesPage.empty')}</p>
              </div>
            ) : null}

            {announcements.length > 0 ? (
              <div className="announcements-feed">
                {announcements.map((item) => (
                  <article
                    key={item.id}
                    id={`announcement-${item.id}`}
                    className={`announcement-item${item.isActive ? '' : ' inactive'}${
                      item.isUnread ? ' unread' : ''
                    }${
                      focusedAnnouncementId === item.id ? ' focused' : ''
                    }`}
                  >
                    <div className="announcement-head">
                      <h3>{item.title}</h3>
                      <div className="announcement-tags">
                        {item.isUnread ? (
                          <span className="status-pill">{t('messagesPage.unread')}</span>
                        ) : null}
                        <span className="status-pill">{t(`messagesPage.audience.${item.audience}`)}</span>
                        <span className="status-pill">
                          {t(`messagesPage.visibility.${item.visibility}`)}
                        </span>
                        <span className="status-pill">
                          {item.tournamentId
                            ? tournamentLabelById.get(item.tournamentId) ?? t('messagesPage.tags.tournament')
                            : t('messagesPage.tags.platform')}
                        </span>
                        {item.isPinned ? (
                          <span className="status-pill">{t('messagesPage.tags.pinned')}</span>
                        ) : null}
                        {!item.isActive ? (
                          <span className="status-pill announcement-status-off">
                            {t('messagesPage.tags.inactive')}
                          </span>
                        ) : null}
                      </div>
                    </div>

                    <p className="announcement-body">{item.body}</p>

                    <div className="announcement-meta">
                      <span>
                        {t('messagesPage.publishedAt')}: {formatDateTime(item.publishedAt, language)}
                      </span>
                      <span>
                        {t('messagesPage.updatedAt')}: {formatDateTime(item.updatedAt, language)}
                      </span>
                      {item.linkUrl ? (
                        <a href={item.linkUrl} target="_blank" rel="noreferrer">
                          {t('messagesPage.openLink')}
                        </a>
                      ) : null}
                    </div>

                    {isManager ? (
                      <div className="announcement-actions">
                        <button
                          type="button"
                          className="button button-soft announcement-action-btn"
                          onClick={() => void togglePinned(item)}
                          disabled={pendingActionId === item.id}
                        >
                          {item.isPinned
                            ? t('messagesPage.actions.unpin')
                            : t('messagesPage.actions.pin')}
                        </button>
                        <button
                          type="button"
                          className="button button-soft announcement-action-btn"
                          onClick={() => void toggleActive(item)}
                          disabled={pendingActionId === item.id}
                        >
                          {item.isActive
                            ? t('messagesPage.actions.deactivate')
                            : t('messagesPage.actions.activate')}
                        </button>
                      </div>
                    ) : null}
                  </article>
                ))}
              </div>
            ) : null}
          </article>
        </>
      ) : null}

      {showDialogs ? (
        <article id="messages-dialogs" className="card panel-card">
        <div className="messages-controls">
          <div className="messages-controls-text">
            <h2>{t('messagesPage.dialogs.title')}</h2>
            <p className="inline-hint">{t('messagesPage.dialogs.lead')}</p>
          </div>
          <button
            type="button"
            className="button button-soft announcement-action-btn"
            onClick={refreshDialogs}
            disabled={dialogsLoading}
          >
            {dialogsLoading ? t('messagesPage.refreshing') : t('messagesPage.refresh')}
          </button>
        </div>

        <form className="panel-form messages-new-dialog-form" onSubmit={handleCreateDialog}>
          <label className="field">
            <span>{t('messagesPage.dialogs.recipientEmail')}</span>
            <input
              type="email"
              value={newDialogEmail}
              onChange={(event) => setNewDialogEmail(event.target.value)}
              placeholder="user@example.com"
            />
          </label>
          <button
            type="submit"
            className="button button-soft announcement-action-btn"
            disabled={dialogActionLoading}
          >
            {t('messagesPage.dialogs.start')}
          </button>
        </form>

        {dialogsError ? <p className="form-error">{dialogsError}</p> : null}
        {dialogMessagesError ? <p className="form-error">{dialogMessagesError}</p> : null}
        {dialogNotice ? <p className="form-success">{dialogNotice}</p> : null}

        <div className="messages-dialogs-layout">
          <div className="messages-dialog-list">
            {dialogs.length === 0 ? (
              <div className="state-callout featured">
                <strong>{t('messagesPage.dialogs.title')}</strong>
                <p>{t('messagesPage.dialogs.empty')}</p>
              </div>
            ) : (
              dialogs.map((dialog) => (
                <button
                  key={dialog.id}
                  type="button"
                  className={`messages-dialog-item${
                    dialog.id === selectedDialogId ? ' active' : ''
                  }`}
                  onClick={() => setSelectedDialogId(dialog.id)}
                >
                  <span className="messages-dialog-avatar" aria-hidden>
                    {initialsFromName(dialog.otherUser.fullName)}
                  </span>
                  <div className="messages-dialog-body">
                    <div className="messages-dialog-topline">
                      <strong>{dialog.otherUser.fullName}</strong>
                      {dialog.isUnread ? (
                        <span className="messages-dialog-unread">{t('messagesPage.unread')}</span>
                      ) : null}
                    </div>
                    <div className="messages-dialog-meta">
                      <span>{dialog.otherUser.email}</span>
                      <span className="messages-dialog-role">
                        {t(`profile.role.${dialog.otherUser.role}`)}
                      </span>
                    </div>
                    <p>
                      {dialog.lastMessage
                        ? dialog.lastMessage.body
                        : t('messagesPage.dialogs.noMessages')}
                    </p>
                    <span className="messages-dialog-time">
                      {formatDateTime(dialog.updatedAt, language)}
                    </span>
                  </div>
                </button>
              ))
            )}
          </div>

          <div className="messages-dialog-thread">
            {!selectedDialog ? (
              <div className="state-callout featured">
                <strong>{t('messagesPage.dialogs.title')}</strong>
                <p>{t('messagesPage.dialogs.pickDialog')}</p>
              </div>
            ) : (
              <>
                <header className="messages-thread-head">
                  <span className="messages-thread-avatar" aria-hidden>
                    {initialsFromName(selectedDialog.otherUser.fullName)}
                  </span>
                  <div className="messages-thread-head-copy">
                    <strong>{selectedDialog.otherUser.fullName}</strong>
                    <span>{selectedDialog.otherUser.email}</span>
                  </div>
                  <span className="messages-dialog-role">
                    {t(`profile.role.${selectedDialog.otherUser.role}`)}
                  </span>
                </header>

                {dialogMessagesLoading ? (
                  <QuietLoadingInline label={t('messagesPage.dialogs.loadingMessages')} compact />
                ) : (
                  <div className="messages-thread-feed">
                    {dialogMessages.length === 0 ? (
                      <div className="state-callout subtle">
                        <strong>{t('messagesPage.dialogs.title')}</strong>
                        <p>{t('messagesPage.dialogs.noMessages')}</p>
                      </div>
                    ) : (
                      dialogMessages.map((item) => (
                        <article
                          key={item.id}
                          className={`messages-thread-item${
                            item.senderId === me?.id ? ' mine' : ''
                          }`}
                        >
                          <p>{item.body}</p>
                          <span>{formatDateTime(item.createdAt, language)}</span>
                        </article>
                      ))
                    )}
                  </div>
                )}

                <form className="panel-form messages-thread-form" onSubmit={handleSendMessage}>
                  <label className="field messages-composer-field">
                    <span className="visually-hidden">{t('messagesPage.dialogs.message')}</span>
                    <textarea
                      value={newMessageBody}
                      onChange={(event) => setNewMessageBody(event.target.value)}
                      maxLength={2000}
                      placeholder={t('messagesPage.dialogs.message')}
                    />
                  </label>
                  <button
                    type="submit"
                    className="button button-primary messages-thread-send"
                    aria-label={t('messagesPage.dialogs.send')}
                    title={t('messagesPage.dialogs.send')}
                    disabled={dialogActionLoading || !selectedDialogId}
                  >
                    <svg viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden>
                      <path
                        d="M3.4 10.2L16.2 4.4L13.6 16.1L9.3 12.2M3.4 10.2L9.3 12.2M3.4 10.2L16.2 4.4L9.3 12.2"
                        stroke="currentColor"
                        strokeWidth="1.7"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                    <span className="visually-hidden">{t('messagesPage.dialogs.send')}</span>
                  </button>
                </form>
              </>
            )}
          </div>
        </div>
        </article>
      ) : null}
    </section>
  );
}
