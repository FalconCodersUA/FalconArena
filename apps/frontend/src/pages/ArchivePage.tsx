import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import QuietLoadingCard from '../components/QuietLoadingCard';
import QuietLoadingInline from '../components/QuietLoadingInline';
import { useI18n } from '../i18n/I18nProvider';
import { getAuthRole, isAuthenticated } from '../lib/auth';
import { apiRequest, buildApiUrl } from '../lib/api';
import { formatDateTime } from '../lib/dateTime';
import { normalizeApiErrorMessage } from '../lib/errorMessages';
import {
  rememberTournamentSelection,
  resolveStoredTournamentSelection,
} from '../lib/tournamentSelection';

type TournamentStatus = 'DRAFT' | 'REGISTRATION' | 'RUNNING' | 'FINISHED';
type RoundStatus = 'DRAFT' | 'ACTIVE' | 'SUBMISSION_CLOSED' | 'EVALUATED';
type SubmissionStatus = 'DRAFT' | 'SUBMITTED' | 'LOCKED';

type TournamentOption = {
  id: string;
  title: string;
  status: TournamentStatus;
  startsAt: string | null;
  registrationOpenAt: string;
  registrationCloseAt: string;
  canTeamRegister: boolean;
};

type CategoryAverages = {
  technicalBackend: number;
  technicalDatabase: number;
  technicalFrontend: number;
  mustHave: number;
  stability: number;
  usability: number;
};

type ArchiveResponse = {
  tournament: TournamentOption & {
    description: string | null;
  };
  summary: {
    teamsCount: number;
    roundsCount: number;
    submissionsCount: number;
  };
  leaderboard: {
    tournament: {
      id: string;
      title: string;
      status: TournamentStatus;
    };
    scoring: {
      scale: string;
      totalFormula: string;
      roundFormula: string;
      evaluationFormula: string;
    };
    rows: Array<{
      rank: number;
      teamId: string;
      teamName: string;
      organization: string | null;
      totalScore: number;
      averageScore: number;
      evaluationsCount: number;
      categoryAverages: CategoryAverages;
      rounds: Array<{
        roundId: string;
        roundTitle: string;
        evaluationsCount: number;
        averageScore: number;
      }>;
    }>;
  } | null;
  teams: Array<{
    id: string;
    name: string;
    organization: string | null;
    membersCount: number;
    submissionsCount: number;
    rank: number | null;
    totalScore: number;
    averageScore: number;
    evaluationsCount: number;
  }>;
  rounds: Array<{
    id: string;
    sequence: number;
    title: string;
    description: string;
    status: RoundStatus;
    startsAt: string;
    deadlineAt: string;
    submissionsCount: number;
    evaluatedSubmissionsCount: number;
    averageScore: number;
    submissions: Array<{
      id: string;
      teamId: string;
      teamName: string;
      organization: string | null;
      repoUrl: string;
      demoUrl: string;
      liveDemoUrl: string | null;
      shortSummary: string | null;
      status: SubmissionStatus;
      submittedAt: string | null;
      evaluationsCount: number;
      averageScore: number;
      categoryAverages: CategoryAverages;
    }>;
  }>;
};

type CertificateTemplateView = {
  id: string | null;
  tournamentId: string;
  isDefault: boolean;
  name: string;
  title: string;
  subtitle: string;
  body: string;
  footer: string;
  signerName: string;
  signerRole: string;
  accentColor: string;
};

type GoogleSheetsExportResponse = {
  ok: boolean;
  destination: string;
  sheetName: string;
  rowsExported: number;
  response?:
    | {
        spreadsheetUrl?: string;
        url?: string;
      }
    | string
    | null;
};

type CategoryKey = keyof CategoryAverages;

const CATEGORY_KEYS: CategoryKey[] = [
  'technicalBackend',
  'technicalDatabase',
  'technicalFrontend',
  'mustHave',
  'stability',
  'usability',
];

function formatScore(value: number) {
  return Number.isInteger(value) ? String(value) : value.toFixed(2);
}

