import { useEffect, useMemo, useState } from 'react';
import { useI18n } from '../i18n/I18nProvider';
import { apiRequest } from '../lib/api';

type ErrorReport = {
  id: string;
  requestId: string;
  method: string;
  path: string;
  statusCode: number;
  message: string;
  stack: string | null;
  userId: string | null;
  userRole: 'ADMIN' | 'TEAM' | 'JURY' | 'ORGANIZER' | null;
  userEmail: string | null;
  createdAt: string;
};

type MonitoringGoogleSheetsSettings = {
  isConfigured: boolean;
  lastExportAt: string | null;
  lastExportStatus: string | null;
};

type MonitoringEmailSettings = {
  enabled: boolean;
  isConfigured: boolean;
  lastCheckedAt: string | null;
  lastCheckStatus: string | null;
};

function formatDateTime(value: string | null, language: 'uk' | 'en', fallback: string) {
  if (!value) {
    return fallback;
  }

  return new Date(value).toLocaleString(language === 'uk' ? 'uk-UA' : 'en-US');
}

function statusAccent(statusCode: number) {
  if (statusCode >= 500) {
    return 'danger';
  }

  if (statusCode >= 400) {
    return 'warning';
  }

  return 'success';
}

export default function MonitoringPage() {
  const { language, t } = useI18n();
  const [reports, setReports] = useState<ErrorReport[]>([]);
  const [googleSheets, setGoogleSheets] = useState<MonitoringGoogleSheetsSettings | null>(null);
  const [emailSettings, setEmailSettings] = useState<MonitoringEmailSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  async function loadMonitoring(options?: { keepContent?: boolean }) {
    const keepContent = options?.keepContent ?? false;
    if (keepContent) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }
    setError('');

    try {
      const [reportData, googleData, emailData] = await Promise.all([
        apiRequest<ErrorReport[]>('/admin/error-reports?limit=25'),
        apiRequest<MonitoringGoogleSheetsSettings>('/admin/system-integrations/google-sheets'),
        apiRequest<MonitoringEmailSettings>('/admin/system-integrations/email'),
      ]);

      setReports(Array.isArray(reportData) ? reportData : []);
      setGoogleSheets(googleData);
      setEmailSettings(emailData);
    } catch (requestError) {
      setError(
        requestError instanceof Error ? requestError.message : t('monitoring.loadFailed'),
      );
      if (!keepContent) {
        setReports([]);
        setGoogleSheets(null);
        setEmailSettings(null);
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => {
    void loadMonitoring();
  }, []);

  const recentFailures = reports.length;
  const latestIncident = reports[0] ?? null;
  const userVisibleIncidents = reports.filter((item) =>
    item.path.startsWith('/auth') ||
    item.path.startsWith('/tournaments') ||
    item.path.startsWith('/rounds') ||
    item.path.startsWith('/messages'),
  ).length;

  const workspaceCards = useMemo(
    () => [
      {
        id: 'failures',
        eyebrow: t('monitoring.workspaceCards.failuresLabel'),
        title: String(recentFailures),
        lead: t('monitoring.workspaceCards.failuresLead'),
        status: latestIncident
          ? formatDateTime(latestIncident.createdAt, language, t('monitoring.none'))
          : t('monitoring.none'),
      },
      {
        id: 'google',
        eyebrow: t('monitoring.workspaceCards.googleLabel'),
        title:
          googleSheets?.isConfigured
            ? t('monitoring.workspaceCards.googleConfigured')
            : t('monitoring.workspaceCards.googlePending'),
        lead: t('monitoring.workspaceCards.googleLead'),
        status: googleSheets?.lastExportStatus ?? t('monitoring.unknown'),
      },
      {
        id: 'email',
        eyebrow: t('monitoring.workspaceCards.emailLabel'),
        title:
          emailSettings?.enabled && emailSettings.isConfigured
            ? t('monitoring.workspaceCards.emailActive')
            : t('monitoring.workspaceCards.emailPending'),
        lead: t('monitoring.workspaceCards.emailLead'),
        status: emailSettings?.lastCheckStatus ?? t('monitoring.unknown'),
      },
      {
        id: 'surface',
        eyebrow: t('monitoring.workspaceCards.surfaceLabel'),
        title: String(userVisibleIncidents),
        lead: t('monitoring.workspaceCards.surfaceLead'),
        status: t('monitoring.workspaceCards.surfaceStatus'),
      },
    ],
    [
      emailSettings?.enabled,
      emailSettings?.isConfigured,
      emailSettings?.lastCheckStatus,
      googleSheets?.isConfigured,
      googleSheets?.lastExportStatus,
      language,
      latestIncident,
      recentFailures,
      t,
      userVisibleIncidents,
    ],
  );
  const errorCountLabel = `${recentFailures} ${t('monitoring.errorCountSuffix')}`;

  if (loading) {
    return <article className="card state-card">{t('monitoring.loading')}</article>;
  }

  if (!googleSheets || !emailSettings) {
    return (
      <article className="card state-card">
        <p className="form-error">{error || t('monitoring.loadFailed')}</p>
        <button type="button" className="button button-soft" onClick={() => void loadMonitoring()}>
          {t('monitoring.retry')}
        </button>
      </article>
    );
  }

  return (
    <section className="team-dashboard">
      <header className="section-header">
        <p className="eyebrow">{t('monitoring.eyebrow')}</p>
        <h1>{t('monitoring.title')}</h1>
        <p className="lead">{t('monitoring.lead')}</p>
      </header>

      <article className="card panel-card monitoring-workspace-card">
        <div className="integrations-workspace-head">
          <div className="integrations-workspace-copy">
            <p className="eyebrow dashboard-workspace-eyebrow">
              {t('monitoring.workspaceEyebrow')}
            </p>
            <h2>{t('monitoring.workspaceTitle')}</h2>
            <p>{t('monitoring.workspaceLead')}</p>
          </div>
          <div className="dashboard-workspace-status integrations-workspace-status">
            <span>{t('monitoring.workspaceStatusLabel')}</span>
            <strong>{recentFailures}</strong>
            <p>{t('monitoring.workspaceStatusLead')}</p>
          </div>
        </div>

        <div className="dashboard-toolset-grid monitoring-toolset-grid">
          {workspaceCards.map((card) => (
            <article key={card.id} className="dashboard-tool-card">
              <span>{card.eyebrow}</span>
              <strong>{card.title}</strong>
              <p>{card.lead}</p>
              <em>{card.status}</em>
            </article>
          ))}
        </div>
      </article>

      <article className="card panel-card">
        <div className="tournament-head">
          <h2>{t('monitoring.operationalStatusTitle')}</h2>
          <button
            type="button"
            className="button button-soft"
            onClick={() => void loadMonitoring({ keepContent: true })}
            disabled={refreshing}
          >
            {refreshing ? t('monitoring.refreshing') : t('monitoring.refresh')}
          </button>
        </div>

        <div className="meta-grid">
          <div>
            <dt>{t('monitoring.googleSheets')}</dt>
            <dd>
              {googleSheets.isConfigured
                ? t('monitoring.configured')
                : t('monitoring.notConfigured')}
            </dd>
          </div>
          <div>
            <dt>{t('monitoring.lastGoogleExport')}</dt>
            <dd>
              {formatDateTime(
                googleSheets.lastExportAt,
                language,
                t('monitoring.notAvailable'),
              )}
            </dd>
          </div>
          <div>
            <dt>{t('monitoring.emailDelivery')}</dt>
            <dd>
              {emailSettings.enabled && emailSettings.isConfigured
                ? t('monitoring.active')
                : t('monitoring.incomplete')}
            </dd>
          </div>
          <div>
            <dt>{t('monitoring.lastEmailCheck')}</dt>
            <dd>
              {formatDateTime(
                emailSettings.lastCheckedAt,
                language,
                t('monitoring.notAvailable'),
              )}
            </dd>
          </div>
        </div>

        {error ? <p className="form-error">{error}</p> : null}
      </article>

      <article className="card panel-card">
        <div className="tournament-head">
          <h2>{t('monitoring.errorReportsTitle')}</h2>
          <span className={`status-pill${recentFailures > 0 ? '' : ' active'}`}>
            {recentFailures > 0 ? errorCountLabel : t('monitoring.noErrors')}
          </span>
        </div>
        <p className="inline-hint">{t('monitoring.errorReportsLead')}</p>

        {reports.length === 0 ? (
          <div className="state-callout subtle">
            <strong>{t('monitoring.noErrors')}</strong>
            <p>{t('monitoring.noErrorsLead')}</p>
          </div>
        ) : (
          <div className="monitoring-report-list">
            {reports.map((report) => (
              <article key={report.id} className="monitoring-report-card">
                <div className="monitoring-report-head">
                  <div>
                    <strong>{report.message}</strong>
                    <p>
                      {report.method} {report.path}
                    </p>
                  </div>
                  <span className={`status-pill monitoring-status-${statusAccent(report.statusCode)}`}>
                    {report.statusCode}
                  </span>
                </div>

                <div className="meta-grid">
                  <div>
                    <dt>{t('monitoring.requestId')}</dt>
                    <dd>{report.requestId}</dd>
                  </div>
                  <div>
                    <dt>{t('monitoring.createdAt')}</dt>
                    <dd>{formatDateTime(report.createdAt, language, t('monitoring.notAvailable'))}</dd>
                  </div>
                  <div>
                    <dt>{t('monitoring.user')}</dt>
                    <dd>{report.userEmail || report.userId || t('monitoring.anonymous')}</dd>
                  </div>
                  <div>
                    <dt>{t('monitoring.role')}</dt>
                    <dd>{report.userRole || t('monitoring.unknown')}</dd>
                  </div>
                </div>

                {report.stack ? (
                  <details className="monitoring-stack">
                    <summary>{t('monitoring.stackTrace')}</summary>
                    <pre>{report.stack}</pre>
                  </details>
                ) : null}
              </article>
            ))}
          </div>
        )}
      </article>
    </section>
  );
}
