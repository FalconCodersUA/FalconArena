import { useCallback, useEffect, useMemo, useState } from 'react';
import { apiRequest, buildApiUrl } from '../lib/api';
import { formatDateTime } from '../lib/dateTime';
import { getAuthUser, getToken, type AuthRole } from '../lib/auth';
import { useI18n } from '../i18n/I18nProvider';

type ManagedUser = {
  id: string;
  email: string;
  fullName: string;
  role: AuthRole;
  isBlocked: boolean;
  createdAt: string;
  updatedAt: string;
};

type UserStatusFilter = 'ALL' | 'ACTIVE' | 'BLOCKED';

const MANAGEABLE_ROLES: AuthRole[] = ['ADMIN', 'TEAM', 'JURY', 'ORGANIZER'];

function resolveExportFilename(contentDisposition: string | null) {
  const match = contentDisposition?.match(/filename="?([^"]+)"?/i);
  return match?.[1] ?? 'users-export.csv';
}

export default function AdminUsersPage() {
  const { language, t } = useI18n();
  const [users, setUsers] = useState<ManagedUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState<'ALL' | AuthRole>('ALL');
  const [statusFilter, setStatusFilter] = useState<UserStatusFilter>('ALL');
  const [draftRoles, setDraftRoles] = useState<Record<string, AuthRole>>({});
  const [savingRoleUserId, setSavingRoleUserId] = useState('');
  const [togglingBlockUserId, setTogglingBlockUserId] = useState('');
  const [exportingCsv, setExportingCsv] = useState(false);

  const currentUserId = getAuthUser()?.id ?? '';

  const loadUsers = useCallback(async (showLoading = true) => {
    if (showLoading) {
      setLoading(true);
    }
    setError('');

    try {
      const data = await apiRequest<ManagedUser[]>('/admin/users');
      setUsers(data);
      setDraftRoles(
        data.reduce<Record<string, AuthRole>>((accumulator, item) => {
          accumulator[item.id] = item.role;
          return accumulator;
        }, {}),
      );
    } catch (requestError) {
      setError(
        requestError instanceof Error ? requestError.message : t('adminDashboard.adminUsers.loadFailed'),
      );
    } finally {
      if (showLoading) {
        setLoading(false);
      }
    }
  }, [t]);

  useEffect(() => {
    void loadUsers();
  }, [loadUsers]);

  const filteredUsers = useMemo(() => {
    const normalizedQuery = searchQuery.trim().toLowerCase();

    return users.filter((item) => {
      const matchesQuery =
        !normalizedQuery ||
        item.fullName.toLowerCase().includes(normalizedQuery) ||
        item.email.toLowerCase().includes(normalizedQuery);

      const matchesRole = roleFilter === 'ALL' || item.role === roleFilter;
      const matchesStatus =
        statusFilter === 'ALL' ||
        (statusFilter === 'ACTIVE' && !item.isBlocked) ||
        (statusFilter === 'BLOCKED' && item.isBlocked);

      return matchesQuery && matchesRole && matchesStatus;
    });
  }, [roleFilter, searchQuery, statusFilter, users]);

  const activeUsersCount = useMemo(
    () => users.filter((item) => !item.isBlocked).length,
    [users],
  );
  const blockedUsersCount = useMemo(
    () => users.filter((item) => item.isBlocked).length,
    [users],
  );
  const adminUsersCount = useMemo(
    () => users.filter((item) => item.role === 'ADMIN').length,
    [users],
  );

  async function exportUsersCsv() {
    setExportingCsv(true);
    setError('');
    setNotice('');

    try {
      const params = new URLSearchParams();
      const normalizedQuery = searchQuery.trim();
      const token = getToken();

      if (normalizedQuery) {
        params.set('search', normalizedQuery);
      }
      if (roleFilter !== 'ALL') {
        params.set('role', roleFilter);
      }
      if (statusFilter !== 'ALL') {
        params.set('status', statusFilter);
      }

      const query = params.toString();
      const response = await fetch(
        buildApiUrl(`/admin/users/export.csv${query ? `?${query}` : ''}`),
        {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        },
      );

      if (!response.ok) {
        throw new Error(t('adminDashboard.adminUsers.exportFailed'));
      }

      const blob = await response.blob();
      const downloadUrl = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = downloadUrl;
      anchor.download = resolveExportFilename(
        response.headers.get('Content-Disposition'),
      );
      document.body.append(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(downloadUrl);
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : t('adminDashboard.adminUsers.exportFailed'),
      );
    } finally {
      setExportingCsv(false);
    }
  }

  async function saveRole(user: ManagedUser) {
    const nextRole = draftRoles[user.id] ?? user.role;

    if (nextRole === user.role) {
      return;
    }

    setSavingRoleUserId(user.id);
    setError('');
    setNotice('');

    try {
      const updated = await apiRequest<ManagedUser>(`/admin/users/${user.id}`, {
        method: 'PATCH',
        body: { role: nextRole },
      });

      setUsers((current) =>
        current.map((entry) => (entry.id === user.id ? updated : entry)),
      );
      setDraftRoles((current) => ({ ...current, [user.id]: updated.role }));
      setNotice(
        t('adminDashboard.adminUsers.roleUpdated').replace('{name}', updated.fullName),
      );
    } catch (requestError) {
      setError(
        requestError instanceof Error ? requestError.message : t('adminDashboard.adminUsers.updateFailed'),
      );
    } finally {
      setSavingRoleUserId('');
    }
  }

  async function toggleBlocked(user: ManagedUser) {
    setTogglingBlockUserId(user.id);
    setError('');
    setNotice('');

    try {
      const updated = await apiRequest<ManagedUser>(`/admin/users/${user.id}`, {
        method: 'PATCH',
        body: { isBlocked: !user.isBlocked },
      });

      setUsers((current) =>
        current.map((entry) => (entry.id === user.id ? updated : entry)),
      );
      setDraftRoles((current) => ({ ...current, [user.id]: updated.role }));
      setNotice(
        updated.isBlocked
          ? t('adminDashboard.adminUsers.blocked').replace('{name}', updated.fullName)
          : t('adminDashboard.adminUsers.unblocked').replace('{name}', updated.fullName),
      );
    } catch (requestError) {
      setError(
        requestError instanceof Error ? requestError.message : t('adminDashboard.adminUsers.updateFailed'),
      );
    } finally {
      setTogglingBlockUserId('');
    }
  }

  if (loading) {
    return <article className="card state-card">{t('adminDashboard.adminUsers.loading')}</article>;
  }

  return (
    <section className="team-dashboard app-page admin-users-page">
      <header className="section-header">
        <p className="eyebrow">{t('adminDashboard.adminUsers.eyebrow')}</p>
        <h1>{t('adminDashboard.adminUsers.title')}</h1>
        <p className="lead">{t('adminDashboard.adminUsers.lead')}</p>
      </header>

      <article className="card panel-card admin-users-workspace-card">
        <div className="admin-users-workspace-head">
          <div className="admin-users-workspace-copy">
            <p className="eyebrow dashboard-workspace-eyebrow">{t('adminDashboard.adminUsers.workspaceEyebrow')}</p>
            <h2>{t('adminDashboard.adminUsers.workspaceTitle')}</h2>
            <p>{t('adminDashboard.adminUsers.workspaceLead')}</p>
          </div>
          <div className="dashboard-workspace-status admin-users-workspace-status">
            <span>{t('adminDashboard.adminUsers.workspaceStatusLabel')}</span>
            <strong>{users.length}</strong>
            <p>{t('adminDashboard.adminUsers.workspaceStatusLead')}</p>
          </div>
        </div>

        <div className="summary-grid compact-summary-grid admin-users-summary-grid">
          <div className="summary-card dashboard-tool-card dashboard-tool-card--teal">
            <span>{t('adminDashboard.adminUsers.summary.total')}</span>
            <strong>{users.length}</strong>
            <p>{t('adminDashboard.adminUsers.summary.totalLead')}</p>
          </div>
          <div className="summary-card dashboard-tool-card dashboard-tool-card--purple">
            <span>{t('adminDashboard.adminUsers.summary.active')}</span>
            <strong>{activeUsersCount}</strong>
            <p>{t('adminDashboard.adminUsers.summary.activeLead')}</p>
          </div>
          <div className="summary-card dashboard-tool-card dashboard-tool-card--orange">
            <span>{t('adminDashboard.adminUsers.summary.blocked')}</span>
            <strong>{blockedUsersCount}</strong>
            <p>{t('adminDashboard.adminUsers.summary.blockedLead')}</p>
          </div>
          <div className="summary-card dashboard-tool-card dashboard-tool-card--berry">
            <span>{t('adminDashboard.adminUsers.summary.admins')}</span>
            <strong>{adminUsersCount}</strong>
            <p>{t('adminDashboard.adminUsers.summary.adminsLead')}</p>
          </div>
        </div>
      </article>

      <article className="card panel-card admin-users-controls">
        <div className="admin-users-filters">
          <label className="field">
            <span>{t('adminDashboard.adminUsers.filters.search')}</span>
            <input
              type="search"
              value={searchQuery}
              placeholder={t('adminDashboard.adminUsers.filters.searchPlaceholder')}
              onChange={(event) => setSearchQuery(event.target.value)}
            />
          </label>

          <label className="field">
            <span>{t('adminDashboard.adminUsers.filters.role')}</span>
            <select
              className="select-input"
              value={roleFilter}
              onChange={(event) => setRoleFilter(event.target.value as 'ALL' | AuthRole)}
            >
              <option value="ALL">{t('adminDashboard.adminUsers.filters.allRoles')}</option>
              {MANAGEABLE_ROLES.map((role) => (
                <option key={role} value={role}>
                  {t(`profile.role.${role}`)}
                </option>
              ))}
            </select>
          </label>

          <label className="field">
            <span>{t('adminDashboard.adminUsers.filters.status')}</span>
            <select
              className="select-input"
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value as UserStatusFilter)}
            >
              <option value="ALL">{t('adminDashboard.adminUsers.filters.allStatuses')}</option>
              <option value="ACTIVE">{t('adminDashboard.adminUsers.status.active')}</option>
              <option value="BLOCKED">{t('adminDashboard.adminUsers.status.blocked')}</option>
            </select>
          </label>

          <button
            type="button"
            className="button button-soft admin-users-refresh"
            onClick={() => void loadUsers(false)}
          >
            {t('adminDashboard.adminUsers.refresh')}
          </button>
        </div>

        {error ? <p className="form-error">{error}</p> : null}
        {notice ? <p className="form-success">{notice}</p> : null}
      </article>

      <article className="card panel-card admin-users-list-panel">
        <div className="admin-users-list-head">
          <div className="admin-users-list-copy">
            <h2>{t('adminDashboard.adminUsers.listTitle')}</h2>
            <p>{t('adminDashboard.adminUsers.listLead')}</p>
          </div>
          <button
            type="button"
            className="button button-soft admin-users-export"
            disabled={exportingCsv}
            onClick={() => void exportUsersCsv()}
          >
            {exportingCsv
              ? t('adminDashboard.adminUsers.exportingCsv')
              : t('adminDashboard.adminUsers.exportCsv')}
          </button>
        </div>

        {filteredUsers.length === 0 ? (
          <div className="state-callout featured">
            <strong>{t('adminDashboard.adminUsers.emptyTitle')}</strong>
            <p>{t('adminDashboard.adminUsers.emptyLead')}</p>
          </div>
        ) : (
          <div className="admin-users-list">
            {filteredUsers.map((user) => {
              const isSelf = user.id === currentUserId;
              const draftRole = draftRoles[user.id] ?? user.role;

              return (
                <article key={user.id} className={`admin-user-card${user.isBlocked ? ' is-blocked' : ''}`}>
                  <div className="admin-user-card-head">
                    <div>
                      <strong>{user.fullName}</strong>
                      <p>{user.email}</p>
                    </div>
                    <div className="admin-user-card-meta">
                      <span className={`status-pill${user.isBlocked ? ' is-blocked' : ''}`}>
                        {user.isBlocked ? t('adminDashboard.adminUsers.status.blocked') : t('adminDashboard.adminUsers.status.active')}
                      </span>
                      {isSelf ? <span className="inline-hint">{t('adminDashboard.adminUsers.selfLabel')}</span> : null}
                    </div>
                  </div>

                  <div className="admin-user-card-grid">
                    <div className="admin-user-card-stat">
                      <span>{t('adminDashboard.adminUsers.fields.role')}</span>
                      <strong>{t(`profile.role.${user.role}`)}</strong>
                    </div>
                    <div className="admin-user-card-stat">
                      <span>{t('adminDashboard.adminUsers.fields.createdAt')}</span>
                      <strong>{formatDateTime(user.createdAt, language)}</strong>
                    </div>
                    <div className="admin-user-card-stat">
                      <span>{t('adminDashboard.adminUsers.fields.updatedAt')}</span>
                      <strong>{formatDateTime(user.updatedAt, language)}</strong>
                    </div>
                  </div>

                  <div className="admin-user-card-actions">
                    <label className="field">
                      <span>{t('adminDashboard.adminUsers.fields.newRole')}</span>
                      <select
                        className="select-input"
                        value={draftRole}
                        disabled={isSelf || user.isBlocked}
                        onChange={(event) =>
                          setDraftRoles((current) => ({
                            ...current,
                            [user.id]: event.target.value as AuthRole,
                          }))
                        }
                      >
                        {MANAGEABLE_ROLES.map((role) => (
                          <option key={role} value={role}>
                            {t(`profile.role.${role}`)}
                          </option>
                        ))}
                      </select>
                    </label>

                    <button
                      type="button"
                      className="button button-soft admin-user-action admin-user-action--save"
                      disabled={isSelf || user.isBlocked || draftRole === user.role || savingRoleUserId === user.id}
                      onClick={() => void saveRole(user)}
                    >
                      {savingRoleUserId === user.id ? t('adminDashboard.adminUsers.saving') : t('adminDashboard.adminUsers.saveRole')}
                    </button>

                    <button
                      type="button"
                      className={`button admin-user-action ${
                        user.isBlocked ? 'admin-user-action--unblock' : 'admin-user-action--block'
                      }`}
                      disabled={isSelf || togglingBlockUserId === user.id}
                      onClick={() => void toggleBlocked(user)}
                    >
                      {togglingBlockUserId === user.id
                        ? t('adminDashboard.adminUsers.updating')
                        : user.isBlocked
                          ? t('adminDashboard.adminUsers.unblockAction')
                          : t('adminDashboard.adminUsers.blockAction')}
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </article>
    </section>
  );
}