function formatScoringFormula(
  formula: string,
  t: (key: string) => string,
) {
  switch (formula) {
    case 'sum(roundAverageScore)':
      return t('archivePage.formulaDescriptions.total');
    case 'average(juryEvaluationTotals)':
      return t('archivePage.formulaDescriptions.round');
    case 'average(6 category scores)':
      return t('archivePage.formulaDescriptions.evaluation');
    default:
      return formula;
  }
}

function formatArchiveRoundTitle(
  title: string,
  sequence: number,
  t: (key: string) => string,
) {
  const trimmedTitle = title.trim();
  const legacyRoundMatch = trimmedTitle.match(/^Round\s+(.+)$/i);
  const prefix = `${t('archivePage.roundPrefix')} ${sequence}`;

  if (!legacyRoundMatch) {
    return `${prefix}. ${trimmedTitle}`;
  }

  const suffix = legacyRoundMatch[1]?.trim();
  if (!suffix || suffix === String(sequence)) {
    return prefix;
  }

  return `${prefix}. ${suffix}`;
}

function formatArchiveRoundDescription(
  description: string,
  t: (key: string) => string,
) {
  const trimmedDescription = description.trim();
  if (/^Description for\s+.+$/i.test(trimmedDescription)) {
    return t('archivePage.roundDescriptionFallback');
  }

  return trimmedDescription;
}

