import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import QuietLoadingCard from '../components/QuietLoadingCard';
import { apiRequest, buildApiUrl } from '../lib/api';
import { formatDateTime } from '../lib/dateTime';
import { normalizeApiErrorMessage } from '../lib/errorMessages';
import { getAuthUser, getToken, type AuthRole } from '../lib/auth';
import { useAutoDismissMessage } from '../lib/useAutoDismissMessage';
import { useI18n } from '../i18n/I18nProvider';

type ManagedUser = {
  id: string;
  email: string;
  fullName: string;
  role: AuthRole;
  isBlocked: boolean;
  blockedReason: string | null;
  blockedAt: string | null;
  blockedByUserId: string | null;
  blockedByUserName: string | null;
  createdAt: string;
  updatedAt: string;
};

type UserStatusFilter = 'ALL' | 'ACTIVE' | 'BLOCKED';

type CreatedUser = {
  id: string;
  email: string;
  fullName: string;
  role: AuthRole;
  createdAt: string;
};

const MANAGEABLE_ROLES: AuthRole[] = ['ADMIN', 'TEAM', 'JURY', 'ORGANIZER'];

function resolveExportFilename(contentDisposition: string | null) {
  const match = contentDisposition?.match(/filename="?([^"]+)"?/i);
  return match?.[1] ?? 'users-export.csv';
}

