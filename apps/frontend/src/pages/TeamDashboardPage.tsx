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
import { useAutoDismissMessage } from '../lib/useAutoDismissMessage';
import {
  rememberTournamentSelection,
  resolveStoredTournamentSelection,
} from '../lib/tournamentSelection';
import { localizeWeekLabels } from '../lib/weekLabels';
import { useI18n } from '../i18n/I18nProvider';

type UserRole = 'ADMIN' | 'TEAM' | 'JURY' | 'ORGANIZER';

type AuthMe = {
  id: string;
  fullName: string;
  email: string;
  role: UserRole;
};

type TournamentStatus = 'DRAFT' | 'REGISTRATION' | 'RUNNING' | 'FINISHED';

type Tournament = {
  id: string;
  title: string;
  status: TournamentStatus;
  canTeamRegister: boolean;
};

type TeamMember = {
  id: string;
  fullName: string;
  email: string;
};

type TeamProfile = {
  id: string;
  tournamentId: string;
  name: string;
  organization: string | null;
  contactHandle: string | null;
  captain: {
    id: string;
    fullName: string;
    email: string;
  };
  members: TeamMember[];
};

type ActiveRound = {
  id: string;
  title: string;
  description: string;
  startsAt: string;
  deadlineAt: string;
  mustHave: string[];
  technologyRequirements: string[];
  additionalMaterials: string[];
  status: 'DRAFT' | 'ACTIVE' | 'SUBMISSION_CLOSED' | 'EVALUATED';
};

type TeamSubmission = {
  id: string;
  repoUrl: string;
  demoUrl: string;
  liveDemoUrl: string | null;
  shortSummary: string | null;
  submittedAt: string;
  status: 'DRAFT' | 'SUBMITTED' | 'LOCKED';
  isEditable: boolean;
};

type DashboardActiveEntity = {
  id: string;
  name: string;
  subtitle: string;
};

type TeamDashboardMetrics = {
  summary: {
    runningTournaments: number;
    registrationOpen: number;
    totalSubmissions: number;
  };
  weekly: {
    labels: string[];
    reviewed: number[];
    submissions: number[];
  };
  pie: {
    submitted: number;
    draft: number;
    locked: number;
    total: number;
  };
  activeEntities: DashboardActiveEntity[];
  activity: number[];
};

type PlatformDefaults = {
  minTeamMembers: number;
  maxTeamMembers: number;
  defaultProjectTimeZone: string;
};

type MemberDraft = {
  fullName: string;
  email: string;
};

const DEFAULT_MEMBERS: MemberDraft[] = [
  { fullName: '', email: '' },
  { fullName: '', email: '' },
];

const DEFAULT_PLATFORM_DEFAULTS: PlatformDefaults = {
  minTeamMembers: 2,
  maxTeamMembers: 8,
  defaultProjectTimeZone: 'Europe/Kyiv',
};

const DEFAULT_WEEK_LABELS = ['Sat', 'Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri'];

const EMPTY_TEAM_METRICS: TeamDashboardMetrics = {
  summary: {
    runningTournaments: 0,
    registrationOpen: 0,
    totalSubmissions: 0,
  },
  weekly: {
    labels: DEFAULT_WEEK_LABELS,
    reviewed: new Array(7).fill(0),
    submissions: new Array(7).fill(0),
  },
  pie: {
    submitted: 0,
    draft: 0,
    locked: 0,
    total: 0,
  },
  activeEntities: [],
  activity: new Array(7).fill(0),
};

function emptyMember(): MemberDraft {
  return { fullName: '', email: '' };
}

function toPositiveInteger(value: unknown, fallback: number) {
  const normalized =
    typeof value === 'number' ? value : typeof value === 'string' ? Number(value) : NaN;

  if (!Number.isFinite(normalized)) {
    return fallback;
  }

  return Math.max(1, Math.floor(normalized));
}

function sanitizePlatformDefaults(value: unknown): PlatformDefaults {
  if (!value || typeof value !== 'object') {
    return DEFAULT_PLATFORM_DEFAULTS;
  }

  const payload = value as Partial<PlatformDefaults>;
  const minTeamMembers = toPositiveInteger(
    payload.minTeamMembers,
    DEFAULT_PLATFORM_DEFAULTS.minTeamMembers,
  );
  const requestedMaxTeamMembers = toPositiveInteger(
    payload.maxTeamMembers,
    DEFAULT_PLATFORM_DEFAULTS.maxTeamMembers,
  );
  const maxTeamMembers = Math.max(minTeamMembers, requestedMaxTeamMembers);
  const defaultProjectTimeZone =
    typeof payload.defaultProjectTimeZone === 'string' && payload.defaultProjectTimeZone.trim()
      ? payload.defaultProjectTimeZone.trim()
      : DEFAULT_PLATFORM_DEFAULTS.defaultProjectTimeZone;

  return {
    minTeamMembers,
    maxTeamMembers,
    defaultProjectTimeZone,
  };
}