export default function ArchivePage() {
  const { language, t } = useI18n();
  const [searchParams, setSearchParams] = useSearchParams();
  const [initialTournamentId] = useState(() => searchParams.get('tournamentId') ?? '');
  const isManager = isAuthenticated() && ['ADMIN', 'ORGANIZER'].includes(getAuthRole() ?? '');

  const [tournaments, setTournaments] = useState<TournamentOption[]>([]);
  const [selectedTournamentId, setSelectedTournamentId] = useState('');
  const [archive, setArchive] = useState<ArchiveResponse | null>(null);
  const [certificateTemplate, setCertificateTemplate] = useState<CertificateTemplateView | null>(null);
  const [loadingTournaments, setLoadingTournaments] = useState(true);
  const [loadingArchive, setLoadingArchive] = useState(false);
  const [loadingTemplate, setLoadingTemplate] = useState(false);
  const [tournamentsError, setTournamentsError] = useState('');
  const [archiveError, setArchiveError] = useState('');
  const [templateError, setTemplateError] = useState('');
  const [templateNotice, setTemplateNotice] = useState('');
  const [savingTemplate, setSavingTemplate] = useState(false);
  const [exportingGoogleSheets, setExportingGoogleSheets] = useState(false);
  const [googleSheetsNotice, setGoogleSheetsNotice] = useState('');
  const [googleSheetsError, setGoogleSheetsError] = useState('');

  const leader = archive?.leaderboard?.rows[0] ?? null;
  const selectedTournament = useMemo(
    () => tournaments.find((entry) => entry.id === selectedTournamentId) ?? null,
    [selectedTournamentId, tournaments],
  );

  function resolveSheetsUrl(response: GoogleSheetsExportResponse['response']) {
    if (!response || typeof response === 'string') {
      return '';
    }

    return response.spreadsheetUrl ?? response.url ?? '';
  }

  function resolveDefaultTournamentId(list: TournamentOption[]) {
    if (initialTournamentId && list.some((entry) => entry.id === initialTournamentId)) {
      return initialTournamentId;
    }

    return resolveStoredTournamentSelection(list, list[0]?.id ?? '');
  }

  async function loadTournaments() {
    setLoadingTournaments(true);
    setTournamentsError('');
    setArchiveError('');

    try {
      const data = await apiRequest<TournamentOption[]>('/tournaments?status=FINISHED');
      setTournaments(data);
      setSelectedTournamentId((current) => {
        if (current && data.some((entry) => entry.id === current)) {
          return current;
        }

        return resolveDefaultTournamentId(data);
      });
    } catch (requestError) {
      setTournamentsError(
        normalizeApiErrorMessage(requestError, t, t('archivePage.loadTournamentsFailed')),
      );
      setTournaments([]);
      setSelectedTournamentId('');
      setArchive(null);
    } finally {
      setLoadingTournaments(false);
    }
  }

  async function loadArchive(tournamentId: string) {
    setLoadingArchive(true);
    setArchiveError('');

    try {
      const data = await apiRequest<ArchiveResponse>(`/tournaments/${tournamentId}/archive`);
      setArchive(data);
    } catch (requestError) {
      setArchiveError(
        normalizeApiErrorMessage(requestError, t, t('archivePage.loadArchiveFailed')),
      );
      setArchive(null);
    } finally {
      setLoadingArchive(false);
    }
  }

  async function loadCertificateTemplate(tournamentId: string) {
    if (!isManager) {
      setCertificateTemplate(null);
      setTemplateError('');
      return;
    }

    setLoadingTemplate(true);
    setTemplateError('');

    try {
      const data = await apiRequest<CertificateTemplateView>(
        `/tournaments/${tournamentId}/certificate-template`,
      );
      setCertificateTemplate(data);
    } catch (requestError) {
      setTemplateError(
        normalizeApiErrorMessage(
          requestError,
          t,
          t('archivePage.certificates.loadTemplateFailed'),
        ),
      );
      setCertificateTemplate(null);
    } finally {
      setLoadingTemplate(false);
    }
  }

  useEffect(() => {
    void loadTournaments();
  }, []);

  useEffect(() => {
    if (!selectedTournamentId) {
      return;
    }

    setSearchParams({ tournamentId: selectedTournamentId }, { replace: true });
    rememberTournamentSelection(selectedTournamentId);
    void loadArchive(selectedTournamentId);
    void loadCertificateTemplate(selectedTournamentId);
  }, [selectedTournamentId, setSearchParams]);

  async function saveCertificateTemplate() {
    if (!selectedTournamentId || !certificateTemplate) {
      return;
    }

    setSavingTemplate(true);
    setTemplateError('');
    setTemplateNotice('');

    try {
      const saved = await apiRequest<CertificateTemplateView>(
        `/tournaments/${selectedTournamentId}/certificate-template`,
        {
          method: 'PATCH',
          body: {
            name: certificateTemplate.name,
            title: certificateTemplate.title,
            subtitle: certificateTemplate.subtitle,
            body: certificateTemplate.body,
            footer: certificateTemplate.footer,
            signerName: certificateTemplate.signerName,
            signerRole: certificateTemplate.signerRole,
            accentColor: certificateTemplate.accentColor,
          },
        },
      );
      setCertificateTemplate(saved);
      setTemplateNotice(t('archivePage.certificates.saved'));
    } catch (requestError) {
      setTemplateError(
        normalizeApiErrorMessage(requestError, t, t('archivePage.certificates.saveFailed')),
      );
    } finally {
      setSavingTemplate(false);
    }
  }

  async function exportGoogleSheets() {
    if (!archive || !isManager) {
      return;
    }

    setExportingGoogleSheets(true);
    setGoogleSheetsNotice('');
    setGoogleSheetsError('');

    try {
      const result = await apiRequest<GoogleSheetsExportResponse>(
        `/tournaments/${archive.tournament.id}/leaderboard/export.google-sheets`,
        {
          method: 'POST',
          body: {},
        },
      );
      const sheetUrl = resolveSheetsUrl(result.response);
      setGoogleSheetsNotice(
        sheetUrl ? t('archivePage.exportGoogleSheetsSuccessWithLink') : t('archivePage.exportGoogleSheetsSuccess'),
      );
      if (sheetUrl) {
        window.open(sheetUrl, '_blank', 'noopener,noreferrer');
      }
    } catch (requestError) {
      setGoogleSheetsError(
        normalizeApiErrorMessage(requestError, t, t('archivePage.exportGoogleSheetsFailed')),
      );
    } finally {
      setExportingGoogleSheets(false);
    }
  }

  if (loadingTournaments) {
    return <QuietLoadingCard label={t('archivePage.loadingTournaments')} />;
  }

  if (tournamentsError) {
    return (
      <article className="card state-card">
        <p className="form-error">{tournamentsError}</p>
        <button type="button" className="button button-soft" onClick={() => void loadTournaments()}>
          {t('archivePage.retry')}
        </button>
      </article>
    );
  }

  if (tournaments.length === 0) {
    return <article className="card state-card">{t('archivePage.empty')}</article>;
  }

  return (
    <section className="team-dashboard">
      <header className="section-header">
        <p className="eyebrow">{t('archivePage.eyebrow')}</p>
        <h1>{t('archivePage.title')}</h1>
        <p className="lead">{t('archivePage.lead')}</p>
      </header>

      <article className="card panel-card archive-workspace-card">
        <div className="archive-workspace-head">
          <div className="archive-workspace-copy">
            <p className="eyebrow dashboard-workspace-eyebrow">
              {t('archivePage.workspaceEyebrow')}
            </p>
            <h2>{t('archivePage.workspaceTitle')}</h2>
            <p>{t('archivePage.workspaceLead')}</p>
          </div>
          <div className="dashboard-workspace-status archive-workspace-status">
            <span>{t('archivePage.workspaceStatusLabel')}</span>
            <strong>{tournaments.length}</strong>
            <p>{t('archivePage.workspaceStatusLead')}</p>
          </div>
        </div>

        <div className="dashboard-toolset-grid archive-toolset-grid">
          <button
            type="button"
            className="dashboard-tool-card dashboard-tool-card--teal dashboard-tool-button"
            onClick={() => document.getElementById('archive-summary')?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
          >
            <span>{t('archivePage.summaryTitle')}</span>
            <strong>{t('archivePage.workspaceCards.summaryTitle')}</strong>
            <p>{t('archivePage.workspaceCards.summaryLead')}</p>
            <em>{archive ? `${archive.summary.teamsCount} ${t('archivePage.workspaceCards.teamsSuffix')}` : `0 ${t('archivePage.workspaceCards.teamsSuffix')}`}</em>
          </button>
          <button
            type="button"
            className="dashboard-tool-card dashboard-tool-card--purple dashboard-tool-button"
            onClick={() => document.getElementById('archive-results')?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
          >
            <span>{t('archivePage.resultsTitle')}</span>
            <strong>{t('archivePage.workspaceCards.resultsTitle')}</strong>
            <p>{t('archivePage.workspaceCards.resultsLead')}</p>
            <em>{leader ? `#1 ${leader.teamName}` : t('archivePage.workspaceCards.noLeader')}</em>
          </button>
          <button
            type="button"
            className="dashboard-tool-card dashboard-tool-card--orange dashboard-tool-button"
            onClick={() => document.getElementById('archive-rounds')?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
          >
            <span>{t('archivePage.roundsTitle')}</span>
            <strong>{t('archivePage.workspaceCards.roundsTitle')}</strong>
            <p>{t('archivePage.workspaceCards.roundsLead')}</p>
            <em>{archive ? `${archive.summary.roundsCount} ${t('archivePage.workspaceCards.roundsSuffix')}` : `0 ${t('archivePage.workspaceCards.roundsSuffix')}`}</em>
          </button>
          {isManager ? (
            <button
              type="button"
              className="dashboard-tool-card dashboard-tool-card--berry dashboard-tool-button"
              onClick={() => document.getElementById('archive-certificates')?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
            >
              <span>{t('archivePage.certificates.title')}</span>
              <strong>{t('archivePage.workspaceCards.certificatesTitle')}</strong>
              <p>{t('archivePage.workspaceCards.certificatesLead')}</p>
              <em>
                {certificateTemplate?.isDefault
                  ? t('archivePage.certificates.defaultTemplate')
                  : t('archivePage.certificates.customTemplate')}
              </em>
            </button>
          ) : null}
        </div>
      </article>

      <article className="card panel-card">
        <label className="field admin-tournament-picker" htmlFor="archive-tournament-select">
          <span>{t('archivePage.tournamentLabel')}</span>
          <select
            id="archive-tournament-select"
            className="select-input admin-tournament-picker-select"
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
          <span>{t('archivePage.tournamentStatus')}</span>
          <strong>
            {selectedTournament ? t(`tournaments.status.${selectedTournament.status}`) : '-'}
          </strong>
        </div>
      </article>

      {loadingArchive && !archive ? (
        <article className="card panel-card">
          <QuietLoadingInline label={t('archivePage.loadingArchive')} />
        </article>
      ) : null}

      {archiveError ? (
        <article className="card panel-card">
          <div className="state-callout featured">
            <strong>{t('archivePage.title')}</strong>
            <p>{archiveError}</p>
          </div>
          <button
            type="button"
            className="button button-soft"
            onClick={() => void loadArchive(selectedTournamentId)}
          >
            {t('archivePage.retry')}
          </button>
        </article>
      ) : null}

      {!loadingArchive && !archiveError && archive ? (
        <>
          <article id="archive-summary" className="card panel-card">
            <h2>{t('archivePage.summaryTitle')}</h2>
            <div className="summary-grid">
              <div className="summary-card">
                <span>{t('archivePage.summary.tournament')}</span>
                <strong>{archive.tournament.title}</strong>
                <p>{t(`tournaments.status.${archive.tournament.status}`)}</p>
              </div>
              <div className="summary-card">
                <span>{t('archivePage.summary.winner')}</span>
                <strong>{leader ? leader.teamName : '-'}</strong>
                <p>{leader ? `${t('archivePage.totalScore')}: ${formatScore(leader.totalScore)}` : '-'}</p>
              </div>
              <div className="summary-card">
                <span>{t('archivePage.summary.teams')}</span>
                <strong>{archive.summary.teamsCount}</strong>
                <p>{t('archivePage.summary.rounds')}: {archive.summary.roundsCount}</p>
              </div>
              <div className="summary-card">
                <span>{t('archivePage.summary.submissions')}</span>
                <strong>{archive.summary.submissionsCount}</strong>
                <p>{t('archivePage.summary.evaluatedRounds')}: {archive.rounds.filter((item) => item.evaluatedSubmissionsCount > 0).length}</p>
              </div>
            </div>

            <div className="state-callout subtle">
              <strong>{t('archivePage.aboutTitle')}</strong>
              <p>
                {archive.tournament.description?.trim() || t('archivePage.noDescription')}
              </p>
            </div>

            <div className="status-actions">
              <Link
                to={`/app/tournaments/${archive.tournament.id}`}
                className="button button-soft"
              >
                {t('archivePage.openTournament')}
              </Link>
              <a
                href={buildApiUrl(
                  `/tournaments/${archive.tournament.id}/leaderboard/export.csv`,
                )}
                className="button button-soft"
              >
                {t('archivePage.exportCsv')}
              </a>
              {isManager ? (
                <button
                  type="button"
                  className="button button-soft"
                  onClick={() => void exportGoogleSheets()}
                  disabled={exportingGoogleSheets}
                >
                  {exportingGoogleSheets
                    ? t('archivePage.exportGoogleSheetsSubmitting')
                    : t('archivePage.exportGoogleSheets')}
                </button>
                ) : null}
                <Link
                  to={`/app/leaderboard?tournamentId=${archive.tournament.id}`}
                  className="button tournaments-card-action tournaments-card-action--purple"
                >
                  {t('archivePage.openLeaderboard')}
                </Link>
              </div>

            {googleSheetsNotice ? <p className="form-success">{googleSheetsNotice}</p> : null}
            {googleSheetsError ? <p className="form-error">{googleSheetsError}</p> : null}
          </article>

          {isManager ? (
            <article id="archive-certificates" className="card panel-card">
              <div className="tournament-head">
                <h2>{t('archivePage.certificates.title')}</h2>
                <span className="status-pill">
                  {certificateTemplate?.isDefault
                    ? t('archivePage.certificates.defaultTemplate')
                    : t('archivePage.certificates.customTemplate')}
                </span>
              </div>

              <p className="inline-hint">{t('archivePage.certificates.lead')}</p>

              {loadingTemplate ? <QuietLoadingInline label={t('archivePage.certificates.loadingTemplate')} compact /> : null}
              {templateError ? <p className="form-error">{templateError}</p> : null}
              {templateNotice ? <p className="form-success">{templateNotice}</p> : null}

              {certificateTemplate ? (
                <>
                  <div className="profile-settings-fields two-col">
                    <label className="field">
                      <span>{t('archivePage.certificates.form.name')}</span>
                      <input
                        value={certificateTemplate.name}
                        onChange={(event) =>
                          setCertificateTemplate((current) =>
                            current ? { ...current, name: event.target.value } : current,
                          )
                        }
                      />
                    </label>
                    <label className="field">
                      <span>{t('archivePage.certificates.form.accentColor')}</span>
                      <input
                        type="color"
                        value={certificateTemplate.accentColor}
                        onChange={(event) =>
                          setCertificateTemplate((current) =>
                            current ? { ...current, accentColor: event.target.value } : current,
                          )
                        }
                      />
                    </label>
                    <label className="field">
                      <span>{t('archivePage.certificates.form.title')}</span>
                      <input
                        value={certificateTemplate.title}
                        onChange={(event) =>
                          setCertificateTemplate((current) =>
                            current ? { ...current, title: event.target.value } : current,
                          )
                        }
                      />
                    </label>
                    <label className="field">
                      <span>{t('archivePage.certificates.form.subtitle')}</span>
                      <input
                        value={certificateTemplate.subtitle}
                        onChange={(event) =>
                          setCertificateTemplate((current) =>
                            current ? { ...current, subtitle: event.target.value } : current,
                          )
                        }
                      />
                    </label>
                    <label className="field field-full">
                      <span>{t('archivePage.certificates.form.body')}</span>
                      <textarea
                        className="textarea-input"
                        rows={4}
                        value={certificateTemplate.body}
                        onChange={(event) =>
                          setCertificateTemplate((current) =>
                            current ? { ...current, body: event.target.value } : current,
                          )
                        }
                      />
                    </label>
                    <label className="field field-full">
                      <span>{t('archivePage.certificates.form.footer')}</span>
                      <input
                        value={certificateTemplate.footer}
                        onChange={(event) =>
                          setCertificateTemplate((current) =>
                            current ? { ...current, footer: event.target.value } : current,
                          )
                        }
                      />
                    </label>
                    <label className="field">
                      <span>{t('archivePage.certificates.form.signerName')}</span>
                      <input
                        value={certificateTemplate.signerName}
                        onChange={(event) =>
                          setCertificateTemplate((current) =>
                            current ? { ...current, signerName: event.target.value } : current,
                          )
                        }
                      />
                    </label>
                    <label className="field">
                      <span>{t('archivePage.certificates.form.signerRole')}</span>
                      <input
                        value={certificateTemplate.signerRole}
                        onChange={(event) =>
                          setCertificateTemplate((current) =>
                            current ? { ...current, signerRole: event.target.value } : current,
                          )
                        }
                      />
                    </label>
                  </div>

                  <div className="state-callout subtle">
                    <strong>{t('archivePage.certificates.placeholdersTitle')}</strong>
                    <p>{t('archivePage.certificates.placeholdersLead')}</p>
                    <p className="inline-hint">
                      {'{{teamName}}, {{tournamentTitle}}, {{issuedAt}}, {{rank}}, {{totalScore}}, {{kindLabel}}, {{kindDescription}}'}
                    </p>
                  </div>

                    <div className="status-actions">
                      <button
                        type="button"
                        className="button tournaments-card-action tournaments-card-action--purple"
                        disabled={savingTemplate}
                        onClick={() => void saveCertificateTemplate()}
                      >
                      {savingTemplate
                        ? t('archivePage.certificates.saving')
                        : t('archivePage.certificates.save')}
                    </button>
                  </div>
                </>
              ) : null}
            </article>
          ) : null}

          {archive.leaderboard ? (
            <article id="archive-results" className="card panel-card">
              <h2>{t('archivePage.resultsTitle')}</h2>
              <div className="leaderboard-scoring">
                <p>
                  <strong>{t('archivePage.scoreScale')}:</strong> {archive.leaderboard.scoring.scale}
                </p>
                <p>
                  <strong>{t('archivePage.totalFormula')}:</strong>{' '}
                  {formatScoringFormula(archive.leaderboard.scoring.totalFormula, t)}
                </p>
              </div>

              <div className="leaderboard-grid">
                {archive.leaderboard.rows.map((row) => (
                  <article
                    key={row.teamId}
                    className={`leaderboard-row-card${row.rank === 1 ? ' leader-card' : ''}`}
                  >
                    <div className="leaderboard-row-head">
                      <strong>
                        #{row.rank} {row.teamName}
                      </strong>
                      <span>{row.organization || t('archivePage.noOrganization')}</span>
                    </div>

                    <div className="leaderboard-metrics">
                      <div className="leaderboard-metric">
                        <span>{t('archivePage.totalScore')}</span>
                        <strong>{formatScore(row.totalScore)}</strong>
                      </div>
                      <div className="leaderboard-metric">
                        <span>{t('archivePage.averageScore')}</span>
                        <strong>{formatScore(row.averageScore)}</strong>
                      </div>
                      <div className="leaderboard-metric">
                        <span>{t('archivePage.evaluationsCount')}</span>
                        <strong>{row.evaluationsCount}</strong>
                      </div>
                    </div>

                    <div className="leaderboard-category-grid">
                      {CATEGORY_KEYS.map((key) => (
                        <div key={`${row.teamId}-${key}`} className="leaderboard-category-item">
                          <span>{t(`archivePage.categories.${key}`)}</span>
                          <strong>{formatScore(row.categoryAverages[key])}</strong>
                        </div>
                      ))}
                    </div>
                  </article>
                ))}
              </div>
            </article>
          ) : null}

          <article id="archive-rounds" className="card panel-card">
            <h2>{t('archivePage.teamsTitle')}</h2>
            <div className="leaderboard-grid">
              {archive.teams.map((team) => (
                <article key={team.id} className="leaderboard-row-card">
                  <div className="leaderboard-row-head">
                    <strong>{team.rank ? `#${team.rank} ` : ''}{team.name}</strong>
                    <span>{team.organization || t('archivePage.noOrganization')}</span>
                  </div>
                  <div className="leaderboard-metrics">
                    <div className="leaderboard-metric">
                      <span>{t('archivePage.membersCount')}</span>
                      <strong>{team.membersCount}</strong>
                    </div>
                    <div className="leaderboard-metric">
                      <span>{t('archivePage.submissionsCount')}</span>
                      <strong>{team.submissionsCount}</strong>
                    </div>
                    <div className="leaderboard-metric">
                      <span>{t('archivePage.totalScore')}</span>
                      <strong>{formatScore(team.totalScore)}</strong>
                    </div>
                  </div>

                  {isManager ? (
                      <div className="status-actions">
                        <Link
                          to={`/app/certificates?tournamentId=${archive.tournament.id}&teamId=${team.id}&kind=participation`}
                          className="button tournaments-card-action tournaments-card-action--secondary"
                        >
                          {t('archivePage.certificates.participation')}
                        </Link>
                        {team.rank === 1 ? (
                          <Link
                            to={`/app/certificates?tournamentId=${archive.tournament.id}&teamId=${team.id}&kind=winner`}
                            className="button tournaments-card-action tournaments-card-action--purple"
                          >
                            {t('archivePage.certificates.winner')}
                          </Link>
                        ) : null}
                      </div>
                  ) : null}
                </article>
              ))}
            </div>
          </article>

          <article className="card panel-card">
            <h2>{t('archivePage.roundsTitle')}</h2>
            <div className="archive-section-stack">
                {archive.rounds.map((round) => (
                  <article key={round.id} className="archive-round-card">
                    <div className="leaderboard-row-head">
                      <strong>
                        {formatArchiveRoundTitle(round.title, round.sequence, t)}
                      </strong>
                      <span>{t(`profile.status.${round.status}`)}</span>
                    </div>

                  <div className="meta-grid">
                    <div>
                      <dt>{t('archivePage.startsAt')}</dt>
                      <dd>{formatDateTime(round.startsAt, language)}</dd>
                    </div>
                    <div>
                      <dt>{t('archivePage.deadlineAt')}</dt>
                      <dd>{formatDateTime(round.deadlineAt, language)}</dd>
                    </div>
                    <div>
                      <dt>{t('archivePage.submissionsCount')}</dt>
                      <dd>{round.submissionsCount}</dd>
                    </div>
                    <div>
                      <dt>{t('archivePage.averageScore')}</dt>
                      <dd>{formatScore(round.averageScore)}</dd>
                    </div>
                  </div>

                    <p className="inline-hint">{formatArchiveRoundDescription(round.description, t)}</p>

                  {round.submissions.length === 0 ? (
                    <p className="archive-empty-note state-callout subtle">{t('archivePage.noSubmissions')}</p>
                  ) : (
                    <div className="archive-submissions-grid">
                      {round.submissions.map((submission) => (
                        <article key={submission.id} className="leaderboard-row-card">
                          <div className="leaderboard-row-head">
                            <strong>{submission.teamName}</strong>
                            <span>{submission.organization || t('archivePage.noOrganization')}</span>
                          </div>

                          <div className="leaderboard-metrics">
                            <div className="leaderboard-metric">
                              <span>{t('archivePage.submissionStatus')}</span>
                              <strong>{t(`profile.submission.${submission.status}`)}</strong>
                            </div>
                            <div className="leaderboard-metric">
                              <span>{t('archivePage.evaluationsCount')}</span>
                              <strong>{submission.evaluationsCount}</strong>
                            </div>
                            <div className="leaderboard-metric">
                              <span>{t('archivePage.averageScore')}</span>
                              <strong>{formatScore(submission.averageScore)}</strong>
                            </div>
                          </div>

                          <div className="leaderboard-category-grid">
                            {CATEGORY_KEYS.map((key) => (
                              <div
                                key={`${submission.id}-${key}`}
                                className="leaderboard-category-item"
                              >
                                <span>{t(`archivePage.categories.${key}`)}</span>
                                <strong>{formatScore(submission.categoryAverages[key])}</strong>
                              </div>
                            ))}
                          </div>

                          {submission.shortSummary ? (
                            <p className="inline-hint">{submission.shortSummary}</p>
                          ) : null}

                          <div className="archive-link-list">
                            <a href={submission.repoUrl} target="_blank" rel="noreferrer">
                              {t('archivePage.links.repository')}
                            </a>
                            <a href={submission.demoUrl} target="_blank" rel="noreferrer">
                              {t('archivePage.links.demo')}
                            </a>
                            {submission.liveDemoUrl ? (
                              <a href={submission.liveDemoUrl} target="_blank" rel="noreferrer">
                                {t('archivePage.links.liveDemo')}
                              </a>
                            ) : null}
                          </div>

                          <p className="archive-empty-note">
                            {t('archivePage.submittedAt')}:{' '}
                            {submission.submittedAt
                              ? formatDateTime(submission.submittedAt, language)
                              : '-'}
                          </p>
                        </article>
                      ))}
                    </div>
                  )}
                </article>
              ))}
            </div>
          </article>
        </>
      ) : null}
    </section>
  );
}
