import { FormEvent, useEffect, useMemo, useState } from 'react';
import { apiRequest } from '../lib/api';
import { useI18n } from '../i18n/I18nProvider';

type UserRole = 'ADMIN' | 'TEAM' | 'JURY' | 'ORGANIZER';
type TournamentStatus = 'DRAFT' | 'REGISTRATION' | 'RUNNING' | 'FINISHED';
type RoundStatus = 'DRAFT' | 'ACTIVE' | 'SUBMISSION_CLOSED' | 'EVALUATED';

type AuthMe = {
  id: string;
  email: string;
  role: UserRole;
};

type ManagedUserRole = 'ADMIN' | 'TEAM' | 'JURY' | 'ORGANIZER';

type CreatedUser = {
  id: string;
  email: string;
  fullName: string;
  role: ManagedUserRole;
  createdAt: string;
};

type Tournament = {
  id: string;
  title: string;
  description: string | null;
  status: TournamentStatus;
  registrationOpenAt: string;
  registrationCloseAt: string;
  maxTeams: number | null;
};

type Round = {
  id: string;
  sequence: number;
  title: string;
  status: RoundStatus;
  startsAt: string;
  deadlineAt: string;
};

type RoundOperationState = {
  loading: boolean;
  notice: string;
  error: string;
};

type DashboardActiveEntity = {
  id: string;
  name: string;
  subtitle: string;
};

type AdminDashboardMetrics = {
  summary: {
    runningTournaments: number;
    registrationTournaments: number;
    tournamentsTotal: number;
    roundsTotal: number;
    activeRounds: number;
    closedRounds: number;
    evaluatedRounds: number;
  };
  weekly: {
    labels: string[];
    reviewed: number[];
    submissions: number[];
  };
  pie: {
    active: number;
    closed: number;
    evaluated: number;
    total: number;
  };
  activeEntities: DashboardActiveEntity[];
  activity: number[];
};

const EMPTY_OP_STATE: RoundOperationState = {
  loading: false,
  notice: '',
  error: '',
};

const DEFAULT_WEEK_LABELS = ['Sat', 'Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri'];

const EMPTY_ADMIN_METRICS: AdminDashboardMetrics = {
  summary: {
    runningTournaments: 0,
    registrationTournaments: 0,
    tournamentsTotal: 0,
    roundsTotal: 0,
    activeRounds: 0,
    closedRounds: 0,
    evaluatedRounds: 0,
  },
  weekly: {
    labels: DEFAULT_WEEK_LABELS,
    reviewed: new Array(7).fill(0),
    submissions: new Array(7).fill(0),
  },
  pie: {
    active: 0,
    closed: 0,
    evaluated: 0,
    total: 0,
  },
  activeEntities: [],
  activity: new Array(7).fill(0),
};

function formatDate(value: string, language: string) {
  return new Date(value).toLocaleString(language === 'uk' ? 'uk-UA' : 'en-US');
}

