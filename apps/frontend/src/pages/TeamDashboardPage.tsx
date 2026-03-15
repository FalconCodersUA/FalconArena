import { FormEvent, useEffect, useMemo, useState } from 'react';
import { ApiError, apiRequest } from '../lib/api';
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

type MemberDraft = {
  fullName: string;
  email: string;
};

const DEFAULT_MEMBERS: MemberDraft[] = [
  { fullName: '', email: '' },
  { fullName: '', email: '' },
];

function formatDate(value: string, language: string) {
  return new Date(value).toLocaleString(language === 'uk' ? 'uk-UA' : 'en-US');
}

function emptyMember(): MemberDraft {
  return { fullName: '', email: '' };
}

export default function TeamDashboardPage() {
  const { language, t } = useI18n();

  const [me, setMe] = useState<AuthMe | null>(null);
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [selectedTournamentId, setSelectedTournamentId] = useState('');

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
  const [submission, setSubmission] = useState<TeamSubmission | null>(null);
  const [submissionError, setSubmissionError] = useState('');
  const [submissionNotice, setSubmissionNotice] = useState('');
  const [submissionLoading, setSubmissionLoading] = useState(false);
  const [savingSubmission, setSavingSubmission] = useState(false);

  const [repoUrl, setRepoUrl] = useState('');
  const [demoUrl, setDemoUrl] = useState('');
  const [liveDemoUrl, setLiveDemoUrl] = useState('');
  const [shortSummary, setShortSummary] = useState('');

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
      Date.now() <= new Date(activeRound.deadlineAt).getTime()
    );
  }, [activeRound, submission]);

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
          : t('teamDashboard.loadFailed'),
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
          requestError instanceof Error
            ? requestError.message
            : t('teamDashboard.teamLoadFailed'),
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
            requestError instanceof Error
              ? requestError.message
              : t('teamDashboard.submissionLoadFailed'),
          );
        }
      }
    } catch (requestError) {
      setActiveRound(null);
      applySubmissionDraft(null);
      setSubmissionError(
        requestError instanceof Error
          ? requestError.message
          : t('teamDashboard.roundLoadFailed'),
      );
    } finally {
      setSubmissionLoading(false);
    }
  }

  async function reloadTournamentData(tournamentId: string) {
    if (!roleAllowed) {
      return;
    }

    await Promise.all([
      loadTeamForTournament(tournamentId),
      loadRoundAndSubmission(tournamentId),
    ]);
  }

  useEffect(() => {
    void loadInitialData();
  }, []);

  useEffect(() => {
    if (!selectedTournamentId || !me) {
      return;
    }

    void reloadTournamentData(selectedTournamentId);
  }, [selectedTournamentId, me?.role]);

  function updateMember(index: number, field: keyof MemberDraft, value: string) {
    setMembers((current) =>
      current.map((item, itemIndex) =>
        itemIndex === index ? { ...item, [field]: value } : item,
      ),
    );
  }

  function addMember() {
    setMembers((current) => (current.length >= 8 ? current : [...current, emptyMember()]));
  }

  function removeMember(index: number) {
    setMembers((current) => (current.length <= 2 ? current : current.filter((_, i) => i !== index)));
  }

  async function submitTeamRegistration(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedTournamentId) {
      return;
    }

    setRegistering(true);
    setTeamError('');
    setTeamNotice('');

    try {
      const payload = {
        name: teamName,
        organization: organization || undefined,
        contactHandle: contactHandle || undefined,
        members: members.map((item) => ({
          fullName: item.fullName,
          email: item.email,
        })),
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
    } catch (requestError) {
      setTeamError(
        requestError instanceof Error
          ? requestError.message
          : t('teamDashboard.registrationFailed'),
      );
    } finally {
      setRegistering(false);
    }
  }

  async function submitSubmission(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!activeRound) {
      return;
    }

    setSavingSubmission(true);
    setSubmissionError('');
    setSubmissionNotice('');

    try {
      const saved = await apiRequest<TeamSubmission>(`/rounds/${activeRound.id}/submissions`, {
        method: 'POST',
        body: {
          repoUrl,
          demoUrl,
          liveDemoUrl: liveDemoUrl || undefined,
          shortSummary: shortSummary || undefined,
        },
      });

      applySubmissionDraft(saved);
      setSubmissionNotice(t('teamDashboard.submissionSaved'));
    } catch (requestError) {
      setSubmissionError(
        requestError instanceof Error
          ? requestError.message
          : t('teamDashboard.submissionSaveFailed'),
      );
    } finally {
      setSavingSubmission(false);
    }
  }

  if (loading) {
    return <article className="card state-card">{t('teamDashboard.loading')}</article>;
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

      <article className="card panel-card">
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

      <div className="team-grid">
        <article className="card panel-card">
          <h2>{t('teamDashboard.teamCardTitle')}</h2>
          {teamLoading ? <p>{t('teamDashboard.teamLoading')}</p> : null}
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
                    <h3>{t('teamDashboard.form.membersTitle')}</h3>
                    <button
                      type="button"
                      className="button button-soft"
                      onClick={addMember}
                      disabled={members.length >= 8}
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
                        disabled={members.length <= 2}
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

        <article className="card panel-card">
          <h2>{t('teamDashboard.submissionCardTitle')}</h2>

          {!team ? <p>{t('teamDashboard.needTeamFirst')}</p> : null}
          {team && submissionLoading ? <p>{t('teamDashboard.submissionLoading')}</p> : null}
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
              <p>
                {t('teamDashboard.taskStartsAt')}:{' '}
                {formatDate(activeRound.startsAt, language)}
              </p>
              <p>
                {t('teamDashboard.deadlineLabel')}:{' '}
                {formatDate(activeRound.deadlineAt, language)}
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
            </div>
          ) : null}

          {team && !activeRound && !submissionLoading ? (
            <p>{t('teamDashboard.noActiveRound')}</p>
          ) : null}

          {team && activeRound ? (
            <form className="panel-form" onSubmit={submitSubmission} noValidate>
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
