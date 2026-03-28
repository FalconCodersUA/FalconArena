import { FormEvent, useEffect, useMemo, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { apiRequest } from '../lib/api';
import { formatDateTime } from '../lib/dateTime';
import { useI18n } from '../i18n/I18nProvider';

type UserRole = 'ADMIN' | 'TEAM' | 'JURY' | 'ORGANIZER';
type AnnouncementAudience = 'ALL' | 'TEAM' | 'JURY' | 'ADMIN' | 'ORGANIZER';

type AuthMe = {
  id: string;
  email: string;
  fullName: string;
  role: UserRole;
};

type Announcement = {
  id: string;
  title: string;
  body: string;
  audience: AnnouncementAudience;
  linkUrl: string | null;
  isPinned: boolean;
  isActive: boolean;
  publishedAt: string;
  createdAt: string;
  updatedAt: string;
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

export default function MessagesPage() {
  const { language, t } = useI18n();
  const location = useLocation();

  const [me, setMe] = useState<AuthMe | null>(null);
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [managerError, setManagerError] = useState('');
  const [pendingActionId, setPendingActionId] = useState('');

  const [includeInactive, setIncludeInactive] = useState(false);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [audience, setAudience] = useState<AnnouncementAudience>('ALL');
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
  const [focusedAnnouncementId, setFocusedAnnouncementId] = useState('');

  const isManager = isManagerRole(me?.role);
  const pinnedCount = useMemo(
    () => announcements.filter((item) => item.isPinned).length,
    [announcements],
  );
  const activeCount = useMemo(
    () => announcements.filter((item) => item.isActive).length,
    [announcements],
  );
  const selectedDialog = useMemo(
    () => dialogs.find((item) => item.id === selectedDialogId) ?? null,
    [dialogs, selectedDialogId],
  );
  const requestedAnnouncementId = useMemo(() => {
    const query = new URLSearchParams(location.search);
    return query.get('announcement') ?? '';
  }, [location.search]);

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
      const data = await apiRequest<Announcement[]>(
        announcementsPath(role, includeInactiveValue),
      );
      if (!includeInactiveValue) {
        await markAnnouncementsRead(data);
        setAnnouncements(data.map((item) => ({ ...item, isUnread: false })));
      } else {
        setAnnouncements(data);
      }
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : t('messagesPage.loadFailed'));
    } finally {
      if (showRefreshing) {
        setRefreshing(false);
      }
    }
  }

  async function loadDialogs(showLoading: boolean) {
    if (showLoading) {
      setDialogsLoading(true);
    }
    setDialogsError('');

    try {
      const data = await apiRequest<DialogListItem[]>('/messages/dialogs');
      setDialogs(data);

      if (data.length === 0) {
        setSelectedDialogId('');
        setDialogMessages([]);
        setDialogMessagesError('');
        return;
      }

      setSelectedDialogId((current) => current || data[0].id);
    } catch (requestError) {
      setDialogsError(
        requestError instanceof Error ? requestError.message : t('messagesPage.dialogs.loadFailed'),
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
    } catch (requestError) {
      setDialogMessagesError(
        requestError instanceof Error
          ? requestError.message
          : t('messagesPage.dialogs.messagesLoadFailed'),
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
      await loadAnnouncements(meData.role, false, false);
      await loadDialogs(false);
    } catch (requestError) {
      setAnnouncements([]);
      setMe(null);
      setDialogs([]);
      setSelectedDialogId('');
      setDialogMessages([]);
      setError(requestError instanceof Error ? requestError.message : t('messagesPage.loadFailed'));
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

  function refreshFeed() {
    if (!me) {
      return;
    }

    void loadAnnouncements(me.role, includeInactive, true);
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

    setSaving(true);
    setManagerError('');
    setNotice('');

    try {
      const payload: {
        title: string;
        body: string;
        audience: AnnouncementAudience;
        isPinned: boolean;
        isActive: boolean;
        linkUrl?: string;
      } = {
        title: trimmedTitle,
        body: trimmedBody,
        audience,
        isPinned,
        isActive,
      };

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
      setIsPinned(false);
      setIsActive(true);
      setNotice(t('messagesPage.created'));

      if (me) {
        await loadAnnouncements(me.role, includeInactive, false);
      }
    } catch (requestError) {
      setManagerError(requestError instanceof Error ? requestError.message : t('messagesPage.saveFailed'));
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
      setManagerError(requestError instanceof Error ? requestError.message : t('messagesPage.saveFailed'));
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
      setManagerError(requestError instanceof Error ? requestError.message : t('messagesPage.saveFailed'));
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
        requestError instanceof Error
          ? requestError.message
          : t('messagesPage.dialogs.createFailed'),
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
      setDialogs((current) =>
        current.map((dialog) =>
          dialog.id === selectedDialogId
            ? { ...dialog, lastMessage: message, updatedAt: message.createdAt }
            : dialog,
        ),
      );
      setNewMessageBody('');
      setDialogNotice(t('messagesPage.dialogs.sent'));
    } catch (requestError) {
      setDialogMessagesError(
        requestError instanceof Error
          ? requestError.message
          : t('messagesPage.dialogs.sendFailed'),
      );
    } finally {
      setDialogActionLoading(false);
    }
  }

  if (loading) {
    return <article className="card state-card">{t('messagesPage.loading')}</article>;
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

      <article className="card panel-card">
        <div className="summary-grid compact-summary-grid">
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
        </div>
      </article>

      {isManager ? (
        <article className="card panel-card">
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
        <article className="card panel-card">
          <div className="state-callout subtle">
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

      <article className="card panel-card">
        <h2>{t('messagesPage.feedTitle')}</h2>
        {error ? <p className="form-error">{error}</p> : null}
        {refreshing ? <p>{t('messagesPage.refreshing')}</p> : null}
        {!refreshing && announcements.length === 0 ? <p>{t('messagesPage.empty')}</p> : null}

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

      <article className="card panel-card">
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
              <p>{t('messagesPage.dialogs.empty')}</p>
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
                  <strong>{dialog.otherUser.fullName}</strong>
                  <span>{dialog.otherUser.email}</span>
                  <span className="messages-dialog-role">
                    {t(`profile.role.${dialog.otherUser.role}`)}
                  </span>
                  <p>
                    {dialog.lastMessage
                      ? dialog.lastMessage.body
                      : t('messagesPage.dialogs.noMessages')}
                  </p>
                </button>
              ))
            )}
          </div>

          <div className="messages-dialog-thread">
            {!selectedDialog ? (
              <p>{t('messagesPage.dialogs.pickDialog')}</p>
            ) : (
              <>
                <header className="messages-thread-head">
                  <strong>{selectedDialog.otherUser.fullName}</strong>
                  <span>{selectedDialog.otherUser.email}</span>
                </header>

                {dialogMessagesLoading ? (
                  <p>{t('messagesPage.dialogs.loadingMessages')}</p>
                ) : (
                  <div className="messages-thread-feed">
                    {dialogMessages.length === 0 ? (
                      <p>{t('messagesPage.dialogs.noMessages')}</p>
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
                  <label className="field">
                    <span>{t('messagesPage.dialogs.message')}</span>
                    <textarea
                      value={newMessageBody}
                      onChange={(event) => setNewMessageBody(event.target.value)}
                      maxLength={2000}
                    />
                  </label>
                  <button
                    type="submit"
                    className="button button-primary"
                    disabled={dialogActionLoading || !selectedDialogId}
                  >
                    {t('messagesPage.dialogs.send')}
                  </button>
                </form>
              </>
            )}
          </div>
        </div>
      </article>
    </section>
  );
}
