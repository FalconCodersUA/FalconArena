import { FormEvent, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useNotifications } from '../app/notifications/NotificationsProvider';
import QuietLoadingCard from '../components/QuietLoadingCard';
import QuietLoadingInline from '../components/QuietLoadingInline';
import TournamentSchedulePanel from '../components/TournamentSchedulePanel';
import { ApiError, apiRequest } from '../lib/api';
import { formatDateTime } from '../lib/dateTime';
import { normalizeApiErrorMessage } from '../lib/errorMessages';
import { TournamentScheduleEvent } from '../lib/tournamentSchedule';
import {
  rememberTournamentSelection,
  resolveStoredTournamentSelection,
} from '../lib/tournamentSelection';
import { localizeWeekLabels } from '../lib/weekLabels';
import { useI18n } from '../i18n/I18nProvider';

type UserRole = 'ADMIN' | 'TEAM' | 'JURY' | 'ORGANIZER';
type RoundStatus = 'DRAFT' | 'ACTIVE' | 'SUBMISSION_CLOSED' | 'EVALUATED';
type TournamentStatus = 'DRAFT' | 'REGISTRATION' | 'RUNNING' | 'FINISHED';

type AuthMe = {
  id: string;
  fullName: string;
  email: string;
  role: UserRole;
};

type Tournament = {
  id: string;
  title: string;
  status: TournamentStatus;
};

type Round = {
  id: string;
  title: string;
  status: RoundStatus;
  deadlineAt: string;
};

type ScoreField =
  | 'technicalBackend'
  | 'technicalDatabase'
  | 'technicalFrontend'
  | 'mustHave'
  | 'stability'
  | 'usability';

type ScoreDraft = Record<ScoreField, number>;

type EvaluationView = {
  id: string;
  totalScore: number;
  comment: string | null;
  scores: unknown;
};

type Assignment = {
  id: string;
  assignedAt: string;
  submission: {
    id: string;
    repoUrl: string;
    demoUrl: string;
    liveDemoUrl: string | null;
    shortSummary: string | null;
    team: {
      id: string;
      name: string;
    };
  };
  evaluation: EvaluationView | null;
};

type DashboardActiveEntity = {
  id: string;
  name: string;
  subtitle: string;
};

type JuryDashboardMetrics = {
  summary: {
    total: number;
    pending: number;
    evaluated: number;
    currentScore: number;
  };
  weekly: {
    labels: string[];
    reviewed: number[];
    assigned: number[];
  };
  pie: {
    pending: number;
    evaluated: number;
    total: number;
  };
  activeEntities: DashboardActiveEntity[];
  activity: number[];
};

const SCORE_KEYS: ScoreField[] = [
  'technicalBackend',
  'technicalDatabase',
  'technicalFrontend',
  'mustHave',
  'stability',
  'usability',
];

const EMPTY_SCORES: ScoreDraft = {
  technicalBackend: 0,
  technicalDatabase: 0,
  technicalFrontend: 0,
  mustHave: 0,
  stability: 0,
  usability: 0,
};

const DEFAULT_WEEK_LABELS = ['Sat', 'Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri'];

const EMPTY_JURY_METRICS: JuryDashboardMetrics = {
  summary: {
    total: 0,
    pending: 0,
    evaluated: 0,
    currentScore: 0,
  },
  weekly: {
    labels: DEFAULT_WEEK_LABELS,
    reviewed: new Array(7).fill(0),
    assigned: new Array(7).fill(0),
  },
  pie: {
    pending: 0,
    evaluated: 0,
    total: 0,
  },
  activeEntities: [],
  activity: new Array(7).fill(0),
};

function clampScore(value: number) {
  if (!Number.isFinite(value)) {
    return 0;
  }

  if (value < 0) {
    return 0;
  }

  if (value > 100) {
    return 100;
  }

  return Math.round(value);
}

