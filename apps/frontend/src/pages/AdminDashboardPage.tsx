import { FormEvent, ReactNode, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useNotifications } from '../app/notifications/NotificationsProvider';
import QuietLoadingCard from '../components/QuietLoadingCard';
import QuietLoadingInline from '../components/QuietLoadingInline';
import { apiRequest } from '../lib/api';
import { formatDateTime } from '../lib/dateTime';
import { normalizeApiErrorMessage } from '../lib/errorMessages';
import {
  AUTO_DISMISS_NOTICE_MS,
  useAutoDismissMessage,
} from '../lib/useAutoDismissMessage';
import {
  TournamentScheduleEvent,
  TournamentScheduleEventType,
} from '../lib/tournamentSchedule';
import {
  rememberTournamentSelection,
  resolveStoredTournamentSelection,
} from '../lib/tournamentSelection';
import { localizeWeekLabels } from '../lib/weekLabels';
import { resolveHtmlLanguage, useI18n } from '../i18n/I18nProvider';

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
  startsAt: string | null;
  registrationOpenAt: string;
  registrationCloseAt: string;
  maxTeams: number | null;
};

type Round = {
  id: string;
  sequence: number;
  title: string;
  description: string;
  status: RoundStatus;
  mustHave: string[];
  technologyRequirements: string[];
  additionalMaterials: string[];
  startsAt: string;
  deadlineAt: string;
};

type TournamentJuryUser = {
  id: string;
  fullName: string;
  email: string;
  role: 'JURY';
  isBlocked: boolean;
};

type TournamentJuryPayload = {
  tournamentId: string;
  tournamentTitle: string;
  assigned: TournamentJuryUser[];
  candidates: TournamentJuryUser[];
};

type RoundOperationState = {
  loading: boolean;
  notice: string;
  error: string;
};

