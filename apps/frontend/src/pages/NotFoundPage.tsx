import { Link } from 'react-router-dom';
import { useI18n } from '../i18n/I18nProvider';

export default function NotFoundPage() {
  const { t } = useI18n();

  return (
    <article className="card state-card">
      <p className="eyebrow">404</p>
      <h1>{t('notFound.title')}</h1>
      <p className="lead">{t('notFound.lead')}</p>
      <Link className="button button-primary" to="/app/tournaments">
        {t('notFound.action')}
      </Link>
    </article>
  );
}
