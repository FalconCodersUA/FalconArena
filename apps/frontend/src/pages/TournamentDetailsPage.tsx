import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import QuietLoadingCard from '../components/QuietLoadingCard';
import TournamentSchedulePanel from '../components/TournamentSchedulePanel';
import { apiRequest } from '../lib/api';
import { formatDateTime } from '../lib/dateTime';
import { normalizeApiErrorMessage } from '../lib/errorMessages';
import { getAuthRole, isAuthenticated } from '../lib/auth';
import { TournamentScheduleEvent } from '../lib/tournamentSchedule';
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
  hideTeamsUntilRegistrationClose: boolean;
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
  if (!tournament.hideTeamsUntilRegistrationClose) {
    return true;
  }

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
  const [scheduleEvents, setScheduleEvents] = useState<TournamentScheduleEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [scheduleError, setScheduleError] = useState('');

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
        const [tournamentData, roundsData] = await Promise.all([
          apiRequest<Tournament>(`/tournaments/${tournamentId}`),
          apiRequest<Round[]>(`/tournaments/${tournamentId}/rounds`),
        ]);
        setTournament(tournamentData);
        setRounds(roundsData);

        try {
          const scheduleData = await apiRequest<TournamentScheduleEvent[]>(
            `/tournaments/${tournamentId}/schedule`,
          );
          setScheduleEvents(scheduleData);
          setScheduleError('');
        } catch (scheduleRequestError) {
          setScheduleEvents([]);
          setScheduleError(
            normalizeApiErrorMessage(scheduleRequestError, t, t('schedule.loadFailed')),
          );
        }

        if (canShowTeamsList(tournamentData)) {
          const teamsData = await apiRequest<TeamRow[]>(`/tournaments/${tournamentId}/teams`);
          setTeams(teamsData);
        } else {
          setTeams([]);
        }
      } catch (requestError) {
        setError(
          normalizeApiErrorMessage(requestError, t, t('tournamentDetails.loadFailed')),
        );
        setTournament(null);
        setRounds([]);
        setTeams([]);
        setScheduleEvents([]);
        setScheduleError('');
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
  const scheduleHighlights = useMemo(() => scheduleEvents.slice(0, 3), [scheduleEvents]);

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
    return <QuietLoadingCard label={t('tournamentDetails.loading')} />;
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
  const tournamentCards = [
    {
      label: t('tournamentDetails.spotlight.registration'),
      value: formatDateTime(tournament.registrationOpenAt, language),
      hint: formatDateTime(tournament.registrationCloseAt, language),
    },
    {
      label: t('tournamentDetails.spotlight.rounds'),
      value: `${rounds.length}`,
      hint: t('tournamentDetails.roundsHint'),
    },
    {
      label: t('tournamentDetails.spotlight.teams'),
      value: showTeams ? `${teams.length}` : t('tournamentDetails.hiddenUntilClose'),
      hint: tournament.maxTeams
        ? `${t('tournamentDetails.teamLimit')}: ${tournament.maxTeams}`
        : t('tournamentDetails.teamLimitOpen'),
    },
    {
      label: t('tournamentDetails.spotlight.activeRound'),
      value: activeRound ? `#${activeRound.sequence}` : t('tournamentDetails.notScheduled'),
      hint: activeRound ? activeRound.title : t('tournamentDetails.activeRoundHint'),
    },
  ];

  return (
    <section className="tournaments-section tournament-public-page">
      <article className="card panel-card tournament-showcase">
        <div className="tournament-showcase-copy">
          <p className="eyebrow">{t('tournamentDetails.eyebrow')}</p>
          <div className="tournament-showcase-head">
            <h1>{tournament.title}</h1>
            <span className="status-pill">{t(`tournaments.status.${tournament.status}`)}</span>
          </div>
          <p className="lead">{tournament.description || t('tournamentDetails.noDescription')}</p>
          <p className="tournament-showcase-support">{t('tournamentDetails.showcaseLead')}</p>

          <div className="status-actions">
            {registrationAction ? (
              <Link to={registrationAction.to} className="button button-primary">
                {registrationAction.label}
              </Link>
            ) : null}
            <Link
              to={`/app/leaderboard?tournamentId=${tournament.id}`}
              className="button tournaments-card-action tournaments-card-action--purple tournament-showcase-action"
            >
              {t('tournaments.leaderboard')}
            </Link>
            <Link
              to="/app/tournaments"
              className="button tournaments-card-action tournaments-card-action--secondary tournament-showcase-action"
            >
              {t('tournamentDetails.backToTournaments')}
            </Link>
          </div>
        </div>

        <div className="tournament-showcase-side">
          <div className="tournament-showcase-grid">
            {tournamentCards.map((card) => (
              <article key={card.label} className="tournament-showcase-card">
                <span>{card.label}</span>
                <strong>{card.value}</strong>
                <p>{card.hint}</p>
              </article>
            ))}
          </div>

          <article className="tournament-showcase-timeline">
            <div className="tournament-head">
              <h2>{t('tournamentDetails.timelineTitle')}</h2>
              <span className="status-pill">{scheduleEvents.length}</span>
            </div>
            {scheduleHighlights.length > 0 ? (
              <div className="tournament-showcase-events">
                {scheduleHighlights.map((event) => (
                  <article key={event.id} className="tournament-showcase-event">
                    <strong>{event.title}</strong>
                    <span>{formatDateTime(event.startsAt, language)}</span>
                  </article>
                ))}
              </div>
            ) : (
              <p className="inline-hint">{t('schedule.empty')}</p>
            )}
          </article>
        </div>
      </article>

      <article className="card panel-card">
        <div className="tournament-head">
          <h2>{t('tournamentDetails.overviewTitle')}</h2>
          <span className="status-pill">{t('tournamentDetails.overviewLabel')}</span>
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
              {showTeams
                ? t('tournamentDetails.teamVisibilityOpen')
                : t('tournamentDetails.teamVisibilityClosed')}
            </p>
          </div>
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

      <TournamentSchedulePanel
        className="section-card"
        events={scheduleEvents}
        error={scheduleError}
        onRetry={() => {
          void (async () => {
            try {
              setScheduleError('');
              const data = await apiRequest<TournamentScheduleEvent[]>(
                `/tournaments/${tournamentId}/schedule`,
              );
              setScheduleEvents(data);
            } catch (requestError) {
              setScheduleError(
                normalizeApiErrorMessage(requestError, t, t('schedule.loadFailed')),
              );
            }
          })();
        }}
        lead={t('tournamentDetails.scheduleLead')}
      />

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
