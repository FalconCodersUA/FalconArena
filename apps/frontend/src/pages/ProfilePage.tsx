import { useEffect, useMemo, useState } from 'react';
import { ApiError, apiRequest } from '../lib/api';
import { useI18n } from '../i18n/I18nProvider';

type UserRole = 'ADMIN' | 'TEAM' | 'JURY' | 'ORGANIZER';
type TournamentStatus = 'DRAFT' | 'REGISTRATION' | 'RUNNING' | 'FINISHED';
type RoundStatus = 'DRAFT' | 'ACTIVE' | 'SUBMISSION_CLOSED' | 'EVALUATED';

type AuthMe = {
  id: string;
  fullName: string;
  email: string;
  role: UserRole;
  createdAt: string;
};

type Tournament = {
  id: string;
  title: string;
  status: TournamentStatus;
  createdById: string;
};

type TeamProfile = {
  id: string;
  name: string;
  captain: {
    id: string;
  };
  members: {
    id: string;
  }[];
};

type Round = {
  id: string;
  title: string;
  status: RoundStatus;
};

type TeamSubmission = {
  id: string;
};

type Assignment = {
  id: string;
  evaluation: {
    id: string;
  } | null;
};

type TeamSummaryItem = {
  tournamentId: string;
  tournamentTitle: string;
  tournamentStatus: TournamentStatus;
  teamName: string;
  membersCount: number;
  submissionsCount: number;
};

type JurySummaryItem = {
  tournamentId: string;
  tournamentTitle: string;
  assignments: number;
  evaluated: number;
};

type AdminSummaryItem = {
  tournamentId: string;
  tournamentTitle: string;
  tournamentStatus: TournamentStatus;
  roundsCount: number;
};

type TeamRoleSummary = {
  kind: 'TEAM';
  items: TeamSummaryItem[];
};

type JuryRoleSummary = {
  kind: 'JURY';
  items: JurySummaryItem[];
  totalAssignments: number;
  evaluatedAssignments: number;
};

type AdminRoleSummary = {
  kind: 'ADMIN';
  items: AdminSummaryItem[];
};

type RoleSummary = TeamRoleSummary | JuryRoleSummary | AdminRoleSummary;

function formatDate(value: string, language: string) {
  return new Date(value).toLocaleString(language === 'uk' ? 'uk-UA' : 'en-US');
}