function isValidEmail(value: string) {
  return /^\S+@\S+\.\S+$/.test(value);
}

function isValidHttpUrl(value: string) {
  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

function formatCountdown(target: string, language: string, nowMs: number) {
  const diff = new Date(target).getTime() - nowMs;
  if (diff <= 0) {
    return language === 'uk' ? 'Дедлайн минув' : 'Deadline passed';
  }

  const totalMinutes = Math.floor(diff / 60000);
  const days = Math.floor(totalMinutes / (24 * 60));
  const hours = Math.floor((totalMinutes % (24 * 60)) / 60);
  const minutes = totalMinutes % 60;
  const dayLabel = language === 'uk' ? 'д' : 'd';
  const hourLabel = language === 'uk' ? 'г' : 'h';
  const minuteLabel = language === 'uk' ? 'хв' : 'm';
  const parts = [] as string[];

  if (days > 0) {
    parts.push(`${days}${dayLabel}`);
  }
  if (hours > 0 || days > 0) {
    parts.push(`${hours}${hourLabel}`);
  }
  parts.push(`${minutes}${minuteLabel}`);

  return parts.join(' ');
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

function isTeamDashboardMetrics(value: unknown): value is TeamDashboardMetrics {
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

export default function TeamDashboardPage() {
  const { language, t } = useI18n();
  const { notifyError, notifySuccess } = useNotifications();

  const [me, setMe] = useState<AuthMe | null>(null);
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [selectedTournamentId, setSelectedTournamentId] = useState('');
  const [metrics, setMetrics] = useState<TeamDashboardMetrics>(EMPTY_TEAM_METRICS);
  const [platformDefaults, setPlatformDefaults] = useState<PlatformDefaults>(
    DEFAULT_PLATFORM_DEFAULTS,
  );

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [team, setTeam] = useState<TeamProfile | null>(null);
  const [teamLoading, setTeamLoading] = useState(false);
  const [teamError, setTeamError] = useState('');
  const [teamNotice, setTeamNotice] = useState('');
  const [registering, setRegistering] = useState(false);

  const [teamName, setTeamName] = useState('');
  const [organization, setOrganization] = useState('');
  const [contactHandle, setContactHandle] = useState('');
  const [members, setMembers] = useState<MemberDraft[]>(DEFAULT_MEMBERS);

  const [activeRound, setActiveRound] = useState<ActiveRound | null>(null);
  const [scheduleEvents, setScheduleEvents] = useState<TournamentScheduleEvent[]>([]);
  const [submission, setSubmission] = useState<TeamSubmission | null>(null);
  const [submissionError, setSubmissionError] = useState('');
  const [submissionNotice, setSubmissionNotice] = useState('');
  const [submissionLoading, setSubmissionLoading] = useState(false);
  const [scheduleLoading, setScheduleLoading] = useState(false);
  const [scheduleError, setScheduleError] = useState('');

  useAutoDismissMessage(teamNotice, setTeamNotice);
  useAutoDismissMessage(submissionNotice, setSubmissionNotice);
  const [savingSubmission, setSavingSubmission] = useState(false);

  const [repoUrl, setRepoUrl] = useState('');
  const [demoUrl, setDemoUrl] = useState('');
  const [liveDemoUrl, setLiveDemoUrl] = useState('');
  const [shortSummary, setShortSummary] = useState('');
  const [nowMs, setNowMs] = useState(() => Date.now());

  const selectedTournament = useMemo(
    () => tournaments.find((entry) => entry.id === selectedTournamentId) ?? null,
    [selectedTournamentId, tournaments],
  );

  const roleAllowed = me?.role === 'TEAM';

  const canEditSubmission = useMemo(() => {
    if (submission) {
      return submission.isEditable;
    }

    if (!activeRound) {
      return false;
    }

    return (
      activeRound.status === 'ACTIVE' &&
      nowMs <= new Date(activeRound.deadlineAt).getTime()
    );
  }, [activeRound, nowMs, submission]);

  const deadlineCountdown = useMemo(
    () => (activeRound ? formatCountdown(activeRound.deadlineAt, language, nowMs) : ''),
    [activeRound, language, nowMs],
  );
  const weekLabels = metrics.weekly.labels.length > 0 ? metrics.weekly.labels : DEFAULT_WEEK_LABELS;
  const localizedWeekLabels = useMemo(
    () => localizeWeekLabels(weekLabels, language),
    [language, weekLabels],
  );
  const weeklyReviewRaw = useMemo(
    () => toSizedSeries(metrics.weekly.reviewed, weekLabels.length),
    [metrics.weekly.reviewed, weekLabels.length],
  );
  const weeklySubmissionRaw = useMemo(
    () => toSizedSeries(metrics.weekly.submissions, weekLabels.length),
    [metrics.weekly.submissions, weekLabels.length],
  );
  const weeklyReviewBars = useMemo(() => toBarHeights(weeklyReviewRaw), [weeklyReviewRaw]);
  const weeklySubmissionBars = useMemo(
    () => toBarHeights(weeklySubmissionRaw),
    [weeklySubmissionRaw],
  );
  const teamStatusShares = {
    inProgress: metrics.pie.draft,
    submitted: metrics.pie.submitted,
    locked: metrics.pie.locked,
  };
  const runningTournaments = metrics.summary.runningTournaments;
  const registrationOpenTournaments = metrics.summary.registrationOpen;
  const activeDelta = Math.max(1, Math.round(runningTournaments / 2) + 1);
  const registrationDelta = Math.max(1, Math.round(registrationOpenTournaments / 2) + 2);
  const quickMembers = metrics.activeEntities.map((entry) => ({
    id: entry.id,
    name: entry.name,
    subtitle: entry.subtitle,
    initials: toInitials(entry.name),
  }));
  const quickMembersPreview = quickMembers.slice(0, 5);
  const activityCurve = toSizedSeries(metrics.activity, 8);
  const activityPath = buildSparkPath(activityCurve);
  const hasWeeklyMetrics = weeklyReviewRaw.some((value) => value > 0) || weeklySubmissionRaw.some((value) => value > 0);
  const hasStatusMetrics = metrics.pie.total > 0;
  const hasActivityMetrics = activityCurve.some((value) => value > 0);

  const nextStepMessage = useMemo(() => {
    if (!selectedTournament) {
      return '';
    }

    if (!team) {
      return selectedTournament.canTeamRegister
        ? t('teamDashboard.nextStep.registerTeam')
        : t('teamDashboard.nextStep.waitForRegistration');
    }

    if (!activeRound) {
      return t('teamDashboard.nextStep.waitForRound');
    }

    if (!submission) {
      return canEditSubmission
        ? t('teamDashboard.nextStep.submitWork')
        : t('teamDashboard.nextStep.waitForNextRound');
    }

    return canEditSubmission
      ? t('teamDashboard.nextStep.updateSubmission')
      : t('teamDashboard.nextStep.lockedSubmission');
  }, [activeRound, canEditSubmission, selectedTournament, submission, t, team]);

  useEffect(() => {
    const timer = window.setInterval(() => setNowMs(Date.now()), 60000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    setMembers((current) => {
      if (current.length > platformDefaults.maxTeamMembers) {
        return current.slice(0, platformDefaults.maxTeamMembers);
      }

      if (current.length >= platformDefaults.minTeamMembers) {
        return current;
      }

      return [
        ...current,
        ...new Array(platformDefaults.minTeamMembers - current.length)
          .fill(null)
          .map(() => emptyMember()),
      ];
    });
  }, [platformDefaults.maxTeamMembers, platformDefaults.minTeamMembers]);

  function applySubmissionDraft(value: TeamSubmission | null) {
    setSubmission(value);
    setRepoUrl(value?.repoUrl ?? '');
    setDemoUrl(value?.demoUrl ?? '');
    setLiveDemoUrl(value?.liveDemoUrl ?? '');
    setShortSummary(value?.shortSummary ?? '');
  }

  async function loadInitialData() {
    setLoading(true);
    setError('');

    try {
      const [meData, tournamentData, defaultsData] = await Promise.all([
        apiRequest<AuthMe>('/auth/me'),
        apiRequest<Tournament[]>('/tournaments'),
        apiRequest<PlatformDefaults>('/platform/defaults')
          .then((value) => sanitizePlatformDefaults(value))
          .catch(() => DEFAULT_PLATFORM_DEFAULTS),
      ]);

      setMe(meData);
      setTournaments(tournamentData);
      setPlatformDefaults(defaultsData);

      if (tournamentData.length > 0) {
        setSelectedTournamentId((current) =>
          current || resolveStoredTournamentSelection(tournamentData, tournamentData[0].id),
        );
      }
    } catch (requestError) {
      setError(
        normalizeApiErrorMessage(requestError, t, t('teamDashboard.loadFailed')),
      );
    } finally {
      setLoading(false);
    }
  }

  async function loadTeamForTournament(tournamentId: string) {
    setTeamLoading(true);
    setTeamError('');
    setTeamNotice('');

    try {
      const teamData = await apiRequest<TeamProfile>(
        `/tournaments/${tournamentId}/teams/me`,
      );
      setTeam(teamData);
    } catch (requestError) {
      if (requestError instanceof ApiError && requestError.status === 404) {
        setTeam(null);
      } else {
        setTeamError(
          normalizeApiErrorMessage(requestError, t, t('teamDashboard.teamLoadFailed')),
        );
      }
    } finally {
      setTeamLoading(false);
    }
  }

  async function loadRoundAndSubmission(tournamentId: string) {
    setSubmissionError('');
    setSubmissionNotice('');
    setSubmissionLoading(true);

    try {
      const roundData = await apiRequest<ActiveRound | null>(
        `/tournaments/${tournamentId}/rounds/active`,
      );
      setActiveRound(roundData);

      if (!roundData) {
        applySubmissionDraft(null);
        return;
      }

      try {
        const submissionData = await apiRequest<TeamSubmission>(
          `/rounds/${roundData.id}/submissions/me`,
        );
        applySubmissionDraft(submissionData);
      } catch (requestError) {
        if (requestError instanceof ApiError && requestError.status === 404) {
          applySubmissionDraft(null);
        } else {
          setSubmissionError(
            normalizeApiErrorMessage(
              requestError,
              t,
              t('teamDashboard.submissionLoadFailed'),
            ),
          );
        }
      }
    } catch (requestError) {
      setActiveRound(null);
      applySubmissionDraft(null);
      setSubmissionError(
        normalizeApiErrorMessage(requestError, t, t('teamDashboard.roundLoadFailed')),
      );
    } finally {
      setSubmissionLoading(false);
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

  async function loadDashboardMetrics(tournamentId?: string) {
    try {
      const query = tournamentId ? `?tournamentId=${encodeURIComponent(tournamentId)}` : '';
      const data = await apiRequest<unknown>(`/dashboard/team/metrics${query}`);
      if (!isTeamDashboardMetrics(data)) {
        throw new Error('Invalid metrics response');
      }
      setMetrics(data);
    } catch {
      setMetrics(EMPTY_TEAM_METRICS);
    }
  }

  async function reloadTournamentData(tournamentId: string) {
    if (!roleAllowed) {
      return;
    }

    await Promise.all([
      loadTeamForTournament(tournamentId),
      loadRoundAndSubmission(tournamentId),
      loadSchedule(tournamentId),
      loadDashboardMetrics(tournamentId),
    ]);
  }

  useEffect(() => {
    void loadInitialData();
  }, []);

  useEffect(() => {
    if (!selectedTournamentId || !me) {
      return;
    }

    rememberTournamentSelection(selectedTournamentId);
    void reloadTournamentData(selectedTournamentId);
  }, [selectedTournamentId, me?.role]);

  useEffect(() => {
    if (!roleAllowed) {
      setMetrics(EMPTY_TEAM_METRICS);
      return;
    }

    void loadDashboardMetrics(selectedTournamentId || undefined);
  }, [roleAllowed, selectedTournamentId]);

  function updateMember(index: number, field: keyof MemberDraft, value: string) {
    setMembers((current) =>
      current.map((item, itemIndex) =>
        itemIndex === index ? { ...item, [field]: value } : item,
      ),
    );
  }

  function addMember() {
    setMembers((current) =>
      current.length >= platformDefaults.maxTeamMembers
        ? current
        : [...current, emptyMember()],
    );
  }

  function removeMember(index: number) {
    setMembers((current) =>
      current.length <= platformDefaults.minTeamMembers
        ? current
        : current.filter((_, i) => i !== index),
    );
  }

  async function submitTeamRegistration(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedTournamentId) {
      return;
    }

    setTeamError('');
    setTeamNotice('');

    const normalizedTeamName = teamName.trim();
    if (normalizedTeamName.length < 2 || normalizedTeamName.length > 120) {
      setTeamError(t('teamDashboard.validation.teamNameLength'));
      return;
    }

    const normalizedMembers = members.map((member) => ({
      fullName: member.fullName.trim(),
      email: member.email.trim().toLowerCase(),
    }));

    if (
      normalizedMembers.length < platformDefaults.minTeamMembers ||
      normalizedMembers.length > platformDefaults.maxTeamMembers
    ) {
      setTeamError(
        language === 'uk'
          ? `Команда має містити від ${platformDefaults.minTeamMembers} до ${platformDefaults.maxTeamMembers} учасників.`
          : `The team must contain between ${platformDefaults.minTeamMembers} and ${platformDefaults.maxTeamMembers} members.`,
      );
      return;
    }

    const emails = new Set<string>(me?.email ? [me.email.toLowerCase()] : []);
    for (const member of normalizedMembers) {
      if (member.fullName.length < 2 || member.fullName.length > 120) {
        setTeamError(t('teamDashboard.validation.memberNameLength'));
        return;
      }

      if (!member.email) {
        setTeamError(t('teamDashboard.validation.memberEmailRequired'));
        return;
      }

      if (!isValidEmail(member.email)) {
        setTeamError(t('teamDashboard.validation.memberEmailInvalid'));
        return;
      }

      if (emails.has(member.email)) {
        setTeamError(t('teamDashboard.validation.memberEmailDuplicate'));
        return;
      }

      emails.add(member.email);
    }

    setRegistering(true);

    try {
      const payload = {
        name: normalizedTeamName,
        organization: organization.trim() || undefined,
        contactHandle: contactHandle.trim() || undefined,
        members: normalizedMembers,
      };

      const created = await apiRequest<TeamProfile>(
        `/tournaments/${selectedTournamentId}/teams/register`,
        {
          method: 'POST',
          body: payload,
        },
      );

      setTeam(created);
      setTeamNotice(t('teamDashboard.registrationSuccess'));
      setTeamName('');
      setOrganization('');
      setContactHandle('');
      setMembers(DEFAULT_MEMBERS);
      await loadDashboardMetrics(selectedTournamentId);
      notifySuccess(t('teamDashboard.registrationSuccess'));
    } catch (requestError) {
      const message = normalizeApiErrorMessage(
        requestError,
        t,
        t('teamDashboard.registrationFailed'),
      );
      setTeamError(message);
      notifyError(message);
    } finally {
      setRegistering(false);
    }
  }

  async function submitSubmission(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!activeRound) {
      return;
    }

    setSubmissionError('');
    setSubmissionNotice('');

    const normalizedRepoUrl = repoUrl.trim();
    const normalizedDemoUrl = demoUrl.trim();
    const normalizedLiveDemoUrl = liveDemoUrl.trim();
    const normalizedSummary = shortSummary.trim();

    if (!normalizedRepoUrl) {
      setSubmissionError(t('teamDashboard.validation.repoUrlRequired'));
      return;
    }

    if (!isValidHttpUrl(normalizedRepoUrl)) {
      setSubmissionError(t('teamDashboard.validation.repoUrlInvalid'));
      return;
    }

    if (!normalizedDemoUrl) {
      setSubmissionError(t('teamDashboard.validation.demoUrlRequired'));
      return;
    }

    if (!isValidHttpUrl(normalizedDemoUrl)) {
      setSubmissionError(t('teamDashboard.validation.demoUrlInvalid'));
      return;
    }

    if (normalizedLiveDemoUrl && !isValidHttpUrl(normalizedLiveDemoUrl)) {
      setSubmissionError(t('teamDashboard.validation.liveDemoUrlInvalid'));
      return;
    }

    if (normalizedSummary && normalizedSummary.length < 10) {
      setSubmissionError(t('teamDashboard.validation.summaryTooShort'));
      return;
    }

    setSavingSubmission(true);

    try {
      const saved = await apiRequest<TeamSubmission>(`/rounds/${activeRound.id}/submissions`, {
        method: 'POST',
        body: {
          repoUrl: normalizedRepoUrl,
          demoUrl: normalizedDemoUrl,
          liveDemoUrl: normalizedLiveDemoUrl || undefined,
          shortSummary: normalizedSummary || undefined,
        },
      });

      applySubmissionDraft(saved);
      setSubmissionNotice(t('teamDashboard.submissionSaved'));
      await loadDashboardMetrics(selectedTournamentId || undefined);
      notifySuccess(t('teamDashboard.submissionSaved'));
    } catch (requestError) {
      const message = normalizeApiErrorMessage(
        requestError,
        t,
        t('teamDashboard.submissionSaveFailed'),
      );
      setSubmissionError(message);
      notifyError(message);
    } finally {
      setSavingSubmission(false);
    }
  }

  if (loading) {
    return <QuietLoadingCard label={t('teamDashboard.loading')} />;
  }

  if (error) {
    return (
      <article className="card state-card">
        <p className="form-error">{error}</p>
        <button type="button" className="button button-soft" onClick={loadInitialData}>
          {t('teamDashboard.retry')}
        </button>
      </article>
    );
  }

  if (!me) {
    return <article className="card state-card">{t('teamDashboard.loadFailed')}</article>;
  }

  if (!roleAllowed) {
    return (
      <article className="card state-card">
        <p className="eyebrow">{t('teamDashboard.accessTitle')}</p>
        <h1>{t('teamDashboard.accessDenied')}</h1>
        <p className="lead">{t('teamDashboard.accessLead')}</p>
      </article>
    );
  }

  if (tournaments.length === 0) {
    return <article className="card state-card">{t('teamDashboard.noTournaments')}</article>;
  }

  return (
    <section className="team-dashboard">
      <header className="section-header">
        <p className="eyebrow">{t('teamDashboard.eyebrow')}</p>
        <h1>{t('teamDashboard.title')}</h1>
        <p className="lead">{t('teamDashboard.lead')}</p>
      </header>

      <article className="card panel-card dashboard-overview-card dashboard-overview-card--role">
        <div className="dashboard-overview-meta">
          <div>
            <p className="eyebrow">{t('teamDashboard.eyebrow')}</p>
            <h2>{t('shell.overview')}</h2>
            <p>{t('teamDashboard.lead')}</p>
          </div>
          <div className="dashboard-overview-status">
            <span>{t('teamDashboard.tournamentLabel')}</span>
            <strong>{selectedTournament?.title ?? '-'}</strong>
            <p>
              {selectedTournament
                ? t(`tournaments.status.${selectedTournament.status}`)
                : t('teamDashboard.noTournaments')}
            </p>
          </div>
        </div>

        <div className="dashboard-overview-top">
          <div className="dashboard-summary-tiles">
            <article className="dashboard-highlight-tile">
              <div className="dashboard-tile-head">
                <span>{t('tournaments.sections.active')}</span>
                <span className="dashboard-tile-chip" aria-hidden />
              </div>
              <strong>{runningTournaments}</strong>
              <div className="dashboard-tile-foot">
                <a href="#team-tournament-select-card">{t('shell.viewAll')}</a>
                <span>
                  +{activeDelta} {t('shell.thisMonth')}
                </span>
              </div>
            </article>
            <article className="dashboard-muted-tile">
              <div className="dashboard-tile-head">
                <span>{t('tournaments.filters.registrationOpen')}</span>
                <span className="dashboard-tile-chip muted" aria-hidden />
              </div>
              <strong>{registrationOpenTournaments}</strong>
              <div className="dashboard-tile-foot">
                <a href="#team-submission-card">{t('shell.viewAll')}</a>
                <span>
                  +{registrationDelta} {t('shell.thisMonth')}
                </span>
              </div>
            </article>
          </div>

          <div className="dashboard-quick-actions">
            <div className="dashboard-quick-head">
              <strong>{t('shell.quickActions')}</strong>
            </div>
            <a href="#team-card" className="button dashboard-action is-teal">
              {t('teamDashboard.teamCardTitle')}
            </a>
            <a href="#team-submission-card" className="button dashboard-action is-purple">
              {t('teamDashboard.submissionCardTitle')}
            </a>
            <a href="#team-tournament-select-card" className="button dashboard-action is-orange">
              {t('teamDashboard.tournamentLabel')}
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
            {hasWeeklyMetrics ? (
              <>
                <div className="dashboard-bars">
                  {weeklyReviewBars.map((value, index) => (
                    <div key={`team-bar-a-${index}`} className="dashboard-bar-pair">
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
                    <span key={`team-week-${label}`}>{label}</span>
                  ))}
                </div>
              </>
            ) : (
              <p className="dashboard-empty-note">{t('teamDashboard.metrics.noWeekly')}</p>
            )}
          </article>

          <article className="dashboard-pie-card">
            <h3>{t('shell.submissionStatus')}</h3>
            {hasStatusMetrics ? (
              <>
                <div
                  className="dashboard-pie"
                  style={{
                    background: `conic-gradient(#5e17eb 0 ${teamStatusShares.submitted}%, #f8890a ${teamStatusShares.submitted}% ${teamStatusShares.submitted + teamStatusShares.locked}%, #2ec9c3 ${teamStatusShares.submitted + teamStatusShares.locked}% 100%)`,
                  }}
                >
                  <div className="dashboard-pie-center">{metrics.pie.total}</div>
                </div>
                <div className="dashboard-pie-legend">
                  <p>
                    <i className="dot is-primary" aria-hidden />
                    {t('profile.submission.SUBMITTED')}: {teamStatusShares.submitted}%
                  </p>
                  <p>
                    <i className="dot is-teal" aria-hidden />
                    {t('profile.submission.DRAFT')}: {teamStatusShares.inProgress}%
                  </p>
                  <p>
                    <i className="dot is-orange" aria-hidden />
                    {t('profile.submission.LOCKED')}: {teamStatusShares.locked}%
                  </p>
                </div>
              </>
            ) : (
              <p className="dashboard-empty-note">{t('teamDashboard.metrics.noStatus')}</p>
            )}
          </article>
        </div>

        <div className="dashboard-lower-grid">
          <article className="dashboard-mini-card is-teams">
            <h3>{t('shell.activeTeams')}</h3>
            {quickMembersPreview.length === 0 ? (
              <p className="inline-hint">{t('teamDashboard.needTeamFirst')}</p>
            ) : (
              <>
                <div className="dashboard-mini-team-list">
                  {quickMembersPreview.map((entry) => (
                    <div key={`team-member-${entry.id}`} className="dashboard-mini-team-item">
                      <span className="dashboard-mini-avatar">{entry.initials}</span>
                      <div className="dashboard-mini-caption">
                        <strong>{entry.name}</strong>
                        <p>{entry.subtitle}</p>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="dashboard-mini-links">
                  <Link to="/app/profile" className="button dashboard-action is-teal">
                    {t('shell.profile')}
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
            {hasActivityMetrics ? (
              <div className="dashboard-line-wrap">
                <svg viewBox="0 0 320 96" preserveAspectRatio="none" className="dashboard-line-svg" aria-hidden>
                  <path d={activityPath} />
                </svg>
              </div>
            ) : (
              <p className="dashboard-empty-note">{t('teamDashboard.metrics.noActivity')}</p>
            )}
          </article>
        </div>
      </article>

      <article id="team-tournament-select-card" className="card panel-card">
        <label className="field" htmlFor="team-tournament-select">
          <span>{t('teamDashboard.tournamentLabel')}</span>
          <select
            id="team-tournament-select"
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

        <div className="status-row">
          <span>{t('teamDashboard.tournamentStatus')}:</span>
          <strong>{selectedTournament ? t(`tournaments.status.${selectedTournament.status}`) : '-'}</strong>
        </div>
      </article>

      <TournamentSchedulePanel
        events={scheduleEvents}
        loading={scheduleLoading}
        error={scheduleError}
        onRetry={() => void loadSchedule(selectedTournamentId)}
        lead={t('teamDashboard.scheduleLead')}
      />

      <div className="team-grid">
        <article id="team-card" className="card panel-card">
          <h2>{t('teamDashboard.teamCardTitle')}</h2>
          {teamLoading ? <QuietLoadingInline label={t('teamDashboard.teamLoading')} compact /> : null}
          {teamError ? (
            <>
              <p className="form-error">{teamError}</p>
              <button
                type="button"
                className="button button-soft"
                onClick={() => void loadTeamForTournament(selectedTournamentId)}
              >
                {t('teamDashboard.retry')}
              </button>
            </>
          ) : null}
          {teamNotice ? <p className="form-success">{teamNotice}</p> : null}

          {nextStepMessage ? (
            <div className="state-callout">
              <strong>{t('teamDashboard.nextStepTitle')}</strong>
              <p>{nextStepMessage}</p>
            </div>
          ) : null}

          {!team && !teamLoading ? (
            selectedTournament?.canTeamRegister ? (
              <form className="panel-form" onSubmit={submitTeamRegistration} noValidate>
                <label className="field" htmlFor="team-name">
                  <span>{t('teamDashboard.form.teamName')}</span>
                  <input
                    id="team-name"
                    type="text"
                    value={teamName}
                    onChange={(event) => setTeamName(event.target.value)}
                    required
                    minLength={2}
                    maxLength={120}
                  />
                </label>

                <label className="field" htmlFor="team-organization">
                  <span>{t('teamDashboard.form.organization')}</span>
                  <input
                    id="team-organization"
                    type="text"
                    value={organization}
                    onChange={(event) => setOrganization(event.target.value)}
                    maxLength={180}
                  />
                </label>

                <label className="field" htmlFor="team-contact">
                  <span>{t('teamDashboard.form.contact')}</span>
                  <input
                    id="team-contact"
                    type="text"
                    value={contactHandle}
                    onChange={(event) => setContactHandle(event.target.value)}
                    maxLength={180}
                  />
                </label>

                <div className="members-block">
                  <div className="members-head">
                    <div>
                      <h3>{t('teamDashboard.form.membersTitle')}</h3>
                      <p className="inline-hint">
                        {language === 'uk'
                          ? `Мінімум ${platformDefaults.minTeamMembers}, максимум ${platformDefaults.maxTeamMembers} учасників без капітана.`
                          : `Minimum ${platformDefaults.minTeamMembers}, maximum ${platformDefaults.maxTeamMembers} members without the captain.`}
                      </p>
                    </div>
                    <button
                      type="button"
                      className="button button-soft"
                      onClick={addMember}
                      disabled={members.length >= platformDefaults.maxTeamMembers}
                    >
                      {t('teamDashboard.form.addMember')}
                    </button>
                  </div>

                  {members.map((member, index) => (
                    <div key={`member-${index}`} className="member-row">
                      <input
                        type="text"
                        placeholder={t('teamDashboard.form.memberName')}
                        value={member.fullName}
                        onChange={(event) => updateMember(index, 'fullName', event.target.value)}
                        required
                        minLength={2}
                        maxLength={120}
                      />
                      <input
                        type="email"
                        placeholder={t('teamDashboard.form.memberEmail')}
                        value={member.email}
                        onChange={(event) => updateMember(index, 'email', event.target.value)}
                        required
                      />
                      <button
                        type="button"
                        className="button button-soft"
                        onClick={() => removeMember(index)}
                        disabled={members.length <= platformDefaults.minTeamMembers}
                      >
                        {t('teamDashboard.form.removeMember')}
                      </button>
                    </div>
                  ))}
                </div>

                <button
                  type="submit"
                  className="button button-primary"
                  disabled={registering}
                >
                  {registering
                    ? t('teamDashboard.form.submitting')
                    : t('teamDashboard.form.submit')}
                </button>
              </form>
            ) : (
              <p>{t('teamDashboard.registrationClosed')}</p>
            )
          ) : null}

          {team ? (
            <div className="team-details">
              <p>
                <strong>{team.name}</strong>
              </p>
              <p>{team.organization || '-'}</p>
              <p>{team.contactHandle || '-'}</p>
              <h3>{t('teamDashboard.membersList')}</h3>
              <ul className="members-list">
                <li>
                  {team.captain.fullName} ({team.captain.email})
                </li>
                {team.members.map((member) => (
                  <li key={member.id}>
                    {member.fullName} ({member.email})
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </article>

        <article id="team-submission-card" className="card panel-card">
          <h2>{t('teamDashboard.submissionCardTitle')}</h2>

          {!team ? <p>{t('teamDashboard.needTeamFirst')}</p> : null}
          {team && submissionLoading ? <QuietLoadingInline label={t('teamDashboard.submissionLoading')} compact /> : null}
          {team && submissionError ? (
            <>
              <p className="form-error">{submissionError}</p>
              <button
                type="button"
                className="button button-soft"
                onClick={() => void loadRoundAndSubmission(selectedTournamentId)}
              >
                {t('teamDashboard.retry')}
              </button>
            </>
          ) : null}
          {team && submissionNotice ? <p className="form-success">{submissionNotice}</p> : null}

          {team && activeRound ? (
            <div className="round-summary">
              <p>
                <strong>{activeRound.title}</strong>
              </p>
              <div className="deadline-banner">
                <span>{t('teamDashboard.deadlineRemaining')}</span>
                <strong>{deadlineCountdown}</strong>
              </div>
              <p>
                {t('teamDashboard.taskStartsAt')}:{' '}
                {formatDateTime(activeRound.startsAt, language)}
              </p>
              <p>
                {t('teamDashboard.deadlineLabel')}:{' '}
                {formatDateTime(activeRound.deadlineAt, language)}
              </p>
              <p>
                <strong>{t('teamDashboard.taskDescriptionLabel')}</strong>
              </p>
              <p>{activeRound.description || t('teamDashboard.noTaskDescription')}</p>

              <div className="must-have-block">
                <p>
                  <strong>{t('teamDashboard.mustHaveTitle')}</strong>
                </p>
                {activeRound.mustHave.length === 0 ? (
                  <p className="inline-hint">{t('teamDashboard.noMustHave')}</p>
                ) : (
                  <ul className="must-have-list">
                    {activeRound.mustHave.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                )}
              </div>

              <div className="must-have-block">
                <p>
                  <strong>{t('teamDashboard.technologyRequirementsTitle')}</strong>
                </p>
                {activeRound.technologyRequirements.length === 0 ? (
                  <p className="inline-hint">{t('teamDashboard.noTechnologyRequirements')}</p>
                ) : (
                  <ul className="must-have-list">
                    {activeRound.technologyRequirements.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                )}
              </div>

              <div className="must-have-block">
                <p>
                  <strong>{t('teamDashboard.additionalMaterialsTitle')}</strong>
                </p>
                {activeRound.additionalMaterials.length === 0 ? (
                  <p className="inline-hint">{t('teamDashboard.noAdditionalMaterials')}</p>
                ) : (
                  <ul className="must-have-list">
                    {activeRound.additionalMaterials.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          ) : null}

          {team && !activeRound && !submissionLoading ? (
            <p>{t('teamDashboard.noActiveRound')}</p>
          ) : null}

          {team && activeRound ? (
            <form className="panel-form" onSubmit={submitSubmission} noValidate>
              {submission ? (
                <div className="state-callout subtle">
                  <strong>{t('teamDashboard.summary.submission')}</strong>
                  <p>
                    {t(`profile.submission.${submission.status}`)}
                    {submission.submittedAt
                      ? ` · ${t('teamDashboard.submittedAt')}: ${formatDateTime(submission.submittedAt, language)}`
                      : ''}
                  </p>
                </div>
              ) : null}

              <label className="field" htmlFor="repo-url">
                <span>{t('teamDashboard.submission.repoUrl')}</span>
                <input
                  id="repo-url"
                  type="url"
                  value={repoUrl}
                  onChange={(event) => setRepoUrl(event.target.value)}
                  required
                  disabled={!canEditSubmission || savingSubmission}
                />
              </label>

              <label className="field" htmlFor="demo-url">
                <span>{t('teamDashboard.submission.demoUrl')}</span>
                <input
                  id="demo-url"
                  type="url"
                  value={demoUrl}
                  onChange={(event) => setDemoUrl(event.target.value)}
                  required
                  disabled={!canEditSubmission || savingSubmission}
                />
              </label>

              <label className="field" htmlFor="live-url">
                <span>{t('teamDashboard.submission.liveDemoUrl')}</span>
                <input
                  id="live-url"
                  type="url"
                  value={liveDemoUrl}
                  onChange={(event) => setLiveDemoUrl(event.target.value)}
                  disabled={!canEditSubmission || savingSubmission}
                />
              </label>

              <label className="field" htmlFor="summary">
                <span>{t('teamDashboard.submission.summary')}</span>
                <textarea
                  id="summary"
                  value={shortSummary}
                  onChange={(event) => setShortSummary(event.target.value)}
                  minLength={10}
                  maxLength={2000}
                  disabled={!canEditSubmission || savingSubmission}
                />
              </label>

              <button
                type="submit"
                className="button button-primary"
                disabled={!canEditSubmission || savingSubmission}
              >
                {savingSubmission
                  ? t('teamDashboard.submission.saving')
                  : t('teamDashboard.submission.save')}
              </button>

              {!canEditSubmission ? (
                <p className="inline-hint">{t('teamDashboard.submission.locked')}</p>
              ) : null}
            </form>
          ) : null}
        </article>
      </div>
    </section>
  );
}
