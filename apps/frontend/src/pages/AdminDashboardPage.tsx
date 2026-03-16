import { FormEvent, useEffect, useState } from 'react';
import { apiRequest } from '../lib/api';
import { useI18n } from '../i18n/I18nProvider';

type UserRole = 'ADMIN' | 'TEAM' | 'JURY' | 'ORGANIZER';
type TournamentStatus = 'DRAFT' | 'REGISTRATION' | 'RUNNING' | 'FINISHED';
type RoundStatus = 'DRAFT' | 'ACTIVE' | 'SUBMISSION_CLOSED' | 'EVALUATED';

type AuthMe = {
  id: string;
  role: UserRole;
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

const EMPTY_OP_STATE: RoundOperationState = {
  loading: false,
  notice: '',
  error: '',
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

export default function AdminDashboardPage() {
  const { language, t } = useI18n();

  const [me, setMe] = useState<AuthMe | null>(null);
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [selectedTournamentId, setSelectedTournamentId] = useState('');
  const [rounds, setRounds] = useState<Round[]>([]);

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

  const selectedTournament =
    tournaments.find((entry) => entry.id === selectedTournamentId) ?? null;

  const roleAllowed = me?.role === 'ADMIN' || me?.role === 'ORGANIZER';

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

      <div className="team-grid">
        <article className="card panel-card">
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

        <article className="card panel-card">
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
        <article className="card panel-card">
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

      <article className="card panel-card">
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
