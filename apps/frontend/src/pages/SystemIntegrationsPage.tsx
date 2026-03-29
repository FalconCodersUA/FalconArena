import { useEffect, useState } from 'react';
import { useI18n } from '../i18n/I18nProvider';
import { apiRequest } from '../lib/api';

type GoogleSheetsSettingsResponse = {
  webhookUrl: string;
  secret: string;
  defaultSheetName: string;
  isConfigured: boolean;
  lastCheckedAt: string | null;
  lastCheckStatus: string | null;
  lastCheckMessage: string | null;
  source: 'database' | 'env' | 'none';
};

type GoogleSheetsTestResponse = {
  ok: boolean;
  status: string;
  message: string;
  checkedAt: string;
};

function trimToUndefined(value: string) {
  const normalized = value.trim();
  return normalized.length > 0 ? normalized : undefined;
}

export default function SystemIntegrationsPage() {
  const { language, t } = useI18n();
  const [settings, setSettings] = useState<GoogleSheetsSettingsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  async function loadSettings() {
    setLoading(true);
    setError('');

    try {
      const data = await apiRequest<GoogleSheetsSettingsResponse>(
        '/admin/system-integrations/google-sheets',
      );
      setSettings(data);
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : t('systemIntegrations.loadFailed'),
      );
      setSettings(null);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadSettings();
  }, []);

  async function saveSettings() {
    if (!settings) {
      return;
    }

    setSaving(true);
    setNotice('');
    setError('');

    try {
      const saved = await apiRequest<GoogleSheetsSettingsResponse>(
        '/admin/system-integrations/google-sheets',
        {
          method: 'PATCH',
          body: {
            webhookUrl: trimToUndefined(settings.webhookUrl),
            secret: trimToUndefined(settings.secret),
            defaultSheetName: trimToUndefined(settings.defaultSheetName),
          },
        },
      );
      setSettings(saved);
      setNotice(t('systemIntegrations.saved'));
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : t('systemIntegrations.saveFailed'),
      );
    } finally {
      setSaving(false);
    }
  }

  async function testConnection() {
    if (!settings) {
      return;
    }

    setTesting(true);
    setNotice('');
    setError('');

    try {
      const result = await apiRequest<GoogleSheetsTestResponse>(
        '/admin/system-integrations/google-sheets/test',
        {
          method: 'POST',
          body: {
            webhookUrl: trimToUndefined(settings.webhookUrl),
            secret: trimToUndefined(settings.secret),
            defaultSheetName: trimToUndefined(settings.defaultSheetName),
          },
        },
      );

      setSettings((current) =>
        current
          ? {
              ...current,
              lastCheckedAt: result.checkedAt,
              lastCheckStatus: result.status,
              lastCheckMessage: result.message,
            }
          : current,
      );
      setNotice(result.message);
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : t('systemIntegrations.testFailed'),
      );
    } finally {
      setTesting(false);
    }
  }

  if (loading) {
    return <article className="card state-card">{t('systemIntegrations.loading')}</article>;
  }

  if (!settings) {
    return (
      <article className="card state-card">
        <p className="form-error">{error || t('systemIntegrations.loadFailed')}</p>
        <button type="button" className="button button-soft" onClick={() => void loadSettings()}>
          {t('systemIntegrations.retry')}
        </button>
      </article>
    );
  }

  return (
    <section className="team-dashboard">
      <header className="section-header">
        <p className="eyebrow">{t('systemIntegrations.eyebrow')}</p>
        <h1>{t('systemIntegrations.title')}</h1>
        <p className="lead">{t('systemIntegrations.lead')}</p>
      </header>

      <article className="card panel-card">
        <div className="tournament-head">
          <h2>{t('systemIntegrations.googleSheets.title')}</h2>
          <span className={`status-pill${settings.isConfigured ? ' active' : ''}`}>
            {settings.isConfigured
              ? t('systemIntegrations.googleSheets.configured')
              : t('systemIntegrations.googleSheets.notConfigured')}
          </span>
        </div>

        <p className="inline-hint">{t('systemIntegrations.googleSheets.lead')}</p>
        <div className="state-callout subtle">
          <strong>{t(`systemIntegrations.googleSheets.sources.${settings.source}`)}</strong>
          <p>{t(`systemIntegrations.googleSheets.sourceHints.${settings.source}`)}</p>
        </div>

        <div className="meta-grid">
          <div>
            <dt>{t('systemIntegrations.googleSheets.source')}</dt>
            <dd>{t(`systemIntegrations.googleSheets.sources.${settings.source}`)}</dd>
          </div>
          <div>
            <dt>{t('systemIntegrations.googleSheets.lastCheck')}</dt>
            <dd>
              {settings.lastCheckedAt
                ? new Date(settings.lastCheckedAt).toLocaleString(
                    language === 'uk' ? 'uk-UA' : 'en-US',
                  )
                : t('systemIntegrations.googleSheets.notChecked')}
            </dd>
          </div>
          <div>
            <dt>{t('systemIntegrations.googleSheets.lastStatus')}</dt>
            <dd>{settings.lastCheckStatus || t('systemIntegrations.googleSheets.unknown')}</dd>
          </div>
        </div>

        {settings.lastCheckMessage ? (
          <div className="state-callout subtle">
            <strong>{t('systemIntegrations.googleSheets.connectionMessage')}</strong>
            <p>{settings.lastCheckMessage}</p>
          </div>
        ) : null}

        <div className="profile-settings-fields">
          <label className="field">
            <span>{t('systemIntegrations.googleSheets.form.webhookUrl')}</span>
            <input
              value={settings.webhookUrl}
              onChange={(event) =>
                setSettings((current) =>
                  current ? { ...current, webhookUrl: event.target.value } : current,
                )
              }
            />
          </label>
          <label className="field">
            <span>{t('systemIntegrations.googleSheets.form.secret')}</span>
            <input
              type="password"
              autoComplete="new-password"
              value={settings.secret}
              onChange={(event) =>
                setSettings((current) =>
                  current ? { ...current, secret: event.target.value } : current,
                )
              }
            />
          </label>
          <label className="field">
            <span>{t('systemIntegrations.googleSheets.form.defaultSheetName')}</span>
            <input
              value={settings.defaultSheetName}
              onChange={(event) =>
                setSettings((current) =>
                  current
                    ? { ...current, defaultSheetName: event.target.value }
                    : current,
                )
              }
            />
          </label>
        </div>

        <div className="status-actions">
          <button
            type="button"
            className="button button-soft"
            onClick={() => void testConnection()}
            disabled={testing}
          >
            {testing
              ? t('systemIntegrations.googleSheets.testing')
              : t('systemIntegrations.googleSheets.testConnection')}
          </button>
          <button
            type="button"
            className="button button-primary"
            onClick={() => void saveSettings()}
            disabled={saving}
          >
            {saving ? t('systemIntegrations.saving') : t('systemIntegrations.save')}
          </button>
        </div>

        {notice ? <p className="form-success">{notice}</p> : null}
        {error ? <p className="form-error">{error}</p> : null}
      </article>
    </section>
  );
}
