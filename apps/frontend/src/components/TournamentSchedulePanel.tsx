import { formatDateTime } from '../lib/dateTime';
import { TournamentScheduleEvent } from '../lib/tournamentSchedule';
import { useI18n } from '../i18n/I18nProvider';
import QuietLoadingInline from './QuietLoadingInline';

type TournamentSchedulePanelProps = {
  events: TournamentScheduleEvent[];
  loading?: boolean;
  error?: string;
  onRetry?: () => void;
  className?: string;
  title?: string;
  lead?: string;
};

export default function TournamentSchedulePanel({
  events,
  loading = false,
  error = '',
  onRetry,
  className = 'card panel-card',
  title,
  lead,
}: TournamentSchedulePanelProps) {
  const { language, t } = useI18n();

  return (
    <article className={className}>
      <div className="tournament-head">
        <h2>{title ?? t('schedule.title')}</h2>
        <span className="status-pill">{events.length}</span>
      </div>
      {lead ? <p className="inline-hint">{lead}</p> : null}
      {loading ? <QuietLoadingInline label={t('schedule.loading')} compact /> : null}
      {error ? (
        <>
          <p className="form-error">{error}</p>
          {onRetry ? (
            <button type="button" className="button button-soft" onClick={onRetry}>
              {t('schedule.retry')}
            </button>
          ) : null}
        </>
      ) : null}
      {!loading && !error && events.length === 0 ? <p>{t('schedule.empty')}</p> : null}
      {events.length > 0 ? (
        <div className="schedule-stack">
          {events.map((event) => (
            <article key={event.id} className="schedule-item">
              <div className="schedule-item-head">
                <div>
                  <strong>{event.title}</strong>
                  <p>{event.description || t('schedule.noDescription')}</p>
                </div>
                <span className={`schedule-type-chip type-${event.type.toLowerCase()}`}>
                  {t(`schedule.types.${event.type}`)}
                </span>
              </div>
              <div className="schedule-item-meta">
                <span>
                  {t('schedule.form.startsAt')}: {formatDateTime(event.startsAt, language)}
                </span>
                <span>
                  {event.endsAt
                    ? `${t('schedule.form.endsAt')}: ${formatDateTime(event.endsAt, language)}`
                    : t('schedule.noEndTime')}
                </span>
                <span>
                  {event.location
                    ? `${t('schedule.form.location')}: ${event.location}`
                    : t('schedule.noLocation')}
                </span>
              </div>
            </article>
          ))}
        </div>
      ) : null}
    </article>
  );
}