function isValidEmail(value: string) {
  return /^\S+@\S+\.\S+$/.test(value);
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
  const [createUserOpen, setCreateUserOpen] = useState(false);
  const [createUserLoading, setCreateUserLoading] = useState(false);
  const [createUserError, setCreateUserError] = useState('');
  const [userFullName, setUserFullName] = useState('');
  const [userEmail, setUserEmail] = useState('');
  const [userPassword, setUserPassword] = useState('');
  const [userRole, setUserRole] = useState<AuthRole>('JURY');
  const [blockUserTarget, setBlockUserTarget] = useState<ManagedUser | null>(null);
  const [blockReason, setBlockReason] = useState('');
  const [blockReasonError, setBlockReasonError] = useState('');
  const [resetPasswordTarget, setResetPasswordTarget] = useState<ManagedUser | null>(null);
  const [resetPassword, setResetPassword] = useState('');
  const [resetPasswordError, setResetPasswordError] = useState('');

  useAutoDismissMessage(notice, setNotice);
  const [resettingPasswordUserId, setResettingPasswordUserId] = useState('');

  const currentUser = getAuthUser();
  const currentUserId = currentUser?.id ?? '';
  const currentUserEmail = currentUser?.email.trim().toLowerCase() ?? '';
  const canResetPasswords = currentUser?.role === 'ADMIN';
  const creatableRoles =
    currentUser?.role === 'ADMIN'
      ? MANAGEABLE_ROLES
      : MANAGEABLE_ROLES.filter((role) => role !== 'ADMIN');

  function closeCreateUserModal() {
    setCreateUserOpen(false);
    setCreateUserError('');
    setUserFullName('');
    setUserEmail('');
    setUserPassword('');
    setUserRole(creatableRoles[0] ?? 'JURY');
  }

  function closeBlockUserModal() {
    setBlockUserTarget(null);
    setBlockReason('');
    setBlockReasonError('');
  }

  function closeResetPasswordModal() {
    setResetPasswordTarget(null);
    setResetPassword('');
    setResetPasswordError('');
  }

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
        normalizeApiErrorMessage(requestError, t, t('adminDashboard.adminUsers.loadFailed')),
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
  const usersByRoleSummary = useMemo(
    () =>
      MANAGEABLE_ROLES
        .map((role) => ({
          role,
          count: users.filter((item) => item.role === role).length,
        }))
        .filter((item) => item.count > 0),
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
        normalizeApiErrorMessage(requestError, t, t('adminDashboard.adminUsers.exportFailed')),
      );
    } finally {
      setExportingCsv(false);
    }
  }

  async function submitUser(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setCreateUserError('');
    setError('');
    setNotice('');

    const trimmedFullName = userFullName.trim();
    const trimmedEmail = userEmail.trim().toLowerCase();

    if (trimmedFullName.length < 2 || trimmedFullName.length > 80) {
      setCreateUserError(t('adminDashboard.validation.userFullName'));
      return;
    }

    if (!trimmedEmail || !isValidEmail(trimmedEmail)) {
      setCreateUserError(t('adminDashboard.validation.userEmail'));
      return;
    }

    if (trimmedEmail === currentUserEmail) {
      setCreateUserError(t('adminDashboard.validation.userEmailNotSelf'));
      return;
    }

    if (userPassword.length < 8 || userPassword.length > 128) {
      setCreateUserError(t('adminDashboard.validation.userPassword'));
      return;
    }

    if (!creatableRoles.includes(userRole)) {
      setCreateUserError(t('adminDashboard.validation.userRole'));
      return;
    }

    setCreateUserLoading(true);

    try {
      const created = await apiRequest<CreatedUser>('/auth/admin/users', {
        method: 'POST',
        body: {
          fullName: trimmedFullName,
          email: trimmedEmail,
          password: userPassword,
          role: userRole,
        },
      });

      const nextUser: ManagedUser = {
        ...created,
        isBlocked: false,
        blockedReason: null,
        blockedAt: null,
        blockedByUserId: null,
        blockedByUserName: null,
        updatedAt: created.createdAt,
      };

      setUsers((current) => [nextUser, ...current]);
      setDraftRoles((current) => ({ [nextUser.id]: nextUser.role, ...current }));
      setNotice(
        t('adminDashboard.createUserSuccess').replace(
          '{role}',
          t(`profile.role.${created.role}`),
        ),
      );
      closeCreateUserModal();
    } catch (requestError) {
      setCreateUserError(
        normalizeApiErrorMessage(requestError, t, t('adminDashboard.createUserFailed')),
      );
    } finally {
      setCreateUserLoading(false);
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
        normalizeApiErrorMessage(requestError, t, t('adminDashboard.adminUsers.updateFailed')),
      );
    } finally {
      setSavingRoleUserId('');
    }
  }

  async function blockUser() {
    if (!blockUserTarget) {
      return;
    }

    const trimmedReason = blockReason.trim();
    if (!trimmedReason) {
      setBlockReasonError(t('adminDashboard.validation.blockReasonRequired'));
      return;
    }

    if (trimmedReason.length > 300) {
      setBlockReasonError(t('adminDashboard.validation.blockReasonLength'));
      return;
    }

    setBlockReasonError('');
    setTogglingBlockUserId(blockUserTarget.id);
    setError('');
    setNotice('');

    try {
      const updated = await apiRequest<ManagedUser>(`/admin/users/${blockUserTarget.id}`, {
        method: 'PATCH',
        body: { isBlocked: true, blockedReason: trimmedReason },
      });

      setUsers((current) =>
        current.map((entry) => (entry.id === blockUserTarget.id ? updated : entry)),
      );
      setDraftRoles((current) => ({ ...current, [blockUserTarget.id]: updated.role }));
      setNotice(
        t('adminDashboard.adminUsers.blocked').replace('{name}', updated.fullName),
      );
      closeBlockUserModal();
    } catch (requestError) {
      setBlockReasonError(
        normalizeApiErrorMessage(requestError, t, t('adminDashboard.adminUsers.updateFailed')),
      );
    } finally {
      setTogglingBlockUserId('');
    }
  }

  async function toggleBlocked(user: ManagedUser) {
    if (!user.isBlocked) {
      setBlockReasonError('');
      setBlockReason('');
      setBlockUserTarget(user);
      return;
    }

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
        normalizeApiErrorMessage(requestError, t, t('adminDashboard.adminUsers.updateFailed')),
      );
    } finally {
      setTogglingBlockUserId('');
    }
  }

  async function submitPasswordReset(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!resetPasswordTarget) {
      return;
    }

    if (resetPassword.length < 8 || resetPassword.length > 128) {
      setResetPasswordError(t('adminDashboard.validation.userPassword'));
      return;
    }

    setResetPasswordError('');
    setResettingPasswordUserId(resetPasswordTarget.id);
    setError('');
    setNotice('');

    try {
      const updated = await apiRequest<ManagedUser>(
        `/admin/users/${resetPasswordTarget.id}/password`,
        {
          method: 'PATCH',
          body: { password: resetPassword },
        },
      );

      setUsers((current) =>
        current.map((entry) => (entry.id === resetPasswordTarget.id ? updated : entry)),
      );
      setDraftRoles((current) => ({ ...current, [updated.id]: updated.role }));
      setNotice(
        t('adminDashboard.adminUsers.passwordReset').replace('{name}', updated.fullName),
      );
      closeResetPasswordModal();
    } catch (requestError) {
      setResetPasswordError(
        normalizeApiErrorMessage(requestError, t, t('adminDashboard.adminUsers.passwordResetFailed')),
      );
    } finally {
      setResettingPasswordUserId('');
    }
  }

  if (loading) {
    return <QuietLoadingCard label={t('adminDashboard.adminUsers.loading')} />;
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
            {usersByRoleSummary.length > 0 ? (
              <p className="admin-users-role-breakdown">
                {usersByRoleSummary
                  .map((item) => `${t(`profile.role.${item.role}`)}: ${item.count}`)
                  .join(' · ')}
              </p>
            ) : null}
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
          <button
            type="button"
            className="summary-card dashboard-tool-card dashboard-tool-card--berry admin-users-create-card dashboard-tool-button"
            onClick={() => {
              setCreateUserError('');
              setUserRole(creatableRoles[0] ?? 'JURY');
              setCreateUserOpen(true);
            }}
          >
            <span>{t('adminDashboard.adminUsers.summary.createUser')}</span>
            <strong>{t('adminDashboard.userForm.createUser')}</strong>
            <p>{t('adminDashboard.adminUsers.summary.createUserLead')}</p>
            <em>{t('adminDashboard.adminUsers.summary.createUserHint')}</em>
          </button>
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
            className="button button-soft admin-primary-action admin-users-toolbar-action"
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
          </div>
          <button
            type="button"
            className="button button-soft admin-primary-action admin-users-toolbar-action admin-users-export-action"
            aria-disabled={exportingCsv}
            onClick={() => {
              if (exportingCsv) {
                return;
              }
              void exportUsersCsv();
            }}
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

                  {user.blockedReason ? (
                    <div className="admin-user-block-history">
                      <span>{t('adminDashboard.adminUsers.blockHistory.title')}</span>
                      <strong>{user.blockedReason}</strong>
                      <p>
                        {user.blockedAt ? formatDateTime(user.blockedAt, language) : t('adminDashboard.adminUsers.blockHistory.dateUnknown')}
                        {' · '}
                        {user.blockedByUserName ?? t('adminDashboard.adminUsers.blockHistory.actorUnknown')}
                      </p>
                    </div>
                  ) : null}

                  <div className={`admin-user-card-actions${canResetPasswords ? ' has-password-reset' : ''}`}>
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

                    {canResetPasswords ? (
                      <button
                        type="button"
                        className="button button-soft admin-user-action admin-user-action--save"
                        disabled={isSelf || resettingPasswordUserId === user.id}
                        onClick={() => {
                          setResetPassword('');
                          setResetPasswordError('');
                          setResetPasswordTarget(user);
                        }}
                      >
                        {resettingPasswordUserId === user.id
                          ? t('adminDashboard.adminUsers.updating')
                          : t('adminDashboard.adminUsers.resetPasswordAction')}
                      </button>
                    ) : null}

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

      {createUserOpen ? (
        <div
          className="app-modal-overlay"
          role="presentation"
          onClick={closeCreateUserModal}
        >
          <article
            className="app-modal-card"
            role="dialog"
            aria-modal="true"
            aria-label={t('adminDashboard.createUserTitle')}
            onClick={(event) => event.stopPropagation()}
          >
            <header className="app-modal-head">
              <h2>{t('adminDashboard.createUserTitle')}</h2>
              <button
                type="button"
                className="button button-soft app-modal-close app-modal-secondary-action"
                onClick={closeCreateUserModal}
              >
                {t('adminDashboard.modal.close')}
              </button>
            </header>
            <div className="app-modal-body">
              <p className="inline-hint">{t('adminDashboard.createUserLead')}</p>
              {createUserError ? <p className="form-error">{createUserError}</p> : null}

              <form className="panel-form" onSubmit={submitUser} noValidate>
                <label className="field" htmlFor="admin-users-full-name">
                  <span>{t('adminDashboard.userForm.fullName')}</span>
                  <input
                    id="admin-users-full-name"
                    type="text"
                    value={userFullName}
                    onChange={(event) => setUserFullName(event.target.value)}
                    required
                    minLength={2}
                    maxLength={80}
                  />
                </label>

                <label className="field" htmlFor="admin-users-email">
                  <span>{t('adminDashboard.userForm.email')}</span>
                  <input
                    id="admin-users-email"
                    type="email"
                    value={userEmail}
                    onChange={(event) => setUserEmail(event.target.value)}
                    required
                  />
                </label>

                <label className="field" htmlFor="admin-users-password">
                  <span>{t('adminDashboard.userForm.password')}</span>
                  <input
                    id="admin-users-password"
                    type="password"
                    value={userPassword}
                    onChange={(event) => setUserPassword(event.target.value)}
                    required
                    minLength={8}
                    maxLength={128}
                  />
                </label>

                <label className="field" htmlFor="admin-users-role">
                  <span>{t('adminDashboard.userForm.role')}</span>
                  <select
                    id="admin-users-role"
                    className="select-input"
                    value={userRole}
                    onChange={(event) => setUserRole(event.target.value as AuthRole)}
                  >
                    {creatableRoles.map((role) => (
                      <option key={role} value={role}>
                        {t(`profile.role.${role}`)}
                      </option>
                    ))}
                  </select>
                </label>

                <button
                  type="submit"
                  className="button button-primary"
                  disabled={createUserLoading}
                >
                  {createUserLoading
                    ? t('adminDashboard.userForm.creatingUser')
                    : t('adminDashboard.userForm.createUser')}
                </button>
              </form>
            </div>
          </article>
        </div>
      ) : null}

      {blockUserTarget ? (
        <div
          className="app-modal-overlay"
          role="presentation"
          onClick={closeBlockUserModal}
        >
          <article
            className="app-modal-card"
            role="dialog"
            aria-modal="true"
            aria-label={t('adminDashboard.adminUsers.blockModal.title')}
            onClick={(event) => event.stopPropagation()}
          >
            <header className="app-modal-head">
              <h2>{t('adminDashboard.adminUsers.blockModal.title')}</h2>
              <button
                type="button"
                className="button button-soft app-modal-close app-modal-secondary-action"
                onClick={closeBlockUserModal}
              >
                {t('adminDashboard.modal.close')}
              </button>
            </header>
            <div className="app-modal-body">
              <p className="inline-hint">
                {t('adminDashboard.adminUsers.blockModal.lead').replace('{name}', blockUserTarget.fullName)}
              </p>
              {blockReasonError ? <p className="form-error">{blockReasonError}</p> : null}

              <label className="field" htmlFor="admin-users-block-reason">
                <span>{t('adminDashboard.adminUsers.blockModal.reason')}</span>
                <textarea
                  id="admin-users-block-reason"
                  className="textarea-input admin-modal-textarea"
                  rows={4}
                  value={blockReason}
                  onChange={(event) => setBlockReason(event.target.value)}
                  maxLength={300}
                />
              </label>

              <div className="admin-users-block-actions">
                <button
                  type="button"
                  className="button button-soft app-modal-secondary-action"
                  onClick={closeBlockUserModal}
                >
                  {t('adminDashboard.adminUsers.blockModal.cancel')}
                </button>
                <button
                  type="button"
                  className="button admin-user-action admin-user-action--block"
                  disabled={togglingBlockUserId === blockUserTarget.id}
                  onClick={() => void blockUser()}
                >
                  {togglingBlockUserId === blockUserTarget.id
                    ? t('adminDashboard.adminUsers.updating')
                    : t('adminDashboard.adminUsers.blockModal.confirm')}
                </button>
              </div>
            </div>
          </article>
        </div>
      ) : null}

      {resetPasswordTarget ? (
        <div
          className="app-modal-overlay"
          role="presentation"
          onClick={closeResetPasswordModal}
        >
          <article
            className="app-modal-card"
            role="dialog"
            aria-modal="true"
            aria-label={t('adminDashboard.adminUsers.passwordResetModal.title')}
            onClick={(event) => event.stopPropagation()}
          >
            <header className="app-modal-head">
              <h2>{t('adminDashboard.adminUsers.passwordResetModal.title')}</h2>
              <button
                type="button"
                className="button button-soft app-modal-close app-modal-secondary-action"
                onClick={closeResetPasswordModal}
              >
                {t('adminDashboard.modal.close')}
              </button>
            </header>
            <div className="app-modal-body">
              <p className="inline-hint">
                {t('adminDashboard.adminUsers.passwordResetModal.lead')
                  .replace('{name}', resetPasswordTarget.fullName)
                  .replace('{email}', resetPasswordTarget.email)}
              </p>
              {resetPasswordError ? <p className="form-error">{resetPasswordError}</p> : null}

              <form className="panel-form" onSubmit={submitPasswordReset} noValidate>
                <label className="field" htmlFor="admin-users-reset-password">
                  <span>{t('adminDashboard.adminUsers.passwordResetModal.password')}</span>
                  <input
                    id="admin-users-reset-password"
                    type="password"
                    value={resetPassword}
                    onChange={(event) => setResetPassword(event.target.value)}
                    required
                    minLength={8}
                    maxLength={128}
                    autoComplete="new-password"
                  />
                </label>

                <div className="admin-users-block-actions">
                  <button
                    type="button"
                    className="button button-soft app-modal-secondary-action"
                    onClick={closeResetPasswordModal}
                  >
                    {t('adminDashboard.adminUsers.passwordResetModal.cancel')}
                  </button>
                  <button
                    type="submit"
                    className="button button-primary"
                    disabled={resettingPasswordUserId === resetPasswordTarget.id}
                  >
                    {resettingPasswordUserId === resetPasswordTarget.id
                      ? t('adminDashboard.adminUsers.updating')
                      : t('adminDashboard.adminUsers.passwordResetModal.confirm')}
                  </button>
                </div>
              </form>
            </div>
          </article>
        </div>
      ) : null}
    </section>
  );
}
