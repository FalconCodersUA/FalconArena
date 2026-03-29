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

type EmailSettingsResponse = {
  enabled: boolean;
  provider: 'console' | 'resend';
  from: string;
  replyTo: string;
  resendApiKey: string;
  isConfigured: boolean;
  lastCheckedAt: string | null;
  lastCheckStatus: string | null;
  lastCheckMessage: string | null;
  source: 'database' | 'env' | 'default';
};

type NotificationRulesResponse = {
  registrationStarted: boolean;
  roundStarted: boolean;
  submissionReceived: boolean;
  deadlineReminder: boolean;
  submissionClosed: boolean;
  source: 'database' | 'default';
};

function trimToUndefined(value: string) {
  const normalized = value.trim();
  return normalized.length > 0 ? normalized : undefined;
}

function formatDateTime(value: string | null, language: 'uk' | 'en', fallback: string) {
  if (!value) {
    return fallback;
  }

  return new Date(value).toLocaleString(language === 'uk' ? 'uk-UA' : 'en-US');
}

export default function SystemIntegrationsPage() {
  const { language, t } = useI18n();
  const [googleSheets, setGoogleSheets] = useState<GoogleSheetsSettingsResponse | null>(null);
  const [emailSettings, setEmailSettings] = useState<EmailSettingsResponse | null>(null);
  const [notificationRules, setNotificationRules] = useState<NotificationRulesResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [googleSaving, setGoogleSaving] = useState(false);
  const [googleTesting, setGoogleTesting] = useState(false);
  const [emailSaving, setEmailSaving] = useState(false);
  const [rulesSaving, setRulesSaving] = useState(false);
  const [googleError, setGoogleError] = useState('');
  const [googleNotice, setGoogleNotice] = useState('');
  const [emailError, setEmailError] = useState('');
  const [emailNotice, setEmailNotice] = useState('');
  const [rulesError, setRulesError] = useState('');
  const [rulesNotice, setRulesNotice] = useState('');

  async function loadSettings() {
    setLoading(true);
    setLoadError('');

    try {
      const [googleData, emailData, rulesData] = await Promise.all([
        apiRequest<GoogleSheetsSettingsResponse>('/admin/system-integrations/google-sheets'),
        apiRequest<EmailSettingsResponse>('/admin/system-integrations/email'),
        apiRequest<NotificationRulesResponse>('/admin/system-integrations/notification-rules'),
      ]);
      setGoogleSheets(googleData);
      setEmailSettings(emailData);
      setNotificationRules(rulesData);
    } catch (requestError) {
      setLoadError(
        requestError instanceof Error
          ? requestError.message
          : t('systemIntegrations.loadFailed'),
      );
      setGoogleSheets(null);
      setEmailSettings(null);
      setNotificationRules(null);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadSettings();
  }, []);

  async function saveGoogleSheets() {
    if (!googleSheets) {
      return;
    }

    setGoogleSaving(true);
    setGoogleNotice('');
    setGoogleError('');

    try {
      const saved = await apiRequest<GoogleSheetsSettingsResponse>(
        '/admin/system-integrations/google-sheets',
        {
          method: 'PATCH',
          body: {
            webhookUrl: trimToUndefined(googleSheets.webhookUrl),
            secret: trimToUndefined(googleSheets.secret),
            defaultSheetName: trimToUndefined(googleSheets.defaultSheetName),
          },
        },
      );
      setGoogleSheets(saved);
      setGoogleNotice(t('systemIntegrations.saved'));
    } catch (requestError) {
      setGoogleError(
        requestError instanceof Error
          ? requestError.message
          : t('systemIntegrations.saveFailed'),
      );
    } finally {
      setGoogleSaving(false);
    }
  }

  async function testGoogleSheetsConnection() {
    if (!googleSheets) {
      return;
    }

    setGoogleTesting(true);
    setGoogleNotice('');
    setGoogleError('');

    try {
      const result = await apiRequest<GoogleSheetsTestResponse>(
        '/admin/system-integrations/google-sheets/test',
        {
          method: 'POST',
          body: {
            webhookUrl: trimToUndefined(googleSheets.webhookUrl),
            secret: trimToUndefined(googleSheets.secret),
            defaultSheetName: trimToUndefined(googleSheets.defaultSheetName),
          },
        },
      );

      setGoogleSheets((current) =>
        current
          ? {
              ...current,
              lastCheckedAt: result.checkedAt,
              lastCheckStatus: result.status,
              lastCheckMessage: result.message,
            }
          : current,
      );
      setGoogleNotice(result.message);
    } catch (requestError) {
      setGoogleError(
        requestError instanceof Error
          ? requestError.message
          : t('systemIntegrations.testFailed'),
      );
    } finally {
      setGoogleTesting(false);
    }
  }

  async function saveEmailSettings() {
    if (!emailSettings) {
      return;
    }

    setEmailSaving(true);
    setEmailNotice('');
    setEmailError('');

    try {
      const saved = await apiRequest<EmailSettingsResponse>(
        '/admin/system-integrations/email',
        {
          method: 'PATCH',
          body: {
            enabled: emailSettings.enabled,
            provider: emailSettings.provider,
            from: trimToUndefined(emailSettings.from),
            replyTo: trimToUndefined(emailSettings.replyTo),
            resendApiKey: trimToUndefined(emailSettings.resendApiKey),
          },
        },
      );
      setEmailSettings(saved);
      setEmailNotice(t('systemIntegrations.saved'));
    } catch (requestError) {
      setEmailError(
        requestError instanceof Error
          ? requestError.message
          : t('systemIntegrations.saveFailed'),
      );
    } finally {
      setEmailSaving(false);
    }
  }

  async function saveNotificationRules() {
    if (!notificationRules) {
      return;
    }

    setRulesSaving(true);
    setRulesNotice('');
    setRulesError('');

    try {
      const saved = await apiRequest<NotificationRulesResponse>(
        '/admin/system-integrations/notification-rules',
        {
          method: 'PATCH',
          body: {
            registrationStarted: notificationRules.registrationStarted,
            roundStarted: notificationRules.roundStarted,
            submissionReceived: notificationRules.submissionReceived,
            deadlineReminder: notificationRules.deadlineReminder,
            submissionClosed: notificationRules.submissionClosed,
          },
        },
      );
      setNotificationRules(saved);
      setRulesNotice(t('systemIntegrations.saved'));
    } catch (requestError) {
      setRulesError(
        requestError instanceof Error
          ? requestError.message
          : t('systemIntegrations.saveFailed'),
      );
    } finally {
      setRulesSaving(false);
    }
  }

  if (loading) {
    return <article className="card state-card">{t('systemIntegrations.loading')}</article>;
  }

  if (!googleSheets && !emailSettings && !notificationRules) {
    return (
      <article className="card state-card">
        <p className="form-error">{loadError || t('systemIntegrations.loadFailed')}</p>
        <button type="button" className="button button-soft" onClick={() => void loadSettings()}>
          {t('systemIntegrations.retry')}
        </button>
      </article>
    );
  }

  if (!googleSheets || !emailSettings || !notificationRules) {
    return (
      <article className="card state-card">
        <p className="form-error">{loadError || t('systemIntegrations.loadFailed')}</p>
      </article>
    );
  }

  const emailStatusKey = !emailSettings.enabled
    ? 'disabled'
    : emailSettings.isConfigured
      ? 'active'
      : 'incomplete';

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
          <span className={`status-pill${googleSheets.isConfigured ? ' active' : ''}`}>
            {googleSheets.isConfigured
              ? t('systemIntegrations.googleSheets.configured')
              : t('systemIntegrations.googleSheets.notConfigured')}
          </span>
        </div>

        <p className="inline-hint">{t('systemIntegrations.googleSheets.lead')}</p>
        <div className="state-callout subtle">
          <strong>{t(`systemIntegrations.googleSheets.sources.${googleSheets.source}`)}</strong>
          <p>{t(`systemIntegrations.googleSheets.sourceHints.${googleSheets.source}`)}</p>
        </div>

        <div className="meta-grid">
          <div>
            <dt>{t('systemIntegrations.googleSheets.source')}</dt>
            <dd>{t(`systemIntegrations.googleSheets.sources.${googleSheets.source}`)}</dd>
          </div>
          <div>
            <dt>{t('systemIntegrations.googleSheets.lastCheck')}</dt>
            <dd>
              {formatDateTime(
                googleSheets.lastCheckedAt,
                language,
                t('systemIntegrations.googleSheets.notChecked'),
              )}
            </dd>
          </div>
          <div>
            <dt>{t('systemIntegrations.googleSheets.lastStatus')}</dt>
            <dd>{googleSheets.lastCheckStatus || t('systemIntegrations.googleSheets.unknown')}</dd>
          </div>
        </div>

        {googleSheets.lastCheckMessage ? (
          <div className="state-callout subtle">
            <strong>{t('systemIntegrations.googleSheets.connectionMessage')}</strong>
            <p>{googleSheets.lastCheckMessage}</p>
          </div>
        ) : null}

        <div className="profile-settings-fields">
          <label className="field">
            <span>{t('systemIntegrations.googleSheets.form.webhookUrl')}</span>
            <input
              value={googleSheets.webhookUrl}
              onChange={(event) =>
                setGoogleSheets((current) =>
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
              value={googleSheets.secret}
              onChange={(event) =>
                setGoogleSheets((current) =>
                  current ? { ...current, secret: event.target.value } : current,
                )
              }
            />
          </label>
          <label className="field">
            <span>{t('systemIntegrations.googleSheets.form.defaultSheetName')}</span>
            <input
              value={googleSheets.defaultSheetName}
              onChange={(event) =>
                setGoogleSheets((current) =>
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
            onClick={() => void testGoogleSheetsConnection()}
            disabled={googleTesting}
          >
            {googleTesting
              ? t('systemIntegrations.googleSheets.testing')
              : t('systemIntegrations.googleSheets.testConnection')}
          </button>
          <button
            type="button"
            className="button button-primary"
            onClick={() => void saveGoogleSheets()}
            disabled={googleSaving}
          >
            {googleSaving ? t('systemIntegrations.saving') : t('systemIntegrations.save')}
          </button>
        </div>

        {googleNotice ? <p className="form-success">{googleNotice}</p> : null}
        {googleError ? <p className="form-error">{googleError}</p> : null}
      </article>

      <article className="card panel-card">
        <div className="tournament-head">
          <h2>{t('systemIntegrations.email.title')}</h2>
          <span className={`status-pill${emailStatusKey === 'active' ? ' active' : ''}`}>
            {t(`systemIntegrations.email.status.${emailStatusKey}`)}
          </span>
        </div>

        <p className="inline-hint">{t('systemIntegrations.email.lead')}</p>
        <div className="state-callout subtle">
          <strong>{t(`systemIntegrations.email.sources.${emailSettings.source}`)}</strong>
          <p>{t(`systemIntegrations.email.sourceHints.${emailSettings.source}`)}</p>
        </div>

        <div className="meta-grid">
          <div>
            <dt>{t('systemIntegrations.email.source')}</dt>
            <dd>{t(`systemIntegrations.email.sources.${emailSettings.source}`)}</dd>
          </div>
          <div>
            <dt>{t('systemIntegrations.email.provider')}</dt>
            <dd>{t(`systemIntegrations.email.providers.${emailSettings.provider}`)}</dd>
          </div>
          <div>
            <dt>{t('systemIntegrations.email.deliveryStatus')}</dt>
            <dd>{t(`systemIntegrations.email.status.${emailStatusKey}`)}</dd>
          </div>
        </div>

        {emailStatusKey === 'incomplete' ? (
          <div className="state-callout subtle">
            <strong>{t('systemIntegrations.email.incompleteTitle')}</strong>
            <p>{t('systemIntegrations.email.incompleteLead')}</p>
          </div>
        ) : null}

        <div className="profile-preferences-block">
          <label className="profile-toggle-row" htmlFor="integrations-email-enabled">
            <button
              id="integrations-email-enabled"
              type="button"
              className={`settings-toggle${emailSettings.enabled ? ' on' : ''}`}
              onClick={() =>
                setEmailSettings((current) =>
                  current ? { ...current, enabled: !current.enabled } : current,
                )
              }
              aria-label={t('systemIntegrations.email.form.enabled')}
              aria-pressed={emailSettings.enabled}
            />
            <span>{t('systemIntegrations.email.form.enabled')}</span>
          </label>
        </div>

        <div className="profile-settings-fields two-col">
          <label className="field">
            <span>{t('systemIntegrations.email.form.provider')}</span>
            <select
              className="select-input"
              value={emailSettings.provider}
              onChange={(event) =>
                setEmailSettings((current) =>
                  current
                    ? {
                        ...current,
                        provider: event.target.value as 'console' | 'resend',
                      }
                    : current,
                )
              }
            >
              <option value="console">{t('systemIntegrations.email.providers.console')}</option>
              <option value="resend">{t('systemIntegrations.email.providers.resend')}</option>
            </select>
          </label>
          <label className="field">
            <span>{t('systemIntegrations.email.form.from')}</span>
            <input
              type="email"
              value={emailSettings.from}
              onChange={(event) =>
                setEmailSettings((current) =>
                  current ? { ...current, from: event.target.value } : current,
                )
              }
            />
          </label>
          <label className="field">
            <span>{t('systemIntegrations.email.form.replyTo')}</span>
            <input
              type="email"
              value={emailSettings.replyTo}
              onChange={(event) =>
                setEmailSettings((current) =>
                  current ? { ...current, replyTo: event.target.value } : current,
                )
              }
            />
          </label>
          <label className="field">
            <span>{t('systemIntegrations.email.form.resendApiKey')}</span>
            <input
              type="password"
              autoComplete="new-password"
              value={emailSettings.resendApiKey}
              onChange={(event) =>
                setEmailSettings((current) =>
                  current ? { ...current, resendApiKey: event.target.value } : current,
                )
              }
            />
          </label>
        </div>

        <div className="status-actions">
          <button
            type="button"
            className="button button-primary"
            onClick={() => void saveEmailSettings()}
            disabled={emailSaving}
          >
            {emailSaving ? t('systemIntegrations.saving') : t('systemIntegrations.save')}
          </button>
        </div>

        {emailNotice ? <p className="form-success">{emailNotice}</p> : null}
        {emailError ? <p className="form-error">{emailError}</p> : null}
      </article>

      <article className="card panel-card">
        <div className="tournament-head">
          <h2>{t('systemIntegrations.notificationRules.title')}</h2>
          <span className="status-pill active">
            {t(`systemIntegrations.notificationRules.sources.${notificationRules.source}`)}
          </span>
        </div>

        <p className="inline-hint">{t('systemIntegrations.notificationRules.lead')}</p>
        <div className="state-callout subtle">
          <strong>{t(`systemIntegrations.notificationRules.sources.${notificationRules.source}`)}</strong>
          <p>{t(`systemIntegrations.notificationRules.sourceHints.${notificationRules.source}`)}</p>
        </div>

        <div className="profile-preferences-block">
          <label className="profile-toggle-row" htmlFor="rule-registration-started">
            <button
              id="rule-registration-started"
              type="button"
              className={`settings-toggle${notificationRules.registrationStarted ? ' on' : ''}`}
              onClick={() =>
                setNotificationRules((current) =>
                  current
                    ? { ...current, registrationStarted: !current.registrationStarted }
                    : current,
                )
              }
              aria-label={t('systemIntegrations.notificationRules.items.registrationStarted')}
              aria-pressed={notificationRules.registrationStarted}
            />
            <span>{t('systemIntegrations.notificationRules.items.registrationStarted')}</span>
          </label>

          <label className="profile-toggle-row" htmlFor="rule-round-started">
            <button
              id="rule-round-started"
              type="button"
              className={`settings-toggle${notificationRules.roundStarted ? ' on' : ''}`}
              onClick={() =>
                setNotificationRules((current) =>
                  current ? { ...current, roundStarted: !current.roundStarted } : current,
                )
              }
              aria-label={t('systemIntegrations.notificationRules.items.roundStarted')}
              aria-pressed={notificationRules.roundStarted}
            />
            <span>{t('systemIntegrations.notificationRules.items.roundStarted')}</span>
          </label>

          <label className="profile-toggle-row" htmlFor="rule-submission-received">
            <button
              id="rule-submission-received"
              type="button"
              className={`settings-toggle${notificationRules.submissionReceived ? ' on' : ''}`}
              onClick={() =>
                setNotificationRules((current) =>
                  current
                    ? { ...current, submissionReceived: !current.submissionReceived }
                    : current,
                )
              }
              aria-label={t('systemIntegrations.notificationRules.items.submissionReceived')}
              aria-pressed={notificationRules.submissionReceived}
            />
            <span>{t('systemIntegrations.notificationRules.items.submissionReceived')}</span>
          </label>

          <label className="profile-toggle-row" htmlFor="rule-deadline-reminder">
            <button
              id="rule-deadline-reminder"
              type="button"
              className={`settings-toggle${notificationRules.deadlineReminder ? ' on' : ''}`}
              onClick={() =>
                setNotificationRules((current) =>
                  current
                    ? { ...current, deadlineReminder: !current.deadlineReminder }
                    : current,
                )
              }
              aria-label={t('systemIntegrations.notificationRules.items.deadlineReminder')}
              aria-pressed={notificationRules.deadlineReminder}
            />
            <span>{t('systemIntegrations.notificationRules.items.deadlineReminder')}</span>
          </label>

          <label className="profile-toggle-row" htmlFor="rule-submission-closed">
            <button
              id="rule-submission-closed"
              type="button"
              className={`settings-toggle${notificationRules.submissionClosed ? ' on' : ''}`}
              onClick={() =>
                setNotificationRules((current) =>
                  current
                    ? { ...current, submissionClosed: !current.submissionClosed }
                    : current,
                )
              }
              aria-label={t('systemIntegrations.notificationRules.items.submissionClosed')}
              aria-pressed={notificationRules.submissionClosed}
            />
            <span>{t('systemIntegrations.notificationRules.items.submissionClosed')}</span>
          </label>
        </div>

        <div className="status-actions">
          <button
            type="button"
            className="button button-primary"
            onClick={() => void saveNotificationRules()}
            disabled={rulesSaving}
          >
            {rulesSaving ? t('systemIntegrations.saving') : t('systemIntegrations.save')}
          </button>
        </div>

        {rulesNotice ? <p className="form-success">{rulesNotice}</p> : null}
        {rulesError ? <p className="form-error">{rulesError}</p> : null}
      </article>
    </section>
  );
}
