import { Link, isRouteErrorResponse, useRouteError } from 'react-router-dom';
import { useI18n } from '../i18n/I18nProvider';

function resolveErrorMessage(error: unknown, fallback: string) {
  if (isRouteErrorResponse(error)) {
    if (error.status === 404) {
      return fallback;
    }

    if (typeof error.data === 'string' && error.data.trim()) {
      return error.data;
    }

    return error.statusText || fallback;
  }

  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }

  return fallback;
}

export default function AppErrorPage() {
  const { t } = useI18n();
  const error = useRouteError();

  const isNotFound = isRouteErrorResponse(error) && error.status === 404;
  const eyebrow = isNotFound ? '404' : '500';
  const title = isNotFound ? t('errorPage.notFoundTitle') : t('errorPage.title');
  const lead = resolveErrorMessage(error, t('errorPage.lead'));

  return (
    <article className="card state-card app-error-page">
      <p className="eyebrow">{eyebrow}</p>
      <h1>{title}</h1>
      <p className="lead">{lead}</p>
      <div className="app-error-actions">
        <Link className="button button-primary" to="/app/tournaments">
          {t('errorPage.primaryAction')}
        </Link>
        <Link className="button button-soft" to="/app/dashboard">
          {t('errorPage.secondaryAction')}
        </Link>
      </div>
      <p className="app-error-note">{t('errorPage.note')}</p>
    </article>
  );
}
