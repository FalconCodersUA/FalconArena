import { ChangeEvent, useEffect, useMemo, useRef, useState } from 'react';
import { useNotifications } from '../app/notifications/NotificationsProvider';
import { ApiError, apiRequest, resolveApiAssetUrl } from '../lib/api';
import { formatDateTime, setPreferredTimeZone } from '../lib/dateTime';
import { useI18n } from '../i18n/I18nProvider';
import type { Language } from '../i18n/messages';

type UserRole = 'ADMIN' | 'TEAM' | 'JURY' | 'ORGANIZER';
type TournamentStatus = 'DRAFT' | 'REGISTRATION' | 'RUNNING' | 'FINISHED';
type RoundStatus = 'DRAFT' | 'ACTIVE' | 'SUBMISSION_CLOSED' | 'EVALUATED';

type AuthMe = {
  id: string;
  fullName: string;
  email: string;
  role: UserRole;
  createdAt: string;
};

type Tournament = {
  id: string;
  title: string;
  status: TournamentStatus;
  createdById: string;
  startsAt: string | null;
};

type TeamProfile = {
  id: string;
  name: string;
  captain: {
    id: string;
    fullName: string;
    email: string;
  };
  members: {
    id: string;
    fullName: string;
    email: string;
  }[];
};

type Round = {
  id: string;
  title: string;
  status: RoundStatus;
};

type TeamSubmission = {
  id: string;
  repoUrl: string;
  demoUrl: string;
  liveDemoUrl: string | null;
  submittedAt: string;
  status: 'DRAFT' | 'SUBMITTED' | 'LOCKED';
};

type Assignment = {
  id: string;
  assignedAt: string;
  submission: {
    id: string;
    repoUrl: string;
    demoUrl: string;
    liveDemoUrl: string | null;
    team: {
      id: string;
      name: string;
    };
  };
  evaluation: {
    id: string;
    totalScore: number;
  } | null;
};

type TeamSubmissionHistoryItem = {
  roundId: string;
  roundTitle: string;
  roundStatus: RoundStatus;
  submissionStatus: 'DRAFT' | 'SUBMITTED' | 'LOCKED';
  submittedAt: string;
  repoUrl: string;
  demoUrl: string;
  liveDemoUrl: string | null;
};

type JuryAssignmentHistoryItem = {
  assignmentId: string;
  tournamentId: string;
  tournamentTitle: string;
  roundId: string;
  roundTitle: string;
  teamName: string;
  assignedAt: string;
  repoUrl: string;
  demoUrl: string;
  liveDemoUrl: string | null;
  evaluated: boolean;
  totalScore: number | null;
};

type TeamSummaryItem = {
  tournamentId: string;
  tournamentTitle: string;
  tournamentStatus: TournamentStatus;
  teamName: string;
  membersCount: number;
  members: {
    fullName: string;
    email: string;
    isCaptain: boolean;
  }[];
  totalRounds: number;
  submissionsCount: number;
  submissionHistory: TeamSubmissionHistoryItem[];
};

type JurySummaryItem = {
  tournamentId: string;
  tournamentTitle: string;
  assignments: number;
  evaluated: number;
};

type AdminSummaryItem = {
  tournamentId: string;
  tournamentTitle: string;
  tournamentStatus: TournamentStatus;
  roundsCount: number;
  startsAt: string | null;
};

type TeamRoleSummary = {
  kind: 'TEAM';
  items: TeamSummaryItem[];
};

type JuryRoleSummary = {
  kind: 'JURY';
  items: JurySummaryItem[];
  totalAssignments: number;
  evaluatedAssignments: number;
  history: JuryAssignmentHistoryItem[];
};

type AdminRoleSummary = {
  kind: 'ADMIN';
  items: AdminSummaryItem[];
};

type RoleSummary = TeamRoleSummary | JuryRoleSummary | AdminRoleSummary;
type ProfileSettingsTab = 'edit' | 'preferences' | 'security';
type ProfileActivityItem = {
  id: string;
  title: string;
  meta: string;
  timestamp: number;
  accent: 'purple' | 'teal' | 'orange' | 'cobalt';
};

type AuditActivityEntry = {
  id: string;
  actorName: string | null;
  action: string;
  entityLabel: string | null;
  title: string;
  description: string;
  createdAt: string;
};

type ProfileSettingsPayload = {
  edit: {
    avatarUrl?: string;
    fullName: string;
    userName: string;
    email: string;
    dateOfBirth: string;
    presentAddress: string;
    permanentAddress: string;
    city: string;
    postalCode: string;
    country: string;
  };
  preferences: {
    interfaceLanguage: string;
    timeZone: string;
    notifyAnnouncements: boolean;
    notifyReviews: boolean;
    notifyMessages: boolean;
  };
};

const PROFILE_TIME_ZONE_OPTIONS = [
  'Europe/Kyiv',
  'UTC',
  'Europe/Warsaw',
  'Europe/London',
  'America/New_York',
] as const;

