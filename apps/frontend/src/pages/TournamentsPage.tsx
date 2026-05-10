import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import QuietLoadingInline from '../components/QuietLoadingInline';
import QuietLoadingCard from '../components/QuietLoadingCard';
import { isAuthenticated } from '../lib/auth';
import { ApiError, apiRequest } from '../lib/api';
import { formatDateTime } from '../lib/dateTime';
import { normalizeApiErrorMessage } from '../lib/errorMessages';
import { useI18n } from '../i18n/I18nProvider';

type TournamentStatus = 'DRAFT' | 'REGISTRATION' | 'RUNNING' | 'FINISHED';
type UserRole = 'ADMIN' | 'TEAM' | 'JURY' | 'ORGANIZER';

type Tournament = {
  id: string;
  title: string;
  status: TournamentStatus;
  startsAt: string | null;
  registrationOpenAt: string;
  registrationCloseAt: string;
  canTeamRegister: boolean;
};

type AuthMe = {
  id: string;
  role: UserRole;
};

type TeamProfile = {
  id: string;
  name: string;
};

type ActiveRound = {
  id: string;
  title: string;
  deadlineAt: string;
};

type TeamSubmission = {
  id: string;
  status: 'DRAFT' | 'SUBMITTED' | 'LOCKED';
};

type QuickTeamBlock = {
  tournament: Tournament;
  team: TeamProfile;
  activeRound: ActiveRound | null;
  submission: TeamSubmission | null;
};

type FilterType = 'all' | 'registrationOpen' | 'running' | 'finished';
type ViewMode = 'list' | 'grid';

const TOURNAMENT_PRIORITY: Record<TournamentStatus, number> = {
  RUNNING: 1,
  REGISTRATION: 2,
  DRAFT: 3,
  FINISHED: 4,
};

const TOURNAMENT_STATUS_CARD_CLASS: Record<TournamentStatus, string> = {
  DRAFT: 'is-draft',
  REGISTRATION: 'is-registration',
  RUNNING: 'is-running',
  FINISHED: 'is-finished',
};

