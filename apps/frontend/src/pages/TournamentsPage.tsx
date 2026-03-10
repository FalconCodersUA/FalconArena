import { useEffect, useMemo, useState } from 'react';
import { apiRequest } from '../lib/api';
import { useI18n } from '../i18n/I18nProvider';

type Tournament = {
  id: string;
  title: string;
  status: string;
  registrationOpenAt: string;
  registrationCloseAt: string;
  canTeamRegister: boolean;
};

function formatDate(value: string, language: string) {
  return new Date(value).toLocaleString(language === 'uk' ? 'uk-UA' : 'en-US');
}

export default function TournamentsPage() {
  const { language, t } = useI18n();
  const [items, setItems] = useState<Tournament[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  async function loadTournaments() {
    setLoading(true);
    setError('');

    try {
      const data = await apiRequest<Tournament[]>('/tournaments');
      setItems(data);
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : t('tournaments.requestFailed'),
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadTournaments();
  }, []);

  const cards = useMemo(
    () =>
      items.map((tournament) => (
        <article key={tournament.id} className="card tournament-card">
          <div className="tournament-head">
            <h2>{tournament.title}</h2>
            <span className="status-pill">{t(`tournaments.status.${tournament.status}`)}</span>
          </div>

          <dl className="meta-grid">
            <div>
              <dt>{t('tournaments.registrationOpens')}</dt>
              <dd>{formatDate(tournament.registrationOpenAt, language)}</dd>
            </div>
            <div>
              <dt>{t('tournaments.registrationCloses')}</dt>
              <dd>{formatDate(tournament.registrationCloseAt, language)}</dd>
            </div>
          </dl>

          <p className="register-flag">
            {t('tournaments.registrationState')}: {tournament.canTeamRegister ? t('tournaments.available') : t('tournaments.closed')}
          </p>
        </article>
      )),
    [items, language, t],
  );

  if (loading) {
    return <div className="card state-card">{t('tournaments.loading')}</div>;
  }

  if (error) {
    return (
      <div className="card state-card">
        <p className="form-error">{error}</p>
        <button type="button" className="button button-soft" onClick={loadTournaments}>
          {t('tournaments.retry')}
        </button>
      </div>
    );
  }

  if (items.length === 0) {
    return <div className="card state-card">{t('tournaments.empty')}</div>;
  }

  return (
    <section className="tournaments-section">
      <header className="section-header">
        <p className="eyebrow">{t('tournaments.eyebrow')}</p>
        <h1>{t('tournaments.title')}</h1>
      </header>
      <div className="tournaments-grid">{cards}</div>
    </section>
  );
}