function isProfileSettingsPayload(value: unknown): value is ProfileSettingsPayload {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const payload = value as { edit?: unknown; preferences?: unknown };
  return (
    !!payload.edit &&
    typeof payload.edit === 'object' &&
    !!payload.preferences &&
    typeof payload.preferences === 'object'
  );
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

function normalizeStoredLanguage(value: string | null | undefined, fallback: Language): Language {
  const normalized = value?.trim().toLowerCase();
  if (!normalized) {
    return fallback;
  }

  if (normalized === 'uk' || normalized.includes('укра')) {
    return 'uk';
  }

  if (normalized === 'en' || normalized.includes('eng')) {
    return 'en';
  }

  return fallback;
}

function normalizeStoredTimeZone(value: string | null | undefined) {
  const normalized = value?.trim();
  if (!normalized) {
    return 'Europe/Kyiv';
  }

  if (normalized === '(GMT+02:00) Eastern Europe') {
    return 'Europe/Kyiv';
  }

  return PROFILE_TIME_ZONE_OPTIONS.includes(normalized as (typeof PROFILE_TIME_ZONE_OPTIONS)[number])
    ? normalized
    : 'Europe/Kyiv';
}

function getProfileActivityAccent(action: string): ProfileActivityItem['accent'] {
  if (action.startsWith('evaluation.')) {
    return 'cobalt';
  }

  if (action.startsWith('submission.')) {
    return 'teal';
  }

  if (action.startsWith('schedule.') || action.startsWith('certificate.')) {
    return 'orange';
  }

  return 'purple';
}

export default function ProfilePage() {
  const { language, setLanguage, t } = useI18n();
  const { notifyError, notifySuccess } = useNotifications();
  const avatarInputRef = useRef<HTMLInputElement | null>(null);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [me, setMe] = useState<AuthMe | null>(null);
  const [summary, setSummary] = useState<RoleSummary | null>(null);
  const [activityEntries, setActivityEntries] = useState<AuditActivityEntry[]>([]);
  const [activeSettingsTab, setActiveSettingsTab] = useState<ProfileSettingsTab>('edit');
  const [settingsNotice, setSettingsNotice] = useState('');
  const [settingsError, setSettingsError] = useState('');
  const [settingsSaving, setSettingsSaving] = useState(false);

  const [editFullName, setEditFullName] = useState('');
  const [editUserName, setEditUserName] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [editAvatarUrl, setEditAvatarUrl] = useState('');
  const [avatarUploadError, setAvatarUploadError] = useState('');
  const [editDateOfBirth, setEditDateOfBirth] = useState('1990-01-25');
  const [editPresentAddress, setEditPresentAddress] = useState('San Jose, California, USA');
  const [editPermanentAddress, setEditPermanentAddress] = useState('San Jose, California, USA');
  const [editCity, setEditCity] = useState('San Jose');
  const [editPostalCode, setEditPostalCode] = useState('45962');
  const [editCountry, setEditCountry] = useState('USA');

  const [prefLanguage, setPrefLanguage] = useState<Language>(language);
  const [prefTimeZone, setPrefTimeZone] = useState<string>('Europe/Kyiv');
  const [prefNotificationsAnnouncements, setPrefNotificationsAnnouncements] = useState(true);
  const [prefNotificationsReviews, setPrefNotificationsReviews] = useState(false);
  const [prefNotificationsMessages, setPrefNotificationsMessages] = useState(true);

  const [securityCurrentPassword, setSecurityCurrentPassword] = useState('');
  const [securityNewPassword, setSecurityNewPassword] = useState('');

  const roleLabel = useMemo(() => {
    if (!me) {
      return '-';
    }

    return t(`profile.role.${me.role}`);
  }, [me?.role, t]);

  async function loadTeamSummary(tournaments: Tournament[]): Promise<TeamRoleSummary> {
    const teamData = await Promise.all(
      tournaments.map(async (tournament) => {
        try {
          const team = await apiRequest<TeamProfile>(`/tournaments/${tournament.id}/teams/me`);
          const rounds = await apiRequest<Round[]>(`/tournaments/${tournament.id}/rounds`);

          const submissionsWithRound = await Promise.all(
            rounds.map(async (round) => {
              try {
                const submission = await apiRequest<TeamSubmission>(
                  `/rounds/${round.id}/submissions/me`,
                );
                return {
                  round,
                  submission,
                };
              } catch (requestError) {
                if (requestError instanceof ApiError && requestError.status === 404) {
                  return null;
                }

                throw requestError;
              }
            }),
          );

          const submissionHistory = submissionsWithRound
            .filter(
              (
                entry,
              ): entry is {
                round: Round;
                submission: TeamSubmission;
              } => entry !== null,
            )
            .map((entry) => ({
              roundId: entry.round.id,
              roundTitle: entry.round.title,
              roundStatus: entry.round.status,
              submissionStatus: entry.submission.status,
              submittedAt: entry.submission.submittedAt,
              repoUrl: entry.submission.repoUrl,
              demoUrl: entry.submission.demoUrl,
              liveDemoUrl: entry.submission.liveDemoUrl,
            }))
            .sort(
              (left, right) =>
                new Date(right.submittedAt).getTime() - new Date(left.submittedAt).getTime(),
            );

          return {
            tournamentId: tournament.id,
            tournamentTitle: tournament.title,
            tournamentStatus: tournament.status,
            teamName: team.name,
            membersCount: team.members.length + 1,
            members: [
              {
                fullName: team.captain.fullName,
                email: team.captain.email,
                isCaptain: true,
              },
              ...team.members.map((member) => ({
                fullName: member.fullName,
                email: member.email,
                isCaptain: false,
              })),
            ],
            totalRounds: rounds.length,
            submissionsCount: submissionHistory.length,
            submissionHistory,
          } satisfies TeamSummaryItem;
        } catch (requestError) {
          if (requestError instanceof ApiError && requestError.status === 404) {
            return null;
          }

          throw requestError;
        }
      }),
    );

    return {
      kind: 'TEAM',
      items: teamData.filter((entry): entry is TeamSummaryItem => entry !== null),
    };
  }

  async function loadJurySummary(tournaments: Tournament[]): Promise<JuryRoleSummary> {
    const byTournament = await Promise.all(
      tournaments.map(async (tournament) => {
        const rounds = await apiRequest<Round[]>(`/tournaments/${tournament.id}/rounds`);
        const assignmentsByRound = await Promise.all(
          rounds.map(async (round) => {
            try {
              const assignments = await apiRequest<Assignment[]>(`/rounds/${round.id}/assignments/me`);
              return {
                round,
                assignments,
              };
            } catch (requestError) {
              if (requestError instanceof ApiError && requestError.status === 404) {
                return {
                  round,
                  assignments: [],
                };
              }

              throw requestError;
            }
          }),
        );

        const flatAssignments = assignmentsByRound.flatMap((entry) => entry.assignments);
        const evaluated = flatAssignments.filter((entry) => entry.evaluation !== null).length;

        const history = assignmentsByRound.flatMap((entry) =>
          entry.assignments.map(
            (assignment) =>
              ({
                assignmentId: assignment.id,
                tournamentId: tournament.id,
                tournamentTitle: tournament.title,
                roundId: entry.round.id,
                roundTitle: entry.round.title,
                teamName: assignment.submission.team.name,
                assignedAt: assignment.assignedAt,
                repoUrl: assignment.submission.repoUrl,
                demoUrl: assignment.submission.demoUrl,
                liveDemoUrl: assignment.submission.liveDemoUrl,
                evaluated: assignment.evaluation !== null,
                totalScore: assignment.evaluation?.totalScore ?? null,
              }) satisfies JuryAssignmentHistoryItem,
          ),
        );

        return {
          tournament: {
            tournamentId: tournament.id,
            tournamentTitle: tournament.title,
            assignments: flatAssignments.length,
            evaluated,
          } satisfies JurySummaryItem,
          history,
        };
      }),
    );

    const items = byTournament
      .map((entry) => entry.tournament)
      .filter((entry) => entry.assignments > 0);

    const history = byTournament
      .flatMap((entry) => entry.history)
      .sort(
        (left, right) =>
          new Date(right.assignedAt).getTime() - new Date(left.assignedAt).getTime(),
      );

    const totalAssignments = items.reduce((acc, entry) => acc + entry.assignments, 0);
    const evaluatedAssignments = items.reduce((acc, entry) => acc + entry.evaluated, 0);

    return {
      kind: 'JURY',
      items,
      totalAssignments,
      evaluatedAssignments,
      history,
    };
  }

  async function loadAdminSummary(
    meData: AuthMe,
    tournaments: Tournament[],
  ): Promise<AdminRoleSummary> {
    const createdByMe = tournaments.filter((entry) => entry.createdById === meData.id);
    const withRounds = await Promise.all(
      createdByMe.map(async (tournament) => {
        const rounds = await apiRequest<Round[]>(`/tournaments/${tournament.id}/rounds`);
        return {
          tournamentId: tournament.id,
          tournamentTitle: tournament.title,
          tournamentStatus: tournament.status,
          roundsCount: rounds.length,
          startsAt: tournament.startsAt,
        } satisfies AdminSummaryItem;
      }),
    );

    return {
      kind: 'ADMIN',
      items: withRounds,
    };
  }

  function applySettingsPayload(payload: ProfileSettingsPayload) {
    setEditAvatarUrl(payload.edit.avatarUrl || '');
    setEditFullName(payload.edit.fullName);
    setEditUserName(payload.edit.userName);
    setEditEmail(payload.edit.email);
    setEditDateOfBirth(payload.edit.dateOfBirth || '1990-01-25');
    setEditPresentAddress(payload.edit.presentAddress || '');
    setEditPermanentAddress(payload.edit.permanentAddress || '');
    setEditCity(payload.edit.city || '');
    setEditPostalCode(payload.edit.postalCode || '');
    setEditCountry(payload.edit.country || '');

    setPrefLanguage(normalizeStoredLanguage(payload.preferences.interfaceLanguage, language));
    const nextTimeZone = normalizeStoredTimeZone(payload.preferences.timeZone);
    setPrefTimeZone(nextTimeZone);
    setPreferredTimeZone(nextTimeZone);
    setPrefNotificationsAnnouncements(payload.preferences.notifyAnnouncements);
    setPrefNotificationsReviews(payload.preferences.notifyReviews);
    setPrefNotificationsMessages(payload.preferences.notifyMessages);
  }

  async function loadProfile() {
    setLoading(true);
    setError('');

    try {
      const [meData, tournamentData] = await Promise.all([
        apiRequest<AuthMe>('/auth/me'),
        apiRequest<Tournament[]>('/tournaments'),
      ]);

      setMe(meData);
      setEditFullName(meData.fullName);
      setEditUserName(meData.fullName);
      setEditEmail(meData.email);
      setEditAvatarUrl('');
      setAvatarUploadError('');
      setSettingsError('');
      setSettingsNotice('');

      try {
        const settings = await apiRequest<unknown>('/profile/settings');
        if (!isProfileSettingsPayload(settings)) {
          throw new Error('Invalid settings response');
        }
        applySettingsPayload(settings);
      } catch {
        // keep defaults if settings endpoint is unavailable
      }

      if (meData.role === 'TEAM') {
        setSummary(await loadTeamSummary(tournamentData));
      } else if (meData.role === 'JURY') {
        setSummary(await loadJurySummary(tournamentData));
      } else {
        setSummary(await loadAdminSummary(meData, tournamentData));
      }

      try {
        const activity = await apiRequest<AuditActivityEntry[]>('/activity/mine');
        setActivityEntries(Array.isArray(activity) ? activity : []);
      } catch {
        setActivityEntries([]);
      }
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : t('profile.loadFailed'));
      setSummary(null);
      setMe(null);
      setActivityEntries([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadProfile();
  }, []);

  function onAvatarPickerClick() {
    avatarInputRef.current?.click();
  }

  function onAvatarFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = '';

    if (!file) {
      return;
    }

    if (!file.type.startsWith('image/')) {
      setAvatarUploadError(t('profile.settings.avatarErrors.invalidType'));
      return;
    }

    if (file.size > 1024 * 1024) {
      setAvatarUploadError(t('profile.settings.avatarErrors.tooLarge'));
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const result = typeof reader.result === 'string' ? reader.result : '';
      if (!result) {
        setAvatarUploadError(t('profile.settings.avatarErrors.readFailed'));
        return;
      }

      setAvatarUploadError('');
      setEditAvatarUrl(result);
    };
    reader.onerror = () => {
      setAvatarUploadError(t('profile.settings.avatarErrors.readFailed'));
    };
    reader.readAsDataURL(file);
  }

  async function saveSettings(tab: ProfileSettingsTab) {
    setSettingsSaving(true);
    setSettingsError('');
    setSettingsNotice('');

    try {
      let body: Record<string, unknown>;

      if (tab === 'edit') {
        body = {
          edit: {
            avatarUrl: editAvatarUrl,
            fullName: editFullName,
            userName: editUserName,
            email: editEmail,
            dateOfBirth: editDateOfBirth,
            presentAddress: editPresentAddress,
            permanentAddress: editPermanentAddress,
            city: editCity,
            postalCode: editPostalCode,
            country: editCountry,
          },
        };
      } else if (tab === 'preferences') {
        body = {
          preferences: {
            interfaceLanguage: prefLanguage,
            timeZone: prefTimeZone,
            notifyAnnouncements: prefNotificationsAnnouncements,
            notifyReviews: prefNotificationsReviews,
            notifyMessages: prefNotificationsMessages,
          },
        };
      } else {
        body = {
          security: {
            currentPassword: securityCurrentPassword,
            newPassword: securityNewPassword,
          },
        };
      }

      const settings = await apiRequest<unknown>('/profile/settings', {
        method: 'PATCH',
        body,
      });
      if (!isProfileSettingsPayload(settings)) {
        throw new Error('Invalid settings response');
      }
      setPreferredTimeZone(normalizeStoredTimeZone(settings.preferences.timeZone));
      applySettingsPayload(settings);
      setSettingsNotice(t('profile.settings.saved'));
      notifySuccess(t('profile.settings.saved'));

      if (tab === 'edit') {
        window.dispatchEvent(
          new CustomEvent('falconarena-profile-updated', {
            detail: {
              avatarUrl: settings.edit.avatarUrl ?? '',
            },
          }),
        );
      }

      if (tab === 'preferences') {
        const nextLanguage = normalizeStoredLanguage(settings.preferences.interfaceLanguage, language);
        if (nextLanguage !== language) {
          setLanguage(nextLanguage);
        }
      }

      if (tab === 'security') {
        setSecurityCurrentPassword('');
        setSecurityNewPassword('');
      }
    } catch (requestError) {
      const message =
        requestError instanceof Error ? requestError.message : t('profile.loadFailed');
      setSettingsError(message);
      notifyError(message);
    } finally {
      setSettingsSaving(false);
    }
  }

  const profileWorkspacePrimaryValue =
    !summary
      ? 0
      : summary.kind === 'TEAM'
      ? summary.items.reduce((acc, item) => acc + item.submissionsCount, 0)
      : summary.kind === 'JURY'
        ? summary.totalAssignments - summary.evaluatedAssignments
        : summary.items.reduce((acc, item) => acc + item.roundsCount, 0);

  const profileWorkspacePrimaryLabel =
    !summary
      ? '-'
      : summary.kind === 'TEAM'
      ? t('profile.workspaceStatus.team')
      : summary.kind === 'JURY'
        ? t('profile.workspaceStatus.jury')
        : t('profile.workspaceStatus.admin');

  const profileWorkspaceLead =
    !summary
      ? t('profile.lead')
      : summary.kind === 'TEAM'
      ? t('profile.workspaceLead.TEAM')
      : summary.kind === 'JURY'
        ? t('profile.workspaceLead.JURY')
        : t('profile.workspaceLead.ADMIN');
  const profileActivityFeed = useMemo<ProfileActivityItem[]>(
    () =>
      activityEntries.map((entry) => ({
        id: entry.id,
        title: entry.entityLabel || entry.title,
        meta: `${entry.description} · ${formatDateTime(entry.createdAt, language)}`,
        timestamp: new Date(entry.createdAt).getTime(),
        accent: getProfileActivityAccent(entry.action),
      })),
    [activityEntries, language],
  );

  if (loading) {
    return <article className="card state-card">{t('profile.loading')}</article>;
  }

  if (error) {
    return (
      <article className="card state-card">
        <p className="form-error">{error}</p>
        <button type="button" className="button button-soft" onClick={loadProfile}>
          {t('profile.retry')}
        </button>
      </article>
    );
  }

  if (!me || !summary) {
    return <article className="card state-card">{t('profile.loadFailed')}</article>;
  }

  function renderSettingsContent() {
    if (activeSettingsTab === 'edit') {
      return (
        <form
          className="profile-settings-form"
          onSubmit={(event) => {
            event.preventDefault();
            void saveSettings('edit');
          }}
        >
          <div className="profile-edit-layout">
            <div className="profile-edit-avatar-wrap">
              <div className={`profile-edit-avatar${editAvatarUrl ? ' has-image' : ''}`}>
                {editAvatarUrl ? (
                  <img
                    src={resolveApiAssetUrl(editAvatarUrl)}
                    alt={t('profile.settings.editAvatar')}
                  />
                ) : (
                  initialsFromName(editFullName)
                )}
              </div>
              <input
                ref={avatarInputRef}
                type="file"
                accept="image/*"
                className="visually-hidden"
                onChange={onAvatarFileChange}
              />
              <button
                type="button"
                className="profile-edit-avatar-button"
                aria-label={t('profile.settings.editAvatar')}
                onClick={onAvatarPickerClick}
              >
                +
              </button>
              {avatarUploadError ? <p className="form-error profile-avatar-error">{avatarUploadError}</p> : null}
            </div>

            <div className="profile-settings-fields">
              <label className="field" htmlFor="profile-edit-name">
                <span>{t('profile.settings.edit.fullName')}</span>
                <input
                  id="profile-edit-name"
                  type="text"
                  value={editFullName}
                  onChange={(event) => setEditFullName(event.target.value)}
                  required
                />
              </label>

              <label className="field" htmlFor="profile-edit-username">
                <span>{t('profile.settings.edit.userName')}</span>
                <input
                  id="profile-edit-username"
                  type="text"
                  value={editUserName}
                  onChange={(event) => setEditUserName(event.target.value)}
                  required
                />
              </label>

              <label className="field" htmlFor="profile-edit-email">
                <span>{t('profile.settings.edit.email')}</span>
                <input
                  id="profile-edit-email"
                  type="email"
                  value={editEmail}
                  onChange={(event) => setEditEmail(event.target.value)}
                  required
                />
              </label>

              <label className="field" htmlFor="profile-edit-password">
                <span>{t('profile.settings.edit.password')}</span>
                <input id="profile-edit-password" type="password" value="********" readOnly />
              </label>

              <label className="field" htmlFor="profile-edit-dob">
                <span>{t('profile.settings.edit.dateOfBirth')}</span>
                <input
                  id="profile-edit-dob"
                  type="date"
                  value={editDateOfBirth}
                  onChange={(event) => setEditDateOfBirth(event.target.value)}
                />
              </label>

              <label className="field" htmlFor="profile-edit-present-address">
                <span>{t('profile.settings.edit.presentAddress')}</span>
                <input
                  id="profile-edit-present-address"
                  type="text"
                  value={editPresentAddress}
                  onChange={(event) => setEditPresentAddress(event.target.value)}
                />
              </label>

              <label className="field" htmlFor="profile-edit-permanent-address">
                <span>{t('profile.settings.edit.permanentAddress')}</span>
                <input
                  id="profile-edit-permanent-address"
                  type="text"
                  value={editPermanentAddress}
                  onChange={(event) => setEditPermanentAddress(event.target.value)}
                />
              </label>

              <label className="field" htmlFor="profile-edit-city">
                <span>{t('profile.settings.edit.city')}</span>
                <input
                  id="profile-edit-city"
                  type="text"
                  value={editCity}
                  onChange={(event) => setEditCity(event.target.value)}
                />
              </label>

              <label className="field" htmlFor="profile-edit-postal-code">
                <span>{t('profile.settings.edit.postalCode')}</span>
                <input
                  id="profile-edit-postal-code"
                  type="text"
                  value={editPostalCode}
                  onChange={(event) => setEditPostalCode(event.target.value)}
                />
              </label>

              <label className="field" htmlFor="profile-edit-country">
                <span>{t('profile.settings.edit.country')}</span>
                <input
                  id="profile-edit-country"
                  type="text"
                  value={editCountry}
                  onChange={(event) => setEditCountry(event.target.value)}
                />
              </label>
            </div>
          </div>

          <div className="profile-settings-actions">
            <button type="submit" className="button button-primary" disabled={settingsSaving}>
              {t('profile.settings.save')}
            </button>
          </div>
        </form>
      );
    }

    if (activeSettingsTab === 'preferences') {
      return (
        <form
          className="profile-settings-form"
          onSubmit={(event) => {
            event.preventDefault();
            void saveSettings('preferences');
          }}
        >
          <div className="profile-settings-fields two-col">
            <label className="field" htmlFor="profile-pref-language">
              <span>{t('profile.settings.preferences.interfaceLanguage')}</span>
              <select
                id="profile-pref-language"
                className="select-input"
                value={prefLanguage}
                onChange={(event) => setPrefLanguage(event.target.value as Language)}
              >
                <option value="uk">{t('profile.settings.preferences.languages.uk')}</option>
                <option value="en">{t('profile.settings.preferences.languages.en')}</option>
              </select>
            </label>

            <label className="field" htmlFor="profile-pref-timezone">
              <span>{t('profile.settings.preferences.timeZone')}</span>
              <select
                id="profile-pref-timezone"
                className="select-input"
                value={prefTimeZone}
                onChange={(event) => setPrefTimeZone(event.target.value)}
              >
                {PROFILE_TIME_ZONE_OPTIONS.map((zone) => (
                  <option key={zone} value={zone}>
                    {t(`profile.settings.preferences.timeZones.${zone}`)}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="profile-preferences-block">
            <strong>{t('profile.settings.preferences.notifications')}</strong>

            <label className="profile-toggle-row" htmlFor="pref-notify-announcements">
              <button
                id="pref-notify-announcements"
                type="button"
                className={`settings-toggle${prefNotificationsAnnouncements ? ' on' : ''}`}
                onClick={() => setPrefNotificationsAnnouncements((current) => !current)}
                aria-pressed={prefNotificationsAnnouncements}
              />
              <span>{t('profile.settings.preferences.notifyAnnouncements')}</span>
            </label>

            <label className="profile-toggle-row" htmlFor="pref-notify-reviews">
              <button
                id="pref-notify-reviews"
                type="button"
                className={`settings-toggle${prefNotificationsReviews ? ' on' : ''}`}
                onClick={() => setPrefNotificationsReviews((current) => !current)}
                aria-pressed={prefNotificationsReviews}
              />
              <span>{t('profile.settings.preferences.notifyReviews')}</span>
            </label>

            <label className="profile-toggle-row" htmlFor="pref-notify-messages">
              <button
                id="pref-notify-messages"
                type="button"
                className={`settings-toggle${prefNotificationsMessages ? ' on' : ''}`}
                onClick={() => setPrefNotificationsMessages((current) => !current)}
                aria-pressed={prefNotificationsMessages}
              />
              <span>{t('profile.settings.preferences.notifyMessages')}</span>
            </label>
          </div>

          <div className="profile-settings-actions">
            <button type="submit" className="button button-primary" disabled={settingsSaving}>
              {t('profile.settings.save')}
            </button>
          </div>
        </form>
      );
    }

    return (
      <form
        className="profile-settings-form profile-settings-security"
        onSubmit={(event) => {
          event.preventDefault();
          void saveSettings('security');
        }}
      >
        <h3>{t('profile.settings.security.title')}</h3>
        <label className="field" htmlFor="profile-security-current-password">
          <span>{t('profile.settings.security.currentPassword')}</span>
          <input
            id="profile-security-current-password"
            type="password"
            value={securityCurrentPassword}
            onChange={(event) => setSecurityCurrentPassword(event.target.value)}
            required
          />
        </label>

        <label className="field" htmlFor="profile-security-new-password">
          <span>{t('profile.settings.security.newPassword')}</span>
          <input
            id="profile-security-new-password"
            type="password"
            value={securityNewPassword}
            onChange={(event) => setSecurityNewPassword(event.target.value)}
            required
          />
        </label>

        <div className="profile-settings-actions">
          <button type="submit" className="button button-primary" disabled={settingsSaving}>
            {t('profile.settings.save')}
          </button>
        </div>
      </form>
    );
  }

  return (
    <section className="team-dashboard">
      <header className="section-header">
        <p className="eyebrow">{t('shell.profile')}</p>
        <h1>{t('profile.title')}</h1>
        <p className="lead">{t('profile.lead')}</p>
      </header>

      <article className="card panel-card profile-workspace-card">
        <div className="profile-workspace-head">
          <div className="profile-workspace-copy">
            <p className="eyebrow dashboard-workspace-eyebrow">{t('profile.workspaceEyebrow')}</p>
            <h2>{t('profile.workspaceTitle')}</h2>
            <p>{profileWorkspaceLead}</p>
          </div>
          <div className="dashboard-workspace-status profile-workspace-status">
            <span>{profileWorkspacePrimaryLabel}</span>
            <strong>{profileWorkspacePrimaryValue}</strong>
            <p>{t('profile.workspaceStatusLead')}</p>
          </div>
        </div>

        <div className="dashboard-toolset-grid profile-toolset-grid">
          {(['edit', 'preferences', 'security'] as ProfileSettingsTab[]).map((tab) => (
            <button
              key={tab}
              type="button"
              className={`dashboard-tool-card dashboard-tool-button ${
                tab === 'edit'
                  ? 'dashboard-tool-card--teal'
                  : tab === 'preferences'
                    ? 'dashboard-tool-card--purple'
                    : 'dashboard-tool-card--orange'
              }`}
              onClick={() => {
                setActiveSettingsTab(tab);
                setSettingsNotice('');
              }}
            >
              <span>{t('profile.workspaceCards.settingsLabel')}</span>
              <strong>{t(`profile.settings.tabs.${tab}`)}</strong>
              <p>{t(`profile.workspaceCards.${tab}`)}</p>
              <em>{activeSettingsTab === tab ? t('profile.workspaceCards.active') : t('profile.workspaceCards.open')}</em>
            </button>
          ))}
          <article className="dashboard-tool-card dashboard-tool-card--berry">
            <span>{t('profile.workspaceCards.activityLabel')}</span>
            <strong>{t('profile.overviewTitle')}</strong>
            <p>{t('profile.workspaceCards.activityLead')}</p>
            <em>{roleLabel}</em>
          </article>
        </div>
      </article>

      <article className="card profile-settings-shell">
        <h2>{t('profile.settings.title')}</h2>

        <div className="profile-settings-tabs" role="tablist" aria-label={t('profile.settings.tabsLabel')}>
          {(['edit', 'preferences', 'security'] as ProfileSettingsTab[]).map((tab) => (
            <button
              key={tab}
              type="button"
              role="tab"
              aria-selected={activeSettingsTab === tab}
              className={`profile-settings-tab${activeSettingsTab === tab ? ' active' : ''}`}
              onClick={() => {
                setActiveSettingsTab(tab);
                setSettingsNotice('');
              }}
            >
              {t(`profile.settings.tabs.${tab}`)}
            </button>
          ))}
        </div>

        {settingsNotice ? <p className="form-success">{settingsNotice}</p> : null}
        {settingsError ? <p className="form-error">{settingsError}</p> : null}
        <div className="state-callout subtle">
          <strong>{t(`profile.settings.help.${activeSettingsTab}.title`)}</strong>
          <p>{t(`profile.settings.help.${activeSettingsTab}.lead`)}</p>
        </div>
        {renderSettingsContent()}
      </article>

      <article className="card panel-card" id="profile-basics">
        <h2>{t('profile.basics.title')}</h2>
        <div className="profile-grid">
          <div className="profile-item">
            <span>{t('profile.basics.role')}</span>
            <strong>{roleLabel}</strong>
          </div>
          <div className="profile-item">
            <span>{t('profile.basics.email')}</span>
            <strong>{me.email}</strong>
          </div>
          <div className="profile-item">
            <span>{t('profile.basics.fullName')}</span>
            <strong>{me.fullName}</strong>
          </div>
          <div className="profile-item">
            <span>{t('profile.basics.createdAt')}</span>
            <strong>{formatDateTime(me.createdAt, language)}</strong>
          </div>
        </div>
      </article>

      <article className="card panel-card" id="profile-overview">
        <h2>{t('profile.overviewTitle')}</h2>
        {summary.kind === 'TEAM' ? (
          <div className="summary-grid compact-summary-grid">
            <div className="summary-card">
              <span>{t('profile.team.title')}</span>
              <strong>{summary.items.length}</strong>
              <p>{t('profile.overview.teamTournaments')}</p>
            </div>
            <div className="summary-card">
              <span>{t('profile.team.submissions')}</span>
              <strong>{summary.items.reduce((acc, item) => acc + item.submissionsCount, 0)}</strong>
              <p>{t('profile.overview.teamSubmissions')}</p>
            </div>
          </div>
        ) : null}

        {summary.kind === 'JURY' ? (
          <div className="summary-grid compact-summary-grid">
            <div className="summary-card">
              <span>{t('profile.jury.totalAssignments')}</span>
              <strong>{summary.totalAssignments}</strong>
              <p>{t('profile.overview.juryAssignments')}</p>
            </div>
            <div className="summary-card">
              <span>{t('profile.jury.pending')}</span>
              <strong>{summary.totalAssignments - summary.evaluatedAssignments}</strong>
              <p>{t('profile.overview.juryPending')}</p>
            </div>
          </div>
        ) : null}

        {summary.kind === 'ADMIN' ? (
          <div className="summary-grid compact-summary-grid">
            <div className="summary-card">
              <span>{t('profile.admin.title')}</span>
              <strong>{summary.items.length}</strong>
              <p>{t('profile.overview.adminTournaments')}</p>
            </div>
            <div className="summary-card">
              <span>{t('profile.admin.rounds')}</span>
              <strong>{summary.items.reduce((acc, item) => acc + item.roundsCount, 0)}</strong>
              <p>{t('profile.overview.adminRounds')}</p>
            </div>
          </div>
        ) : null}

        <div className="state-callout subtle">
          <strong>{t('profile.nextStepTitle')}</strong>
          <p>{t(`profile.nextStep.${summary.kind}`)}</p>
        </div>
      </article>

      <article className="card panel-card">
        <h2>{t('profile.activityFeed.title')}</h2>
        <p className="dashboard-mini-lead">{t('profile.activityFeed.lead')}</p>
        {profileActivityFeed.length === 0 ? (
          <p className="state-callout subtle">{t('profile.activityFeed.empty')}</p>
        ) : (
          <div className="activity-feed-list">
            {profileActivityFeed.map((item) => (
              <article key={item.id} className={`activity-feed-item is-${item.accent}`}>
                <span className="activity-feed-dot" aria-hidden />
                <div>
                  <strong>{item.title}</strong>
                  <p>{item.meta}</p>
                </div>
              </article>
            ))}
          </div>
        )}
      </article>

      {summary.kind === 'TEAM' ? (
        <article className="card panel-card">
          <h2>{t('profile.team.title')}</h2>
          {summary.items.length === 0 ? (
            <p className="state-callout subtle">{t('profile.team.empty')}</p>
          ) : null}
          {summary.items.length > 0 ? (
            <div className="profile-role-grid">
              {summary.items.map((item) => (
                <article key={item.tournamentId} className="profile-role-card">
                  <div className="tournament-head">
                    <strong>{item.tournamentTitle}</strong>
                    <span className="status-pill">{t(`profile.status.${item.tournamentStatus}`)}</span>
                  </div>
                  <p>{item.teamName}</p>
                  <p>
                    {t('profile.team.members')}: {item.membersCount}
                  </p>
                  <div className="profile-history-list">
                    {item.members.map((member) => (
                      <article key={`${item.tournamentId}-${member.email}`} className="profile-history-card">
                        <p>
                          <strong>{member.fullName}</strong>
                        </p>
                        <p>{member.email}</p>
                        {member.isCaptain ? (
                          <p className="inline-hint">{t('profile.team.captainLabel')}</p>
                        ) : null}
                      </article>
                    ))}
                  </div>
                  <p>
                    {t('profile.team.roundsTotal')}: {item.totalRounds}
                  </p>
                  <p>
                    {t('profile.team.submissions')}: {item.submissionsCount}
                  </p>
                  {item.submissionsCount === 0 ? (
                    <p className="inline-hint">{t('profile.team.noSubmissions')}</p>
                  ) : (
                    <>
                      <h3>{t('profile.team.historyTitle')}</h3>
                      <div className="profile-history-list">
                        {item.submissionHistory.map((entry) => (
                          <article key={`${item.tournamentId}-${entry.roundId}`} className="profile-history-card">
                            <p>
                              <strong>
                                {t('profile.team.round')}: {entry.roundTitle}
                              </strong>
                            </p>
                            <p>
                              {t('profile.team.roundStatus')}: {t(`profile.status.${entry.roundStatus}`)}
                            </p>
                            <p>
                              {t('profile.team.submissionStatus')}:{' '}
                              {t(`profile.submission.${entry.submissionStatus}`)}
                            </p>
                            <p>
                              {t('profile.team.submittedAt')}: {formatDateTime(entry.submittedAt, language)}
                            </p>
                            <div className="profile-links">
                              <a href={entry.repoUrl} target="_blank" rel="noreferrer">
                                {t('profile.team.links.repository')}
                              </a>
                              <a href={entry.demoUrl} target="_blank" rel="noreferrer">
                                {t('profile.team.links.demo')}
                              </a>
                              {entry.liveDemoUrl ? (
                                <a href={entry.liveDemoUrl} target="_blank" rel="noreferrer">
                                  {t('profile.team.links.liveDemo')}
                                </a>
                              ) : null}
                            </div>
                          </article>
                        ))}
                      </div>
                    </>
                  )}
                </article>
              ))}
            </div>
          ) : null}
        </article>
      ) : null}

      {summary.kind === 'JURY' ? (
        <article className="card panel-card">
          <h2>{t('profile.jury.title')}</h2>
          {summary.items.length === 0 ? (
            <p className="state-callout subtle">{t('profile.jury.empty')}</p>
          ) : null}

          {summary.items.length > 0 ? (
            <>
              <div className="profile-grid">
                <div className="profile-item">
                  <span>{t('profile.jury.totalAssignments')}</span>
                  <strong>{summary.totalAssignments}</strong>
                </div>
                <div className="profile-item">
                  <span>{t('profile.jury.evaluated')}</span>
                  <strong>{summary.evaluatedAssignments}</strong>
                </div>
                <div className="profile-item">
                  <span>{t('profile.jury.pending')}</span>
                  <strong>{summary.totalAssignments - summary.evaluatedAssignments}</strong>
                </div>
              </div>

              <div className="profile-role-grid">
                {summary.items.map((item) => (
                  <article key={item.tournamentId} className="profile-role-card">
                    <strong>{item.tournamentTitle}</strong>
                    <p>
                      {t('profile.jury.totalAssignments')}: {item.assignments}
                    </p>
                    <p>
                      {t('profile.jury.evaluated')}: {item.evaluated}
                    </p>
                    <p>
                      {t('profile.jury.pending')}: {item.assignments - item.evaluated}
                    </p>
                  </article>
                ))}
              </div>

              <h3>{t('profile.jury.historyTitle')}</h3>
              {summary.history.length === 0 ? (
                <p>{t('profile.jury.noHistory')}</p>
              ) : (
                <div className="profile-history-list">
                  {summary.history.map((entry) => (
                    <article key={entry.assignmentId} className="profile-history-card">
                      <p>
                        <strong>
                          {t('profile.jury.tournament')}: {entry.tournamentTitle}
                        </strong>
                      </p>
                      <p>
                        {t('profile.jury.round')}: {entry.roundTitle}
                      </p>
                      <p>
                        {t('profile.jury.team')}: {entry.teamName}
                      </p>
                            <p>
                              {t('profile.jury.assignedAt')}: {formatDateTime(entry.assignedAt, language)}
                            </p>
                      <p>
                        {t('profile.jury.statusLabel')}:{' '}
                        {entry.evaluated
                          ? t('profile.jury.status.evaluated')
                          : t('profile.jury.status.pending')}
                      </p>
                      <p>
                        {t('profile.jury.score')}:{' '}
                        {entry.totalScore !== null ? entry.totalScore : '-'}
                      </p>
                      <div className="profile-links">
                        <a href={entry.repoUrl} target="_blank" rel="noreferrer">
                          {t('profile.jury.links.repository')}
                        </a>
                        <a href={entry.demoUrl} target="_blank" rel="noreferrer">
                          {t('profile.jury.links.demo')}
                        </a>
                        {entry.liveDemoUrl ? (
                          <a href={entry.liveDemoUrl} target="_blank" rel="noreferrer">
                            {t('profile.jury.links.liveDemo')}
                          </a>
                        ) : null}
                      </div>
                    </article>
                  ))}
                </div>
              )}
            </>
          ) : null}
        </article>
      ) : null}

      {summary.kind === 'ADMIN' ? (
        <article className="card panel-card">
          <h2>{t('profile.admin.title')}</h2>
          {summary.items.length === 0 ? (
            <p className="state-callout subtle">{t('profile.admin.empty')}</p>
          ) : null}
          {summary.items.length > 0 ? (
            <div className="profile-role-grid">
              {summary.items.map((item) => (
                <article key={item.tournamentId} className="profile-role-card">
                  <div className="tournament-head">
                    <strong>{item.tournamentTitle}</strong>
                    <span className="status-pill">{t(`profile.status.${item.tournamentStatus}`)}</span>
                  </div>
                  <p>
                    {t('profile.admin.rounds')}: {item.roundsCount}
                  </p>
                </article>
              ))}
            </div>
          ) : null}
        </article>
      ) : null}
    </section>
  );
}