function toInputDateTime(value: Date) {
  const yyyy = value.getFullYear();
  const mm = String(value.getMonth() + 1).padStart(2, '0');
  const dd = String(value.getDate()).padStart(2, '0');
  const hh = String(value.getHours()).padStart(2, '0');
  const min = String(value.getMinutes()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}T${hh}:${min}`;
}

function fromInputDateTime(value: string) {
  return new Date(value).toISOString();
}

function isPositiveInteger(value: string) {
  if (!value.trim()) {
    return false;
  }

  const numeric = Number(value);
  return Number.isInteger(numeric) && numeric > 0;
}

function isValidEmail(value: string) {
  return /^\S+@\S+\.\S+$/.test(value);
}

function toInitials(value: string) {
  const chunks = value
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2);
  if (chunks.length === 0) {
    return 'FA';
  }
  return chunks.map((chunk) => chunk[0]?.toUpperCase() ?? '').join('');
}

function toSizedSeries(values: number[], size: number) {
  const output = values.slice(0, size).map((value) => Math.max(0, value));
  while (output.length < size) {
    output.push(0);
  }
  return output;
}

function toBarHeights(values: number[]) {
  const max = Math.max(...values, 0);
  if (max <= 0) {
    return values.map(() => 0);
  }
  return values.map((value) => Math.round((value / max) * 100));
}

function isAdminDashboardMetrics(value: unknown): value is AdminDashboardMetrics {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const payload = value as { summary?: unknown; weekly?: unknown; pie?: unknown };
  return (
    !!payload.summary &&
    typeof payload.summary === 'object' &&
    !!payload.weekly &&
    typeof payload.weekly === 'object' &&
    !!payload.pie &&
    typeof payload.pie === 'object'
  );
}

function buildSparkPath(values: number[], width = 320, height = 96) {
  if (values.length === 0) {
    return '';
  }

  const max = Math.max(...values, 1);
  const step = values.length > 1 ? width / (values.length - 1) : width;
  return values
    .map((value, index) => {
      const x = index * step;
      const y = height - (value / max) * height;
      return `${index === 0 ? 'M' : 'L'} ${x.toFixed(2)} ${y.toFixed(2)}`;
    })
    .join(' ');
}

export default function AdminDashboardPage() {
  const { language, t } = useI18n();

  const [me, setMe] = useState<AuthMe | null>(null);
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [selectedTournamentId, setSelectedTournamentId] = useState('');
  const [rounds, setRounds] = useState<Round[]>([]);
  const [metrics, setMetrics] = useState<AdminDashboardMetrics>(EMPTY_ADMIN_METRICS);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [roundsLoading, setRoundsLoading] = useState(false);
  const [roundsError, setRoundsError] = useState('');
  const [statusLoading, setStatusLoading] = useState(false);
  const [statusError, setStatusError] = useState('');
  const [statusNotice, setStatusNotice] = useState('');

  const [createTournamentLoading, setCreateTournamentLoading] = useState(false);
  const [createTournamentError, setCreateTournamentError] = useState('');
  const [createTournamentNotice, setCreateTournamentNotice] = useState('');

  const [createRoundLoading, setCreateRoundLoading] = useState(false);
  const [createRoundError, setCreateRoundError] = useState('');
  const [createRoundNotice, setCreateRoundNotice] = useState('');

  const [createUserLoading, setCreateUserLoading] = useState(false);
  const [createUserError, setCreateUserError] = useState('');
  const [createUserNotice, setCreateUserNotice] = useState('');

  const [opsByRoundId, setOpsByRoundId] = useState<Record<string, RoundOperationState>>({});
  const [minReviewersByRoundId, setMinReviewersByRoundId] = useState<Record<string, number>>({});
  const [resetByRoundId, setResetByRoundId] = useState<Record<string, boolean>>({});

  const now = new Date();

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [registrationOpenAt, setRegistrationOpenAt] = useState(toInputDateTime(now));
  const [registrationCloseAt, setRegistrationCloseAt] = useState(
    toInputDateTime(new Date(now.getTime() + 24 * 60 * 60 * 1000)),
  );
  const [maxTeams, setMaxTeams] = useState('');

  const [roundTitle, setRoundTitle] = useState('');
  const [roundDescription, setRoundDescription] = useState('');
  const [mustHaveRaw, setMustHaveRaw] = useState('');
  const [roundStartsAt, setRoundStartsAt] = useState(toInputDateTime(now));
  const [roundDeadlineAt, setRoundDeadlineAt] = useState(
    toInputDateTime(new Date(now.getTime() + 24 * 60 * 60 * 1000)),
  );

  const [userFullName, setUserFullName] = useState('');
  const [userEmail, setUserEmail] = useState('');
  const [userPassword, setUserPassword] = useState('');
  const [userRole, setUserRole] = useState<ManagedUserRole>('JURY');

  const selectedTournament =
    tournaments.find((entry) => entry.id === selectedTournamentId) ?? null;

  const roleAllowed = me?.role === 'ADMIN' || me?.role === 'ORGANIZER';
  const creatableRoles: ManagedUserRole[] =
    me?.role === 'ADMIN' ? ['JURY', 'ORGANIZER', 'TEAM', 'ADMIN'] : ['JURY', 'ORGANIZER', 'TEAM'];
  const runningTournaments = metrics.summary.runningTournaments;
  const activeRounds = metrics.summary.activeRounds;
  const closedRounds = metrics.summary.closedRounds;
  const evaluatedRounds = metrics.summary.evaluatedRounds;
  const weekLabels = metrics.weekly.labels.length > 0 ? metrics.weekly.labels : DEFAULT_WEEK_LABELS;
  const weeklyReviewedRaw = useMemo(
    () => toSizedSeries(metrics.weekly.reviewed, weekLabels.length),
    [metrics.weekly.reviewed, weekLabels.length],
  );
  const weeklySubmissionRaw = useMemo(
    () => toSizedSeries(metrics.weekly.submissions, weekLabels.length),
    [metrics.weekly.submissions, weekLabels.length],
  );
  const weeklyReviewedBars = useMemo(() => toBarHeights(weeklyReviewedRaw), [weeklyReviewedRaw]);
  const weeklySubmissionBars = useMemo(
    () => toBarHeights(weeklySubmissionRaw),
    [weeklySubmissionRaw],
  );
  const runningDelta = Math.max(1, Math.round(runningTournaments / 2) + 2);
  const totalDelta = Math.max(1, Math.round(metrics.summary.tournamentsTotal / 3) + 4);
  const statusTotal = metrics.pie.total;
  const statusShares = {
    active: metrics.pie.active,
    closed: metrics.pie.closed,
    evaluated: metrics.pie.evaluated,
  };
  const quickTeams = metrics.activeEntities.map((entry) => ({
    id: entry.id,
    name: entry.name,
    subtitle: entry.subtitle,
    initials: toInitials(entry.name),
  }));
  const quickTeamsPreview = quickTeams.slice(0, 3);
  const activityCurve = toSizedSeries(metrics.activity, 8);
  const activityPath = buildSparkPath(activityCurve);

  function updateRoundOperationState(roundId: string, patch: Partial<RoundOperationState>) {
    setOpsByRoundId((current) => ({
      ...current,
      [roundId]: {
        ...(current[roundId] ?? EMPTY_OP_STATE),
        ...patch,
      },
    }));
  }

  async function loadTournaments() {
    const list = await apiRequest<Tournament[]>('/tournaments');
    setTournaments(list);
    if (list.length > 0) {
      setSelectedTournamentId((current) => current || list[0].id);
    } else {
      setSelectedTournamentId('');
    }
  }

  async function loadRounds(tournamentId: string) {
    setRoundsLoading(true);
    setRoundsError('');
    try {
      const data = await apiRequest<Round[]>(`/tournaments/${tournamentId}/rounds`);
      setRounds(data);
    } catch (requestError) {
      setRounds([]);
      setRoundsError(
        requestError instanceof Error
          ? requestError.message
          : t('adminDashboard.roundsLoadFailed'),
      );
    } finally {
      setRoundsLoading(false);
    }
  }

  async function loadDashboardMetrics(tournamentId?: string) {
    try {
      const query = tournamentId ? `?tournamentId=${encodeURIComponent(tournamentId)}` : '';
      const data = await apiRequest<unknown>(`/dashboard/admin/metrics${query}`);
      if (!isAdminDashboardMetrics(data)) {
        throw new Error('Invalid metrics response');
      }
      setMetrics(data);
    } catch {
      setMetrics(EMPTY_ADMIN_METRICS);
    }
  }

  async function loadInitial() {
    setLoading(true);
    setError('');
    try {
      const [meData] = await Promise.all([apiRequest<AuthMe>('/auth/me')]);
      setMe(meData);
      if (meData.role === 'ADMIN' || meData.role === 'ORGANIZER') {
        await loadTournaments();
      }
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : t('adminDashboard.loadFailed'),
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadInitial();
  }, []);

  useEffect(() => {
    if (!selectedTournamentId || !roleAllowed) {
      setRounds([]);
      return;
    }

    void loadRounds(selectedTournamentId);
  }, [selectedTournamentId, roleAllowed]);

  useEffect(() => {
    if (!roleAllowed) {
      setMetrics(EMPTY_ADMIN_METRICS);
      return;
    }

    void loadDashboardMetrics(selectedTournamentId || undefined);
  }, [roleAllowed, selectedTournamentId]);

  async function submitTournament(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setCreateTournamentError('');
    setCreateTournamentNotice('');

    const normalizedTitle = title.trim();
    if (normalizedTitle.length < 3 || normalizedTitle.length > 120) {
      setCreateTournamentError(t('adminDashboard.validation.tournamentTitleLength'));
      return;
    }

    const normalizedDescription = description.trim();
    const openDate = new Date(registrationOpenAt);
    const closeDate = new Date(registrationCloseAt);
    if (!registrationOpenAt || !registrationCloseAt || Number.isNaN(openDate.getTime()) || Number.isNaN(closeDate.getTime()) || openDate >= closeDate) {
      setCreateTournamentError(t('adminDashboard.validation.registrationWindowInvalid'));
      return;
    }

    if (maxTeams && !isPositiveInteger(maxTeams)) {
      setCreateTournamentError(t('adminDashboard.validation.maxTeamsInvalid'));
      return;
    }

    setCreateTournamentLoading(true);

    try {
      await apiRequest('/tournaments', {
        method: 'POST',
        body: {
          title: normalizedTitle,
          description: normalizedDescription || undefined,
          registrationOpenAt: fromInputDateTime(registrationOpenAt),
          registrationCloseAt: fromInputDateTime(registrationCloseAt),
          maxTeams: maxTeams ? Number(maxTeams) : undefined,
        },
      });

      setTitle('');
      setDescription('');
      setMaxTeams('');
      setCreateTournamentNotice(t('adminDashboard.createTournamentSuccess'));
      await loadTournaments();
    } catch (requestError) {
      setCreateTournamentError(
        requestError instanceof Error
          ? requestError.message
          : t('adminDashboard.createTournamentFailed'),
      );
    } finally {
      setCreateTournamentLoading(false);
    }
  }

  async function updateTournamentStatus(status: TournamentStatus) {
    if (!selectedTournamentId) {
      return;
    }

    setStatusLoading(true);
    setStatusError('');
    setStatusNotice('');

    try {
      await apiRequest(`/tournaments/${selectedTournamentId}/status`, {
        method: 'PATCH',
        body: { status },
      });

      setStatusNotice(t('adminDashboard.tournamentStatusUpdated'));
      await loadTournaments();
      await loadDashboardMetrics(selectedTournamentId);
    } catch (requestError) {
      setStatusError(
        requestError instanceof Error
          ? requestError.message
          : t('adminDashboard.tournamentStatusFailed'),
      );
    } finally {
      setStatusLoading(false);
    }
  }

  async function submitRound(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedTournamentId) {
      return;
    }

    setCreateRoundError('');
    setCreateRoundNotice('');

    const normalizedRoundTitle = roundTitle.trim();
    if (normalizedRoundTitle.length < 3 || normalizedRoundTitle.length > 140) {
      setCreateRoundError(t('adminDashboard.validation.roundTitleLength'));
      return;
    }

    const normalizedRoundDescription = roundDescription.trim();
    if (normalizedRoundDescription.length < 10 || normalizedRoundDescription.length > 5000) {
      setCreateRoundError(t('adminDashboard.validation.roundDescriptionLength'));
      return;
    }

    const startsAt = new Date(roundStartsAt);
    const deadlineAt = new Date(roundDeadlineAt);
    if (!roundStartsAt || !roundDeadlineAt || Number.isNaN(startsAt.getTime()) || Number.isNaN(deadlineAt.getTime()) || startsAt >= deadlineAt) {
      setCreateRoundError(t('adminDashboard.validation.roundWindowInvalid'));
      return;
    }

    setCreateRoundLoading(true);

    try {
      const mustHave = mustHaveRaw
        .split(',')
        .map((entry) => entry.trim())
        .filter((entry) => entry.length > 0);

      await apiRequest(`/tournaments/${selectedTournamentId}/rounds`, {
        method: 'POST',
        body: {
          title: normalizedRoundTitle,
          description: normalizedRoundDescription,
          mustHave: mustHave.length > 0 ? mustHave : undefined,
          startsAt: fromInputDateTime(roundStartsAt),
          deadlineAt: fromInputDateTime(roundDeadlineAt),
        },
      });

      setRoundTitle('');
      setRoundDescription('');
      setMustHaveRaw('');
      setCreateRoundNotice(t('adminDashboard.createRoundSuccess'));
      await loadRounds(selectedTournamentId);
      await loadDashboardMetrics(selectedTournamentId);
    } catch (requestError) {
      setCreateRoundError(
        requestError instanceof Error
          ? requestError.message
          : t('adminDashboard.createRoundFailed'),
      );
    } finally {
      setCreateRoundLoading(false);
    }
  }

  async function submitUser(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setCreateUserError('');
    setCreateUserNotice('');

    const normalizedFullName = userFullName.trim();
    const normalizedEmail = userEmail.trim().toLowerCase();

    if (normalizedFullName.length < 2 || normalizedFullName.length > 80) {
      setCreateUserError(t('adminDashboard.validation.userFullNameLength'));
      return;
    }

    if (!normalizedEmail) {
      setCreateUserError(t('adminDashboard.validation.userEmailRequired'));
      return;
    }

    if (!isValidEmail(normalizedEmail)) {
      setCreateUserError(t('adminDashboard.validation.userEmailInvalid'));
      return;
    }

    if (normalizedEmail === me?.email.toLowerCase()) {
      setCreateUserError(t('adminDashboard.validation.userEmailSelf'));
      return;
    }

    if (userPassword.length < 8 || userPassword.length > 128) {
      setCreateUserError(t('adminDashboard.validation.userPasswordLength'));
      return;
    }

    if (!creatableRoles.includes(userRole)) {
      setCreateUserError(t('adminDashboard.validation.userRoleInvalid'));
      return;
    }

    setCreateUserLoading(true);

    try {
      const created = await apiRequest<CreatedUser>('/auth/admin/users', {
        method: 'POST',
        body: {
          fullName: normalizedFullName,
          email: normalizedEmail,
          password: userPassword,
          role: userRole,
        },
      });

      setUserFullName('');
      setUserEmail('');
      setUserPassword('');
      setUserRole(me?.role === 'ADMIN' ? 'JURY' : 'JURY');
      setCreateUserNotice(
        t('adminDashboard.createUserSuccess').replace('{role}', t(`profile.role.${created.role}`)),
      );
    } catch (requestError) {
      setCreateUserError(
        requestError instanceof Error ? requestError.message : t('adminDashboard.createUserFailed'),
      );
    } finally {
      setCreateUserLoading(false);
    }
  }

  async function changeRoundStatus(roundId: string, status: RoundStatus) {
    if (!selectedTournamentId) {
      return;
    }

    updateRoundOperationState(roundId, { loading: true, error: '', notice: '' });
    try {
      await apiRequest(`/tournaments/${selectedTournamentId}/rounds/${roundId}/status`, {
        method: 'PATCH',
        body: { status },
      });
      updateRoundOperationState(roundId, {
        loading: false,
        notice: t('adminDashboard.roundStatusUpdated'),
      });
      await Promise.all([loadRounds(selectedTournamentId), loadTournaments()]);
      await loadDashboardMetrics(selectedTournamentId);
    } catch (requestError) {
      updateRoundOperationState(roundId, {
        loading: false,
        error:
          requestError instanceof Error
            ? requestError.message
            : t('adminDashboard.roundStatusFailed'),
      });
    }
  }

  async function distributeAssignments(roundId: string) {
    updateRoundOperationState(roundId, { loading: true, error: '', notice: '' });

    try {
      const minReviewers = minReviewersByRoundId[roundId] ?? 2;
      const resetExisting = resetByRoundId[roundId] ?? true;

      if (!Number.isInteger(minReviewers) || minReviewers < 1) {
        updateRoundOperationState(roundId, {
          loading: false,
          error: t('adminDashboard.validation.minReviewersInvalid'),
        });
        return;
      }

      await apiRequest(`/rounds/${roundId}/assignments/distribute`, {
        method: 'POST',
        body: {
          minReviewersPerSubmission: minReviewers,
          resetExisting,
        },
      });

      updateRoundOperationState(roundId, {
        loading: false,
        notice: t('adminDashboard.distributeSuccess'),
      });
      await loadDashboardMetrics(selectedTournamentId || undefined);
    } catch (requestError) {
      updateRoundOperationState(roundId, {
        loading: false,
        error:
          requestError instanceof Error
            ? requestError.message
            : t('adminDashboard.distributeFailed'),
      });
    }
  }

  async function finishEvaluation(roundId: string, force: boolean) {
    updateRoundOperationState(roundId, { loading: true, error: '', notice: '' });

    try {
      await apiRequest(`/rounds/${roundId}/finish-evaluation`, {
        method: 'POST',
        body: { force },
      });

      updateRoundOperationState(roundId, {
        loading: false,
        notice: t('adminDashboard.finishEvaluationSuccess'),
      });
      if (selectedTournamentId) {
        await Promise.all([loadRounds(selectedTournamentId), loadTournaments()]);
      }
      await loadDashboardMetrics(selectedTournamentId || undefined);
    } catch (requestError) {
      updateRoundOperationState(roundId, {
        loading: false,
        error:
          requestError instanceof Error
            ? requestError.message
            : t('adminDashboard.finishEvaluationFailed'),
      });
    }
  }

  if (loading) {
    return <article className="card state-card">{t('adminDashboard.loading')}</article>;
  }

  if (error) {
    return (
      <article className="card state-card">
        <p className="form-error">{error}</p>
        <button type="button" className="button button-soft" onClick={loadInitial}>
          {t('adminDashboard.retry')}
        </button>
      </article>
    );
  }

  if (!me) {
    return <article className="card state-card">{t('adminDashboard.loadFailed')}</article>;
  }

  if (!roleAllowed) {
    return (
      <article className="card state-card">
        <p className="eyebrow">{t('adminDashboard.accessTitle')}</p>
        <h1>{t('adminDashboard.accessDenied')}</h1>
        <p className="lead">{t('adminDashboard.accessLead')}</p>
      </article>
    );
  }

  return (
    <section className="team-dashboard">
      <header className="section-header">
        <p className="eyebrow">{t('adminDashboard.eyebrow')}</p>
        <h1>{t('adminDashboard.title')}</h1>
        <p className="lead">{t('adminDashboard.lead')}</p>
      </header>

      <article className="card panel-card dashboard-overview-card">
        <div className="dashboard-overview-top">
          <div className="dashboard-summary-tiles">
            <article className="dashboard-highlight-tile">
              <div className="dashboard-tile-head">
                <span>{t('adminDashboard.summary.running')}</span>
                <span className="dashboard-tile-chip" aria-hidden />
              </div>
              <strong>{runningTournaments}</strong>
              <div className="dashboard-tile-foot">
                <a href="#admin-manage-tournament">{t('shell.viewAll')}</a>
                <span>
                  +{runningDelta} {t('shell.thisMonth')}
                </span>
              </div>
            </article>
            <article className="dashboard-muted-tile">
              <div className="dashboard-tile-head">
                <span>{t('adminDashboard.summary.tournaments')}</span>
                <span className="dashboard-tile-chip muted" aria-hidden />
              </div>
              <strong>{metrics.summary.tournamentsTotal}</strong>
              <div className="dashboard-tile-foot">
                <a href="#admin-rounds">{t('shell.viewAll')}</a>
                <span>
                  +{totalDelta} {t('shell.thisMonth')}
                </span>
              </div>
            </article>
          </div>

          <div className="dashboard-quick-actions">
            <div className="dashboard-quick-head">
              <strong>{t('shell.quickActions')}</strong>
              <span className="dashboard-edit-link">{t('shell.edit')}</span>
            </div>
            <a href="#admin-create-tournament" className="button dashboard-action is-teal">
              {t('adminDashboard.form.createTournament')}
            </a>
            <a href="#admin-create-user" className="button dashboard-action is-purple">
              {t('adminDashboard.userForm.createUser')}
            </a>
            <a href="#admin-rounds" className="button dashboard-action is-orange">
              {t('adminDashboard.roundsTitle')}
            </a>
          </div>
        </div>

        <div className="dashboard-overview-bottom">
          <article className="dashboard-chart-card">
            <div className="dashboard-chart-head">
              <h3>{t('shell.weeklyActivity')}</h3>
              <div className="dashboard-chart-legend">
                <span>
                  <i className="dot is-secondary" aria-hidden />
                  {t('shell.reviewed')}
                </span>
                <span>
                  <i className="dot is-primary" aria-hidden />
                  {t('shell.submissions')}
                </span>
              </div>
            </div>
            <div className="dashboard-bars">
              {weeklyReviewedBars.map((value, index) => (
                <div key={`admin-bar-a-${index}`} className="dashboard-bar-pair">
                  <span className="dashboard-bar is-primary" style={{ height: `${value}%` }} />
                  <span
                    className="dashboard-bar is-secondary"
                    style={{ height: `${weeklySubmissionBars[index] ?? 0}%` }}
                  />
                </div>
              ))}
            </div>
            <div className="dashboard-bar-labels">
              {weekLabels.map((label) => (
                <span key={`admin-week-${label}`}>{label}</span>
              ))}
            </div>
          </article>

          <article className="dashboard-pie-card">
            <h3>{t('shell.submissionStatus')}</h3>
            <div
              className="dashboard-pie"
              style={{
                background: `conic-gradient(#5e17eb 0 ${statusShares.evaluated}%, #f8890a ${statusShares.evaluated}% ${statusShares.evaluated + statusShares.closed}%, #2ec9c3 ${statusShares.evaluated + statusShares.closed}% 100%)`,
              }}
            >
              <div className="dashboard-pie-center">{statusTotal}</div>
            </div>
            <div className="dashboard-pie-legend">
              <p>
                <i className="dot is-teal" aria-hidden />
                {t('adminDashboard.summary.activeRounds')}: {statusShares.active}%
              </p>
              <p>
                <i className="dot is-orange" aria-hidden />
                {t('adminDashboard.summary.closedRounds')}: {statusShares.closed}%
              </p>
              <p>
                <i className="dot is-primary" aria-hidden />
                {t('adminDashboard.summary.evaluatedRounds')}: {statusShares.evaluated}%
              </p>
            </div>
          </article>
        </div>

        <div className="dashboard-lower-grid">
          <article className="dashboard-mini-card is-teams">
            <h3>{t('shell.activeTeams')}</h3>
            {quickTeamsPreview.length === 0 ? (
              <p className="inline-hint">{t('adminDashboard.noTournaments')}</p>
            ) : (
              <>
                <div className="dashboard-mini-avatars">
                  {quickTeamsPreview.map((entry) => (
                    <span key={`admin-avatar-${entry.id}`} className="dashboard-mini-avatar">
                      {entry.initials}
                    </span>
                  ))}
                  <button type="button" className="dashboard-mini-arrow" aria-label={t('shell.viewAll')}>
                    ›
                  </button>
                </div>
                <div className="dashboard-mini-caption-row">
                  {quickTeamsPreview.map((entry) => (
                    <div key={`admin-caption-${entry.id}`} className="dashboard-mini-caption">
                      <strong>{entry.name}</strong>
                      <p>{entry.subtitle}</p>
                    </div>
                  ))}
                </div>
                <div className="dashboard-mini-cta">
                  <input type="text" readOnly value={t('shell.writeMessage')} />
                  <button type="button" className="button dashboard-action is-purple">
                    {t('shell.send')}
                  </button>
                </div>
              </>
            )}
          </article>

          <article className="dashboard-mini-card">
            <h3>{t('shell.activityHistory')}</h3>
            <div className="dashboard-line-wrap">
              <svg viewBox="0 0 320 96" preserveAspectRatio="none" className="dashboard-line-svg" aria-hidden>
                <path d={activityPath} />
              </svg>
            </div>
          </article>
        </div>

      </article>

      <div className="team-grid">
        <article id="admin-create-tournament" className="card panel-card">
          <h2>{t('adminDashboard.createTournamentTitle')}</h2>
          {createTournamentError ? <p className="form-error">{createTournamentError}</p> : null}
          {createTournamentNotice ? (
            <p className="form-success">{createTournamentNotice}</p>
          ) : null}

          <form className="panel-form" onSubmit={submitTournament} noValidate>
            <label className="field" htmlFor="admin-tournament-title">
              <span>{t('adminDashboard.form.tournamentTitle')}</span>
              <input
                id="admin-tournament-title"
                type="text"
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                required
                minLength={3}
                maxLength={120}
              />
            </label>

            <label className="field" htmlFor="admin-tournament-description">
              <span>{t('adminDashboard.form.tournamentDescription')}</span>
              <textarea
                id="admin-tournament-description"
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                maxLength={4000}
              />
            </label>

            <label className="field" htmlFor="admin-registration-open">
              <span>{t('adminDashboard.form.registrationOpenAt')}</span>
              <input
                id="admin-registration-open"
                type="datetime-local"
                value={registrationOpenAt}
                onChange={(event) => setRegistrationOpenAt(event.target.value)}
                required
              />
            </label>

            <label className="field" htmlFor="admin-registration-close">
              <span>{t('adminDashboard.form.registrationCloseAt')}</span>
              <input
                id="admin-registration-close"
                type="datetime-local"
                value={registrationCloseAt}
                onChange={(event) => setRegistrationCloseAt(event.target.value)}
                required
              />
            </label>

            <label className="field" htmlFor="admin-max-teams">
              <span>{t('adminDashboard.form.maxTeams')}</span>
              <input
                id="admin-max-teams"
                type="number"
                min={1}
                value={maxTeams}
                onChange={(event) => setMaxTeams(event.target.value)}
              />
            </label>

            <button
              type="submit"
              className="button button-primary"
              disabled={createTournamentLoading}
            >
              {createTournamentLoading
                ? t('adminDashboard.form.creatingTournament')
                : t('adminDashboard.form.createTournament')}
            </button>
          </form>
        </article>

        <article id="admin-create-user" className="card panel-card">
          <h2>{t('adminDashboard.createUserTitle')}</h2>
          <p className="inline-hint">{t('adminDashboard.createUserLead')}</p>

          {createUserError ? <p className="form-error">{createUserError}</p> : null}
          {createUserNotice ? <p className="form-success">{createUserNotice}</p> : null}

          <form className="panel-form" onSubmit={submitUser} noValidate>
            <label className="field" htmlFor="admin-user-full-name">
              <span>{t('adminDashboard.userForm.fullName')}</span>
              <input
                id="admin-user-full-name"
                type="text"
                value={userFullName}
                onChange={(event) => setUserFullName(event.target.value)}
                required
                minLength={2}
                maxLength={80}
              />
            </label>

            <label className="field" htmlFor="admin-user-email">
              <span>{t('adminDashboard.userForm.email')}</span>
              <input
                id="admin-user-email"
                type="email"
                value={userEmail}
                onChange={(event) => setUserEmail(event.target.value)}
                required
              />
            </label>

            <label className="field" htmlFor="admin-user-password">
              <span>{t('adminDashboard.userForm.password')}</span>
              <input
                id="admin-user-password"
                type="password"
                value={userPassword}
                onChange={(event) => setUserPassword(event.target.value)}
                required
                minLength={8}
                maxLength={128}
              />
            </label>

            <label className="field" htmlFor="admin-user-role">
              <span>{t('adminDashboard.userForm.role')}</span>
              <select
                id="admin-user-role"
                className="select-input"
                value={userRole}
                onChange={(event) => setUserRole(event.target.value as ManagedUserRole)}
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
        </article>

        <article id="admin-manage-tournament" className="card panel-card">
          <h2>{t('adminDashboard.manageTournamentTitle')}</h2>

          <label className="field" htmlFor="admin-tournament-select">
            <span>{t('adminDashboard.tournamentLabel')}</span>
            <select
              id="admin-tournament-select"
              className="select-input"
              value={selectedTournamentId}
              onChange={(event) => setSelectedTournamentId(event.target.value)}
            >
              {tournaments.map((tournament) => (
                <option key={tournament.id} value={tournament.id}>
                  {tournament.title}
                </option>
              ))}
            </select>
          </label>

          {selectedTournament ? (
            <>
              <div className="status-row">
                <span>{t('adminDashboard.tournamentStatus')}</span>
                <strong>{t(`tournaments.status.${selectedTournament.status}`)}</strong>
              </div>

              <div className="summary-grid compact-summary-grid">
                <div className="summary-card">
                  <span>{t('adminDashboard.summary.registration')}</span>
                  <strong>
                    {formatDate(selectedTournament.registrationOpenAt, language)}
                  </strong>
                  <p>{formatDate(selectedTournament.registrationCloseAt, language)}</p>
                </div>
                <div className="summary-card">
                  <span>{t('adminDashboard.summary.maxTeams')}</span>
                  <strong>{selectedTournament.maxTeams ?? '-'}</strong>
                  <p>{selectedTournament.description || t('adminDashboard.summary.noDescription')}</p>
                </div>
              </div>

              <div className="status-actions">
                {(['DRAFT', 'REGISTRATION', 'RUNNING', 'FINISHED'] as TournamentStatus[]).map(
                  (status) => (
                    <button
                      key={status}
                      type="button"
                      className="button button-soft"
                      disabled={statusLoading}
                      onClick={() => updateTournamentStatus(status)}
                    >
                      {t(`tournaments.status.${status}`)}
                    </button>
                  ),
                )}
              </div>

              <p className="inline-hint">
                {t('adminDashboard.registrationPeriod')}: {formatDate(selectedTournament.registrationOpenAt, language)} -{' '}
                {formatDate(selectedTournament.registrationCloseAt, language)}
              </p>
            </>
          ) : null}

          {statusError ? <p className="form-error">{statusError}</p> : null}
          {statusNotice ? <p className="form-success">{statusNotice}</p> : null}
        </article>
      </div>

      {selectedTournament ? (
        <article id="admin-create-round" className="card panel-card">
          <h2>{t('adminDashboard.createRoundTitle')}</h2>

          {createRoundError ? <p className="form-error">{createRoundError}</p> : null}
          {createRoundNotice ? <p className="form-success">{createRoundNotice}</p> : null}

          <form className="panel-form" onSubmit={submitRound} noValidate>
            <label className="field" htmlFor="admin-round-title">
              <span>{t('adminDashboard.form.roundTitle')}</span>
              <input
                id="admin-round-title"
                type="text"
                value={roundTitle}
                onChange={(event) => setRoundTitle(event.target.value)}
                required
                minLength={3}
                maxLength={140}
              />
            </label>

            <label className="field" htmlFor="admin-round-description">
              <span>{t('adminDashboard.form.roundDescription')}</span>
              <textarea
                id="admin-round-description"
                value={roundDescription}
                onChange={(event) => setRoundDescription(event.target.value)}
                required
                minLength={10}
                maxLength={5000}
              />
            </label>

            <label className="field" htmlFor="admin-round-must-have">
              <span>{t('adminDashboard.form.mustHave')}</span>
              <input
                id="admin-round-must-have"
                type="text"
                value={mustHaveRaw}
                onChange={(event) => setMustHaveRaw(event.target.value)}
              />
            </label>

            <div className="datetime-grid">
              <label className="field" htmlFor="admin-round-starts-at">
                <span>{t('adminDashboard.form.roundStartsAt')}</span>
                <input
                  id="admin-round-starts-at"
                  type="datetime-local"
                  value={roundStartsAt}
                  onChange={(event) => setRoundStartsAt(event.target.value)}
                  required
                />
              </label>

              <label className="field" htmlFor="admin-round-deadline-at">
                <span>{t('adminDashboard.form.roundDeadlineAt')}</span>
                <input
                  id="admin-round-deadline-at"
                  type="datetime-local"
                  value={roundDeadlineAt}
                  onChange={(event) => setRoundDeadlineAt(event.target.value)}
                  required
                />
              </label>
            </div>

            <button
              type="submit"
              className="button button-primary"
              disabled={createRoundLoading}
            >
              {createRoundLoading
                ? t('adminDashboard.form.creatingRound')
                : t('adminDashboard.form.createRound')}
            </button>
          </form>
        </article>
      ) : null}

      <article id="admin-rounds" className="card panel-card">
        <h2>{t('adminDashboard.roundsTitle')}</h2>

        {roundsLoading ? <p>{t('adminDashboard.roundsLoading')}</p> : null}
        {roundsError ? (
          <>
            <p className="form-error">{roundsError}</p>
            {selectedTournamentId ? (
              <button
                type="button"
                className="button button-soft"
                onClick={() => void loadRounds(selectedTournamentId)}
              >
                {t('adminDashboard.retry')}
              </button>
            ) : null}
          </>
        ) : null}
        {!roundsLoading && tournaments.length === 0 ? <p>{t('adminDashboard.noTournaments')}</p> : null}
        {!roundsLoading && rounds.length === 0 ? <p>{t('adminDashboard.noRounds')}</p> : null}

        {rounds.length > 0 ? (
            <div className="summary-grid compact-summary-grid">
              <div className="summary-card">
                <span>{t('adminDashboard.summary.rounds')}</span>
                <strong>{rounds.length}</strong>
                <p>{t('adminDashboard.summary.activeRounds')}: {activeRounds}</p>
              </div>
              <div className="summary-card">
                <span>{t('adminDashboard.summary.closedRounds')}</span>
                <strong>{closedRounds}</strong>
                <p>{t('adminDashboard.summary.evaluatedRounds')}: {evaluatedRounds}</p>
              </div>
            </div>
          ) : null}

        {rounds.length > 0 ? (
          <div className="rounds-grid">
            {rounds.map((round) => {
              const op = opsByRoundId[round.id] ?? EMPTY_OP_STATE;
              return (
                <article key={round.id} className="round-card">
                  <div className="round-card-head">
                    <strong>
                      #{round.sequence} {round.title}
                    </strong>
                    <span>{t(`adminDashboard.roundStatus.${round.status}`)}</span>
                  </div>

                  <p>
                    {t('adminDashboard.roundStartsAt')}: {formatDate(round.startsAt, language)}
                  </p>
                  <p>
                    {t('adminDashboard.roundDeadlineAt')}: {formatDate(round.deadlineAt, language)}
                  </p>

                  <div className="round-actions">
                    <button
                      type="button"
                      className="button button-soft"
                      disabled={op.loading}
                      onClick={() => changeRoundStatus(round.id, 'ACTIVE')}
                    >
                      {t('adminDashboard.activateRound')}
                    </button>
                    <button
                      type="button"
                      className="button button-soft"
                      disabled={op.loading}
                      onClick={() => changeRoundStatus(round.id, 'SUBMISSION_CLOSED')}
                    >
                      {t('adminDashboard.closeSubmissions')}
                    </button>
                  </div>

                  <div className="round-actions">
                    <button
                      type="button"
                      className="button button-soft"
                      disabled={op.loading}
                      onClick={() => finishEvaluation(round.id, false)}
                    >
                      {t('adminDashboard.finishEvaluation')}
                    </button>
                    <button
                      type="button"
                      className="button button-soft"
                      disabled={op.loading}
                      onClick={() => finishEvaluation(round.id, true)}
                    >
                      {t('adminDashboard.finishEvaluationForce')}
                    </button>
                  </div>

                  <div className="distribute-box">
                    <label className="field" htmlFor={`min-reviewers-${round.id}`}>
                      <span>{t('adminDashboard.minReviewers')}</span>
                      <input
                        id={`min-reviewers-${round.id}`}
                        type="number"
                        min={1}
                        value={minReviewersByRoundId[round.id] ?? 2}
                        onChange={(event) =>
                          setMinReviewersByRoundId((current) => ({
                            ...current,
                            [round.id]: Number(event.target.value),
                          }))
                        }
                      />
                    </label>

                    <label className="checkbox-inline" htmlFor={`reset-assignments-${round.id}`}>
                      <input
                        id={`reset-assignments-${round.id}`}
                        type="checkbox"
                        checked={resetByRoundId[round.id] ?? true}
                        onChange={(event) =>
                          setResetByRoundId((current) => ({
                            ...current,
                            [round.id]: event.target.checked,
                          }))
                        }
                      />
                      <span>{t('adminDashboard.resetAssignments')}</span>
                    </label>

                    <button
                      type="button"
                      className="button button-primary"
                      disabled={op.loading}
                      onClick={() => distributeAssignments(round.id)}
                    >
                      {t('adminDashboard.distributeAssignments')}
                    </button>
                  </div>

                  {op.error ? <p className="form-error">{op.error}</p> : null}
                  {op.notice ? <p className="form-success">{op.notice}</p> : null}
                </article>
              );
            })}
          </div>
        ) : null}
      </article>
    </section>
  );
}
