import { Link } from 'react-router-dom';
import { useI18n } from '../i18n/I18nProvider';

export default function MessagesPage() {
  const { t } = useI18n();

  return (
    <section className="team-dashboard">
      <header className="section-header">
        <p className="eyebrow">{t('messagesPage.eyebrow')}</p>
        <h1>{t('messagesPage.title')}</h1>
        <p className="lead">{t('messagesPage.lead')}</p>
      </header>

      <article className="card panel-card">
        <div className="state-callout subtle">
          <strong>{t('messagesPage.noticeTitle')}</strong>
          <p>{t('messagesPage.noticeText')}</p>
        </div>

        <div className="summary-grid compact-summary-grid">
          <div className="summary-card">
            <span>{t('messagesPage.summary.admin')}</span>
            <strong>{t('messagesPage.summary.soon')}</strong>
            <p>{t('messagesPage.summary.adminHint')}</p>
          </div>
          <div className="summary-card">
            <span>{t('messagesPage.summary.teams')}</span>
            <strong>{t('messagesPage.summary.soon')}</strong>
            <p>{t('messagesPage.summary.teamsHint')}</p>
          </div>
        </div>

        <Link to="/app/leaderboard" className="button button-soft">
          {t('messagesPage.openLeaderboard')}
        </Link>
      </article>
    </section>
  );
}

