import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import QuietLoadingCard from '../components/QuietLoadingCard';
import QuietLoadingInline from '../components/QuietLoadingInline';
import { useI18n } from '../i18n/I18nProvider';
import { getAuthRole, isAuthenticated } from '../lib/auth';
import { apiRequest, buildApiUrl } from '../lib/api';
import { normalizeApiErrorMessage } from '../lib/errorMessages';
import { useAutoDismissMessage } from '../lib/useAutoDismissMessage';
import {
  rememberTournamentSelection,
  resolveStoredTournamentSelection,
} from '../lib/tournamentSelection';

type TournamentStatus = 'DRAFT' | 'REGISTRATION' | 'RUNNING' | 'FINISHED';

type Tournament = {
  id: string;
  title: string;
  status: TournamentStatus;
};

type LeaderboardRowRound = {
  roundId: string;
  roundTitle: string;
  evaluationsCount: number;
  averageScore: number;
};

type CategoryAverages = {
  technicalBackend: number;
  technicalDatabase: number;
  technicalFrontend: number;
  mustHave: number;
  stability: number;
  usability: number;
};

type LeaderboardRow = {
  rank: number;
  teamId: string;
  teamName: string;
  organization: string | null;
  totalScore: number;
  averageScore: number;
  evaluationsCount: number;
  categoryAverages: CategoryAverages;
  rounds: LeaderboardRowRound[];
};

type LeaderboardResponse = {
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
  rows: LeaderboardRow[];
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
      return t('leaderboard.formulaDescriptions.total');
    case 'average(juryEvaluationTotals)':
      return t('leaderboard.formulaDescriptions.round');
    case 'average(6 category scores)':
      return t('leaderboard.formulaDescriptions.evaluation');
    default:
      return formula;
  }
}