function parseScores(input: unknown): ScoreDraft {
  if (!input || typeof input !== 'object') {
    return EMPTY_SCORES;
  }

  const source = input as Record<string, unknown>;
  return {
    technicalBackend: clampScore(Number(source.technicalBackend)),
    technicalDatabase: clampScore(Number(source.technicalDatabase)),
    technicalFrontend: clampScore(Number(source.technicalFrontend)),
    mustHave: clampScore(Number(source.mustHave)),
    stability: clampScore(Number(source.stability)),
    usability: clampScore(Number(source.usability)),
  };
}

function getTotalDraftScore(scores: ScoreDraft) {
  return SCORE_KEYS.reduce((acc, key) => acc + scores[key], 0);
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

function isJuryDashboardMetrics(value: unknown): value is JuryDashboardMetrics {
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

export default function JuryDashboardPage() {
  const { language, t } = useI18n();
  const { notifyError, notifySuccess } = useNotifications();

  const [me, setMe] = useState<AuthMe | null>(null);
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [selectedTournamentId, setSelectedTournamentId] = useState('');
  const [rounds, setRounds] = useState<Round[]>([]);
  const [scheduleEvents, setScheduleEvents] = useState<TournamentScheduleEvent[]>([]);
  const [selectedRoundId, setSelectedRoundId] = useState('');
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [selectedAssignmentId, setSelectedAssignmentId] = useState('');
  const [metrics, setMetrics] = useState<JuryDashboardMetrics>(EMPTY_JURY_METRICS);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [roundsLoading, setRoundsLoading] = useState(false);
  const [scheduleLoading, setScheduleLoading] = useState(false);
  const [scheduleError, setScheduleError] = useState('');
  const [roundsError, setRoundsError] = useState('');
  const [assignmentsLoading, setAssignmentsLoading] = useState(false);
  const [assignmentsError, setAssignmentsError] = useState('');
  const [saveNotice, setSaveNotice] = useState('');
  const [saving, setSaving] = useState(false);

  const [scores, setScores] = useState<ScoreDraft>(EMPTY_SCORES);
  const [comment, setComment] = useState('');

  const selectedAssignment = useMemo(
    () => assignments.find((entry) => entry.id === selectedAssignmentId) ?? null,
    [assignments, selectedAssignmentId],
  );
  const selectedTournament = useMemo(
    () => tournaments.find((entry) => entry.id === selectedTournamentId) ?? null,
    [tournaments, selectedTournamentId],
  );
  const selectedRound = useMemo(
    () => rounds.find((entry) => entry.id === selectedRoundId) ?? null,
    [rounds, selectedRoundId],
  );
  const pendingAssignments = metrics.summary.pending;
  const draftTotalScore = useMemo(() => getTotalDraftScore(scores), [scores]);
  const weekLabels = metrics.weekly.labels.length > 0 ? metrics.weekly.labels : DEFAULT_WEEK_LABELS;
  const localizedWeekLabels = useMemo(
    () => localizeWeekLabels(weekLabels, language),
    [language, weekLabels],
  );
  const weeklyReviewRaw = useMemo(
    () => toSizedSeries(metrics.weekly.reviewed, weekLabels.length),
    [metrics.weekly.reviewed, weekLabels.length],
  );
  const weeklyAssignedRaw = useMemo(
    () => toSizedSeries(metrics.weekly.assigned, weekLabels.length),
    [metrics.weekly.assigned, weekLabels.length],
  );
  const weeklyReviewBars = useMemo(() => toBarHeights(weeklyReviewRaw), [weeklyReviewRaw]);
  const weeklyAssignedBars = useMemo(() => toBarHeights(weeklyAssignedRaw), [weeklyAssignedRaw]);
  const pendingDelta = Math.max(1, Math.round(pendingAssignments / 2) + 2);
  const totalDelta = Math.max(1, Math.round(metrics.summary.total / 2) + 3);
  const assignmentTotal = metrics.pie.total;
  const assignmentShares = {
    pending: metrics.pie.pending,
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
  const hasWeeklyMetrics = weeklyReviewRaw.some((value) => value > 0) || weeklyAssignedRaw.some((value) => value > 0);
  const hasStatusMetrics = assignmentTotal > 0;
  const hasActivityMetrics = activityCurve.some((value) => value > 0);

  const roleAllowed = me?.role === 'JURY';

  function applyAssignmentDraft(assignment: Assignment | null) {
    if (!assignment || !assignment.evaluation) {
      setScores(EMPTY_SCORES);
      setComment('');
      return;
    }

    setScores(parseScores(assignment.evaluation.scores));
    setComment(assignment.evaluation.comment ?? '');
  }

  async function loadInitialData() {
    setLoading(true);
    setError('');

    try {
      const [meData, tournamentData] = await Promise.all([
        apiRequest<AuthMe>('/auth/me'),
        apiRequest<Tournament[]>('/tournaments'),
      ]);

      setMe(meData);
      setTournaments(tournamentData);

      if (tournamentData.length > 0) {
        setSelectedTournamentId((current) =>
          current || resolveStoredTournamentSelection(tournamentData, tournamentData[0].id),
        );
      }
    } catch (requestError) {
      setError(
        normalizeApiErrorMessage(requestError, t, t('juryDashboard.loadFailed')),
      );
    } finally {
      setLoading(false);
    }
  }

  async function loadRounds(tournamentId: string) {
    setRoundsLoading(true);
    setRoundsError('');
    setAssignments([]);
    setSelectedRoundId('');
    setSelectedAssignmentId('');
    setSaveNotice('');

    try {
      const roundData = await apiRequest<Round[]>(`/tournaments/${tournamentId}/rounds`);
      setRounds(roundData);

      if (roundData.length > 0) {
        const preferred =
          roundData.find((entry) => entry.status === 'ACTIVE') ??
          roundData.find((entry) => entry.status === 'SUBMISSION_CLOSED') ??
          roundData[0];
        setSelectedRoundId(preferred.id);
      }
    } catch (requestError) {
      setRounds([]);
      setRoundsError(
        normalizeApiErrorMessage(requestError, t, t('juryDashboard.roundsLoadFailed')),
      );
    } finally {
      setRoundsLoading(false);
    }
  }

  async function loadAssignments(roundId: string) {
    setAssignmentsLoading(true);
    setAssignmentsError('');
    setSaveNotice('');

    try {
      const assignmentData = await apiRequest<Assignment[]>(
        `/rounds/${roundId}/assignments/me`,
      );
      setAssignments(assignmentData);

      if (assignmentData.length > 0) {
        setSelectedAssignmentId((current) => {
          const exists = assignmentData.some((entry) => entry.id === current);
          return exists ? current : assignmentData[0].id;
        });
      } else {
        setSelectedAssignmentId('');
      }
    } catch (requestError) {
      if (requestError instanceof ApiError && requestError.status === 404) {
        setAssignments([]);
        setSelectedAssignmentId('');
      } else {
        setAssignmentsError(
          normalizeApiErrorMessage(requestError, t, t('juryDashboard.assignmentsLoadFailed')),
        );
      }
    } finally {
      setAssignmentsLoading(false);
    }
  }

  async function loadSchedule(tournamentId: string) {
    setScheduleLoading(true);
    setScheduleError('');

    try {
      const data = await apiRequest<TournamentScheduleEvent[]>(
        `/tournaments/${tournamentId}/schedule`,
      );
      setScheduleEvents(data);
    } catch (requestError) {
      setScheduleEvents([]);
      setScheduleError(
        normalizeApiErrorMessage(requestError, t, t('schedule.loadFailed')),
      );
    } finally {
      setScheduleLoading(false);
    }
  }

  async function loadDashboardMetrics(tournamentId?: string, roundId?: string) {
    try {
      const params = new URLSearchParams();
      if (tournamentId) {
        params.set('tournamentId', tournamentId);
      }
      if (roundId) {
        params.set('roundId', roundId);
      }
      const query = params.toString();
      const data = await apiRequest<unknown>(
        `/dashboard/jury/metrics${query ? `?${query}` : ''}`,
      );
      if (!isJuryDashboardMetrics(data)) {
        throw new Error('Invalid metrics response');
      }
      setMetrics(data);
    } catch {
      setMetrics(EMPTY_JURY_METRICS);
    }
  }

  useEffect(() => {
    void loadInitialData();
  }, []);

  useEffect(() => {
    if (!selectedTournamentId || !roleAllowed) {
      return;
    }

    rememberTournamentSelection(selectedTournamentId);
    void loadRounds(selectedTournamentId);
    void loadSchedule(selectedTournamentId);
  }, [selectedTournamentId, roleAllowed]);

  useEffect(() => {
    if (!selectedRoundId || !roleAllowed) {
      return;
    }

    void loadAssignments(selectedRoundId);
  }, [selectedRoundId, roleAllowed]);

  useEffect(() => {
    if (!roleAllowed) {
      setMetrics(EMPTY_JURY_METRICS);
      return;
    }

    void loadDashboardMetrics(selectedTournamentId || undefined, selectedRoundId || undefined);
  }, [roleAllowed, selectedTournamentId, selectedRoundId]);

  useEffect(() => {
    applyAssignmentDraft(selectedAssignment);
  }, [selectedAssignment]);

  async function submitEvaluation(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedRoundId || !selectedAssignmentId) {
      setAssignmentsError(t('juryDashboard.validation.assignmentRequired'));
      return;
    }

    setAssignmentsError('');
    setSaveNotice('');

    const hasInvalidScore = SCORE_KEYS.some(
      (field) => !Number.isFinite(scores[field]) || scores[field] < 0 || scores[field] > 100,
    );
    if (hasInvalidScore) {
      setAssignmentsError(t('juryDashboard.validation.scoreRange'));
      return;
    }

    const normalizedComment = comment.trim();
    if (normalizedComment.length > 2000) {
      setAssignmentsError(t('juryDashboard.validation.commentTooLong'));
      return;
    }

    setSaving(true);

    try {
      await apiRequest(`/rounds/${selectedRoundId}/assignments/${selectedAssignmentId}/evaluation`, {
        method: 'POST',
        body: {
          scores,
          comment: normalizedComment || undefined,
        },
      });

      setSaveNotice(t('juryDashboard.saved'));
      await Promise.all([
        loadAssignments(selectedRoundId),
        loadDashboardMetrics(selectedTournamentId || undefined, selectedRoundId),
      ]);
      notifySuccess(t('juryDashboard.saved'));
    } catch (requestError) {
      const message = normalizeApiErrorMessage(
        requestError,
        t,
        t('juryDashboard.saveFailed'),
      );
      setAssignmentsError(message);
      notifyError(message);
    } finally {
      setSaving(false);
    }
  }

  function updateScore(field: ScoreField, value: string) {
    const numeric = clampScore(Number(value));
    setScores((current) => ({
      ...current,
      [field]: numeric,
    }));
  }

  if (loading) {
    return <QuietLoadingCard label={t('juryDashboard.loading')} />;
  }

  if (error) {
    return (
      <article className="card state-card">
        <p className="form-error">{error}</p>
        <button type="button" className="button button-soft" onClick={loadInitialData}>
          {t('juryDashboard.retry')}
        </button>
      </article>
    );
  }

  if (!me) {
    return <article className="card state-card">{t('juryDashboard.loadFailed')}</article>;
  }

  if (!roleAllowed) {
    return (
      <article className="card state-card">
        <p className="eyebrow">{t('juryDashboard.accessTitle')}</p>
        <h1>{t('juryDashboard.accessDenied')}</h1>
        <p className="lead">{t('juryDashboard.accessLead')}</p>
      </article>
    );
  }

  if (tournaments.length === 0) {
    return <article className="card state-card">{t('juryDashboard.noTournaments')}</article>;
  }

  return (
    <section className="team-dashboard">
      <header className="section-header">
        <p className="eyebrow">{t('juryDashboard.eyebrow')}</p>
        <h1>{t('juryDashboard.title')}</h1>
        <p className="lead">{t('juryDashboard.lead')}</p>
      </header>

      <article className="card panel-card dashboard-overview-card dashboard-overview-card--role">
        <div className="dashboard-overview-meta">
          <div>
            <p className="eyebrow">{t('juryDashboard.eyebrow')}</p>
            <h2>{t('shell.overview')}</h2>
            <p>{t('juryDashboard.lead')}</p>
          </div>
          <div className="dashboard-overview-status">
            <span>{t('juryDashboard.tournamentLabel')}</span>
            <strong>{selectedTournament?.title ?? '-'}</strong>
            <p>
              {selectedTournament
                ? `${t(`tournaments.status.${selectedTournament.status}`)} · ${rounds.length} ${t('adminDashboard.summary.rounds').toLowerCase()}`
                : t('juryDashboard.noTournaments')}
            </p>
          </div>
        </div>

        <div className="dashboard-overview-top">
          <div className="dashboard-summary-tiles">
            <article className="dashboard-highlight-tile">
              <div className="dashboard-tile-head">
                <span>{t('juryDashboard.summary.pending')}</span>
                <span className="dashboard-tile-chip" aria-hidden />
              </div>
              <strong>{pendingAssignments}</strong>
              <div className="dashboard-tile-foot">
                <a href="#jury-assignment-list">{t('shell.viewAll')}</a>
                <span>
                  +{pendingDelta} {t('shell.thisMonth')}
                </span>
              </div>
            </article>
            <article className="dashboard-muted-tile">
              <div className="dashboard-tile-head">
                <span>{t('juryDashboard.summary.total')}</span>
                <span className="dashboard-tile-chip muted" aria-hidden />
              </div>
              <strong>{metrics.summary.total}</strong>
              <div className="dashboard-tile-foot">
                <a href="#jury-evaluation-form">{t('shell.viewAll')}</a>
                <span>
                  +{totalDelta} {t('shell.thisMonth')}
                </span>
              </div>
            </article>
          </div>

          <div className="dashboard-quick-actions">
            <div className="dashboard-quick-head">
              <strong>{t('shell.quickActions')}</strong>
            </div>
            <a href="#jury-assignment-list" className="button dashboard-action is-teal">
              {t('juryDashboard.assignmentsTitle')}
            </a>
            <a href="#jury-evaluation-form" className="button dashboard-action is-purple">
              {t('juryDashboard.evaluationTitle')}
            </a>
            <a href="#jury-selectors" className="button dashboard-action is-orange">
              {t('juryDashboard.tournamentLabel')}
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
                  {t('shell.assigned')}
                </span>
              </div>
            </div>
            {hasWeeklyMetrics ? (
              <>
                <div className="dashboard-bars">
                  {weeklyReviewBars.map((value, index) => (
                    <div key={`jury-bar-a-${index}`} className="dashboard-bar-pair">
                      <span className="dashboard-bar is-primary" style={{ height: `${value}%` }} />
                      <span
                        className="dashboard-bar is-secondary"
                        style={{ height: `${weeklyAssignedBars[index] ?? 0}%` }}
                      />
                    </div>
                  ))}
                </div>
                <div className="dashboard-bar-labels">
                  {localizedWeekLabels.map((label) => (
                    <span key={`jury-week-${label}`}>{label}</span>
                  ))}
                </div>
              </>
            ) : (
              <p className="dashboard-empty-note">{t('juryDashboard.metrics.noWeekly')}</p>
            )}
          </article>

          <article className="dashboard-pie-card">
            <h3>{t('shell.submissionStatus')}</h3>
            {hasStatusMetrics ? (
              <>
                <div
                  className="dashboard-pie"
                  style={{
                    background: `conic-gradient(#5e17eb 0 ${assignmentShares.evaluated}%, #f8890a ${assignmentShares.evaluated}% 100%)`,
                  }}
                >
                  <div className="dashboard-pie-center">{assignmentTotal}</div>
                </div>
                <div className="dashboard-pie-legend">
                  <p>
                    <i className="dot is-primary" aria-hidden />
                    {t('juryDashboard.summary.evaluated')}: {assignmentShares.evaluated}%
                  </p>
                  <p>
                    <i className="dot is-orange" aria-hidden />
                    {t('juryDashboard.summary.pending')}: {assignmentShares.pending}%
                  </p>
                  <p>
                    <i className="dot is-teal" aria-hidden />
                    {t('juryDashboard.summary.currentScore')}:{' '}
                    {selectedAssignment ? draftTotalScore : metrics.summary.currentScore}
                  </p>
                </div>
              </>
            ) : (
              <p className="dashboard-empty-note">{t('juryDashboard.metrics.noStatus')}</p>
            )}
          </article>
        </div>

        <div className="dashboard-lower-grid">
          <article className="dashboard-mini-card is-teams">
            <h3>{t('shell.activeTeams')}</h3>
            {quickTeamsPreview.length === 0 ? (
              <p className="inline-hint">{t('juryDashboard.noAssignments')}</p>
            ) : (
              <>
                <div className="dashboard-mini-avatars">
                  {quickTeamsPreview.map((entry) => (
                    <span key={`jury-avatar-${entry.id}`} className="dashboard-mini-avatar">
                      {entry.initials}
                    </span>
                  ))}
                </div>
                <div className="dashboard-mini-caption-row">
                  {quickTeamsPreview.map((entry) => (
                    <div key={`jury-caption-${entry.id}`} className="dashboard-mini-caption">
                      <strong>{entry.name}</strong>
                      <p>{entry.subtitle}</p>
                    </div>
                  ))}
                </div>
                <div className="dashboard-mini-links">
                  <a href="#jury-assignment-list" className="button dashboard-action is-teal">
                    {t('juryDashboard.assignmentsTitle')}
                  </a>
                  <Link to="/app/messages" className="button dashboard-action is-purple">
                    {t('shell.messages')}
                  </Link>
                </div>
              </>
            )}
          </article>

          <article className="dashboard-mini-card">
            <h3>{t('shell.activityHistory')}</h3>
            {hasActivityMetrics ? (
              <div className="dashboard-line-wrap">
                <svg viewBox="0 0 320 96" preserveAspectRatio="none" className="dashboard-line-svg" aria-hidden>
                  <path d={activityPath} />
                </svg>
              </div>
            ) : (
              <p className="dashboard-empty-note">{t('juryDashboard.metrics.noActivity')}</p>
            )}
          </article>
        </div>

      </article>

      <article id="jury-selectors" className="card panel-card">
        <label className="field" htmlFor="jury-tournament-select">
          <span>{t('juryDashboard.tournamentLabel')}</span>
          <select
            id="jury-tournament-select"
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

        <label className="field" htmlFor="jury-round-select">
          <span>{t('juryDashboard.roundLabel')}</span>
          <select
            id="jury-round-select"
            className="select-input"
            value={selectedRoundId}
            onChange={(event) => setSelectedRoundId(event.target.value)}
            disabled={roundsLoading || rounds.length === 0}
          >
            {rounds.map((round) => (
              <option key={round.id} value={round.id}>
                {round.title} - {t(`juryDashboard.roundStatus.${round.status}`)}
              </option>
            ))}
          </select>
        </label>

        {roundsLoading ? <QuietLoadingInline label={t('juryDashboard.roundsLoading')} compact /> : null}
        {roundsError ? (
          <>
            <p className="form-error">{roundsError}</p>
            <button
              type="button"
              className="button button-soft"
              onClick={() => void loadRounds(selectedTournamentId)}
            >
              {t('juryDashboard.retry')}
            </button>
          </>
        ) : null}
        {!roundsLoading && rounds.length === 0 ? <p>{t('juryDashboard.noRounds')}</p> : null}
      </article>

      <TournamentSchedulePanel
        events={scheduleEvents}
        loading={scheduleLoading}
        error={scheduleError}
        onRetry={() => void loadSchedule(selectedTournamentId)}
        lead={t('juryDashboard.scheduleLead')}
      />

      <div className="team-grid">
        <article id="jury-assignment-list" className="card panel-card">
          <h2>{t('juryDashboard.assignmentsTitle')}</h2>
          {assignmentsLoading ? <QuietLoadingInline label={t('juryDashboard.assignmentsLoading')} compact /> : null}
          {assignmentsError ? (
            <>
              <p className="form-error">{assignmentsError}</p>
              {selectedRoundId ? (
                <button
                  type="button"
                  className="button button-soft"
                  onClick={() => void loadAssignments(selectedRoundId)}
                >
                  {t('juryDashboard.retry')}
                </button>
              ) : null}
            </>
          ) : null}
          {saveNotice ? <p className="form-success">{saveNotice}</p> : null}

          {!assignmentsLoading && assignments.length === 0 ? (
            <p>{t('juryDashboard.noAssignments')}</p>
          ) : null}

          {assignments.length > 0 ? (
            <div className="assignment-list">
              {assignments.map((assignment) => (
                <button
                  key={assignment.id}
                  type="button"
                  className={`assignment-item${selectedAssignmentId === assignment.id ? ' active' : ''}`}
                  onClick={() => setSelectedAssignmentId(assignment.id)}
                >
                  <div className="assignment-head">
                    <strong>{assignment.submission.team.name}</strong>
                    <span>
                      {assignment.evaluation
                        ? t('juryDashboard.evaluationDone')
                        : t('juryDashboard.evaluationPending')}
                    </span>
                  </div>
                  <p>
                          {t('juryDashboard.assignedAt')}: {formatDateTime(assignment.assignedAt, language)}
                  </p>
                </button>
              ))}
            </div>
          ) : null}
        </article>

        <article id="jury-evaluation-form" className="card panel-card">
          <h2>{t('juryDashboard.evaluationTitle')}</h2>
          {!selectedAssignment ? (
            <p>{t('juryDashboard.pickAssignment')}</p>
          ) : (
            <form className="panel-form" onSubmit={submitEvaluation} noValidate>
              <div className="round-summary">
                <p>
                  <strong>
                    {t('juryDashboard.teamLabel')}: {selectedAssignment.submission.team.name}
                  </strong>
                </p>
                <p>
                  <a href={selectedAssignment.submission.repoUrl} target="_blank" rel="noreferrer">
                    {t('juryDashboard.links.repository')}
                  </a>
                </p>
                <p>
                  <a href={selectedAssignment.submission.demoUrl} target="_blank" rel="noreferrer">
                    {t('juryDashboard.links.demo')}
                  </a>
                </p>
                {selectedAssignment.submission.liveDemoUrl ? (
                  <p>
                    <a
                      href={selectedAssignment.submission.liveDemoUrl}
                      target="_blank"
                      rel="noreferrer"
                    >
                      {t('juryDashboard.links.liveDemo')}
                    </a>
                  </p>
                ) : null}
                {selectedAssignment.submission.shortSummary ? (
                  <p>{selectedAssignment.submission.shortSummary}</p>
                ) : null}
                {selectedAssignment.evaluation ? (
                  <div className="state-callout subtle">
                    <strong>{t('juryDashboard.summary.lastSaved')}</strong>
                    <p>{t('juryDashboard.summary.savedScore')}: {selectedAssignment.evaluation.totalScore}</p>
                  </div>
                ) : null}
                {selectedRound?.status === 'ACTIVE' ? (
                  <div className="state-callout subtle">
                    <strong>{t('juryDashboard.activeRoundWarningTitle')}</strong>
                    <p>{t('juryDashboard.activeRoundWarningLead')}</p>
                  </div>
                ) : null}
              </div>

              <div className="scores-grid">
                {SCORE_KEYS.map((field) => (
                  <label key={field} className="field" htmlFor={`score-${field}`}>
                    <span>{t(`juryDashboard.scores.${field}`)}</span>
                    <input
                      id={`score-${field}`}
                      type="number"
                      min={0}
                      max={100}
                      step={1}
                      value={scores[field]}
                      onChange={(event) => updateScore(field, event.target.value)}
                      required
                    />
                  </label>
                ))}
              </div>

              <label className="field" htmlFor="jury-comment">
                <span>{t('juryDashboard.comment')}</span>
                <textarea
                  id="jury-comment"
                  value={comment}
                  onChange={(event) => setComment(event.target.value)}
                  maxLength={2000}
                />
              </label>

              <button type="submit" className="button button-primary" disabled={saving}>
                {saving ? t('juryDashboard.saving') : t('juryDashboard.save')}
              </button>
            </form>
          )}
        </article>
      </div>
    </section>
  );
}
