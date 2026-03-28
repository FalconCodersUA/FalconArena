import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { apiRequest } from '../lib/api';
import { formatDateTime } from '../lib/dateTime';
import { getAuthRole, isAuthenticated } from '../lib/auth';
import { useI18n } from '../i18n/I18nProvider';

type TournamentStatus = 'DRAFT' | 'REGISTRATION' | 'RUNNING' | 'FINISHED';
type RoundStatus = 'DRAFT' | 'ACTIVE' | 'SUBMISSION_CLOSED' | 'EVALUATED';
type UserRole = 'ADMIN' | 'TEAM' | 'JURY' | 'ORGANIZER';

type Tournament = {
  id: string;
  title: string;
  description: string | null;
  status: TournamentStatus;
  startsAt: string | null;
  registrationOpenAt: string;
  registrationCloseAt: string;
  maxTeams: number | null;
  canTeamRegister: boolean;
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

type TeamRow = {
  id: string;
  name: string;
  organization: string | null;
  createdAt: string;
  membersCount: number;
};

function canShowTeamsList(tournament: Tournament) {
  if (tournament.status === 'RUNNING' || tournament.status === 'FINISHED') {
    return true;
  }

  return Date.now() > new Date(tournament.registrationCloseAt).getTime();
}

export default function TournamentDetailsPage() {
  const { language, t } = useI18n();
  const { tournamentId = '' } = useParams();
  const [tournament, setTournament] = useState<Tournament | null>(null);
  const [rounds, setRounds] = useState<Round[]>([]);
  const [teams, setTeams] = useState<TeamRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!tournamentId) {
      setError(t('tournamentDetails.notFound'));
      setLoading(false);
      return;
    }

    async function loadDetails() {
      setLoading(true);
      setError('');

      try {
        const tournamentData = await apiRequest<Tournament>(`/tournaments/${tournamentId}`);
        const roundsData = await apiRequest<Round[]>(`/tournaments/${tournamentId}/rounds`);
        setTournament(tournamentData);
        setRounds(roundsData);

        if (canShowTeamsList(tournamentData)) {
          const teamsData = await apiRequest<TeamRow[]>(`/tournaments/${tournamentId}/teams`);
          setTeams(teamsData);
        } else {
          setTeams([]);
        }
      } catch (requestError) {
        setError(
          requestError instanceof Error ? requestError.message : t('tournamentDetails.loadFailed'),
        );
        setTournament(null);
        setRounds([]);
        setTeams([]);
      } finally {
        setLoading(false);
      }
    }

    void loadDetails();
  }, [tournamentId, t]);

  const activeRound = useMemo(
    () => rounds.find((round) => round.status === 'ACTIVE') ?? null,
    [rounds],
  );

  const authRole = (isAuthenticated() ? getAuthRole() : null) as UserRole | null;
  const registrationAction = useMemo(() => {
    if (!tournament) {
      return null;
    }

    if (!tournament.canTeamRegister) {
      return null;
    }

    if (authRole === 'TEAM') {
      return {
        to: '/app/team',
        label: t('tournamentDetails.openTeamWorkspace'),
      };
    }

    if (authRole) {
      return null;
    }

    return {
      to: '/app/register',
      label: t('tournamentDetails.registerTeam'),
    };
  }, [authRole, t, tournament]);

  if (loading) {
    return <article className="card state-card">{t('tournamentDetails.loading')}</article>;
  }

  if (error || !tournament) {
    return (
      <article className="card state-card">
        <p className="form-error">{error || t('tournamentDetails.notFound')}</p>
        <Link to="/app/tournaments" className="button button-soft">
          {t('tournamentDetails.backToTournaments')}
        </Link>
      </article>
    );
  }

  const showTeams = canShowTeamsList(tournament);

  return (
    <section className="tournaments-section">
      <header className="section-header">
        <p className="eyebrow">{t('tournamentDetails.eyebrow')}</p>
        <h1>{tournament.title}</h1>
        <p className="lead">{tournament.description || t('tournamentDetails.noDescription')}</p>
      </header>

      <article className="card panel-card">
        <div className="tournament-head">
          <h2>{t('tournamentDetails.overviewTitle')}</h2>
          <span className="status-pill">{t(`tournaments.status.${tournament.status}`)}</span>
        </div>

        <div className="summary-grid">
          <div className="summary-card">
            <span>{t('tournamentDetails.startsAt')}</span>
            <strong>
              {tournament.startsAt
                ? formatDateTime(tournament.startsAt, language)
                : t('tournamentDetails.notScheduled')}
            </strong>
            <p>{t('tournamentDetails.startHint')}</p>
          </div>
          <div className="summary-card">
            <span>{t('tournamentDetails.registrationWindow')}</span>
            <strong>{formatDateTime(tournament.registrationOpenAt, language)}</strong>
            <p>{formatDateTime(tournament.registrationCloseAt, language)}</p>
          </div>
          <div className="summary-card">
            <span>{t('tournamentDetails.teamsTitle')}</span>
            <strong>{showTeams ? teams.length : t('tournamentDetails.hiddenUntilClose')}</strong>
            <p>
              {tournament.maxTeams
                ? `${t('tournamentDetails.teamLimit')}: ${tournament.maxTeams}`
                : t('tournamentDetails.teamLimitOpen')}
            </p>
          </div>
        </div>

        <div className="status-actions">
          {registrationAction ? (
            <Link to={registrationAction.to} className="button button-primary">
              {registrationAction.label}
            </Link>
          ) : null}
          <Link to={`/app/leaderboard?tournamentId=${tournament.id}`} className="button button-soft">
            {t('tournaments.leaderboard')}
          </Link>
          <Link to="/app/tournaments" className="button button-ghost">
            {t('tournamentDetails.backToTournaments')}
          </Link>
        </div>
      </article>

      {activeRound ? (
        <article className="card panel-card">
          <h2>{t('tournamentDetails.activeRoundTitle')}</h2>
          <div className="state-callout subtle">
            <strong>
              #{activeRound.sequence} {activeRound.title}
            </strong>
            <p>{activeRound.description}</p>
          </div>
          <div className="meta-grid">
            <div>
              <dt>{t('adminDashboard.roundStartsAt')}</dt>
              <dd>{formatDateTime(activeRound.startsAt, language)}</dd>
            </div>
            <div>
              <dt>{t('adminDashboard.roundDeadlineAt')}</dt>
              <dd>{formatDateTime(activeRound.deadlineAt, language)}</dd>
            </div>
          </div>
        </article>
      ) : null}

      <article className="section-card">
        <h2>{t('tournamentDetails.roundsTitle')}</h2>
        {rounds.length === 0 ? <p>{t('tournamentDetails.noRounds')}</p> : null}
        {rounds.length > 0 ? (
          <div className="rounds-grid">
            {rounds.map((round) => (
              <article key={round.id} className="round-card">
                <div className="round-card-head">
                  <strong>
                    #{round.sequence} {round.title}
                  </strong>
                  <span>{t(`adminDashboard.roundStatus.${round.status}`)}</span>
                </div>

                <p>{round.description}</p>
                <p>
                  {t('adminDashboard.roundStartsAt')}: {formatDateTime(round.startsAt, language)}
                </p>
                <p>
                  {t('adminDashboard.roundDeadlineAt')}: {formatDateTime(round.deadlineAt, language)}
                </p>

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
              </article>
            ))}
          </div>
        ) : null}
      </article>

      <article className="section-card">
        <h2>{t('tournamentDetails.teamsTitle')}</h2>
        {!showTeams ? <p>{t('tournamentDetails.teamsHidden')}</p> : null}
        {showTeams && teams.length === 0 ? <p>{t('tournamentDetails.noTeams')}</p> : null}
        {showTeams && teams.length > 0 ? (
          <div className="profile-role-grid">
            {teams.map((team) => (
              <article key={team.id} className="profile-role-card">
                <div className="tournament-head">
                  <strong>{team.name}</strong>
                  <span className="status-pill">{team.membersCount}</span>
                </div>
                <p>{team.organization || t('teamsPage.noOrganization')}</p>
                <p>
                  {t('teamsPage.createdAt')}: {formatDateTime(team.createdAt, language)}
                </p>
              </article>
            ))}
          </div>
        ) : null}
      </article>
    </section>
  );
}