export default function LeaderboardPage() {
  const { language, t } = useI18n();
  const [searchParams, setSearchParams] = useSearchParams();
  const [initialTournamentId] = useState(() => searchParams.get('tournamentId') ?? '');
  const isManager = isAuthenticated() && ['ADMIN', 'ORGANIZER'].includes(getAuthRole() ?? '');

  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [selectedTournamentId, setSelectedTournamentId] = useState('');
  const [leaderboard, setLeaderboard] = useState<LeaderboardResponse | null>(null);

  const [loadingTournaments, setLoadingTournaments] = useState(true);
  const [loadingLeaderboard, setLoadingLeaderboard] = useState(false);
  const [tournamentsError, setTournamentsError] = useState('');
  const [leaderboardError, setLeaderboardError] = useState('');
  const [lastUpdatedAt, setLastUpdatedAt] = useState('');
  const [isExportingGoogleSheets, setIsExportingGoogleSheets] = useState(false);
  const [googleSheetsNotice, setGoogleSheetsNotice] = useState('');
  const [googleSheetsError, setGoogleSheetsError] = useState('');

  useAutoDismissMessage(googleSheetsNotice, setGoogleSheetsNotice);

  function resolveSheetsUrl(response: GoogleSheetsExportResponse['response']) {
    if (!response || typeof response === 'string') {
      return '';
    }

    return response.spreadsheetUrl ?? response.url ?? '';
  }

  const selectedTournament = useMemo(
    () => tournaments.find((entry) => entry.id === selectedTournamentId) ?? null,
    [selectedTournamentId, tournaments],
  );
  const isRealtimeEnabled = selectedTournament?.status === 'RUNNING';
  const leaderRow = leaderboard?.rows[0] ?? null;
  const totalEvaluations = leaderboard?.rows.reduce((acc, row) => acc + row.evaluationsCount, 0) ?? 0;

  function resolveDefaultTournamentId(list: Tournament[]) {
    if (initialTournamentId && list.some((entry) => entry.id === initialTournamentId)) {
      return initialTournamentId;
    }

    const running = list.find((entry) => entry.status === 'RUNNING');
    const finished = list.find((entry) => entry.status === 'FINISHED');
    const fallbackId = running?.id ?? finished?.id ?? list[0].id;

    return resolveStoredTournamentSelection(list, fallbackId);
  }

  async function loadTournaments() {
    setLoadingTournaments(true);
    setTournamentsError('');
    setLeaderboardError('');

    try {
      const data = await apiRequest<Tournament[]>('/tournaments');
      setTournaments(data);

      if (data.length === 0) {
        setSelectedTournamentId('');
        setLeaderboard(null);
        return;
      }

      setSelectedTournamentId((current) => {
        if (current && data.some((entry) => entry.id === current)) {
          return current;
        }

        return resolveDefaultTournamentId(data);
      });
    } catch (requestError) {
      setTournamentsError(
        normalizeApiErrorMessage(requestError, t, t('leaderboard.loadTournamentsFailed')),
      );
      setTournaments([]);
      setSelectedTournamentId('');
      setLeaderboard(null);
    } finally {
      setLoadingTournaments(false);
    }
  }

  async function loadLeaderboard(tournamentId: string, showLoading = true) {
    if (showLoading) {
      setLoadingLeaderboard(true);
    }
    setLeaderboardError('');

    try {
      const data = await apiRequest<LeaderboardResponse>(
        `/tournaments/${tournamentId}/leaderboard`,
      );
      setLeaderboard(data);
      setLastUpdatedAt(new Date().toISOString());
    } catch (requestError) {
      setLeaderboardError(
        normalizeApiErrorMessage(requestError, t, t('leaderboard.loadLeaderboardFailed')),
      );
      setLeaderboard(null);
    } finally {
      if (showLoading) {
        setLoadingLeaderboard(false);
      }
    }
  }

  async function exportGoogleSheets() {
    if (!selectedTournamentId) {
      return;
    }

    setIsExportingGoogleSheets(true);
    setGoogleSheetsNotice('');
    setGoogleSheetsError('');

    try {
      const result = await apiRequest<GoogleSheetsExportResponse>(
        `/tournaments/${selectedTournamentId}/leaderboard/export.google-sheets`,
        {
          method: 'POST',
          body: {},
        },
      );
      const sheetUrl = resolveSheetsUrl(result.response);
      setGoogleSheetsNotice(
        sheetUrl ? t('leaderboard.exportGoogleSheetsSuccessWithLink') : t('leaderboard.exportGoogleSheetsSuccess'),
      );
      if (sheetUrl) {
        window.open(sheetUrl, '_blank', 'noopener,noreferrer');
      }
    } catch (requestError) {
      setGoogleSheetsError(
        normalizeApiErrorMessage(requestError, t, t('leaderboard.exportGoogleSheetsFailed')),
      );
    } finally {
      setIsExportingGoogleSheets(false);
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
    void loadLeaderboard(selectedTournamentId);
  }, [selectedTournamentId, setSearchParams]);

  useEffect(() => {
    if (!selectedTournamentId || !isRealtimeEnabled) {
      return;
    }

    let cancelled = false;
    const intervalId = window.setInterval(() => {
      if (cancelled || document.hidden) {
        return;
      }

      void loadLeaderboard(selectedTournamentId, false);
    }, 30000);

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
    };
  }, [isRealtimeEnabled, selectedTournamentId]);

  if (loadingTournaments) {
    return <QuietLoadingCard label={t('leaderboard.loadingTournaments')} />;
  }

  if (tournamentsError) {
    return (
      <article className="card state-card">
        <p className="form-error">{tournamentsError}</p>
        <button type="button" className="button button-soft" onClick={loadTournaments}>
          {t('leaderboard.retry')}
        </button>
      </article>
    );
  }

  if (tournaments.length === 0) {
    return <article className="card state-card">{t('leaderboard.emptyTournaments')}</article>;
  }

  return (
    <section className="team-dashboard">
      <header className="section-header">
        <p className="eyebrow">{t('leaderboard.eyebrow')}</p>
        <h1>{t('leaderboard.title')}</h1>
        <p className="lead">{t('leaderboard.lead')}</p>
      </header>

      <article className="card panel-card leaderboard-workspace-card">
        <div className="leaderboard-workspace-head">
          <div className="leaderboard-workspace-copy">
            <p className="eyebrow dashboard-workspace-eyebrow">
              {t('leaderboard.workspaceEyebrow')}
            </p>
            <h2>{t('leaderboard.workspaceTitle')}</h2>
            <p>{t('leaderboard.workspaceLead')}</p>
          </div>
          <div className="dashboard-workspace-status leaderboard-workspace-status">
            <span>{t('leaderboard.workspaceStatusLabel')}</span>
            <strong>{leaderboard?.rows.length ?? 0}</strong>
            <p>{t('leaderboard.workspaceStatusLead')}</p>
          </div>
        </div>

        <div className="dashboard-toolset-grid leaderboard-toolset-grid">
          <button
            type="button"
            className="dashboard-tool-card dashboard-tool-card--teal dashboard-tool-button"
            onClick={() =>
              document
                .getElementById('leaderboard-summary')
                ?.scrollIntoView({ behavior: 'smooth', block: 'start' })
            }
          >
            <span>{t('leaderboard.summaryTitle')}</span>
            <strong>{t('leaderboard.workspaceCards.summaryTitle')}</strong>
            <p>{t('leaderboard.workspaceCards.summaryLead')}</p>
            <em>{selectedTournament ? t(`tournaments.status.${selectedTournament.status}`) : '-'}</em>
          </button>
          <button
            type="button"
            className="dashboard-tool-card dashboard-tool-card--purple dashboard-tool-button"
            onClick={() =>
              document
                .getElementById('leaderboard-results')
                ?.scrollIntoView({ behavior: 'smooth', block: 'start' })
            }
          >
            <span>{t('leaderboard.resultsTitle')}</span>
            <strong>{t('leaderboard.workspaceCards.resultsTitle')}</strong>
            <p>{t('leaderboard.workspaceCards.resultsLead')}</p>
            <em>{leaderRow ? `#1 ${leaderRow.teamName}` : t('leaderboard.workspaceCards.noLeader')}</em>
          </button>
          <button
            type="button"
            className="dashboard-tool-card dashboard-tool-card--orange dashboard-tool-button"
            onClick={() => void loadLeaderboard(selectedTournamentId)}
            disabled={!selectedTournamentId}
          >
            <span>{t('leaderboard.workspaceCards.syncLabel')}</span>
            <strong>{t('leaderboard.workspaceCards.syncTitle')}</strong>
            <p>{t('leaderboard.workspaceCards.syncLead')}</p>
            <em>
              {lastUpdatedAt
                ? new Date(lastUpdatedAt).toLocaleTimeString(
                    language === 'uk' ? 'uk-UA' : 'en-US',
                    {
                      hour: '2-digit',
                      minute: '2-digit',
                    },
                  )
                : t('leaderboard.workspaceCards.syncEmpty')}
            </em>
          </button>
          {selectedTournamentId ? (
            <a
              href={buildApiUrl(
                `/tournaments/${selectedTournamentId}/leaderboard/export.csv`,
              )}
              className="dashboard-tool-card dashboard-tool-card--berry"
            >
              <span>{t('leaderboard.exportCsv')}</span>
              <strong>{t('leaderboard.workspaceCards.exportTitle')}</strong>
              <p>{t('leaderboard.workspaceCards.exportLead')}</p>
              <em>{t('leaderboard.workspaceCards.exportHint')}</em>
            </a>
          ) : null}
        </div>
      </article>

      {leaderboard ? (
        <article id="leaderboard-summary" className="card panel-card leaderboard-summary-panel">
          <h2>{t('leaderboard.summaryTitle')}</h2>
          <div className="summary-grid">
            <div className="summary-card">
              <span>{t('leaderboard.summary.tournament')}</span>
              <strong>{leaderboard.tournament.title}</strong>
              <p>{t(`tournaments.status.${leaderboard.tournament.status}`)}</p>
            </div>
            <div className="summary-card">
              <span>{t('leaderboard.summary.leader')}</span>
              <strong>{leaderRow ? leaderRow.teamName : '-'}</strong>
              <p>{leaderRow ? `${t('leaderboard.totalScore')}: ${formatScore(leaderRow.totalScore)}` : '-'}</p>
            </div>
            <div className="summary-card">
              <span>{t('leaderboard.summary.teams')}</span>
              <strong>{leaderboard.rows.length}</strong>
              <p>{t('leaderboard.summary.evaluations')}: {totalEvaluations}</p>
            </div>
            <div className="summary-card">
              <span>{t('leaderboard.summary.formula')}</span>
              <strong>{leaderboard.scoring.scale}</strong>
              <p>{formatScoringFormula(leaderboard.scoring.totalFormula, t)}</p>
            </div>
          </div>

          <div className="state-callout subtle">
            <strong>{t('leaderboard.summary.noteTitle')}</strong>
            <p>
              {leaderboard.tournament.status === 'FINISHED'
                ? t('leaderboard.summary.finishedNote')
                : t('leaderboard.summary.liveNote')}
            </p>
          </div>
        </article>
      ) : null}

      <article className="card panel-card leaderboard-selector-panel">
        <label className="field admin-tournament-picker" htmlFor="leaderboard-tournament-select">
          <span className="leaderboard-selector-head">
            <span>{t('leaderboard.tournamentLabel')}</span>
            <span className="leaderboard-selector-status">
              <span>{t('leaderboard.tournamentStatus')}</span>
              <strong>
                {selectedTournament ? t(`tournaments.status.${selectedTournament.status}`) : '-'}
              </strong>
            </span>
          </span>
          <select
            id="leaderboard-tournament-select"
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
      </article>

      <article id="leaderboard-results" className="card panel-card leaderboard-results-panel">
        <div className="messages-controls">
          <div className="messages-controls-text">
            <h2>{t('leaderboard.resultsTitle')}</h2>
            <p className="inline-hint">
              {isRealtimeEnabled
                ? t('leaderboard.realtimeActive')
                : t('leaderboard.realtimePaused')}
              {lastUpdatedAt
                ? ` ${t('leaderboard.lastUpdated')}: ${new Date(lastUpdatedAt).toLocaleTimeString(language === 'uk' ? 'uk-UA' : 'en-US', {
                    hour: '2-digit',
                    minute: '2-digit',
                  })}`
                : ''}
            </p>
          </div>
          {selectedTournamentId ? (
            <div className="status-actions">
              <a
                href={buildApiUrl(
                  `/tournaments/${selectedTournamentId}/leaderboard/export.csv`,
                )}
                className="button button-soft announcement-action-btn"
              >
                {t('leaderboard.exportCsv')}
              </a>
              {isManager ? (
                <button
                  type="button"
                  className="button button-soft announcement-action-btn announcement-action-btn--wide"
                  onClick={() => void exportGoogleSheets()}
                  disabled={isExportingGoogleSheets}
                >
                  {isExportingGoogleSheets
                    ? t('leaderboard.exportGoogleSheetsSubmitting')
                    : t('leaderboard.exportGoogleSheets')}
                </button>
              ) : null}
            </div>
          ) : null}
        </div>

        {googleSheetsNotice ? <p className="form-success">{googleSheetsNotice}</p> : null}
        {googleSheetsError ? <p className="form-error">{googleSheetsError}</p> : null}

        {loadingLeaderboard ? <QuietLoadingInline label={t('leaderboard.loadingLeaderboard')} /> : null}

        {leaderboardError ? (
          <>
            <div className="state-callout featured">
              <strong>{t('leaderboard.resultsTitle')}</strong>
              <p>{leaderboardError}</p>
            </div>
            <button
              type="button"
              className="button button-soft"
              onClick={() => void loadLeaderboard(selectedTournamentId)}
            >
              {t('leaderboard.retry')}
            </button>
          </>
        ) : null}

        {!loadingLeaderboard && !leaderboardError && leaderboard ? (
          <>
            <div className="leaderboard-scoring">
              <p>
                <strong>{t('leaderboard.scoreScale')}:</strong> {leaderboard.scoring.scale}
              </p>
              <p>
                <strong>{t('leaderboard.totalFormula')}:</strong>{' '}
                {formatScoringFormula(leaderboard.scoring.totalFormula, t)}
              </p>
              <p>
                <strong>{t('leaderboard.roundFormula')}:</strong>{' '}
                {formatScoringFormula(leaderboard.scoring.roundFormula, t)}
              </p>
              <p>
                <strong>{t('leaderboard.evaluationFormula')}:</strong>{' '}
                {formatScoringFormula(leaderboard.scoring.evaluationFormula, t)}
              </p>
            </div>

            {leaderboard.rows.length === 0 ? (
              <div className="state-callout featured">
                <strong>{t('leaderboard.resultsTitle')}</strong>
                <p>{t('leaderboard.emptyRows')}</p>
              </div>
            ) : (
              <div className="leaderboard-grid">
                {leaderboard.rows.map((row) => (
                  <article
                    key={row.teamId}
                    className={`leaderboard-row-card${row.rank === 1 ? ' leader-card' : ''}`}
                  >
                    <div className="leaderboard-row-head">
                      <strong>
                        #{row.rank} {row.teamName}
                      </strong>
                      <span>{row.organization || t('leaderboard.noOrganization')}</span>
                    </div>

                    <div className="leaderboard-metrics">
                      <div className="leaderboard-metric">
                        <span>{t('leaderboard.totalScore')}</span>
                        <strong>{formatScore(row.totalScore)}</strong>
                      </div>
                      <div className="leaderboard-metric">
                        <span>{t('leaderboard.averageScore')}</span>
                        <strong>{formatScore(row.averageScore)}</strong>
                      </div>
                      <div className="leaderboard-metric">
                        <span>{t('leaderboard.evaluationsCount')}</span>
                        <strong>{row.evaluationsCount}</strong>
                      </div>
                    </div>

                    <h3>{t('leaderboard.categoriesTitle')}</h3>
                    <div className="leaderboard-category-grid">
                      {CATEGORY_KEYS.map((key) => (
                        <div key={`${row.teamId}-${key}`} className="leaderboard-category-item">
                          <span>{t(`leaderboard.categories.${key}`)}</span>
                          <strong>{formatScore(row.categoryAverages[key])}</strong>
                        </div>
                      ))}
                    </div>

                    <h3>{t('leaderboard.roundsTitle')}</h3>
                    {row.rounds.length === 0 ? (
                      <p className="inline-hint">{t('leaderboard.noRoundScores')}</p>
                    ) : (
                      <div className="leaderboard-rounds-list">
                        {row.rounds.map((round) => (
                          <div key={round.roundId} className="leaderboard-round-item">
                            <p>
                              <strong>{round.roundTitle}</strong>
                            </p>
                            <p>
                              {t('leaderboard.roundAverage')}: {formatScore(round.averageScore)}
                            </p>
                            <p>
                              {t('leaderboard.evaluationsCount')}: {round.evaluationsCount}
                            </p>
                          </div>
                        ))}
                      </div>
                    )}
                  </article>
                ))}
              </div>
            )}
          </>
        ) : null}
      </article>
    </section>
  );
}