type ScheduleOperationState = {
  loading: boolean;
  error: string;
  notice: string;
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

type AdminActivityFeedItem = {
  id: string;
  title: string;
  meta: string;
  timestamp: number;
  accent: 'purple' | 'teal' | 'orange' | 'cobalt';
};

const ADMIN_WORKSPACE_EXPANDED_KEY = 'falconarena_admin_workspace_expanded';

type AuditActivityEntry = {
  id: string;
  actorName: string | null;
  action: string;
  entityLabel: string | null;
  title: string;
  description: string;
  createdAt: string;
};

type PlatformDefaults = {
  minTeamMembers: number;
  maxTeamMembers: number;
  defaultMinReviewersPerSubmission: number;
  defaultProjectTimeZone: string;
  hideTeamsUntilRegistrationClose: boolean;
  defaultTournamentMaxTeams: number | null;
  defaultRegistrationWindowHours: number;
  defaultRoundDurationHours: number;
  defaultTournamentDescription: string;
  defaultRoundDescription: string;
};

const EMPTY_OP_STATE: RoundOperationState = {
  loading: false,
  notice: '',
  error: '',
};

const EMPTY_SCHEDULE_OP_STATE: ScheduleOperationState = {
  loading: false,
  notice: '',
  error: '',
};

const TOURNAMENT_STATUSES: TournamentStatus[] = [
  'DRAFT',
  'REGISTRATION',
  'RUNNING',
  'FINISHED',
];

const TOURNAMENT_STATUS_ORDER: Record<TournamentStatus, number> = {
  DRAFT: 0,
  REGISTRATION: 1,
  RUNNING: 2,
  FINISHED: 3,
};

function formatDashboardRoundTitle(
  title: string,
  sequence: number,
  t: (key: string) => string,
) {
  const trimmedTitle = title.trim();
  const legacyRoundMatch = trimmedTitle.match(/^Round\s+(.+)$/i);
  const prefix = `${t('adminDashboard.roundPrefix')} ${sequence}`;

  if (!legacyRoundMatch) {
    return trimmedTitle;
  }

  const suffix = legacyRoundMatch[1]?.trim();
  if (!suffix || suffix === String(sequence)) {
    return prefix;
  }

  return `${prefix}. ${suffix}`;
}

function formatDashboardRoundDescription(
  description: string,
  t: (key: string) => string,
) {
  const trimmedDescription = description.trim();
  if (/^Description for\s+.+$/i.test(trimmedDescription)) {
    return t('adminDashboard.roundDescriptionFallback');
  }

  return trimmedDescription;
}

const DEFAULT_PLATFORM_DEFAULTS: PlatformDefaults = {
  minTeamMembers: 2,
  maxTeamMembers: 8,
  defaultMinReviewersPerSubmission: 2,
  defaultProjectTimeZone: 'Europe/Kyiv',
  hideTeamsUntilRegistrationClose: true,
  defaultTournamentMaxTeams: null,
  defaultRegistrationWindowHours: 24,
  defaultRoundDurationHours: 24,
  defaultTournamentDescription: '',
  defaultRoundDescription: '',
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

function addHours(value: Date, hours: number) {
  return new Date(value.getTime() + hours * 60 * 60 * 1000);
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

function parseLineList(value: string) {
  return value
    .split(/\r?\n/)
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);
}

function canTransitionTournamentStatus(
  currentStatus: TournamentStatus,
  nextStatus: TournamentStatus,
) {
  const allowedTransitions: Record<TournamentStatus, TournamentStatus[]> = {
    DRAFT: ['REGISTRATION'],
    REGISTRATION: ['RUNNING', 'FINISHED'],
    RUNNING: ['FINISHED'],
    FINISHED: [],
  };

  return allowedTransitions[currentStatus].includes(nextStatus);
}

function getRecoverableTournamentStatuses(currentStatus: TournamentStatus) {
  return TOURNAMENT_STATUSES.filter(
    (status) => TOURNAMENT_STATUS_ORDER[status] < TOURNAMENT_STATUS_ORDER[currentStatus],
  );
}

function canTransitionRoundStatus(currentStatus: RoundStatus, nextStatus: RoundStatus) {
  const allowedTransitions: Record<RoundStatus, RoundStatus[]> = {
    DRAFT: ['ACTIVE'],
    ACTIVE: ['SUBMISSION_CLOSED'],
    SUBMISSION_CLOSED: [],
    EVALUATED: [],
  };

  return allowedTransitions[currentStatus].includes(nextStatus);
}

function canFinishRoundEvaluation(status: RoundStatus) {
  return status === 'ACTIVE' || status === 'SUBMISSION_CLOSED';
}

function canDistributeRoundAssignments(status: RoundStatus) {
  return status === 'ACTIVE' || status === 'SUBMISSION_CLOSED';
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

function getActivityAccent(action: string): AdminActivityFeedItem['accent'] {
  if (action.startsWith('evaluation.') || action.startsWith('integration.')) {
    return 'cobalt';
  }

  if (action.startsWith('submission.') || action.startsWith('round.status_')) {
    return 'teal';
  }

  if (action.startsWith('schedule.') || action.startsWith('certificate.')) {
    return 'orange';
  }

  return 'purple';
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

type AdminQuickModal = 'none' | 'createTournament' | 'createUser' | 'createRound';

function AdminActionModal({
  open,
  title,
  closeLabel,
  onClose,
  children,
}: {
  open: boolean;
  title: string;
  closeLabel: string;
  onClose: () => void;
  children: ReactNode;
}) {
  if (!open) {
    return null;
  }

  return (
    <div className="app-modal-overlay" role="presentation" onClick={onClose}>
      <article
        className="app-modal-card"
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={(event) => event.stopPropagation()}
      >
        <header className="app-modal-head">
          <h2>{title}</h2>
          <button
            type="button"
            className="button button-soft app-modal-close app-modal-secondary-action"
            onClick={onClose}
          >
            {closeLabel}
          </button>
        </header>
        <div className="app-modal-body">{children}</div>
      </article>
    </div>
  );
}

export default function AdminDashboardPage() {
  const { language, t } = useI18n();
  const dateTimeInputLang = resolveHtmlLanguage(language);
  const contentInputLang = dateTimeInputLang;
  const { notifyError, notifySuccess } = useNotifications();

  const [me, setMe] = useState<AuthMe | null>(null);
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [selectedTournamentId, setSelectedTournamentId] = useState('');
  const [rounds, setRounds] = useState<Round[]>([]);
  const [scheduleEvents, setScheduleEvents] = useState<TournamentScheduleEvent[]>([]);
  const [metrics, setMetrics] = useState<AdminDashboardMetrics>(EMPTY_ADMIN_METRICS);
  const [platformDefaults, setPlatformDefaults] = useState<PlatformDefaults>(
    DEFAULT_PLATFORM_DEFAULTS,
  );

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [roundsLoading, setRoundsLoading] = useState(false);
  const [roundsError, setRoundsError] = useState('');
  const [scheduleLoading, setScheduleLoading] = useState(false);
  const [scheduleError, setScheduleError] = useState('');
  const [statusLoading, setStatusLoading] = useState(false);
  const [statusError, setStatusError] = useState('');
  const [statusNotice, setStatusNotice] = useState('');
  const [statusRecoveryOpen, setStatusRecoveryOpen] = useState(false);
  const [statusRecoveryTarget, setStatusRecoveryTarget] = useState<TournamentStatus | ''>('');
  const [statusRecoveryReason, setStatusRecoveryReason] = useState('');
  const [statusRecoveryLoading, setStatusRecoveryLoading] = useState(false);
  const [statusRecoveryError, setStatusRecoveryError] = useState('');
  const [roundRecoveryOpen, setRoundRecoveryOpen] = useState(false);
  const [roundRecoveryRoundId, setRoundRecoveryRoundId] = useState('');
  const [roundRecoveryReason, setRoundRecoveryReason] = useState('');
  const [roundRecoveryLoading, setRoundRecoveryLoading] = useState(false);
  const [roundRecoveryError, setRoundRecoveryError] = useState('');
  const [juryLoading, setJuryLoading] = useState(false);
  const [jurySaving, setJurySaving] = useState(false);
  const [juryError, setJuryError] = useState('');
  const [juryNotice, setJuryNotice] = useState('');
  const [tournamentJury, setTournamentJury] = useState<TournamentJuryPayload | null>(null);
  const [selectedJuryIds, setSelectedJuryIds] = useState<string[]>([]);

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
  const [scheduleOp, setScheduleOp] = useState<ScheduleOperationState>(EMPTY_SCHEDULE_OP_STATE);

  const now = new Date();
  const roundOperationNoticeSignature = useMemo(
    () =>
      Object.entries(opsByRoundId)
        .filter(([, operation]) => operation.notice)
        .map(([roundId, operation]) => `${roundId}:${operation.notice}`)
        .join('\n'),
    [opsByRoundId],
  );

  useAutoDismissMessage(statusNotice, setStatusNotice);
  useAutoDismissMessage(juryNotice, setJuryNotice);
  useAutoDismissMessage(createTournamentNotice, setCreateTournamentNotice);
  useAutoDismissMessage(createRoundNotice, setCreateRoundNotice);
  useAutoDismissMessage(createUserNotice, setCreateUserNotice);

  useEffect(() => {
    if (!scheduleOp.notice) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      setScheduleOp((current) => ({ ...current, notice: '' }));
    }, AUTO_DISMISS_NOTICE_MS);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [scheduleOp.notice]);

  useEffect(() => {
    if (!roundOperationNoticeSignature) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      setOpsByRoundId((current) => {
        let changed = false;
        const next = Object.fromEntries(
          Object.entries(current).map(([roundId, operation]) => {
            if (!operation.notice) {
              return [roundId, operation];
            }

            changed = true;
            return [roundId, { ...operation, notice: '' }];
          }),
        );

        return changed ? next : current;
      });
    }, AUTO_DISMISS_NOTICE_MS);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [roundOperationNoticeSignature]);

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [tournamentStartsAt, setTournamentStartsAt] = useState('');
  const [registrationOpenAt, setRegistrationOpenAt] = useState(toInputDateTime(now));
  const [registrationCloseAt, setRegistrationCloseAt] = useState(
    toInputDateTime(new Date(now.getTime() + 24 * 60 * 60 * 1000)),
  );
  const [maxTeams, setMaxTeams] = useState('');

  const [roundTitle, setRoundTitle] = useState('');
  const [roundDescription, setRoundDescription] = useState('');
  const [mustHaveRaw, setMustHaveRaw] = useState('');
  const [technologyRequirementsRaw, setTechnologyRequirementsRaw] = useState('');
  const [additionalMaterialsRaw, setAdditionalMaterialsRaw] = useState('');
  const [roundStartsAt, setRoundStartsAt] = useState(toInputDateTime(now));
  const [roundDeadlineAt, setRoundDeadlineAt] = useState(
    toInputDateTime(new Date(now.getTime() + 24 * 60 * 60 * 1000)),
  );
  const [scheduleEditingId, setScheduleEditingId] = useState('');
  const [scheduleTitle, setScheduleTitle] = useState('');
  const [scheduleDescription, setScheduleDescription] = useState('');
  const [scheduleType, setScheduleType] = useState<TournamentScheduleEventType>('OTHER');
  const [scheduleStartsAt, setScheduleStartsAt] = useState(toInputDateTime(now));
  const [scheduleEndsAt, setScheduleEndsAt] = useState('');
  const [scheduleLocation, setScheduleLocation] = useState('');

  const [userFullName, setUserFullName] = useState('');
  const [userEmail, setUserEmail] = useState('');
  const [userPassword, setUserPassword] = useState('');
  const [userRole, setUserRole] = useState<ManagedUserRole>('JURY');
  const [quickModal, setQuickModal] = useState<AdminQuickModal>('none');
  const [activityFeedEntries, setActivityFeedEntries] = useState<AuditActivityEntry[]>([]);
  const [isWorkspaceExpanded, setIsWorkspaceExpanded] = useState(() => {
    return localStorage.getItem(ADMIN_WORKSPACE_EXPANDED_KEY) === 'true';
  });

  const selectedTournament =
    tournaments.find((entry) => entry.id === selectedTournamentId) ?? null;
  const assignedJuryIds = tournamentJury?.assigned
    .filter((jury) => !jury.isBlocked)
    .map((jury) => jury.id) ?? [];
  const selectedJuryBelowDefaultMinimum =
    selectedJuryIds.length < platformDefaults.defaultMinReviewersPerSubmission;
  const selectedJuryMinimumWarning = t('adminDashboard.jury.minReviewersWarning').replace(
    '{count}',
    String(platformDefaults.defaultMinReviewersPerSubmission),
  );

  const isAdmin = me?.role === 'ADMIN';
  const roleAllowed = me?.role === 'ADMIN' || me?.role === 'ORGANIZER';
  const creatableRoles: ManagedUserRole[] =
    me?.role === 'ADMIN' ? ['JURY', 'ORGANIZER', 'TEAM', 'ADMIN'] : ['JURY', 'ORGANIZER', 'TEAM'];
  const recoverableTournamentStatuses = selectedTournament
    ? getRecoverableTournamentStatuses(selectedTournament.status)
    : [];
  const canRecoverTournamentStatus = isAdmin && recoverableTournamentStatuses.length > 0;
  const recoveryRound = rounds.find((round) => round.id === roundRecoveryRoundId) ?? null;
  const runningTournaments = metrics.summary.runningTournaments;
  const activeRounds = metrics.summary.activeRounds;
  const closedRounds = metrics.summary.closedRounds;
  const evaluatedRounds = metrics.summary.evaluatedRounds;
  const weekLabels = metrics.weekly.labels.length > 0 ? metrics.weekly.labels : DEFAULT_WEEK_LABELS;
  const localizedWeekLabels = useMemo(
    () => localizeWeekLabels(weekLabels, language),
    [language, weekLabels],
  );
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
  const quickTeamsPreview = quickTeams.slice(0, 5);
  const activityCurve = toSizedSeries(metrics.activity, 8);
  const activityPath = buildSparkPath(activityCurve);
  const hasWeeklyMetrics =
    weeklyReviewedRaw.some((value) => value > 0) ||
    weeklySubmissionRaw.some((value) => value > 0);
  const hasStatusMetrics = statusTotal > 0;
  const hasActivityMetrics = activityCurve.some((value) => value > 0);
  const checklistItems = [
    {
      id: 'tournaments',
      done: tournaments.length > 0,
      title: t('adminDashboard.workspaceChecklist.items.tournaments.title'),
      description: tournaments.length > 0
        ? t('adminDashboard.workspaceChecklist.items.tournaments.ready')
        : t('adminDashboard.workspaceChecklist.items.tournaments.pending'),
    },
    {
      id: 'schedule',
      done: scheduleEvents.length > 0,
      title: t('adminDashboard.workspaceChecklist.items.schedule.title'),
      description: scheduleEvents.length > 0
        ? t('adminDashboard.workspaceChecklist.items.schedule.ready')
        : t('adminDashboard.workspaceChecklist.items.schedule.pending'),
    },
    {
      id: 'rounds',
      done: rounds.length > 0,
      title: t('adminDashboard.workspaceChecklist.items.rounds.title'),
      description: rounds.length > 0
        ? t('adminDashboard.workspaceChecklist.items.rounds.ready')
        : t('adminDashboard.workspaceChecklist.items.rounds.pending'),
    },
    {
      id: 'evaluation',
      done: activeRounds + closedRounds + evaluatedRounds > 0,
      title: t('adminDashboard.workspaceChecklist.items.evaluation.title'),
      description: activeRounds + closedRounds + evaluatedRounds > 0
        ? t('adminDashboard.workspaceChecklist.items.evaluation.ready')
        : t('adminDashboard.workspaceChecklist.items.evaluation.pending'),
    },
  ];
  const onboardingSteps = [
    {
      id: 'tournament',
      title: t('adminDashboard.onboarding.steps.tournament.title'),
      lead: t('adminDashboard.onboarding.steps.tournament.lead'),
    },
    {
      id: 'round',
      title: t('adminDashboard.onboarding.steps.round.title'),
      lead: t('adminDashboard.onboarding.steps.round.lead'),
    },
    {
      id: 'evaluation',
      title: t('adminDashboard.onboarding.steps.evaluation.title'),
      lead: t('adminDashboard.onboarding.steps.evaluation.lead'),
    },
  ];
  const adminActivityFeed = useMemo<AdminActivityFeedItem[]>(
    () =>
      activityFeedEntries.map((entry) => ({
        id: entry.id,
        title: entry.entityLabel || entry.title,
        meta: `${entry.description} · ${formatDateTime(entry.createdAt, language)}${
          entry.actorName ? ` · ${entry.actorName}` : ''
        }`,
        timestamp: new Date(entry.createdAt).getTime(),
        accent: getActivityAccent(entry.action),
      })),
    [activityFeedEntries, language],
  );

  function openQuickModal(modal: Exclude<AdminQuickModal, 'none'>) {
    setCreateTournamentError('');
    setCreateTournamentNotice('');
    setCreateRoundError('');
    setCreateRoundNotice('');
    setCreateUserError('');
    setCreateUserNotice('');
    if (modal === 'createTournament') {
      const current = new Date();
      setTitle('');
      setTournamentStartsAt('');
      setRegistrationOpenAt(toInputDateTime(current));
      setRegistrationCloseAt(
        toInputDateTime(
          addHours(current, platformDefaults.defaultRegistrationWindowHours),
        ),
      );
      setDescription(platformDefaults.defaultTournamentDescription);
      setMaxTeams(
        platformDefaults.defaultTournamentMaxTeams
          ? String(platformDefaults.defaultTournamentMaxTeams)
          : '',
      );
    }
    if (modal === 'createRound') {
      const current = new Date();
      setRoundTitle('');
      setRoundDescription(platformDefaults.defaultRoundDescription);
      setMustHaveRaw('');
      setTechnologyRequirementsRaw('');
      setAdditionalMaterialsRaw('');
      setRoundStartsAt(toInputDateTime(current));
      setRoundDeadlineAt(
        toInputDateTime(addHours(current, platformDefaults.defaultRoundDurationHours)),
      );
    }
    setQuickModal(modal);
  }

  function closeQuickModal() {
    setQuickModal('none');
  }

  function openStatusRecovery() {
    if (!selectedTournament || recoverableTournamentStatuses.length === 0) {
      return;
    }

    setStatusRecoveryTarget(recoverableTournamentStatuses[0]);
    setStatusRecoveryReason('');
    setStatusRecoveryError('');
    setStatusRecoveryOpen(true);
  }

  function closeStatusRecovery() {
    if (statusRecoveryLoading) {
      return;
    }

    setStatusRecoveryOpen(false);
    setStatusRecoveryTarget('');
    setStatusRecoveryReason('');
    setStatusRecoveryError('');
  }

  function openRoundRecovery(roundId: string) {
    setRoundRecoveryRoundId(roundId);
    setRoundRecoveryReason('');
    setRoundRecoveryError('');
    setRoundRecoveryOpen(true);
  }

  function closeRoundRecovery() {
    if (roundRecoveryLoading) {
      return;
    }

    setRoundRecoveryOpen(false);
    setRoundRecoveryRoundId('');
    setRoundRecoveryReason('');
    setRoundRecoveryError('');
  }

  function resetScheduleForm() {
    setScheduleEditingId('');
    setScheduleTitle('');
    setScheduleDescription('');
    setScheduleType('OTHER');
    setScheduleStartsAt(toInputDateTime(new Date()));
    setScheduleEndsAt('');
    setScheduleLocation('');
  }

  function applyScheduleDraft(event: TournamentScheduleEvent) {
    setScheduleEditingId(event.id);
    setScheduleTitle(event.title);
    setScheduleDescription(event.description ?? '');
    setScheduleType(event.type);
    setScheduleStartsAt(toInputDateTime(new Date(event.startsAt)));
    setScheduleEndsAt(event.endsAt ? toInputDateTime(new Date(event.endsAt)) : '');
    setScheduleLocation(event.location ?? '');
    setScheduleOp(EMPTY_SCHEDULE_OP_STATE);
  }

  useEffect(() => {
    if (quickModal === 'none' && !statusRecoveryOpen && !roundRecoveryOpen) {
      return;
    }

    function handleEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        if (quickModal !== 'none') {
          closeQuickModal();
        }
        if (statusRecoveryOpen) {
          closeStatusRecovery();
        }
        if (roundRecoveryOpen) {
          closeRoundRecovery();
        }
      }
    }

    window.addEventListener('keydown', handleEscape);
    return () => {
      window.removeEventListener('keydown', handleEscape);
    };
  }, [
    quickModal,
    statusRecoveryOpen,
    statusRecoveryLoading,
    roundRecoveryOpen,
    roundRecoveryLoading,
  ]);

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
      setSelectedTournamentId((current) =>
        current || resolveStoredTournamentSelection(list, list[0].id),
      );
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
        normalizeApiErrorMessage(requestError, t, t('adminDashboard.roundsLoadFailed')),
      );
    } finally {
      setRoundsLoading(false);
    }
  }

  async function loadScheduleEvents(tournamentId: string) {
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

  async function loadTournamentJury(tournamentId: string) {
    setJuryLoading(true);
    setJuryError('');
    setJuryNotice('');

    try {
      const data = await apiRequest<TournamentJuryPayload>(`/tournaments/${tournamentId}/jury`);
      setTournamentJury(data);
      setSelectedJuryIds(data.assigned.filter((jury) => !jury.isBlocked).map((jury) => jury.id));
    } catch (requestError) {
      setTournamentJury(null);
      setSelectedJuryIds([]);
      setJuryError(
        normalizeApiErrorMessage(requestError, t, t('adminDashboard.jury.loadFailed')),
      );
    } finally {
      setJuryLoading(false);
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

  async function loadActivityFeed(tournamentId?: string) {
    try {
      const query = tournamentId ? `?tournamentId=${encodeURIComponent(tournamentId)}` : '';
      const data = await apiRequest<AuditActivityEntry[]>(`/activity/admin${query}`);
      setActivityFeedEntries(Array.isArray(data) ? data : []);
    } catch {
      setActivityFeedEntries([]);
    }
  }

  async function loadInitial() {
    setLoading(true);
    setError('');
    try {
      const [meData, defaultsResult] = await Promise.all([
        apiRequest<AuthMe>('/auth/me'),
        apiRequest<PlatformDefaults>('/platform/defaults').catch(
          () => DEFAULT_PLATFORM_DEFAULTS,
        ),
      ]);
      setMe(meData);
      setPlatformDefaults(defaultsResult);
      if (meData.role === 'ADMIN' || meData.role === 'ORGANIZER') {
        await loadTournaments();
      }
    } catch (requestError) {
      setError(
        normalizeApiErrorMessage(requestError, t, t('adminDashboard.loadFailed')),
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadInitial();
  }, []);

  function toggleWorkspaceExpanded() {
    setIsWorkspaceExpanded((current) => {
      const next = !current;
      localStorage.setItem(ADMIN_WORKSPACE_EXPANDED_KEY, String(next));
      return next;
    });
  }

  useEffect(() => {
    setStatusError('');
    setStatusNotice('');
    setStatusRecoveryOpen(false);
    setStatusRecoveryTarget('');
    setStatusRecoveryReason('');
    setStatusRecoveryError('');
    setRoundRecoveryOpen(false);
    setRoundRecoveryRoundId('');
    setRoundRecoveryReason('');
    setRoundRecoveryError('');

    if (!selectedTournamentId || !roleAllowed) {
      setRounds([]);
      setScheduleEvents([]);
      setActivityFeedEntries([]);
      setScheduleError('');
      setScheduleOp(EMPTY_SCHEDULE_OP_STATE);
      setTournamentJury(null);
      setSelectedJuryIds([]);
      setJuryError('');
      setJuryNotice('');
      resetScheduleForm();
      return;
    }

    setScheduleOp(EMPTY_SCHEDULE_OP_STATE);
    resetScheduleForm();
    rememberTournamentSelection(selectedTournamentId);
    void loadRounds(selectedTournamentId);
    void loadScheduleEvents(selectedTournamentId);
    void loadTournamentJury(selectedTournamentId);
    void loadActivityFeed(selectedTournamentId);
  }, [selectedTournamentId, roleAllowed]);

  function toggleJurySelection(userId: string) {
    setSelectedJuryIds((current) =>
      current.includes(userId)
        ? current.filter((item) => item !== userId)
        : [...current, userId],
    );
  }

  async function saveTournamentJury() {
    if (!selectedTournamentId) {
      return;
    }

    setJurySaving(true);
    setJuryError('');
    setJuryNotice('');

    try {
      const saved = await apiRequest<TournamentJuryPayload>(
        `/tournaments/${selectedTournamentId}/jury`,
        {
          method: 'PATCH',
          body: {
            juryUserIds: selectedJuryIds,
          },
        },
      );
      setTournamentJury(saved);
      setSelectedJuryIds(saved.assigned.filter((jury) => !jury.isBlocked).map((jury) => jury.id));
      setJuryNotice(t('adminDashboard.jury.saved'));
      notifySuccess(t('adminDashboard.jury.saved'));
    } catch (requestError) {
      const message = normalizeApiErrorMessage(
        requestError,
        t,
        t('adminDashboard.jury.saveFailed'),
      );
      setJuryError(message);
      notifyError(message);
    } finally {
      setJurySaving(false);
    }
  }

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
    const startDate = tournamentStartsAt ? new Date(tournamentStartsAt) : null;
    if (tournamentStartsAt && (!startDate || Number.isNaN(startDate.getTime()))) {
      setCreateTournamentError(t('adminDashboard.validation.tournamentStartInvalid'));
      return;
    }

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
          startsAt: startDate ? fromInputDateTime(tournamentStartsAt) : undefined,
          registrationOpenAt: fromInputDateTime(registrationOpenAt),
          registrationCloseAt: fromInputDateTime(registrationCloseAt),
          maxTeams: maxTeams ? Number(maxTeams) : undefined,
        },
      });

      setTitle('');
      setDescription('');
      setTournamentStartsAt('');
      setMaxTeams('');
      setCreateTournamentNotice(t('adminDashboard.createTournamentSuccess'));
      notifySuccess(t('adminDashboard.createTournamentSuccess'));
      await loadTournaments();
      await loadActivityFeed(selectedTournamentId || undefined);
      closeQuickModal();
    } catch (requestError) {
      const message = normalizeApiErrorMessage(
        requestError,
        t,
        t('adminDashboard.createTournamentFailed'),
      );
      setCreateTournamentError(message);
      notifyError(message);
    } finally {
      setCreateTournamentLoading(false);
    }
  }

  async function updateTournamentStatus(status: TournamentStatus) {
    if (!selectedTournamentId || !selectedTournament) {
      return;
    }

    if (selectedTournament.status === status) {
      return;
    }

    if (!canTransitionTournamentStatus(selectedTournament.status, status)) {
      setStatusError(t('adminDashboard.tournamentStatusInvalidTransition'));
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
      notifySuccess(t('adminDashboard.tournamentStatusUpdated'));
      await Promise.all([
        loadTournaments(),
        loadDashboardMetrics(selectedTournamentId),
        loadActivityFeed(selectedTournamentId),
      ]);
    } catch (requestError) {
      const message = normalizeApiErrorMessage(
        requestError,
        t,
        t('adminDashboard.tournamentStatusFailed'),
      );
      setStatusError(message);
      notifyError(message);
    } finally {
      setStatusLoading(false);
    }
  }

  async function submitStatusRecovery(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedTournamentId || !selectedTournament || !statusRecoveryTarget) {
      return;
    }

    const normalizedReason = statusRecoveryReason.trim();
    if (normalizedReason.length < 3) {
      setStatusRecoveryError(t('adminDashboard.statusRecovery.reasonRequired'));
      return;
    }

    if (!recoverableTournamentStatuses.includes(statusRecoveryTarget)) {
      setStatusRecoveryError(t('adminDashboard.statusRecovery.unavailable'));
      return;
    }

    setStatusRecoveryLoading(true);
    setStatusRecoveryError('');
    setStatusError('');
    setStatusNotice('');

    try {
      await apiRequest(`/tournaments/${selectedTournamentId}/status/override`, {
        method: 'PATCH',
        body: {
          status: statusRecoveryTarget,
          reason: normalizedReason,
        },
      });

      setStatusNotice(t('adminDashboard.statusRecovery.saved'));
      notifySuccess(t('adminDashboard.statusRecovery.saved'));
      setStatusRecoveryOpen(false);
      setStatusRecoveryTarget('');
      setStatusRecoveryReason('');
      await Promise.all([
        loadTournaments(),
        loadDashboardMetrics(selectedTournamentId),
        loadActivityFeed(selectedTournamentId),
      ]);
    } catch (requestError) {
      const message = normalizeApiErrorMessage(
        requestError,
        t,
        t('adminDashboard.statusRecovery.failed'),
      );
      setStatusRecoveryError(message);
      notifyError(message);
    } finally {
      setStatusRecoveryLoading(false);
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
      const mustHave = parseLineList(mustHaveRaw);
      const technologyRequirements = parseLineList(technologyRequirementsRaw);
      const additionalMaterials = parseLineList(additionalMaterialsRaw);

      await apiRequest(`/tournaments/${selectedTournamentId}/rounds`, {
        method: 'POST',
        body: {
          title: normalizedRoundTitle,
          description: normalizedRoundDescription,
          mustHave: mustHave.length > 0 ? mustHave : undefined,
          technologyRequirements:
            technologyRequirements.length > 0 ? technologyRequirements : undefined,
          additionalMaterials:
            additionalMaterials.length > 0 ? additionalMaterials : undefined,
          startsAt: fromInputDateTime(roundStartsAt),
          deadlineAt: fromInputDateTime(roundDeadlineAt),
        },
      });

      setRoundTitle('');
      setRoundDescription('');
      setMustHaveRaw('');
      setTechnologyRequirementsRaw('');
      setAdditionalMaterialsRaw('');
      setCreateRoundNotice(t('adminDashboard.createRoundSuccess'));
      notifySuccess(t('adminDashboard.createRoundSuccess'));
      await loadRounds(selectedTournamentId);
      await loadDashboardMetrics(selectedTournamentId);
      closeQuickModal();
    } catch (requestError) {
      const message = normalizeApiErrorMessage(
        requestError,
        t,
        t('adminDashboard.createRoundFailed'),
      );
      setCreateRoundError(message);
      notifyError(message);
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
      notifySuccess(
        t('adminDashboard.createUserSuccess').replace('{role}', t(`profile.role.${created.role}`)),
      );
      await loadActivityFeed(selectedTournamentId || undefined);
      closeQuickModal();
    } catch (requestError) {
      const message = normalizeApiErrorMessage(
        requestError,
        t,
        t('adminDashboard.createUserFailed'),
      );
      setCreateUserError(message);
      notifyError(message);
    } finally {
      setCreateUserLoading(false);
    }
  }

  async function changeRoundStatus(roundId: string, status: RoundStatus) {
    if (!selectedTournamentId) {
      return;
    }

    const round = rounds.find((item) => item.id === roundId);
    if (!round || round.status === status) {
      return;
    }

    if (!canTransitionRoundStatus(round.status, status)) {
      updateRoundOperationState(roundId, {
        loading: false,
        error: t('common.errors.invalidRoundStatusTransition'),
        notice: '',
      });
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
      notifySuccess(t('adminDashboard.roundStatusUpdated'));
      await Promise.all([
        loadRounds(selectedTournamentId),
        loadTournaments(),
        loadDashboardMetrics(selectedTournamentId),
        loadActivityFeed(selectedTournamentId),
      ]);
    } catch (requestError) {
      const message = normalizeApiErrorMessage(
        requestError,
        t,
        t('adminDashboard.roundStatusFailed'),
      );
      updateRoundOperationState(roundId, {
        loading: false,
        error: message,
      });
      notifyError(message);
    }
  }

  async function submitScheduleEvent(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedTournamentId) {
      return;
    }

    setScheduleOp({ loading: false, error: '', notice: '' });

    const normalizedTitle = scheduleTitle.trim();
    if (normalizedTitle.length < 3 || normalizedTitle.length > 140) {
      setScheduleOp({
        loading: false,
        error: t('adminDashboard.validation.scheduleTitleLength'),
        notice: '',
      });
      return;
    }

    const normalizedDescription = scheduleDescription.trim();
    const startsAt = new Date(scheduleStartsAt);
    const endsAt = scheduleEndsAt ? new Date(scheduleEndsAt) : null;
    if (!scheduleStartsAt || Number.isNaN(startsAt.getTime())) {
      setScheduleOp({
        loading: false,
        error: t('adminDashboard.validation.scheduleWindowInvalid'),
        notice: '',
      });
      return;
    }

    if (endsAt && Number.isNaN(endsAt.getTime())) {
      setScheduleOp({
        loading: false,
        error: t('adminDashboard.validation.scheduleWindowInvalid'),
        notice: '',
      });
      return;
    }

    if (endsAt && startsAt > endsAt) {
      setScheduleOp({
        loading: false,
        error: t('adminDashboard.validation.scheduleWindowInvalid'),
        notice: '',
      });
      return;
    }

    setScheduleOp({ loading: true, error: '', notice: '' });

    try {
      const path = scheduleEditingId
        ? `/tournaments/${selectedTournamentId}/schedule/${scheduleEditingId}`
        : `/tournaments/${selectedTournamentId}/schedule`;
      const method = scheduleEditingId ? 'PATCH' : 'POST';

      await apiRequest(path, {
        method,
        body: {
          title: normalizedTitle,
          description: normalizedDescription || undefined,
          type: scheduleType,
          startsAt: fromInputDateTime(scheduleStartsAt),
          endsAt: scheduleEndsAt ? fromInputDateTime(scheduleEndsAt) : undefined,
          location: scheduleLocation.trim() || undefined,
        },
      });

      await Promise.all([
        loadScheduleEvents(selectedTournamentId),
        loadActivityFeed(selectedTournamentId),
      ]);
      resetScheduleForm();
      const notice = scheduleEditingId
        ? t('adminDashboard.schedule.updated')
        : t('adminDashboard.schedule.created');
      setScheduleOp({ loading: false, error: '', notice });
      notifySuccess(notice);
    } catch (requestError) {
      const message = normalizeApiErrorMessage(
        requestError,
        t,
        t('adminDashboard.schedule.saveFailed'),
      );
      setScheduleOp({ loading: false, error: message, notice: '' });
      notifyError(message);
    }
  }

  async function deleteScheduleEvent(eventId: string) {
    if (!selectedTournamentId) {
      return;
    }

    setScheduleOp({ loading: true, error: '', notice: '' });

    try {
      await apiRequest(`/tournaments/${selectedTournamentId}/schedule/${eventId}`, {
        method: 'DELETE',
      });
      await Promise.all([
        loadScheduleEvents(selectedTournamentId),
        loadActivityFeed(selectedTournamentId),
      ]);
      if (scheduleEditingId === eventId) {
        resetScheduleForm();
      }
      const notice = t('adminDashboard.schedule.deleted');
      setScheduleOp({ loading: false, error: '', notice });
      notifySuccess(notice);
    } catch (requestError) {
      const message = normalizeApiErrorMessage(
        requestError,
        t,
        t('adminDashboard.schedule.deleteFailed'),
      );
      setScheduleOp({ loading: false, error: message, notice: '' });
      notifyError(message);
    }
  }

  async function distributeAssignments(roundId: string) {
    const round = rounds.find((item) => item.id === roundId);
    if (!round || !canDistributeRoundAssignments(round.status)) {
      updateRoundOperationState(roundId, {
        loading: false,
        error:
          round?.status === 'EVALUATED'
            ? t('common.errors.distributeEvaluatedRound')
            : t('common.errors.distributeDraftRound'),
        notice: '',
      });
      return;
    }

    updateRoundOperationState(roundId, { loading: true, error: '', notice: '' });

    try {
      const minReviewers =
        minReviewersByRoundId[roundId] ??
        platformDefaults.defaultMinReviewersPerSubmission;
      const resetExisting = resetByRoundId[roundId] ?? true;

      if (!Number.isInteger(minReviewers) || minReviewers < 1) {
        updateRoundOperationState(roundId, {
          loading: false,
          error: t('adminDashboard.validation.minReviewersInvalid'),
        });
        return;
      }

      if (assignedJuryIds.length === 0) {
        updateRoundOperationState(roundId, {
          loading: false,
          error: t('adminDashboard.jury.requiredForDistribution'),
        });
        return;
      }

      await apiRequest(`/rounds/${roundId}/assignments/distribute`, {
        method: 'POST',
        body: {
          minReviewersPerSubmission: minReviewers,
          juryUserIds: assignedJuryIds,
          resetExisting,
        },
      });

      updateRoundOperationState(roundId, {
        loading: false,
        notice: t('adminDashboard.distributeSuccess'),
      });
      notifySuccess(t('adminDashboard.distributeSuccess'));
      await Promise.all([
        loadDashboardMetrics(selectedTournamentId || undefined),
        loadActivityFeed(selectedTournamentId || undefined),
      ]);
    } catch (requestError) {
      const message = normalizeApiErrorMessage(
        requestError,
        t,
        t('adminDashboard.distributeFailed'),
      );
      updateRoundOperationState(roundId, {
        loading: false,
        error: message,
      });
      notifyError(message);
    }
  }

  async function finishEvaluation(roundId: string, force: boolean) {
    const round = rounds.find((item) => item.id === roundId);
    if (!round || !canFinishRoundEvaluation(round.status)) {
      updateRoundOperationState(roundId, {
        loading: false,
        error:
          round?.status === 'EVALUATED'
            ? t('common.errors.evaluateEvaluatedRound')
            : t('common.errors.finishDraftRound'),
        notice: '',
      });
      return;
    }

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
      notifySuccess(t('adminDashboard.finishEvaluationSuccess'));
      if (selectedTournamentId) {
        await Promise.all([
          loadRounds(selectedTournamentId),
          loadTournaments(),
          loadActivityFeed(selectedTournamentId),
        ]);
      }
      await loadDashboardMetrics(selectedTournamentId || undefined);
    } catch (requestError) {
      const message = normalizeApiErrorMessage(
        requestError,
        t,
        t('adminDashboard.finishEvaluationFailed'),
      );
      updateRoundOperationState(roundId, {
        loading: false,
        error: message,
      });
      notifyError(message);
    }
  }

  async function submitRoundRecovery(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedTournamentId || !recoveryRound) {
      return;
    }

    const normalizedReason = roundRecoveryReason.trim();
    if (normalizedReason.length < 3) {
      setRoundRecoveryError(t('adminDashboard.roundRecovery.reasonRequired'));
      return;
    }

    setRoundRecoveryLoading(true);
    setRoundRecoveryError('');
    updateRoundOperationState(recoveryRound.id, { loading: true, error: '', notice: '' });

    try {
      await apiRequest(
        `/tournaments/${selectedTournamentId}/rounds/${recoveryRound.id}/status/override`,
        {
          method: 'PATCH',
          body: {
            status: 'SUBMISSION_CLOSED',
            reason: normalizedReason,
          },
        },
      );

      updateRoundOperationState(recoveryRound.id, {
        loading: false,
        notice: t('adminDashboard.roundRecovery.saved'),
      });
      notifySuccess(t('adminDashboard.roundRecovery.saved'));
      setRoundRecoveryOpen(false);
      setRoundRecoveryRoundId('');
      setRoundRecoveryReason('');
      await Promise.all([
        loadRounds(selectedTournamentId),
        loadDashboardMetrics(selectedTournamentId),
        loadActivityFeed(selectedTournamentId),
      ]);
    } catch (requestError) {
      const message = normalizeApiErrorMessage(
        requestError,
        t,
        t('adminDashboard.roundRecovery.failed'),
      );
      setRoundRecoveryError(message);
      updateRoundOperationState(recoveryRound.id, {
        loading: false,
        error: message,
      });
      notifyError(message);
    } finally {
      setRoundRecoveryLoading(false);
    }
  }

  if (loading) {
    return <QuietLoadingCard label={t('adminDashboard.loading')} />;
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
    <section className="team-dashboard admin-dashboard-page">
      <header className="section-header">
        <p className="eyebrow">{t('adminDashboard.eyebrow')}</p>
        <h1>{t('adminDashboard.title')}</h1>
        <p className="lead">{t('adminDashboard.lead')}</p>
      </header>

      <article className="card panel-card dashboard-overview-card">
        <div className="dashboard-overview-meta">
          <div>
            <p className="eyebrow">{t('adminDashboard.summaryTitle')}</p>
            <h2>{t('shell.overview')}</h2>
            <p>{t('adminDashboard.lead')}</p>
          </div>
          <div className="dashboard-overview-status admin-overview-status">
            <span>{t('adminDashboard.workspaceCurrentTournament')}</span>
            <strong>
              {selectedTournament?.title ?? t('adminDashboard.workspaceNoTournament')}
            </strong>
            <p>
              {selectedTournament
                ? `${t(`tournaments.status.${selectedTournament.status}`)} · ${rounds.length} ${t('adminDashboard.summary.rounds').toLowerCase()}`
                : t('adminDashboard.workspaceStatusEmpty')}
            </p>
          </div>
        </div>

        <div className="dashboard-overview-top">
          <div className="dashboard-summary-tiles">
            <article className="dashboard-highlight-tile">
              <div className="dashboard-tile-head">
                <span>{t('adminDashboard.summary.running')}</span>
                <span className="dashboard-tile-chip" aria-hidden />
              </div>
              <strong>{runningTournaments}</strong>
              <div className="dashboard-tile-foot">
                <a href="#admin-manage-tournament">{t('adminDashboard.summary.openTournament')}</a>
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
                <a href="#admin-rounds">{t('adminDashboard.summary.openRounds')}</a>
                <span>
                  +{totalDelta} {t('shell.thisMonth')}
                </span>
              </div>
            </article>
          </div>

          <div className="dashboard-quick-actions">
            <div className="dashboard-quick-head">
              <div>
                <strong>{t('shell.quickActions')}</strong>
                <p>{t('adminDashboard.workspaceActionsLead')}</p>
              </div>
            </div>
            <button
              type="button"
              className="button dashboard-action is-teal"
              onClick={() => openQuickModal('createTournament')}
            >
              {t('adminDashboard.form.createTournament')}
            </button>
            <a href="#admin-manage-tournament" className="button dashboard-action is-orange">
              {t('adminDashboard.manageTournamentTitle')}
            </a>
            <button
              type="button"
              className="button dashboard-action is-cobalt"
              onClick={() => openQuickModal('createRound')}
              disabled={!selectedTournament}
            >
              {t('adminDashboard.form.createRound')}
            </button>
            <button
              type="button"
              className="button dashboard-action is-sand"
              onClick={() => openQuickModal('createUser')}
            >
              {t('adminDashboard.userForm.createUser')}
            </button>
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
            {hasWeeklyMetrics ? (
              <>
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
                  {localizedWeekLabels.map((label) => (
                    <span key={`admin-week-${label}`}>{label}</span>
                  ))}
                </div>
              </>
            ) : (
              <p className="dashboard-empty-note">{t('adminDashboard.metrics.noWeekly')}</p>
            )}
          </article>

          <article className="dashboard-pie-card">
            <h3>{t('shell.submissionStatus')}</h3>
            {hasStatusMetrics ? (
              <>
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
              </>
            ) : (
              <p className="dashboard-empty-note">{t('adminDashboard.metrics.noStatus')}</p>
            )}
          </article>
        </div>

        <div className="dashboard-lower-grid">
          <article className="dashboard-mini-card is-teams">
            <h3>{t('shell.activeTeams')}</h3>
            {quickTeamsPreview.length === 0 ? (
              <p className="inline-hint">{t('adminDashboard.noTournaments')}</p>
            ) : (
              <>
                <div className="dashboard-mini-team-list">
                  {quickTeamsPreview.map((entry) => (
                    <div key={`admin-team-${entry.id}`} className="dashboard-mini-team-item">
                      <span className="dashboard-mini-avatar">{entry.initials}</span>
                      <div className="dashboard-mini-caption">
                        <strong>{entry.name}</strong>
                        <p>{entry.subtitle}</p>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="dashboard-mini-links">
                  <Link to="/app/teams" className="button dashboard-action is-teal">
                    {t('shell.teams')}
                  </Link>
                  <Link to="/app/messages" className="button dashboard-action is-purple">
                    {t('shell.messages')}
                  </Link>
                </div>
              </>
            )}
          </article>

          <article className="dashboard-mini-card is-history-highlight">
            <h3>{t('shell.activityHistory')}</h3>
            <p className="dashboard-mini-lead">{t('adminDashboard.activityFeed.lead')}</p>
            {hasActivityMetrics ? (
              <div className="dashboard-line-wrap">
                <svg viewBox="0 0 320 96" preserveAspectRatio="none" className="dashboard-line-svg" aria-hidden>
                  <path d={activityPath} />
                </svg>
              </div>
            ) : null}
            {adminActivityFeed.length > 0 ? (
              <div className="activity-feed-list is-compact">
                {adminActivityFeed.slice(0, 3).map((item) => (
                  <article key={item.id} className={`activity-feed-item is-${item.accent}`}>
                    <span className="activity-feed-dot" aria-hidden />
                    <div>
                      <strong>{item.title}</strong>
                      <p>{item.meta}</p>
                    </div>
                  </article>
                ))}
              </div>
            ) : (
              <p className="dashboard-empty-note">{t('adminDashboard.activityFeed.empty')}</p>
            )}
          </article>
        </div>

      </article>

      <article
        className={`card panel-card dashboard-workspace-card dashboard-workspace-collapsible${
          isWorkspaceExpanded ? ' is-expanded' : ''
        }`}
      >
        <div className="dashboard-workspace-head">
          <div className="dashboard-workspace-copy">
            <p className="eyebrow dashboard-workspace-eyebrow">
              {t('adminDashboard.workspaceEyebrow')}
            </p>
            <div className="dashboard-workspace-title-row">
              <span className="dashboard-workspace-info-icon" aria-hidden>
                i
              </span>
              <h2>{t('adminDashboard.workspaceTitle')}</h2>
            </div>
            <p>{t('adminDashboard.workspaceLead')}</p>
          </div>

          <button
            type="button"
            className="button button-soft dashboard-workspace-toggle"
            aria-expanded={isWorkspaceExpanded}
            onClick={toggleWorkspaceExpanded}
          >
            <span>
              {isWorkspaceExpanded
                ? t('adminDashboard.workspaceCollapse')
                : t('adminDashboard.workspaceExpand')}
            </span>
            <svg viewBox="0 0 20 20" aria-hidden>
              <path d="M5.5 7.5 10 12l4.5-4.5" />
            </svg>
          </button>
        </div>

        {isWorkspaceExpanded ? (
          <>
            <div className="dashboard-workspace-status admin-workspace-status">
              <span>{t('adminDashboard.focusTitle')}</span>
              <strong>
                {selectedTournament?.title ?? t('adminDashboard.workspaceNoTournament')}
              </strong>
              <p>
                {selectedTournament
                  ? `${t(`tournaments.status.${selectedTournament.status}`)} · ${rounds.length} ${t('adminDashboard.summary.rounds').toLowerCase()}`
                  : t('adminDashboard.focusEmpty')}
              </p>
            </div>

        <div className="dashboard-workspace-grid">
          <article className="dashboard-insight-card">
            <div className="dashboard-insight-head">
              <span>{t('shell.overview')}</span>
              <a href="#admin-manage-tournament">{t('shell.open')}</a>
            </div>
            <strong>
              {selectedTournament?.title ?? t('adminDashboard.workspaceNoTournament')}
            </strong>
            <p>
              {selectedTournament
                ? `${metrics.summary.registrationTournaments} ${t('adminDashboard.focusMetrics.registrationShort').toLowerCase()} · ${activeRounds} ${t('adminDashboard.focusMetrics.activeRoundsShort').toLowerCase()}`
                : t('adminDashboard.focusEmpty')}
            </p>
            <div className="dashboard-insight-metrics">
              <span>
                {metrics.summary.roundsTotal} {t('adminDashboard.summary.rounds').toLowerCase()}
              </span>
              <span>
                {evaluatedRounds} {t('adminDashboard.summary.evaluatedRounds').toLowerCase()}
              </span>
            </div>
          </article>

          <article className="dashboard-workspace-panel">
            <div className="dashboard-workspace-panel-head">
              <h3>{t('adminDashboard.workspaceChecklistTitle')}</h3>
              <p>{t('adminDashboard.workspaceChecklistLead')}</p>
            </div>
            <div className="dashboard-checklist">
              {checklistItems.map((item) => (
                <div
                  key={item.id}
                  className={`dashboard-checklist-item${item.done ? ' is-done' : ''}`}
                >
                  <span className="dashboard-checklist-bullet" aria-hidden />
                  <div>
                    <strong>{item.title}</strong>
                    <p>{item.description}</p>
                  </div>
                </div>
              ))}
            </div>
          </article>

          <article className="dashboard-workspace-panel">
            <div className="dashboard-workspace-panel-head">
              <h3>{t('adminDashboard.workspaceToolsTitle')}</h3>
              <p>{t('adminDashboard.workspaceToolsLead')}</p>
            </div>
            <div className="dashboard-toolset-grid">
              {me?.role === 'ADMIN' ? (
                <Link to="/app/users" className="dashboard-tool-card dashboard-tool-card--teal">
                  <span>{t('shell.users')}</span>
                  <strong>{t('adminDashboard.workspaceTools.usersTitle')}</strong>
                  <p>{t('adminDashboard.workspaceTools.usersLead')}</p>
                </Link>
              ) : null}
              <Link to="/app/leaderboard" className="dashboard-tool-card dashboard-tool-card--purple">
                <span>{t('shell.leaderboard')}</span>
                <strong>{t('adminDashboard.workspaceTools.leaderboardTitle')}</strong>
                <p>{t('adminDashboard.workspaceTools.leaderboardLead')}</p>
              </Link>
              <Link to="/app/archive" className="dashboard-tool-card dashboard-tool-card--orange">
                <span>{t('shell.archive')}</span>
                <strong>{t('adminDashboard.workspaceTools.archiveTitle')}</strong>
                <p>{t('adminDashboard.workspaceTools.archiveLead')}</p>
              </Link>
              <Link to="/app/messages" className="dashboard-tool-card dashboard-tool-card--berry">
                <span>{t('shell.messages')}</span>
                <strong>{t('adminDashboard.workspaceTools.messagesTitle')}</strong>
                <p>{t('adminDashboard.workspaceTools.messagesLead')}</p>
              </Link>
            </div>
          </article>
        </div>

        <article className="dashboard-onboarding-card">
          <div className="dashboard-workspace-panel-head">
            <h3>{t('adminDashboard.onboarding.title')}</h3>
            <p>{t('adminDashboard.onboarding.lead')}</p>
          </div>
          <div className="onboarding-grid">
            {onboardingSteps.map((step, index) => (
              <article key={step.id} className="onboarding-card">
                <span className="onboarding-step">{index + 1}</span>
                <strong>{step.title}</strong>
                <p>{step.lead}</p>
                <div className="onboarding-card-actions">
                  {step.id === 'tournament' ? (
                    <>
                      <button
                        type="button"
                        className="button button-soft onboarding-action-primary"
                        onClick={() => openQuickModal('createTournament')}
                      >
                        {t('adminDashboard.form.createTournament')}
                      </button>
                      <a
                        href="#admin-manage-tournament"
                        className="button button-ghost onboarding-action-secondary"
                      >
                        {t('adminDashboard.manageTournamentTitle')}
                      </a>
                    </>
                  ) : null}
                  {step.id === 'round' ? (
                    <>
                      <button
                        type="button"
                        className="button button-soft onboarding-action-primary"
                        onClick={() => openQuickModal('createRound')}
                        disabled={!selectedTournament}
                      >
                        {t('adminDashboard.form.createRound')}
                      </button>
                      <a
                        href="#admin-schedule"
                        className="button button-ghost onboarding-action-secondary"
                      >
                        {t('schedule.title')}
                      </a>
                    </>
                  ) : null}
                  {step.id === 'evaluation' ? (
                    <>
                      <a
                        href="#admin-rounds"
                        className="button button-soft onboarding-action-primary"
                      >
                        {t('adminDashboard.roundsTitle')}
                      </a>
                      <Link
                        to="/app/leaderboard"
                        className="button button-ghost onboarding-action-secondary"
                      >
                        {t('shell.leaderboard')}
                      </Link>
                    </>
                  ) : null}
                </div>
              </article>
            ))}
          </div>
        </article>
          </>
        ) : null}
      </article>

      <article id="admin-manage-tournament" className="card panel-card">
        <h2>{t('adminDashboard.manageTournamentTitle')}</h2>

          <label className="field admin-tournament-picker" htmlFor="admin-tournament-select">
            <span>{t('adminDashboard.tournamentLabel')}</span>
            <select
              id="admin-tournament-select"
              className="select-input admin-tournament-picker-select"
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
                <div className="summary-card admin-registration-summary">
                  <span>{t('adminDashboard.summary.registration')}</span>
                  <strong>
                    {formatDateTime(selectedTournament.registrationOpenAt, language)}
                  </strong>
                  <p>{formatDateTime(selectedTournament.registrationCloseAt, language)}</p>
                </div>
                <div className="summary-card">
                  <span>{t('adminDashboard.summary.maxTeams')}</span>
                  <strong>{selectedTournament.maxTeams ?? '-'}</strong>
                  <p>
                    {selectedTournament.startsAt
                      ? `${t('adminDashboard.form.tournamentStartsAt')}: ${formatDateTime(selectedTournament.startsAt, language)}`
                      : selectedTournament.description || t('adminDashboard.summary.noDescription')}
                  </p>
                </div>
              </div>

              <div className="status-actions admin-tournament-status-actions">
                {TOURNAMENT_STATUSES.map(
                  (status) => {
                    const isCurrentStatus = selectedTournament.status === status;
                    const isAvailableTransition = canTransitionTournamentStatus(
                      selectedTournament.status,
                      status,
                    );
                    const isDisabled = statusLoading || isCurrentStatus || !isAvailableTransition;

                    return (
                      <button
                        key={status}
                        type="button"
                        className={`button button-soft tournament-status-action${
                          isCurrentStatus ? ' current' : ''
                        }`}
                        disabled={isDisabled}
                        onClick={() => updateTournamentStatus(status)}
                        aria-current={isCurrentStatus ? 'step' : undefined}
                      >
                        <span>{t(`tournaments.status.${status}`)}</span>
                        {isCurrentStatus ? (
                          <small>{t('adminDashboard.tournamentStatusCurrent')}</small>
                        ) : null}
                        {!isCurrentStatus && !isAvailableTransition ? (
                          <small>{t('adminDashboard.tournamentStatusUnavailable')}</small>
                        ) : null}
                      </button>
                    );
                  },
                )}
              </div>

              {canRecoverTournamentStatus ? (
                <div className="status-recovery-panel">
                  <button
                    type="button"
                    className="button button-ghost status-recovery-action"
                    onClick={openStatusRecovery}
                    disabled={statusLoading || statusRecoveryLoading}
                  >
                    {t('adminDashboard.statusRecovery.open')}
                  </button>
                  <p className="inline-hint">{t('adminDashboard.statusRecovery.lead')}</p>
                </div>
              ) : null}

              <p className="inline-hint">
                {t('adminDashboard.registrationPeriod')}:{' '}
                {formatDateTime(selectedTournament.registrationOpenAt, language)} -{' '}
                {formatDateTime(selectedTournament.registrationCloseAt, language)}
              </p>
            </>
          ) : null}

          {statusError ? <p className="form-error">{statusError}</p> : null}
          {statusNotice ? <p className="form-success">{statusNotice}</p> : null}
      </article>

      <article id="admin-tournament-jury" className="card panel-card">
        <div className="tournament-head">
          <div>
            <h2>{t('adminDashboard.jury.title')}</h2>
            <p className="inline-hint">{t('adminDashboard.jury.lead')}</p>
          </div>
          <span className="status-pill">{assignedJuryIds.length}</span>
        </div>

        {juryLoading ? <QuietLoadingInline label={t('adminDashboard.jury.loading')} compact /> : null}
        {juryError ? <p className="form-error">{juryError}</p> : null}
        {juryNotice ? <p className="form-success">{juryNotice}</p> : null}

        {!juryLoading && tournamentJury && tournamentJury.candidates.length === 0 ? (
          <p className="inline-hint">{t('adminDashboard.jury.empty')}</p>
        ) : null}

        {tournamentJury && tournamentJury.candidates.length > 0 ? (
          <>
            <div className="admin-jury-grid">
              {tournamentJury.candidates.map((jury) => {
                const isSelected = selectedJuryIds.includes(jury.id);

                return (
                  <label
                    key={jury.id}
                    className={`admin-jury-card${isSelected ? ' is-selected' : ''}`}
                    htmlFor={`admin-jury-${jury.id}`}
                  >
                    <input
                      id={`admin-jury-${jury.id}`}
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => toggleJurySelection(jury.id)}
                    />
                    <span>
                      <strong>{jury.fullName}</strong>
                      <small title={jury.email}>{jury.email}</small>
                    </span>
                  </label>
                );
              })}
            </div>

            <div className="form-actions admin-jury-actions">
              <button
                type="button"
                className="button button-primary"
                disabled={jurySaving || !selectedTournamentId}
                onClick={() => void saveTournamentJury()}
              >
                {jurySaving
                  ? t('adminDashboard.jury.saving')
                  : t('adminDashboard.jury.save')}
              </button>
              <span className="inline-hint">
                {t('adminDashboard.jury.selected').replace(
                  '{count}',
                  String(selectedJuryIds.length),
                )}
              </span>
            </div>
            {selectedJuryBelowDefaultMinimum ? (
              <p className="admin-jury-warning">{selectedJuryMinimumWarning}</p>
            ) : null}
          </>
        ) : null}
      </article>

      <article id="admin-schedule" className="card panel-card">
        <div className="tournament-head">
          <h2>{t('schedule.title')}</h2>
          <span className="status-pill">{scheduleEvents.length}</span>
        </div>
        <p className="inline-hint">{t('adminDashboard.schedule.lead')}</p>

        {scheduleError ? (
          <>
            <p className="form-error">{scheduleError}</p>
            {selectedTournamentId ? (
              <button
                type="button"
                className="button button-soft"
                onClick={() => void loadScheduleEvents(selectedTournamentId)}
              >
                {t('schedule.retry')}
              </button>
            ) : null}
          </>
        ) : null}
        {scheduleOp.error ? <p className="form-error">{scheduleOp.error}</p> : null}
        {scheduleOp.notice ? <p className="form-success">{scheduleOp.notice}</p> : null}

        <form className="panel-form" onSubmit={submitScheduleEvent} noValidate>
          <label className="field" htmlFor="admin-schedule-title">
            <span>{t('schedule.form.title')}</span>
            <input
              id="admin-schedule-title"
              type="text"
              value={scheduleTitle}
              onChange={(event) => setScheduleTitle(event.target.value)}
              required
              minLength={3}
              maxLength={140}
            />
          </label>

          <label className="field" htmlFor="admin-schedule-description">
            <span>{t('schedule.form.description')}</span>
            <textarea
              id="admin-schedule-description"
              lang={contentInputLang}
              spellCheck
              value={scheduleDescription}
              onChange={(event) => setScheduleDescription(event.target.value)}
              maxLength={4000}
            />
          </label>

          <div className="schedule-manager-grid">
            <label className="field" htmlFor="admin-schedule-type">
              <span>{t('schedule.form.type')}</span>
              <select
                id="admin-schedule-type"
                className="select-input admin-tournament-picker-select"
                value={scheduleType}
                onChange={(event) =>
                  setScheduleType(event.target.value as TournamentScheduleEventType)
                }
              >
                {(['ROUND', 'CONSULTATION', 'DEADLINE', 'ANNOUNCEMENT', 'OTHER'] as TournamentScheduleEventType[]).map((type) => (
                  <option key={type} value={type}>
                    {t(`schedule.types.${type}`)}
                  </option>
                ))}
              </select>
            </label>

            <label className="field" htmlFor="admin-schedule-location">
              <span>{t('schedule.form.location')}</span>
              <input
                id="admin-schedule-location"
                type="text"
                value={scheduleLocation}
                onChange={(event) => setScheduleLocation(event.target.value)}
                maxLength={280}
              />
            </label>
          </div>

          <div className="datetime-grid">
            <label className="field" htmlFor="admin-schedule-start">
              <span>{t('schedule.form.startsAt')}</span>
            <input
              id="admin-schedule-start"
              type="datetime-local"
              lang={dateTimeInputLang}
              value={scheduleStartsAt}
              onChange={(event) => setScheduleStartsAt(event.target.value)}
              required
            />
            </label>

            <label className="field" htmlFor="admin-schedule-end">
              <span>{t('schedule.form.endsAt')}</span>
            <input
              id="admin-schedule-end"
              type="datetime-local"
              lang={dateTimeInputLang}
              value={scheduleEndsAt}
              onChange={(event) => setScheduleEndsAt(event.target.value)}
            />
            </label>
          </div>

          <div className="schedule-form-actions">
            <button
              type="submit"
              className="button button-primary admin-primary-action"
              disabled={scheduleOp.loading || !selectedTournamentId}
            >
              {scheduleOp.loading
                ? t('schedule.form.saving')
                : scheduleEditingId
                  ? t('schedule.form.update')
                  : t('schedule.form.create')}
            </button>
            {scheduleEditingId ? (
              <button
                type="button"
                className="button button-ghost"
                onClick={resetScheduleForm}
                disabled={scheduleOp.loading}
              >
                {t('schedule.actions.cancel')}
              </button>
            ) : null}
          </div>
        </form>

        {scheduleLoading ? <QuietLoadingInline label={t('schedule.loading')} compact /> : null}
        {!scheduleLoading && scheduleEvents.length === 0 ? (
          <p>{t('schedule.empty')}</p>
        ) : null}
        {scheduleEvents.length > 0 ? (
          <div className="schedule-stack">
            {scheduleEvents.map((event) => (
              <article key={event.id} className="schedule-item">
                <div className="schedule-item-head">
                  <div>
                    <strong>{event.title}</strong>
                    <p>{event.description || t('schedule.noDescription')}</p>
                  </div>
                  <span className={`schedule-type-chip type-${event.type.toLowerCase()}`}>
                    {t(`schedule.types.${event.type}`)}
                  </span>
                </div>
                <div className="schedule-item-meta">
                  <span>
                    {t('schedule.form.startsAt')}: {formatDateTime(event.startsAt, language)}
                  </span>
                  <span>
                    {event.endsAt
                      ? `${t('schedule.form.endsAt')}: ${formatDateTime(event.endsAt, language)}`
                      : t('schedule.noEndTime')}
                  </span>
                  <span>
                    {event.location
                      ? `${t('schedule.form.location')}: ${event.location}`
                      : t('schedule.noLocation')}
                  </span>
                </div>
                <div className="status-actions schedule-item-actions">
                  <button
                    type="button"
                    className="button button-soft"
                    onClick={() => applyScheduleDraft(event)}
                    disabled={scheduleOp.loading}
                  >
                    {t('schedule.actions.edit')}
                  </button>
                  <button
                    type="button"
                    className="button button-ghost schedule-delete-action"
                    onClick={() => void deleteScheduleEvent(event.id)}
                    disabled={scheduleOp.loading}
                  >
                    {t('schedule.actions.delete')}
                  </button>
                </div>
              </article>
            ))}
          </div>
        ) : null}
      </article>

      <article id="admin-rounds" className="card panel-card">
        <h2>{t('adminDashboard.roundsTitle')}</h2>
        <div className="state-callout subtle onboarding-inline-callout">
          <strong>{t('adminDashboard.evaluationGuide.title')}</strong>
          <p>{t('adminDashboard.evaluationGuide.lead')}</p>
        </div>

        {roundsLoading ? <QuietLoadingInline label={t('adminDashboard.roundsLoading')} compact /> : null}
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
              <div className="summary-card admin-rounds-summary">
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
              const canActivateRound = canTransitionRoundStatus(round.status, 'ACTIVE');
              const canCloseRoundSubmissions = canTransitionRoundStatus(
                round.status,
                'SUBMISSION_CLOSED',
              );
              const canFinishEvaluation = canFinishRoundEvaluation(round.status);
              const canDistributeAssignments = canDistributeRoundAssignments(round.status);
              const canRecoverRoundEvaluation = isAdmin && round.status === 'EVALUATED';
              const minReviewersForRound =
                minReviewersByRoundId[round.id] ??
                platformDefaults.defaultMinReviewersPerSubmission;
              const assignedJuryBelowRoundMinimum = assignedJuryIds.length < minReviewersForRound;
              const distributionMinimumWarning = t(
                'adminDashboard.jury.distributionMinReviewersWarning',
              ).replace('{count}', String(minReviewersForRound));
              return (
                <article key={round.id} className="round-card">
                  <div className="round-card-head">
                    <strong>
                      #{round.sequence} {formatDashboardRoundTitle(round.title, round.sequence, t)}
                    </strong>
                    <span>{t(`adminDashboard.roundStatus.${round.status}`)}</span>
                  </div>

                  <p>
                    {t('adminDashboard.roundStartsAt')}: {formatDateTime(round.startsAt, language)}
                  </p>
                  <p>
                    {t('adminDashboard.roundDeadlineAt')}: {formatDateTime(round.deadlineAt, language)}
                  </p>
                  <p>{formatDashboardRoundDescription(round.description, t)}</p>

                  <div className="must-have-block">
                    <p>
                      <strong>{t('adminDashboard.form.mustHave')}</strong>
                    </p>
                    {round.mustHave.length === 0 ? (
                      <p className="inline-hint">{t('adminDashboard.noItemsDefined')}</p>
                    ) : (
                      <ul className="must-have-list">
                        {round.mustHave.map((item) => (
                          <li key={item}>{item}</li>
                        ))}
                      </ul>
                    )}
                  </div>

                  <div className="must-have-block">
                    <p>
                      <strong>{t('adminDashboard.form.technologyRequirements')}</strong>
                    </p>
                    {round.technologyRequirements.length === 0 ? (
                      <p className="inline-hint">{t('adminDashboard.noItemsDefined')}</p>
                    ) : (
                      <ul className="must-have-list">
                        {round.technologyRequirements.map((item) => (
                          <li key={item}>{item}</li>
                        ))}
                      </ul>
                    )}
                  </div>

                  <div className="must-have-block">
                    <p>
                      <strong>{t('adminDashboard.form.additionalMaterials')}</strong>
                    </p>
                    {round.additionalMaterials.length === 0 ? (
                      <p className="inline-hint">{t('adminDashboard.noItemsDefined')}</p>
                    ) : (
                      <ul className="must-have-list">
                        {round.additionalMaterials.map((item) => (
                          <li key={item}>{item}</li>
                        ))}
                      </ul>
                    )}
                  </div>

                  <div className="round-actions">
                    <button
                      type="button"
                      className="button button-soft admin-primary-action"
                      disabled={op.loading || !canActivateRound}
                      onClick={() => changeRoundStatus(round.id, 'ACTIVE')}
                    >
                      {t('adminDashboard.activateRound')}
                    </button>
                    <button
                      type="button"
                      className="button button-soft admin-primary-action"
                      disabled={op.loading || !canCloseRoundSubmissions}
                      onClick={() => changeRoundStatus(round.id, 'SUBMISSION_CLOSED')}
                    >
                      {t('adminDashboard.closeSubmissions')}
                    </button>
                  </div>

                  <div className="round-actions">
                    <button
                      type="button"
                      className="button button-soft admin-primary-action"
                      disabled={op.loading || !canFinishEvaluation}
                      onClick={() => finishEvaluation(round.id, false)}
                    >
                      {t('adminDashboard.finishEvaluation')}
                    </button>
                    <button
                      type="button"
                      className="button button-soft admin-primary-action"
                      disabled={op.loading || !canFinishEvaluation}
                      onClick={() => finishEvaluation(round.id, true)}
                    >
                      {t('adminDashboard.finishEvaluationForce')}
                    </button>
                    {canRecoverRoundEvaluation ? (
                      <button
                        type="button"
                        className="button button-ghost status-recovery-action"
                        disabled={op.loading || roundRecoveryLoading}
                        onClick={() => openRoundRecovery(round.id)}
                      >
                        {t('adminDashboard.roundRecovery.open')}
                      </button>
                    ) : null}
                  </div>

                  <div className="distribute-box">
                    <label className="field" htmlFor={`min-reviewers-${round.id}`}>
                      <span>{t('adminDashboard.minReviewers')}</span>
                      <input
                        id={`min-reviewers-${round.id}`}
                        type="number"
                        min={1}
                        value={
                          minReviewersForRound
                        }
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
                      className="button button-primary admin-distribute-action"
                      disabled={op.loading || !canDistributeAssignments}
                      onClick={() => distributeAssignments(round.id)}
                    >
                      {t('adminDashboard.distributeAssignments')}
                    </button>
                    {assignedJuryBelowRoundMinimum ? (
                      <p className="admin-jury-warning">{distributionMinimumWarning}</p>
                    ) : null}
                  </div>

                  {op.error ? <p className="form-error">{op.error}</p> : null}
                  {op.notice ? <p className="form-success">{op.notice}</p> : null}
                </article>
              );
            })}
          </div>
        ) : null}
      </article>

      <AdminActionModal
        open={statusRecoveryOpen}
        title={t('adminDashboard.statusRecovery.title')}
        closeLabel={t('adminDashboard.modal.close')}
        onClose={closeStatusRecovery}
      >
        {selectedTournament ? (
          <form className="panel-form" onSubmit={submitStatusRecovery} noValidate>
            <div className="state-callout subtle status-recovery-warning">
              <strong>{t('adminDashboard.statusRecovery.warningTitle')}</strong>
              <p>{t('adminDashboard.statusRecovery.warningLead')}</p>
            </div>

            <div className="status-row">
              <span>{t('adminDashboard.statusRecovery.current')}</span>
              <strong>{t(`tournaments.status.${selectedTournament.status}`)}</strong>
            </div>

            <label className="field" htmlFor="admin-status-recovery-target">
              <span>{t('adminDashboard.statusRecovery.target')}</span>
              <select
                id="admin-status-recovery-target"
                className="select-input"
                value={statusRecoveryTarget}
                onChange={(event) =>
                  setStatusRecoveryTarget(event.target.value as TournamentStatus)
                }
                required
              >
                {recoverableTournamentStatuses.map((status) => (
                  <option key={status} value={status}>
                    {t(`tournaments.status.${status}`)}
                  </option>
                ))}
              </select>
            </label>

            <label className="field" htmlFor="admin-status-recovery-reason">
              <span>{t('adminDashboard.statusRecovery.reason')}</span>
              <textarea
                id="admin-status-recovery-reason"
                className="admin-modal-textarea"
                value={statusRecoveryReason}
                onChange={(event) => setStatusRecoveryReason(event.target.value)}
                placeholder={t('adminDashboard.statusRecovery.reasonPlaceholder')}
                minLength={3}
                maxLength={500}
                required
              />
            </label>

            {statusRecoveryError ? (
              <p className="form-error">{statusRecoveryError}</p>
            ) : null}

            <button
              type="submit"
              className="button button-primary"
              disabled={
                statusRecoveryLoading ||
                !statusRecoveryTarget ||
                statusRecoveryReason.trim().length < 3
              }
            >
              {statusRecoveryLoading
                ? t('adminDashboard.statusRecovery.saving')
                : t('adminDashboard.statusRecovery.submit')}
            </button>
          </form>
        ) : (
          <p className="form-error">{t('adminDashboard.modal.selectTournamentFirst')}</p>
        )}
      </AdminActionModal>

      <AdminActionModal
        open={roundRecoveryOpen}
        title={t('adminDashboard.roundRecovery.title')}
        closeLabel={t('adminDashboard.modal.close')}
        onClose={closeRoundRecovery}
      >
        {recoveryRound ? (
          <form className="panel-form" onSubmit={submitRoundRecovery} noValidate>
            <p className="inline-hint">
              {t('adminDashboard.roundRecovery.roundLabel')}:{' '}
              <strong>
                #{recoveryRound.sequence}{' '}
                {formatDashboardRoundTitle(recoveryRound.title, recoveryRound.sequence, t)}
              </strong>
            </p>

            <div className="state-callout subtle status-recovery-warning">
              <strong>{t('adminDashboard.roundRecovery.warningTitle')}</strong>
              <p>{t('adminDashboard.roundRecovery.warningLead')}</p>
            </div>

            <div className="status-row">
              <span>{t('adminDashboard.roundRecovery.target')}</span>
              <strong>{t('adminDashboard.roundStatus.SUBMISSION_CLOSED')}</strong>
            </div>

            <label className="field" htmlFor="admin-round-recovery-reason">
              <span>{t('adminDashboard.roundRecovery.reason')}</span>
              <textarea
                id="admin-round-recovery-reason"
                className="admin-modal-textarea"
                value={roundRecoveryReason}
                onChange={(event) => setRoundRecoveryReason(event.target.value)}
                placeholder={t('adminDashboard.roundRecovery.reasonPlaceholder')}
                minLength={3}
                maxLength={500}
                required
              />
            </label>

            {roundRecoveryError ? <p className="form-error">{roundRecoveryError}</p> : null}

            <button
              type="submit"
              className="button button-primary"
              disabled={roundRecoveryLoading || roundRecoveryReason.trim().length < 3}
            >
              {roundRecoveryLoading
                ? t('adminDashboard.roundRecovery.saving')
                : t('adminDashboard.roundRecovery.submit')}
            </button>
          </form>
        ) : (
          <p className="form-error">{t('adminDashboard.roundRecovery.unavailable')}</p>
        )}
      </AdminActionModal>

      <AdminActionModal
        open={quickModal === 'createTournament'}
        title={t('adminDashboard.createTournamentTitle')}
        closeLabel={t('adminDashboard.modal.close')}
        onClose={closeQuickModal}
      >
        {createTournamentError ? <p className="form-error">{createTournamentError}</p> : null}
        {createTournamentNotice ? <p className="form-success">{createTournamentNotice}</p> : null}

        <form className="panel-form" onSubmit={submitTournament} noValidate>
          <div className="state-callout subtle">
            <strong>{t('systemIntegrations.tournamentDefaults.title')}</strong>
            <p>{t('adminDashboard.formHints.tournamentDefaults')}</p>
          </div>

          <label className="field" htmlFor="admin-tournament-title">
            <span>{t('adminDashboard.form.tournamentTitle')}</span>
            <input
              id="admin-tournament-title"
              type="text"
              lang={contentInputLang}
              spellCheck
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              required
              minLength={3}
              maxLength={120}
            />
          </label>

          <label className="field" htmlFor="admin-tournament-description">
            <span>{t('adminDashboard.form.tournamentDescription')}</span>
            <small className="field-hint">
              {t('adminDashboard.formHints.tournamentDescription')}
            </small>
            <textarea
              id="admin-tournament-description"
              lang={contentInputLang}
              spellCheck
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              maxLength={4000}
            />
          </label>

          <label className="field" htmlFor="admin-tournament-start">
            <span>{t('adminDashboard.form.tournamentStartsAt')}</span>
            <small className="field-hint">
              {language === 'uk'
                ? `Часовий пояс системи: ${platformDefaults.defaultProjectTimeZone}`
                : `System time zone: ${platformDefaults.defaultProjectTimeZone}`}
            </small>
            <input
              id="admin-tournament-start"
              type="datetime-local"
              lang={dateTimeInputLang}
              value={tournamentStartsAt}
              onChange={(event) => setTournamentStartsAt(event.target.value)}
            />
          </label>

          <div className="datetime-grid">
            <label className="field" htmlFor="admin-registration-open">
              <span>{t('adminDashboard.form.registrationOpenAt')}</span>
              <small className="field-hint">
                {t('adminDashboard.formHints.registrationWindow')}
              </small>
              <input
                id="admin-registration-open"
                type="datetime-local"
                lang={dateTimeInputLang}
                value={registrationOpenAt}
                onChange={(event) => setRegistrationOpenAt(event.target.value)}
                required
              />
            </label>

            <label className="field" htmlFor="admin-registration-close">
              <span>{t('adminDashboard.form.registrationCloseAt')}</span>
              <small className="field-hint">
                {language === 'uk'
                  ? `За замовчуванням: ${platformDefaults.defaultRegistrationWindowHours} год.`
                  : `Default: ${platformDefaults.defaultRegistrationWindowHours} hours.`}
              </small>
              <input
                id="admin-registration-close"
                type="datetime-local"
                lang={dateTimeInputLang}
                value={registrationCloseAt}
                onChange={(event) => setRegistrationCloseAt(event.target.value)}
                required
              />
            </label>
          </div>

          <label className="field" htmlFor="admin-max-teams">
            <span>{t('adminDashboard.form.maxTeams')}</span>
            <small className="field-hint">
              {language === 'uk'
                ? platformDefaults.defaultTournamentMaxTeams
                  ? `Системний default: ${platformDefaults.defaultTournamentMaxTeams} команд.`
                  : 'Залиште порожнім, якщо ліміт команд не потрібен.'
                : platformDefaults.defaultTournamentMaxTeams
                  ? `System default: ${platformDefaults.defaultTournamentMaxTeams} teams.`
                  : 'Leave empty when no team cap is required.'}
            </small>
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
      </AdminActionModal>

      <AdminActionModal
        open={quickModal === 'createUser'}
        title={t('adminDashboard.createUserTitle')}
        closeLabel={t('adminDashboard.modal.close')}
        onClose={closeQuickModal}
      >
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
      </AdminActionModal>

      <AdminActionModal
        open={quickModal === 'createRound'}
        title={t('adminDashboard.createRoundTitle')}
        closeLabel={t('adminDashboard.modal.close')}
        onClose={closeQuickModal}
      >
        {selectedTournament ? (
          <p className="inline-hint">
            {t('adminDashboard.tournamentLabel')}: <strong>{selectedTournament.title}</strong>
          </p>
        ) : (
          <p className="form-error">{t('adminDashboard.modal.selectTournamentFirst')}</p>
        )}

        {createRoundError ? <p className="form-error">{createRoundError}</p> : null}
        {createRoundNotice ? <p className="form-success">{createRoundNotice}</p> : null}

        <form className="panel-form" onSubmit={submitRound} noValidate>
          <div className="state-callout subtle">
            <strong>{t('systemIntegrations.tournamentDefaults.roundDefaultsTitle')}</strong>
            <p>{t('adminDashboard.formHints.roundDefaults')}</p>
          </div>

          <label className="field" htmlFor="admin-round-title">
            <span>{t('adminDashboard.form.roundTitle')}</span>
            <input
              id="admin-round-title"
              type="text"
              lang={contentInputLang}
              spellCheck
              value={roundTitle}
              onChange={(event) => setRoundTitle(event.target.value)}
              required
              minLength={3}
              maxLength={140}
            />
          </label>

          <label className="field" htmlFor="admin-round-description">
            <span>{t('adminDashboard.form.roundDescription')}</span>
            <small className="field-hint">
              {t('adminDashboard.formHints.roundDescription')}
            </small>
            <textarea
              id="admin-round-description"
              lang={contentInputLang}
              spellCheck
              value={roundDescription}
              onChange={(event) => setRoundDescription(event.target.value)}
              required
              minLength={10}
              maxLength={5000}
            />
          </label>

          <label className="field" htmlFor="admin-round-must-have">
            <span>{t('adminDashboard.form.mustHave')}</span>
            <small className="field-hint">
              {t('adminDashboard.formHints.mustHave')}
            </small>
            <textarea
              id="admin-round-must-have"
              lang={contentInputLang}
              spellCheck
              value={mustHaveRaw}
              onChange={(event) => setMustHaveRaw(event.target.value)}
            />
          </label>

          <label className="field" htmlFor="admin-round-tech-req">
            <span>{t('adminDashboard.form.technologyRequirements')}</span>
            <small className="field-hint">
              {t('adminDashboard.formHints.technologyRequirements')}
            </small>
            <textarea
              id="admin-round-tech-req"
              lang={contentInputLang}
              spellCheck
              value={technologyRequirementsRaw}
              onChange={(event) => setTechnologyRequirementsRaw(event.target.value)}
            />
          </label>

          <label className="field" htmlFor="admin-round-materials">
            <span>{t('adminDashboard.form.additionalMaterials')}</span>
            <small className="field-hint">
              {t('adminDashboard.formHints.additionalMaterials')}
            </small>
            <textarea
              id="admin-round-materials"
              lang={contentInputLang}
              spellCheck
              value={additionalMaterialsRaw}
              onChange={(event) => setAdditionalMaterialsRaw(event.target.value)}
            />
          </label>

          <div className="datetime-grid">
            <label className="field" htmlFor="admin-round-starts-at">
              <span>{t('adminDashboard.form.roundStartsAt')}</span>
              <small className="field-hint">
                {language === 'uk'
                  ? `Часовий пояс системи: ${platformDefaults.defaultProjectTimeZone}`
                  : `System time zone: ${platformDefaults.defaultProjectTimeZone}`}
              </small>
              <input
                id="admin-round-starts-at"
                type="datetime-local"
                lang={dateTimeInputLang}
                value={roundStartsAt}
                onChange={(event) => setRoundStartsAt(event.target.value)}
                required
              />
            </label>

            <label className="field" htmlFor="admin-round-deadline-at">
              <span>{t('adminDashboard.form.roundDeadlineAt')}</span>
              <small className="field-hint">
                {language === 'uk'
                  ? `За замовчуванням: ${platformDefaults.defaultRoundDurationHours} год.`
                  : `Default: ${platformDefaults.defaultRoundDurationHours} hours.`}
              </small>
              <input
                id="admin-round-deadline-at"
                type="datetime-local"
                lang={dateTimeInputLang}
                value={roundDeadlineAt}
                onChange={(event) => setRoundDeadlineAt(event.target.value)}
                required
              />
            </label>
          </div>

          <button
            type="submit"
            className="button button-primary"
            disabled={createRoundLoading || !selectedTournament}
          >
            {createRoundLoading
              ? t('adminDashboard.form.creatingRound')
              : t('adminDashboard.form.createRound')}
          </button>
        </form>
      </AdminActionModal>
    </section>
  );
}
