import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useI18n } from '../i18n/I18nProvider';
import { apiRequest } from '../lib/api';
import { formatDateTime } from '../lib/dateTime';

type TournamentStatus = 'DRAFT' | 'REGISTRATION' | 'RUNNING' | 'FINISHED';

type Tournament = {
  id: string;
  title: string;
  status: TournamentStatus;
};

type TeamRow = {
  id: string;
  name: string;
  organization: string | null;
  createdAt: string;
  membersCount: number;
};

export default function TeamsPage() {
  const { language, t } = useI18n();
  const [searchParams, setSearchParams] = useSearchParams();
  const [initialTournamentId] = useState(() => searchParams.get('tournamentId') ?? '');
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [selectedTournamentId, setSelectedTournamentId] = useState('');
  const [teams, setTeams] = useState<TeamRow[]>([]);
  const [loadingTournaments, setLoadingTournaments] = useState(true);
  const [loadingTeams, setLoadingTeams] = useState(false);
  const [error, setError] = useState('');

  const selectedTournament =
    tournaments.find((item) => item.id === selectedTournamentId) ?? null;
  const averageMembers = teams.length
    ? Math.round((teams.reduce((acc, item) => acc + item.membersCount, 0) / teams.length) * 10) / 10
    : 0;

  async function loadTournaments() {
    setLoadingTournaments(true);
    setError('');

    try {
      const data = await apiRequest<Tournament[]>('/tournaments');
      setTournaments(data);

      if (data.length === 0) {
        setSelectedTournamentId('');
        setTeams([]);
        return;
      }

      const running = data.find((item) => item.status === 'RUNNING');
      const registration = data.find((item) => item.status === 'REGISTRATION');
      const defaultId =
        (initialTournamentId && data.some((item) => item.id === initialTournamentId)
          ? initialTournamentId
          : null) ??
        running?.id ??
        registration?.id ??
        data[0].id;
      setSelectedTournamentId((current) => current || defaultId);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : t('teamsPage.loadFailed'));
      setTournaments([]);
      setSelectedTournamentId('');
      setTeams([]);
    } finally {
      setLoadingTournaments(false);
    }
  }

  async function loadTeams(tournamentId: string) {
    setLoadingTeams(true);
    setError('');

    try {
      const data = await apiRequest<TeamRow[]>(`/tournaments/${tournamentId}/teams`);
      setTeams(data);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : t('teamsPage.loadFailed'));
      setTeams([]);
    } finally {
      setLoadingTeams(false);
    }
  }

  useEffect(() => {
    void loadTournaments();
  }, []);

  useEffect(() => {
    if (!selectedTournamentId) {
      setTeams([]);
      return;
    }

    setSearchParams(
      (current) => {
        current.set('tournamentId', selectedTournamentId);
        return current;
      },
      { replace: true },
    );
    void loadTeams(selectedTournamentId);
  }, [selectedTournamentId, setSearchParams]);

  const hasData = useMemo(
    () => !loadingTournaments && tournaments.length > 0,
    [loadingTournaments, tournaments.length],
  );

  if (loadingTournaments) {
    return <article className="card state-card">{t('teamsPage.loading')}</article>;
  }

  if (error && tournaments.length === 0) {
    return (
      <article className="card state-card">
        <p className="form-error">{error}</p>
        <button type="button" className="button button-soft" onClick={loadTournaments}>
          {t('teamsPage.retry')}
        </button>
      </article>
    );
  }

  if (!hasData) {
    return <article className="card state-card">{t('teamsPage.emptyTournaments')}</article>;
  }

  return (
    <section className="team-dashboard">
      <header className="section-header">
        <p className="eyebrow">{t('teamsPage.eyebrow')}</p>
        <h1>{t('teamsPage.title')}</h1>
        <p className="lead">{t('teamsPage.lead')}</p>
      </header>

      <article className="card panel-card teams-workspace-card">
        <div className="teams-workspace-head">
          <div className="teams-workspace-copy">
            <p className="eyebrow dashboard-workspace-eyebrow">{t('teamsPage.workspaceEyebrow')}</p>
            <h2>{t('teamsPage.workspaceTitle')}</h2>
            <p>{t('teamsPage.workspaceLead')}</p>
          </div>
          <div className="dashboard-workspace-status teams-workspace-status">
            <span>{t('teamsPage.workspaceStatusLabel')}</span>
            <strong>{teams.length}</strong>
            <p>{t('teamsPage.workspaceStatusLead')}</p>
          </div>
        </div>

        <div className="dashboard-toolset-grid teams-toolset-grid">
          <article className="dashboard-tool-card">
            <span>{t('teamsPage.summary.teams')}</span>
            <strong>{t('teamsPage.workspaceCards.directoryTitle')}</strong>
            <p>{t('teamsPage.workspaceCards.directoryLead')}</p>
            <em>{teams.length} {t('teamsPage.workspaceCards.directorySuffix')}</em>
          </article>
          <article className="dashboard-tool-card">
            <span>{t('teamsPage.summary.averageMembers')}</span>
            <strong>{t('teamsPage.workspaceCards.densityTitle')}</strong>
            <p>{t('teamsPage.workspaceCards.densityLead')}</p>
            <em>{averageMembers} {t('teamsPage.workspaceCards.densitySuffix')}</em>
          </article>
          <Link to={`/app/tournaments/${selectedTournamentId}`} className="dashboard-tool-card">
            <span>{t('shell.tournamentsNav')}</span>
            <strong>{t('teamsPage.workspaceCards.tournamentTitle')}</strong>
            <p>{t('teamsPage.workspaceCards.tournamentLead')}</p>
            <em>{selectedTournament?.title ?? '-'}</em>
          </Link>
          <Link to={`/app/leaderboard?tournamentId=${selectedTournamentId}`} className="dashboard-tool-card">
            <span>{t('shell.leaderboard')}</span>
            <strong>{t('teamsPage.workspaceCards.resultsTitle')}</strong>
            <p>{t('teamsPage.workspaceCards.resultsLead')}</p>
            <em>{t(`tournaments.status.${selectedTournament?.status ?? 'DRAFT'}`)}</em>
          </Link>
        </div>
      </article>

      <article className="card panel-card">
        <label className="field" htmlFor="teams-page-tournament-select">
          <span>{t('teamsPage.tournamentLabel')}</span>
          <select
            id="teams-page-tournament-select"
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
          <span>{t('teamsPage.tournamentStatus')}</span>
          <strong>{selectedTournament ? t(`tournaments.status.${selectedTournament.status}`) : '-'}</strong>
        </div>

        <div className="summary-grid compact-summary-grid">
          <div className="summary-card">
            <span>{t('teamsPage.summary.teams')}</span>
            <strong>{teams.length}</strong>
            <p>{selectedTournament?.title ?? '-'}</p>
          </div>
          <div className="summary-card">
            <span>{t('teamsPage.summary.averageMembers')}</span>
            <strong>{averageMembers}</strong>
            <p>{t('teamsPage.summary.membersHint')}</p>
          </div>
        </div>
      </article>

      <article className="card panel-card">
        <h2>{t('teamsPage.resultsTitle')}</h2>

        {loadingTeams ? (
          <div className="state-callout featured">
            <strong>{t('teamsPage.resultsTitle')}</strong>
            <p>{t('teamsPage.loadingTeams')}</p>
          </div>
        ) : null}
        {error ? <p className="form-error">{error}</p> : null}
        {!loadingTeams && teams.length === 0 ? (
          <div className="state-callout subtle">
            <strong>{t('teamsPage.resultsTitle')}</strong>
            <p>{t('teamsPage.emptyTeams')}</p>
          </div>
        ) : null}

        {teams.length > 0 ? (
          <div className="team-grid">
            {teams.map((team) => (
              <article key={team.id} className="team-list-card">
                <div className="tournament-head">
                  <h3>{team.name}</h3>
                  <span className="status-pill">{t('teamsPage.membersCount')}: {team.membersCount}</span>
                </div>
                <p className="inline-hint">{team.organization || t('teamsPage.noOrganization')}</p>
                <div className="leaderboard-metrics team-list-metrics">
                  <div className="leaderboard-metric">
                    <span>{t('teamsPage.membersCount')}</span>
                    <strong>{team.membersCount}</strong>
                  </div>
                  <div className="leaderboard-metric">
                    <span>{t('teamsPage.createdAt')}</span>
                    <strong>{formatDateTime(team.createdAt, language)}</strong>
                  </div>
                </div>
              </article>
            ))}
          </div>
        ) : null}
      </article>
    </section>
  );
}
