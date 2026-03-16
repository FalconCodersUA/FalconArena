import { FormEvent, useEffect, useMemo, useState } from 'react';
import { ApiError, apiRequest } from '../lib/api';
import { useI18n } from '../i18n/I18nProvider';

type UserRole = 'ADMIN' | 'TEAM' | 'JURY' | 'ORGANIZER';
type RoundStatus = 'DRAFT' | 'ACTIVE' | 'SUBMISSION_CLOSED' | 'EVALUATED';

type AuthMe = {
  id: string;
  fullName: string;
  email: string;
  role: UserRole;
};

type Tournament = {
  id: string;
  title: string;
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

function formatDate(value: string, language: string) {
  return new Date(value).toLocaleString(language === 'uk' ? 'uk-UA' : 'en-US');
}

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

export default function JuryDashboardPage() {
  const { language, t } = useI18n();

  const [me, setMe] = useState<AuthMe | null>(null);
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [selectedTournamentId, setSelectedTournamentId] = useState('');
  const [rounds, setRounds] = useState<Round[]>([]);
  const [selectedRoundId, setSelectedRoundId] = useState('');
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [selectedAssignmentId, setSelectedAssignmentId] = useState('');

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [roundsLoading, setRoundsLoading] = useState(false);
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
  const selectedRound = useMemo(
    () => rounds.find((entry) => entry.id === selectedRoundId) ?? null,
    [rounds, selectedRoundId],
  );
  const evaluatedAssignments = useMemo(
    () => assignments.filter((entry) => entry.evaluation !== null).length,
    [assignments],
  );
  const pendingAssignments = assignments.length - evaluatedAssignments;
  const draftTotalScore = useMemo(() => getTotalDraftScore(scores), [scores]);

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
        setSelectedTournamentId((current) => current || tournamentData[0].id);
      }
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : t('juryDashboard.loadFailed'),
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
        requestError instanceof Error
          ? requestError.message
          : t('juryDashboard.roundsLoadFailed'),
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
          requestError instanceof Error
            ? requestError.message
            : t('juryDashboard.assignmentsLoadFailed'),
        );
      }
    } finally {
      setAssignmentsLoading(false);
    }
  }

  useEffect(() => {
    void loadInitialData();
  }, []);

  useEffect(() => {
    if (!selectedTournamentId || !roleAllowed) {
      return;
    }

    void loadRounds(selectedTournamentId);
  }, [selectedTournamentId, roleAllowed]);

  useEffect(() => {
    if (!selectedRoundId || !roleAllowed) {
      return;
    }

    void loadAssignments(selectedRoundId);
  }, [selectedRoundId, roleAllowed]);

  useEffect(() => {
    applyAssignmentDraft(selectedAssignment);
  }, [selectedAssignment?.id]);

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
      await loadAssignments(selectedRoundId);
    } catch (requestError) {
      setAssignmentsError(
        requestError instanceof Error
          ? requestError.message
          : t('juryDashboard.saveFailed'),
      );
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
    return <article className="card state-card">{t('juryDashboard.loading')}</article>;
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

      <article className="card panel-card">
        <h2>{t('juryDashboard.summaryTitle')}</h2>
        <div className="summary-grid">
          <div className="summary-card">
            <span>{t('juryDashboard.tournamentLabel')}</span>
            <strong>{tournaments.find((entry) => entry.id === selectedTournamentId)?.title ?? '-'}</strong>
            <p>{selectedRound ? `${t('juryDashboard.roundLabel')}: ${selectedRound.title}` : '-'}</p>
          </div>
          <div className="summary-card">
            <span>{t('juryDashboard.summary.total')}</span>
            <strong>{assignments.length}</strong>
            <p>{t('juryDashboard.assignmentsTitle')}</p>
          </div>
          <div className="summary-card">
            <span>{t('juryDashboard.summary.pending')}</span>
            <strong>{pendingAssignments}</strong>
            <p>{t('juryDashboard.summary.evaluated')}: {evaluatedAssignments}</p>
          </div>
          <div className="summary-card">
            <span>{t('juryDashboard.summary.currentScore')}</span>
            <strong>{selectedAssignment ? draftTotalScore : '-'}</strong>
            <p>
              {selectedRound?.deadlineAt
                ? `${t('juryDashboard.summary.deadline')}: ${formatDate(selectedRound.deadlineAt, language)}`
                : t('juryDashboard.pickAssignment')}
            </p>
          </div>
        </div>

        <div className="state-callout subtle">
          <strong>{t('juryDashboard.nextStepTitle')}</strong>
          <p>
            {selectedAssignment
              ? selectedAssignment.evaluation
                ? t('juryDashboard.nextStep.reviewOrUpdate')
                : t('juryDashboard.nextStep.evaluateSelected')
              : assignments.length > 0
                ? t('juryDashboard.nextStep.pickAssignment')
                : t('juryDashboard.nextStep.waitForAssignments')}
          </p>
        </div>
      </article>

      <article className="card panel-card">
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

        {roundsLoading ? <p>{t('juryDashboard.roundsLoading')}</p> : null}
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

      <div className="team-grid">
        <article className="card panel-card">
          <h2>{t('juryDashboard.assignmentsTitle')}</h2>
          {assignmentsLoading ? <p>{t('juryDashboard.assignmentsLoading')}</p> : null}
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
                    {t('juryDashboard.assignedAt')}: {formatDate(assignment.assignedAt, language)}
                  </p>
                </button>
              ))}
            </div>
          ) : null}
        </article>

        <article className="card panel-card">
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