export default function TournamentsPage() {
  const { language, t } = useI18n();
  const [items, setItems] = useState<Tournament[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState<FilterType>('all');
  const [viewMode, setViewMode] = useState<ViewMode>('list');

  const [quickRole, setQuickRole] = useState<UserRole | null>(null);
  const [quickLoading, setQuickLoading] = useState(false);
  const [quickError, setQuickError] = useState('');
  const [quickData, setQuickData] = useState<QuickTeamBlock | null>(null);
  const [showFinished, setShowFinished] = useState(false);
  const tournamentsListRef = useRef<HTMLDivElement | null>(null);

  function applyFilterAndScroll(nextFilter: FilterType) {
    setFilter(nextFilter);
    window.requestAnimationFrame(() => {
      tournamentsListRef.current?.scrollIntoView({
        behavior: 'smooth',
        block: 'start',
      });
    });
  }

  async function loadQuickTeamBlock(tournaments: Tournament[]) {
    if (!isAuthenticated()) {
      setQuickRole(null);
      setQuickLoading(false);
      setQuickError('');
      setQuickData(null);
      return;
    }

    setQuickLoading(true);
    setQuickError('');

    try {
      const me = await apiRequest<AuthMe>('/auth/me');
      setQuickRole(me.role);

      if (me.role !== 'TEAM') {
        setQuickData(null);
        return;
      }

      if (tournaments.length === 0) {
        setQuickData(null);
        return;
      }

      const prioritized = [...tournaments].sort(
        (left, right) => TOURNAMENT_PRIORITY[left.status] - TOURNAMENT_PRIORITY[right.status],
      );

      let selected: { tournament: Tournament; team: TeamProfile } | null = null;
      for (const tournament of prioritized) {
        try {
          const team = await apiRequest<TeamProfile>(`/tournaments/${tournament.id}/teams/me`);
          selected = { tournament, team };
          break;
        } catch (requestError) {
          if (requestError instanceof ApiError && requestError.status === 404) {
            continue;
          }

          throw requestError;
        }
      }

      if (!selected) {
        setQuickData(null);
        return;
      }

      const activeRound = await apiRequest<ActiveRound | null>(
        `/tournaments/${selected.tournament.id}/rounds/active`,
      );

      let submission: TeamSubmission | null = null;
      if (activeRound) {
        try {
          submission = await apiRequest<TeamSubmission>(`/rounds/${activeRound.id}/submissions/me`);
        } catch (requestError) {
          if (!(requestError instanceof ApiError && requestError.status === 404)) {
            throw requestError;
          }
        }
      }

      setQuickData({
        tournament: selected.tournament,
        team: selected.team,
        activeRound,
        submission,
      });
    } catch (requestError) {
      setQuickData(null);
      setQuickError(
        normalizeApiErrorMessage(requestError, t, t('tournaments.quickBlock.loadFailed')),
      );
    } finally {
      setQuickLoading(false);
    }
  }

  async function loadTournaments() {
    setLoading(true);
    setError('');

    try {
      const data = await apiRequest<Tournament[]>('/tournaments');
      setItems(data);
      void loadQuickTeamBlock(data);
    } catch (requestError) {
      setError(
        normalizeApiErrorMessage(requestError, t, t('tournaments.requestFailed')),
      );
      setQuickRole(null);
      setQuickData(null);
      setQuickError('');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadTournaments();
  }, []);

  useEffect(() => {
    if (filter === 'finished') {
      setShowFinished(true);
    }
  }, [filter]);

  const filteredItems = useMemo(() => {
    if (filter === 'registrationOpen') {
      return items.filter((item) => item.status === 'REGISTRATION');
    }

    if (filter === 'running') {
      return items.filter((item) => item.status === 'RUNNING');
    }

    if (filter === 'finished') {
      return items.filter((item) => item.status === 'FINISHED');
    }

    return items;
  }, [filter, items]);

  const activeItems = useMemo(
    () => filteredItems.filter((item) => item.status === 'RUNNING'),
    [filteredItems],
  );
  const allActiveItems = useMemo(
    () => items.filter((item) => item.status === 'RUNNING'),
    [items],
  );
  const registrationOpenItems = useMemo(
    () => items.filter((item) => item.status === 'REGISTRATION'),
    [items],
  );
  const upcomingItems = useMemo(
    () =>
      filteredItems.filter(
        (item) => item.status === 'DRAFT' || item.status === 'REGISTRATION',
      ),
    [filteredItems],
  );
  const allUpcomingItems = useMemo(
    () => items.filter((item) => item.status === 'DRAFT' || item.status === 'REGISTRATION'),
    [items],
  );
  const finishedItems = useMemo(
    () => filteredItems.filter((item) => item.status === 'FINISHED'),
    [filteredItems],
  );
  const allFinishedItems = useMemo(
    () => items.filter((item) => item.status === 'FINISHED'),
    [items],
  );

  if (loading) {
    return <QuietLoadingCard label={t('tournaments.loading')} />;
  }

  if (error) {
    return (
      <div className="card state-card">
        <p className="form-error">{error}</p>
        <button type="button" className="button button-soft" onClick={loadTournaments}>
          {t('tournaments.retry')}
        </button>
      </div>
    );
  }

  if (items.length === 0) {
    return <div className="card state-card">{t('tournaments.empty')}</div>;
  }

  const filterButtons: FilterType[] = [
    'all',
    'registrationOpen',
    'running',
    'finished',
  ];

  const sections = [
    { key: 'active', label: t('tournaments.sections.active'), items: activeItems },
    { key: 'upcoming', label: t('tournaments.sections.upcoming'), items: upcomingItems },
    { key: 'finished', label: t('tournaments.sections.finished'), items: finishedItems },
  ] as const;

  return (
    <section className="tournaments-section">
      <header className="section-header">
        <p className="eyebrow">{t('tournaments.eyebrow')}</p>
        <h1>{t('tournaments.title')}</h1>
        <p className="lead">{t('tournaments.lead')}</p>
      </header>

      <article className="card panel-card tournaments-workspace-card">
        <div className="tournaments-workspace-head">
          <div className="tournaments-workspace-copy">
            <p className="eyebrow dashboard-workspace-eyebrow">{t('tournaments.workspaceEyebrow')}</p>
            <h2>{t('tournaments.workspaceTitle')}</h2>
            <p>{t('tournaments.workspaceLead')}</p>
          </div>
          <div className="dashboard-workspace-status tournaments-workspace-status">
            <span>{t('tournaments.workspaceStatusLabel')}</span>
            <strong>{filteredItems.length}</strong>
            <p>{t('tournaments.workspaceStatusLead')}</p>
          </div>
        </div>

        <div className="dashboard-toolset-grid tournaments-toolset-grid">
          <button
            type="button"
            className="dashboard-tool-card dashboard-tool-card--teal dashboard-tool-button"
            onClick={() => applyFilterAndScroll('registrationOpen')}
          >
            <span>{t('tournaments.filters.registrationOpen')}</span>
            <strong>{t('tournaments.workspaceCards.registrationTitle')}</strong>
            <p>{t('tournaments.workspaceCards.registrationLead')}</p>
            <em>{registrationOpenItems.length} {t('tournaments.workspaceCards.registrationSuffix')}</em>
          </button>
          <button
            type="button"
            className="dashboard-tool-card dashboard-tool-card--purple dashboard-tool-button"
            onClick={() => applyFilterAndScroll('all')}
          >
            <span>{t('tournaments.filters.all')}</span>
            <strong>{t('tournaments.workspaceCards.allTitle')}</strong>
            <p>{t('tournaments.workspaceCards.allLead')}</p>
            <em>{items.length} {t('tournaments.workspaceCards.allSuffix')}</em>
          </button>
          <button
            type="button"
            className="dashboard-tool-card dashboard-tool-card--orange dashboard-tool-button"
            onClick={() => applyFilterAndScroll('finished')}
          >
            <span>{t('tournaments.filters.finished')}</span>
            <strong>{t('tournaments.workspaceCards.archiveTitle')}</strong>
            <p>{t('tournaments.workspaceCards.archiveLead')}</p>
            <em>{allFinishedItems.length} {t('tournaments.workspaceCards.archiveSuffix')}</em>
          </button>
          <Link to="/app/teams" className="dashboard-tool-card dashboard-tool-card--berry">
            <span>{t('shell.teams')}</span>
            <strong>{t('tournaments.workspaceCards.directoryTitle')}</strong>
            <p>{t('tournaments.workspaceCards.directoryLead')}</p>
            <em>{t('tournaments.workspaceCards.directoryHint')}</em>
          </Link>
        </div>
      </article>

      <article className="card panel-card">
        <h2>{t('tournaments.summaryTitle')}</h2>
        <div className="summary-grid">
          <div className="summary-card">
            <span>{t('tournaments.totalLabel')}</span>
            <strong>{items.length}</strong>
            <p>{t('tournaments.sections.active')}: {allActiveItems.length}</p>
          </div>
          <div className="summary-card">
            <span>{t('tournaments.filters.registrationOpen')}</span>
            <strong>{registrationOpenItems.length}</strong>
            <p>{t('tournaments.sections.upcoming')}: {allUpcomingItems.length}</p>
          </div>
          <div className="summary-card">
            <span>{t('tournaments.filters.running')}</span>
            <strong>{allActiveItems.length}</strong>
            <p>{t('tournaments.filters.finished')}: {allFinishedItems.length}</p>
          </div>
        </div>
      </article>

      {quickLoading || quickError || quickRole === 'TEAM' ? (
        <article className="card panel-card quick-team-card">
          <h2>{t('tournaments.quickBlock.title')}</h2>
          <p className="inline-hint">{t('tournaments.quickBlock.lead')}</p>

          {quickLoading ? <QuietLoadingInline label={t('tournaments.quickBlock.loading')} /> : null}

          {quickError ? (
            <>
              <p className="form-error">{quickError}</p>
              <button
                type="button"
                className="button tournaments-card-action tournaments-card-action--secondary"
                onClick={() => void loadQuickTeamBlock(items)}
              >
                {t('tournaments.retry')}
              </button>
            </>
          ) : null}

          {!quickLoading && !quickError && quickRole === 'TEAM' && !quickData ? (
            <div className="state-callout subtle">
              <strong>{t('tournaments.quickBlock.nextStepTitle')}</strong>
              <p>{t('tournaments.quickBlock.noTournament')}</p>
            </div>
          ) : null}

          {!quickLoading && !quickError && quickData ? (
            <>
              <div className="state-callout subtle">
                <strong>{t('tournaments.quickBlock.nextStepTitle')}</strong>
                <p>
                  {quickData.activeRound
                    ? quickData.submission
                      ? t('tournaments.quickBlock.nextStep.updateSubmission')
                      : t('tournaments.quickBlock.nextStep.submitWork')
                    : t('tournaments.quickBlock.nextStep.waitForRound')}
                </p>
              </div>

              <div className="quick-team-grid">
                <div className="quick-team-item">
                  <span>{t('tournaments.quickBlock.tournament')}</span>
                  <strong>{quickData.tournament.title}</strong>
                </div>
                <div className="quick-team-item">
                  <span>{t('tournaments.quickBlock.status')}</span>
                  <strong>{t(`tournaments.status.${quickData.tournament.status}`)}</strong>
                </div>
                <div className="quick-team-item">
                  <span>{t('tournaments.quickBlock.teamName')}</span>
                  <strong>{quickData.team.name}</strong>
                </div>
                <div className="quick-team-item">
                  <span>{t('tournaments.quickBlock.activeRound')}</span>
                  <strong>
                    {quickData.activeRound
                      ? quickData.activeRound.title
                      : t('tournaments.quickBlock.noActiveRound')}
                  </strong>
                </div>
                <div className="quick-team-item">
                  <span>{t('tournaments.quickBlock.deadline')}</span>
                  <strong>
                    {quickData.activeRound
                      ? formatDateTime(quickData.activeRound.deadlineAt, language)
                      : '-'}
                  </strong>
                </div>
                <div className="quick-team-item">
                  <span>{t('tournaments.quickBlock.submissionStatus')}</span>
                  <strong>
                    {quickData.submission
                      ? t(`tournaments.quickBlock.submission.${quickData.submission.status}`)
                      : t('tournaments.quickBlock.missingSubmission')}
                  </strong>
                </div>
              </div>

              <div className="status-actions">
                <Link to="/app/team" className="button tournaments-card-action tournaments-card-action--purple">
                  {t('tournaments.quickBlock.goToTeam')}
                </Link>
                <Link
                  to={`/app/leaderboard?tournamentId=${quickData.tournament.id}`}
                  className="button tournaments-card-action tournaments-card-action--secondary"
                >
                  {t('tournaments.quickBlock.goToLeaderboard')}
                </Link>
              </div>
            </>
          ) : null}
        </article>
      ) : null}

      <div ref={tournamentsListRef} className="tournaments-list-toolbar">
        <div
          className="filters-row"
          role="group"
          aria-label="Tournament filters"
        >
          {filterButtons.map((item) => (
            <button
              key={item}
              type="button"
              className={`filter-button${filter === item ? ' active' : ''}`}
              onClick={() => setFilter(item)}
            >
              {t(`tournaments.filters.${item}`)}
            </button>
          ))}
        </div>

        <div
          className="tournaments-view-switch"
          role="group"
          aria-label={t('tournaments.viewMode.label')}
        >
          <button
            type="button"
            className={`tournaments-view-button${viewMode === 'list' ? ' active' : ''}`}
            aria-pressed={viewMode === 'list'}
            title={t('tournaments.viewMode.list')}
            onClick={() => setViewMode('list')}
          >
            <span aria-hidden>
              <svg viewBox="0 0 20 20" focusable="false">
                <path d="M4 5.5h12M4 10h12M4 14.5h12" />
              </svg>
            </span>
            {t('tournaments.viewMode.list')}
          </button>
          <button
            type="button"
            className={`tournaments-view-button${viewMode === 'grid' ? ' active' : ''}`}
            aria-pressed={viewMode === 'grid'}
            title={t('tournaments.viewMode.grid')}
            onClick={() => setViewMode('grid')}
          >
            <span aria-hidden>
              <svg viewBox="0 0 20 20" focusable="false">
                <path d="M4.5 4.5h4v4h-4zM11.5 4.5h4v4h-4zM4.5 11.5h4v4h-4zM11.5 11.5h4v4h-4z" />
              </svg>
            </span>
            {t('tournaments.viewMode.grid')}
          </button>
        </div>
      </div>

      <p className="total-label">
        {t('tournaments.totalLabel')}: {filteredItems.length}
      </p>

      {filteredItems.length === 0 ? (
        <article className="card panel-card">
          <div className="state-callout featured">
            <strong>{t('tournaments.summaryTitle')}</strong>
            <p>{t('tournaments.emptyFiltered')}</p>
          </div>
        </article>
      ) : (
        <div className="sections-stack">
          {sections.map((section) => {
            if (section.items.length === 0) {
              return null;
            }

            if (section.key === 'finished' && !showFinished) {
              return (
                <section key={section.key} className="section-card tournaments-collapsed-section">
                  <div className="tournaments-collapse-row">
                    <button
                      type="button"
                      className="button tournaments-card-action tournaments-card-action--secondary tournaments-collapse-toggle"
                      onClick={() => setShowFinished(true)}
                      aria-expanded="false"
                    >
                      {t('tournaments.showFinished')}
                    </button>
                  </div>
                </section>
              );
            }

            return (
              <section
                key={section.key}
                className={`section-card${section.key === 'finished' ? ' tournaments-finished-section' : ''}`}
              >
                {section.key !== 'finished' ? <h2>{section.label}</h2> : null}
                {section.key === 'finished' ? (
                  <div className="tournaments-collapse-row tournaments-collapse-row--after">
                    <button
                      type="button"
                      className="button tournaments-card-action tournaments-card-action--secondary tournaments-collapse-toggle"
                      onClick={() => setShowFinished(false)}
                      aria-expanded="true"
                    >
                      {t('tournaments.hideFinished')}
                    </button>
                  </div>
                ) : null}
                <div className={`tournaments-grid tournaments-grid--${viewMode}`}>
                  {section.items.map((tournament) => (
                    <article
                      key={tournament.id}
                      className={`card tournament-card ${TOURNAMENT_STATUS_CARD_CLASS[tournament.status]}`}
                    >
                      <div className="tournament-head">
                        <h3>{tournament.title}</h3>
                        <span className="status-pill">
                          {t(`tournaments.status.${tournament.status}`)}
                        </span>
                      </div>

                      <dl className="meta-grid">
                        <div>
                          <dt>{t('tournaments.registrationOpens')}</dt>
                          <dd>{formatDateTime(tournament.registrationOpenAt, language)}</dd>
                        </div>
                        <div>
                          <dt>{t('tournaments.registrationCloses')}</dt>
                          <dd>{formatDateTime(tournament.registrationCloseAt, language)}</dd>
                        </div>
                        {tournament.startsAt ? (
                          <div>
                            <dt>{t('tournaments.startsAt')}</dt>
                            <dd>{formatDateTime(tournament.startsAt, language)}</dd>
                          </div>
                        ) : null}
                      </dl>

                      <p className="register-flag">
                        {t('tournaments.registrationState')}:{' '}
                        {tournament.canTeamRegister
                          ? t('tournaments.available')
                          : t('tournaments.closed')}
                      </p>

                      <div className="status-actions">
                        <Link
                          to={`/app/tournaments/${tournament.id}`}
                          className="button tournaments-card-action tournaments-card-action--purple"
                        >
                          {t('tournaments.details')}
                        </Link>
                        {tournament.status === 'FINISHED' ? (
                          <Link
                            to={`/app/archive?tournamentId=${tournament.id}`}
                            className="button button-soft"
                          >
                            {t('tournaments.archive')}
                          </Link>
                        ) : null}
                        <Link
                          to={`/app/leaderboard?tournamentId=${tournament.id}`}
                          className="button tournaments-card-action tournaments-card-action--secondary"
                        >
                          {t('tournaments.leaderboard')}
                        </Link>
                      </div>
                    </article>
                  ))}
                </div>
              </section>
            );
          })}
        </div>
      )}
    </section>
  );
}
