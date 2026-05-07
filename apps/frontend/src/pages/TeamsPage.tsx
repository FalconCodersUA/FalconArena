import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import QuietLoadingCard from '../components/QuietLoadingCard';
import QuietLoadingInline from '../components/QuietLoadingInline';
import { useI18n } from '../i18n/I18nProvider';
import { apiRequest } from '../lib/api';
import { formatDateTime } from '../lib/dateTime';
import { normalizeApiErrorMessage } from '../lib/errorMessages';
import {
  rememberTournamentSelection,
  resolveStoredTournamentSelection,
} from '../lib/tournamentSelection';

const ALL_TOURNAMENTS_VALUE = 'all';

type TournamentStatus = 'DRAFT' | 'REGISTRATION' | 'RUNNING' | 'FINISHED';

type Tournament = {
  id: string;
  title: string;
  status: TournamentStatus;
};

type TeamRow = {
  id: string;
  tournamentId?: string;
  tournamentTitle?: string;
  tournamentStatus?: TournamentStatus;
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
  const isAllTournaments = selectedTournamentId === ALL_TOURNAMENTS_VALUE;
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
        initialTournamentId === ALL_TOURNAMENTS_VALUE
          ? ALL_TOURNAMENTS_VALUE
          : (initialTournamentId && data.some((item) => item.id === initialTournamentId)
          ? initialTournamentId
          : null) ??
        resolveStoredTournamentSelection(
          data,
          running?.id ?? registration?.id ?? data[0].id,
        );
      setSelectedTournamentId((current) => current || defaultId);
    } catch (requestError) {
      setError(normalizeApiErrorMessage(requestError, t, t('teamsPage.loadFailed')));
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
      const endpoint =
        tournamentId === ALL_TOURNAMENTS_VALUE ? '/teams' : `/tournaments/${tournamentId}/teams`;
      const data = await apiRequest<TeamRow[]>(endpoint);
      setTeams(data);
    } catch (requestError) {
      setError(normalizeApiErrorMessage(requestError, t, t('teamsPage.loadFailed')));
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
    if (selectedTournamentId !== ALL_TOURNAMENTS_VALUE) {
      rememberTournamentSelection(selectedTournamentId);
    }
    void loadTeams(selectedTournamentId);
  }, [selectedTournamentId, setSearchParams]);

  const hasData = useMemo(
    () => !loadingTournaments && tournaments.length > 0,
    [loadingTournaments, tournaments.length],
  );

  if (loadingTournaments) {
    return <QuietLoadingCard label={t('teamsPage.loading')} />;
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
            <p>
              {isAllTournaments
                ? t('teamsPage.workspaceStatusLeadAll')
                : t('teamsPage.workspaceStatusLead')}
            </p>
          </div>
        </div>

        <div className="dashboard-toolset-grid teams-toolset-grid">
          <article className="dashboard-tool-card dashboard-tool-card--teal">
            <span>{t('teamsPage.summary.teams')}</span>
            <strong>{t('teamsPage.workspaceCards.directoryTitle')}</strong>
            <p>
              {isAllTournaments
                ? t('teamsPage.workspaceCards.directoryLeadAll')
                : t('teamsPage.workspaceCards.directoryLead')}
            </p>
            <em>{teams.length} {t('teamsPage.workspaceCards.directorySuffix')}</em>
          </article>
          <article className="dashboard-tool-card dashboard-tool-card--purple">
            <span>{t('teamsPage.summary.averageMembers')}</span>
            <strong>{t('teamsPage.workspaceCards.densityTitle')}</strong>
            <p>{t('teamsPage.workspaceCards.densityLead')}</p>
            <em>{averageMembers} {t('teamsPage.workspaceCards.densitySuffix')}</em>
          </article>
          <Link
            to={isAllTournaments ? '/app/tournaments' : `/app/tournaments/${selectedTournamentId}`}
            className="dashboard-tool-card dashboard-tool-card--orange"
          >
            <span>{t('shell.tournamentsNav')}</span>
            <strong>{t('teamsPage.workspaceCards.tournamentTitle')}</strong>
            <p>
              {isAllTournaments
                ? t('teamsPage.workspaceCards.tournamentLeadAll')
                : t('teamsPage.workspaceCards.tournamentLead')}
            </p>
            <em>{isAllTournaments ? t('teamsPage.allTournaments') : selectedTournament?.title ?? '-'}</em>
          </Link>
          <Link
            to={isAllTournaments ? '/app/leaderboard' : `/app/leaderboard?tournamentId=${selectedTournamentId}`}
            className="dashboard-tool-card dashboard-tool-card--berry"
          >
            <span>{t('shell.leaderboard')}</span>
            <strong>{t('teamsPage.workspaceCards.resultsTitle')}</strong>
            <p>
              {isAllTournaments
                ? t('teamsPage.workspaceCards.resultsLeadAll')
                : t('teamsPage.workspaceCards.resultsLead')}
            </p>
            <em>
              {isAllTournaments
                ? t('teamsPage.allTournamentsStatus')
                : t(`tournaments.status.${selectedTournament?.status ?? 'DRAFT'}`)}
            </em>
          </Link>
        </div>
      </article>

      <article className="card panel-card">
        <label className="field admin-tournament-picker" htmlFor="teams-page-tournament-select">
          <span>{t('teamsPage.tournamentLabel')}</span>
          <select
            id="teams-page-tournament-select"
            className="select-input admin-tournament-picker-select"
            value={selectedTournamentId}
            onChange={(event) => setSelectedTournamentId(event.target.value)}
          >
            <option value={ALL_TOURNAMENTS_VALUE}>{t('teamsPage.allTournamentsOption')}</option>
            {tournaments.map((tournament) => (
              <option key={tournament.id} value={tournament.id}>
                {tournament.title}
              </option>
            ))}
          </select>
        </label>

        <div className="status-row">
          <span>{t('teamsPage.tournamentStatus')}</span>
          <strong>
            {isAllTournaments
              ? t('teamsPage.allTournamentsStatus')
              : selectedTournament
                ? t(`tournaments.status.${selectedTournament.status}`)
                : '-'}
          </strong>
        </div>

        <div className="summary-grid compact-summary-grid">
          <div className="summary-card">
            <span>{t('teamsPage.summary.teams')}</span>
            <strong>{teams.length}</strong>
            <p>{isAllTournaments ? t('teamsPage.allTournaments') : selectedTournament?.title ?? '-'}</p>
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

        {loadingTeams ? <QuietLoadingInline label={t('teamsPage.loadingTeams')} /> : null}
        {error ? <p className="form-error">{error}</p> : null}
        {!loadingTeams && teams.length === 0 ? (
          <div className="state-callout subtle">
            <strong>{t('teamsPage.resultsTitle')}</strong>
            <p>{isAllTournaments ? t('teamsPage.emptyTeamsAll') : t('teamsPage.emptyTeams')}</p>
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
                {isAllTournaments ? (
                  <p className="inline-hint">
                    {t('teamsPage.teamTournament')}:{' '}
                    {team.tournamentTitle ?? t('teamsPage.allTournaments')}{' '}
                    {team.tournamentStatus ? `· ${t(`tournaments.status.${team.tournamentStatus}`)}` : ''}
                  </p>
                ) : null}
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