export default function ProfilePage() {
  const { language, t } = useI18n();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [me, setMe] = useState<AuthMe | null>(null);
  const [summary, setSummary] = useState<RoleSummary | null>(null);

  const roleLabel = useMemo(() => {
    if (!me) {
      return '-';
    }

    return t(`profile.role.${me.role}`);
  }, [me?.role, t]);

  async function loadTeamSummary(tournaments: Tournament[]): Promise<TeamRoleSummary> {
    const teamData = await Promise.all(
      tournaments.map(async (tournament) => {
        try {
          const team = await apiRequest<TeamProfile>(`/tournaments/${tournament.id}/teams/me`);
          const rounds = await apiRequest<Round[]>(`/tournaments/${tournament.id}/rounds`);

          const submissions = await Promise.all(
            rounds.map(async (round) => {
              try {
                const submission = await apiRequest<TeamSubmission>(
                  `/rounds/${round.id}/submissions/me`,
                );
                return submission;
              } catch (requestError) {
                if (requestError instanceof ApiError && requestError.status === 404) {
                  return null;
                }

                throw requestError;
              }
            }),
          );

          return {
            tournamentId: tournament.id,
            tournamentTitle: tournament.title,
            tournamentStatus: tournament.status,
            teamName: team.name,
            membersCount: team.members.length + 1,
            submissionsCount: submissions.filter((entry) => entry !== null).length,
          } satisfies TeamSummaryItem;
        } catch (requestError) {
          if (requestError instanceof ApiError && requestError.status === 404) {
            return null;
          }

          throw requestError;
        }
      }),
    );

    return {
      kind: 'TEAM',
      items: teamData.filter((entry): entry is TeamSummaryItem => entry !== null),
    };
  }

  async function loadJurySummary(tournaments: Tournament[]): Promise<JuryRoleSummary> {
    const byTournament = await Promise.all(
      tournaments.map(async (tournament) => {
        const rounds = await apiRequest<Round[]>(`/tournaments/${tournament.id}/rounds`);
        const assignmentsByRound = await Promise.all(
          rounds.map(async (round) => {
            try {
              const assignments = await apiRequest<Assignment[]>(`/rounds/${round.id}/assignments/me`);
              return assignments;
            } catch (requestError) {
              if (requestError instanceof ApiError && requestError.status === 404) {
                return [];
              }

              throw requestError;
            }
          }),
        );

        const flatAssignments = assignmentsByRound.flat();
        const evaluated = flatAssignments.filter((entry) => entry.evaluation !== null).length;

        return {
          tournamentId: tournament.id,
          tournamentTitle: tournament.title,
          assignments: flatAssignments.length,
          evaluated,
        } satisfies JurySummaryItem;
      }),
    );

    const items = byTournament.filter((entry) => entry.assignments > 0);
    const totalAssignments = items.reduce((acc, entry) => acc + entry.assignments, 0);
    const evaluatedAssignments = items.reduce((acc, entry) => acc + entry.evaluated, 0);

    return {
      kind: 'JURY',
      items,
      totalAssignments,
      evaluatedAssignments,
    };
  }

  async function loadAdminSummary(
    meData: AuthMe,
    tournaments: Tournament[],
  ): Promise<AdminRoleSummary> {
    const createdByMe = tournaments.filter((entry) => entry.createdById === meData.id);
    const withRounds = await Promise.all(
      createdByMe.map(async (tournament) => {
        const rounds = await apiRequest<Round[]>(`/tournaments/${tournament.id}/rounds`);
        return {
          tournamentId: tournament.id,
          tournamentTitle: tournament.title,
          tournamentStatus: tournament.status,
          roundsCount: rounds.length,
        } satisfies AdminSummaryItem;
      }),
    );

    return {
      kind: 'ADMIN',
      items: withRounds,
    };
  }

  async function loadProfile() {
    setLoading(true);
    setError('');

    try {
      const [meData, tournamentData] = await Promise.all([
        apiRequest<AuthMe>('/auth/me'),
        apiRequest<Tournament[]>('/tournaments'),
      ]);

      setMe(meData);

      if (meData.role === 'TEAM') {
        setSummary(await loadTeamSummary(tournamentData));
      } else if (meData.role === 'JURY') {
        setSummary(await loadJurySummary(tournamentData));
      } else {
        setSummary(await loadAdminSummary(meData, tournamentData));
      }
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : t('profile.loadFailed'));
      setSummary(null);
      setMe(null);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadProfile();
  }, []);

  if (loading) {
    return <article className="card state-card">{t('profile.loading')}</article>;
  }

  if (error) {
    return (
      <article className="card state-card">
        <p className="form-error">{error}</p>
        <button type="button" className="button button-soft" onClick={loadProfile}>
          {t('profile.retry')}
        </button>
      </article>
    );
  }

  if (!me || !summary) {
    return <article className="card state-card">{t('profile.loadFailed')}</article>;
  }

  return (
    <section className="team-dashboard">
      <header className="section-header">
        <p className="eyebrow">{t('shell.profile')}</p>
        <h1>{t('profile.title')}</h1>
        <p className="lead">{t('profile.lead')}</p>
      </header>

      <article className="card panel-card">
        <h2>{t('profile.basics.title')}</h2>
        <div className="profile-grid">
          <div className="profile-item">
            <span>{t('profile.basics.role')}</span>
            <strong>{roleLabel}</strong>
          </div>
          <div className="profile-item">
            <span>{t('profile.basics.email')}</span>
            <strong>{me.email}</strong>
          </div>
          <div className="profile-item">
            <span>{t('profile.basics.fullName')}</span>
            <strong>{me.fullName}</strong>
          </div>
          <div className="profile-item">
            <span>{t('profile.basics.createdAt')}</span>
            <strong>{formatDate(me.createdAt, language)}</strong>
          </div>
        </div>
      </article>

      {summary.kind === 'TEAM' ? (
        <article className="card panel-card">
          <h2>{t('profile.team.title')}</h2>
          {summary.items.length === 0 ? <p>{t('profile.team.empty')}</p> : null}
          {summary.items.length > 0 ? (
            <div className="profile-role-grid">
              {summary.items.map((item) => (
                <article key={item.tournamentId} className="profile-role-card">
                  <div className="tournament-head">
                    <strong>{item.tournamentTitle}</strong>
                    <span className="status-pill">{t(`profile.status.${item.tournamentStatus}`)}</span>
                  </div>
                  <p>{item.teamName}</p>
                  <p>
                    {t('profile.team.members')}: {item.membersCount}
                  </p>
                  <p>
                    {t('profile.team.submissions')}: {item.submissionsCount}
                  </p>
                  {item.submissionsCount === 0 ? (
                    <p className="inline-hint">{t('profile.team.noSubmissions')}</p>
                  ) : null}
                </article>
              ))}
            </div>
          ) : null}
        </article>
      ) : null}

      {summary.kind === 'JURY' ? (
        <article className="card panel-card">
          <h2>{t('profile.jury.title')}</h2>
          {summary.items.length === 0 ? <p>{t('profile.jury.empty')}</p> : null}

          {summary.items.length > 0 ? (
            <>
              <div className="profile-grid">
                <div className="profile-item">
                  <span>{t('profile.jury.totalAssignments')}</span>
                  <strong>{summary.totalAssignments}</strong>
                </div>
                <div className="profile-item">
                  <span>{t('profile.jury.evaluated')}</span>
                  <strong>{summary.evaluatedAssignments}</strong>
                </div>
                <div className="profile-item">
                  <span>{t('profile.jury.pending')}</span>
                  <strong>{summary.totalAssignments - summary.evaluatedAssignments}</strong>
                </div>
              </div>

              <div className="profile-role-grid">
                {summary.items.map((item) => (
                  <article key={item.tournamentId} className="profile-role-card">
                    <strong>{item.tournamentTitle}</strong>
                    <p>
                      {t('profile.jury.totalAssignments')}: {item.assignments}
                    </p>
                    <p>
                      {t('profile.jury.evaluated')}: {item.evaluated}
                    </p>
                    <p>
                      {t('profile.jury.pending')}: {item.assignments - item.evaluated}
                    </p>
                  </article>
                ))}
              </div>
            </>
          ) : null}
        </article>
      ) : null}

      {summary.kind === 'ADMIN' ? (
        <article className="card panel-card">
          <h2>{t('profile.admin.title')}</h2>
          {summary.items.length === 0 ? <p>{t('profile.admin.empty')}</p> : null}
          {summary.items.length > 0 ? (
            <div className="profile-role-grid">
              {summary.items.map((item) => (
                <article key={item.tournamentId} className="profile-role-card">
                  <div className="tournament-head">
                    <strong>{item.tournamentTitle}</strong>
                    <span className="status-pill">{t(`profile.status.${item.tournamentStatus}`)}</span>
                  </div>
                  <p>
                    {t('profile.admin.rounds')}: {item.roundsCount}
                  </p>
                </article>
              ))}
            </div>
          ) : null}
        </article>
      ) : null}
    </section>
  );
}
