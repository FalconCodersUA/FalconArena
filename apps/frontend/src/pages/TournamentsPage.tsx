import { useEffect, useMemo, useState } from 'react';
import { apiRequest } from '../lib/api';
import { useI18n } from '../i18n/I18nProvider';

type TournamentStatus = 'DRAFT' | 'REGISTRATION' | 'RUNNING' | 'FINISHED';

type Tournament = {
  id: string;
  title: string;
  status: TournamentStatus;
  registrationOpenAt: string;
  registrationCloseAt: string;
  canTeamRegister: boolean;
};

type FilterType = 'all' | 'registrationOpen' | 'running' | 'finished';

function formatDate(value: string, language: string) {
  return new Date(value).toLocaleString(language === 'uk' ? 'uk-UA' : 'en-US');
}

export default function TournamentsPage() {
  const { language, t } = useI18n();
  const [items, setItems] = useState<Tournament[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState<FilterType>('all');

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

  const filteredItems = useMemo(() => {
    if (filter === 'registrationOpen') {
      return items.filter((item) => item.canTeamRegister);
    }

    if (filter === 'running') {
      return items.filter((item) => item.status === 'RUNNING');
    }

    if (filter === 'finished') {
      return items.filter((item) => item.status === 'FINISHED');
    }

    return items;
  }, [filter, items]);

  const activeItems = useMemo(
    () => filteredItems.filter((item) => item.status === 'RUNNING'),
    [filteredItems],
  );
  const upcomingItems = useMemo(
    () =>
      filteredItems.filter(
        (item) => item.status === 'DRAFT' || item.status === 'REGISTRATION',
      ),
    [filteredItems],
  );
  const finishedItems = useMemo(
    () => filteredItems.filter((item) => item.status === 'FINISHED'),
    [filteredItems],
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

  const filterButtons: FilterType[] = [
    'all',
    'registrationOpen',
    'running',
    'finished',
  ];

  const sections = [
    { key: 'active', label: t('tournaments.sections.active'), items: activeItems },
    { key: 'upcoming', label: t('tournaments.sections.upcoming'), items: upcomingItems },
    { key: 'finished', label: t('tournaments.sections.finished'), items: finishedItems },
  ] as const;

  return (
    <section className="tournaments-section">
      <header className="section-header">
        <p className="eyebrow">{t('tournaments.eyebrow')}</p>
        <h1>{t('tournaments.title')}</h1>
        <p className="lead">{t('tournaments.lead')}</p>
      </header>

      <div className="filters-row" role="group" aria-label="Tournament filters">
        {filterButtons.map((item) => (
          <button
            key={item}
            type="button"
            className={`filter-button${filter === item ? ' active' : ''}`}
            onClick={() => setFilter(item)}
          >
            {t(`tournaments.filters.${item}`)}
          </button>
        ))}
      </div>

      <p className="total-label">
        {t('tournaments.totalLabel')}: {filteredItems.length}
      </p>

      {filteredItems.length === 0 ? (
        <article className="card state-card">{t('tournaments.emptyFiltered')}</article>
      ) : (
        <div className="sections-stack">
          {sections.map((section) =>
            section.items.length > 0 ? (
              <section key={section.key} className="section-card">
                <h2>{section.label}</h2>
                <div className="tournaments-grid">
                  {section.items.map((tournament) => (
                    <article key={tournament.id} className="card tournament-card">
                      <div className="tournament-head">
                        <h3>{tournament.title}</h3>
                        <span className="status-pill">
                          {t(`tournaments.status.${tournament.status}`)}
                        </span>
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
                        {t('tournaments.registrationState')}:{' '}
                        {tournament.canTeamRegister
                          ? t('tournaments.available')
                          : t('tournaments.closed')}
                      </p>
                    </article>
                  ))}
                </div>
              </section>
            ) : null,
          )}
        </div>
      )}
    </section>
  );
}
