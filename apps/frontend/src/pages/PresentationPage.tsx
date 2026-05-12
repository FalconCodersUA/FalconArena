import { Link } from 'react-router-dom';
import { useI18n } from '../i18n/I18nProvider';

const PRESENTATION_EMBED_URL =
  'https://www.youtube-nocookie.com/embed/WUs2zc7T8qk?rel=0&modestbranding=1';

export default function PresentationPage() {
  const { t } = useI18n();

  return (
    <section className="presentation-page app-page">
      <article className="presentation-hero" aria-labelledby="presentation-page-title">
        <div className="presentation-hero-copy">
          <p className="eyebrow">{t('presentationPage.eyebrow')}</p>
          <h1 id="presentation-page-title">{t('presentationPage.title')}</h1>
          <p>{t('presentationPage.lead')}</p>
        </div>
        <div className="presentation-hero-actions">
          <Link className="button button-soft" to="/app/about">
            {t('presentationPage.backToAbout')}
          </Link>
        </div>
      </article>

      <section className="presentation-player-panel" aria-label={t('presentationPage.playerLabel')}>
        <div className="presentation-player-frame">
          <iframe
            src={PRESENTATION_EMBED_URL}
            title={t('presentationPage.videoTitle')}
            loading="lazy"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
            referrerPolicy="strict-origin-when-cross-origin"
            allowFullScreen
          />
        </div>
      </section>

      <section className="presentation-context-grid" aria-label={t('presentationPage.highlightsLabel')}>
        <article>
          <span>01</span>
          <strong>{t('presentationPage.highlights.flowTitle')}</strong>
          <p>{t('presentationPage.highlights.flowLead')}</p>
        </article>
        <article>
          <span>02</span>
          <strong>{t('presentationPage.highlights.rolesTitle')}</strong>
          <p>{t('presentationPage.highlights.rolesLead')}</p>
        </article>
        <article>
          <span>03</span>
          <strong>{t('presentationPage.highlights.resultTitle')}</strong>
          <p>{t('presentationPage.highlights.resultLead')}</p>
        </article>
      </section>
    </section>
  );
}
