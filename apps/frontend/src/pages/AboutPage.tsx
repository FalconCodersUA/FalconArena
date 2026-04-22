import { FormEvent, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useI18n } from '../i18n/I18nProvider';
import { apiRequest, resolveApiAssetUrl } from '../lib/api';
import { AuthRole, getAuthUser, isAuthenticated } from '../lib/auth';

type LocalizedText = {
  uk: string;
  en: string;
};

type PlatformAboutResponse = {
  hero: {
    eyebrow: LocalizedText;
    title: LocalizedText;
    description: LocalizedText;
    bannerImageUrl: string | null;
  };
  product: {
    eyebrow: LocalizedText;
    title: LocalizedText;
    lead: LocalizedText;
  };
  roles: {
    label: LocalizedText;
    organizers: {
      title: LocalizedText;
      lead: LocalizedText;
    };
    teams: {
      title: LocalizedText;
      lead: LocalizedText;
    };
    jury: {
      title: LocalizedText;
      lead: LocalizedText;
    };
  };
  cta: {
    eyebrow: LocalizedText;
    title: LocalizedText;
    lead: LocalizedText;
    registerLabel: LocalizedText;
    workspaceLabel: LocalizedText;
  };
  contacts: {
    eyebrow: LocalizedText;
    title: LocalizedText;
    lead: LocalizedText;
    items: Array<{
      label: LocalizedText;
      value: LocalizedText;
      url: string | null;
    }>;
  };
  source: 'database' | 'default';
};

type PlatformReview = {
  id: string;
  text: string;
  authorName: string;
  authorRole: AuthRole;
  reviewedAt: string | null;
  createdAt: string;
};

function createSampleReviews(language: 'uk' | 'en'): PlatformReview[] {
  if (language === 'en') {
    return [
      {
        id: 'sample-review-1',
        text: 'As a team captain, I always knew what stage the tournament was in, when the deadline was coming, and whether our submission was already saved.',
        authorName: 'Team captain',
        authorRole: 'TEAM',
        reviewedAt: null,
        createdAt: '',
      },
      {
        id: 'sample-review-2',
        text: 'The jury workspace made evaluation predictable: assigned projects, criteria, links, and saved scores were all available without extra spreadsheets.',
        authorName: 'Jury member',
        authorRole: 'JURY',
        reviewedAt: null,
        createdAt: '',
      },
      {
        id: 'sample-review-3',
        text: 'FalconArena helped us keep registration, rounds, announcements, results, and archive exports under control during the full tournament cycle.',
        authorName: 'Tournament organizer',
        authorRole: 'ORGANIZER',
        reviewedAt: null,
        createdAt: '',
      },
    ];
  }

  return [
    {
      id: 'sample-review-1',
      text: 'Як капітан команди, я завжди бачив етап турніру, дедлайн і статус нашого сабміту без додаткових уточнень у чатах.',
      authorName: 'Капітан команди',
      authorRole: 'TEAM',
      reviewedAt: null,
      createdAt: '',
    },
    {
      id: 'sample-review-2',
      text: 'Кабінет журі зробив оцінювання передбачуваним: призначені роботи, критерії, посилання і збережені бали були в одному місці.',
      authorName: 'Член журі',
      authorRole: 'JURY',
      reviewedAt: null,
      createdAt: '',
    },
    {
      id: 'sample-review-3',
      text: 'FalconArena допомогла втримати під контролем реєстрацію, раунди, оголошення, результати й архів протягом усього турніру.',
      authorName: 'Організатор турніру',
      authorRole: 'ORGANIZER',
      reviewedAt: null,
      createdAt: '',
    },
  ];
}

function localized(uk: string, en: string): LocalizedText {
  return { uk, en };
}

function createFallbackContent(): PlatformAboutResponse {
  return {
    hero: {
      eyebrow: localized('Про платформу', 'About the platform'),
      title: localized(
        'FalconArena - вебплатформа для командних турнірів з програмування',
        'FalconArena - a web platform for team programming tournaments',
      ),
      description: localized(
        'FalconArena допомагає організаторам проводити командні турніри з програмування в одному робочому просторі. Платформа обʼєднує реєстрацію команд, керування раундами, подання робіт, оцінювання журі, лідерборд, повідомлення та експорт результатів.',
        'FalconArena helps organizers run team programming tournaments in one workspace. The platform combines team registration, round management, submissions, jury evaluation, leaderboard, messages, and result export.',
      ),
      bannerImageUrl: null,
    },
    product: {
      eyebrow: localized('Робочий процес', 'Workflow'),
      title: localized(
        'Один маршрут для турніру від реєстрації до фінального лідерборда',
        'One tournament route from registration to the final leaderboard',
      ),
      lead: localized(
        'Адміністратор задає правила, команди працюють із завданнями, журі оцінює сабміти, а результати збираються в архіві без ручних таблиць.',
        'Admins define rules, teams work with tasks, jury members review submissions, and results move into the archive without manual spreadsheets.',
      ),
    },
    roles: {
      label: localized('Ролі платформи', 'Platform roles'),
      organizers: {
        title: localized('Організатори', 'Organizers'),
        lead: localized(
          'Створюють турніри, керують раундами, командами, сповіщеннями та експортом результатів.',
          'Create tournaments, manage rounds, teams, notifications, and result export.',
        ),
      },
      teams: {
        title: localized('Команди', 'Teams'),
        lead: localized(
          'Бачать актуальні завдання, дедлайни, статус реєстрації та подають посилання на GitHub і демо.',
          'See current tasks, deadlines, registration status, and submit GitHub and demo links.',
        ),
      },
      jury: {
        title: localized('Журі', 'Jury'),
        lead: localized(
          'Отримує призначені роботи, виставляє оцінки за критеріями та формує прозорий результат.',
          'Receive assigned work, score by criteria, and build a transparent final result.',
        ),
      },
    },
    cta: {
      eyebrow: localized('Почати роботу', 'Start working'),
      title: localized(
        'Відкрийте турнірний простір і перевірте платформу в реальному сценарії',
        'Open the tournament workspace and test the platform in a real scenario',
      ),
      lead: localized(
        'Найкраще FalconArena видно в дії: турніри, команди, сабміти, оцінювання та результати працюють як єдиний продукт.',
        'FalconArena is clearest in action: tournaments, teams, submissions, evaluation, and results operate as one product.',
      ),
      registerLabel: localized('Створити акаунт команди', 'Create team account'),
      workspaceLabel: localized('Перейти до турнірів', 'Go to tournaments'),
    },
    contacts: {
      eyebrow: localized('Наші контакти', 'Our contacts'),
      title: localized(
        'Звʼяжіться з командою FalconArena',
        'Contact the FalconArena team',
      ),
      lead: localized(
        'Виберіть зручний канал, щоб поставити питання про платформу, турнір або співпрацю.',
        'Choose a convenient channel for questions about the platform, tournaments, or collaboration.',
      ),
      items: [
        {
          label: localized('Email', 'Email'),
          value: localized('team@falconarena.live', 'team@falconarena.live'),
          url: 'mailto:team@falconarena.live',
        },
        {
          label: localized('Telegram', 'Telegram'),
          value: localized('@falconarena', '@falconarena'),
          url: 'https://t.me/falconarena',
        },
        {
          label: localized('GitHub', 'GitHub'),
          value: localized('github.com/falconarena', 'github.com/falconarena'),
          url: 'https://github.com/falconarena',
        },
        {
          label: localized('LinkedIn', 'LinkedIn'),
          value: localized('FalconArena', 'FalconArena'),
          url: 'https://www.linkedin.com',
        },
      ],
    },
    source: 'default',
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function mergeLocalized(value: unknown, fallback: LocalizedText): LocalizedText {
  if (!isRecord(value)) {
    return fallback;
  }

  return {
    uk: typeof value.uk === 'string' && value.uk.trim() ? value.uk : fallback.uk,
    en: typeof value.en === 'string' && value.en.trim() ? value.en : fallback.en,
  };
}

function mergeOptionalString(value: unknown) {
  const normalized = typeof value === 'string' ? value.trim() : '';
  return normalized.length > 0 ? normalized : null;
}

function mergeContactItems(value: unknown, fallback: PlatformAboutResponse['contacts']['items']) {
  const source = Array.isArray(value) ? value : [];

  return fallback.map((fallbackItem, index) => {
    const item = isRecord(source[index]) ? source[index] : {};

    return {
      label: mergeLocalized(item.label, fallbackItem.label),
      value: mergeLocalized(item.value, fallbackItem.value),
      url: typeof item.url === 'string' ? mergeOptionalString(item.url) : fallbackItem.url,
    };
  });
}

function normalizeContent(value: unknown, fallback: PlatformAboutResponse): PlatformAboutResponse {
  if (!isRecord(value)) {
    return fallback;
  }

  const hero = isRecord(value.hero) ? value.hero : {};
  const product = isRecord(value.product) ? value.product : {};
  const roles = isRecord(value.roles) ? value.roles : {};
  const organizers = isRecord(roles.organizers) ? roles.organizers : {};
  const teams = isRecord(roles.teams) ? roles.teams : {};
  const jury = isRecord(roles.jury) ? roles.jury : {};
  const cta = isRecord(value.cta) ? value.cta : {};
  const contacts = isRecord(value.contacts) ? value.contacts : {};
  const legacyTitle = typeof value.aboutPageTitle === 'string' ? value.aboutPageTitle : '';
  const legacyDescription =
    typeof value.aboutPageDescription === 'string' ? value.aboutPageDescription : '';

  return {
    hero: {
      eyebrow: mergeLocalized(hero.eyebrow, fallback.hero.eyebrow),
      title: legacyTitle
        ? { ...fallback.hero.title, uk: legacyTitle }
        : mergeLocalized(hero.title, fallback.hero.title),
      description: legacyDescription
        ? { ...fallback.hero.description, uk: legacyDescription }
        : mergeLocalized(hero.description, fallback.hero.description),
      bannerImageUrl: mergeOptionalString(hero.bannerImageUrl),
    },
    product: {
      eyebrow: mergeLocalized(product.eyebrow, fallback.product.eyebrow),
      title: mergeLocalized(product.title, fallback.product.title),
      lead: mergeLocalized(product.lead, fallback.product.lead),
    },
    roles: {
      label: mergeLocalized(roles.label, fallback.roles.label),
      organizers: {
        title: mergeLocalized(organizers.title, fallback.roles.organizers.title),
        lead: mergeLocalized(organizers.lead, fallback.roles.organizers.lead),
      },
      teams: {
        title: mergeLocalized(teams.title, fallback.roles.teams.title),
        lead: mergeLocalized(teams.lead, fallback.roles.teams.lead),
      },
      jury: {
        title: mergeLocalized(jury.title, fallback.roles.jury.title),
        lead: mergeLocalized(jury.lead, fallback.roles.jury.lead),
      },
    },
    cta: {
      eyebrow: mergeLocalized(cta.eyebrow, fallback.cta.eyebrow),
      title: mergeLocalized(cta.title, fallback.cta.title),
      lead: mergeLocalized(cta.lead, fallback.cta.lead),
      registerLabel: mergeLocalized(cta.registerLabel, fallback.cta.registerLabel),
      workspaceLabel: mergeLocalized(cta.workspaceLabel, fallback.cta.workspaceLabel),
    },
    contacts: {
      eyebrow: mergeLocalized(contacts.eyebrow, fallback.contacts.eyebrow),
      title: mergeLocalized(contacts.title, fallback.contacts.title),
      lead: mergeLocalized(contacts.lead, fallback.contacts.lead),
      items: mergeContactItems(contacts.items, fallback.contacts.items),
    },
    source: value.source === 'database' ? 'database' : 'default',
  };
}

function normalizeReviews(value: unknown): PlatformReview[] {
  const source = Array.isArray(value) ? value : [];

  return source
    .map((item) => {
      if (!isRecord(item)) {
        return null;
      }

      const authorRole = item.authorRole;

      if (
        typeof item.id !== 'string' ||
        typeof item.text !== 'string' ||
        typeof item.authorName !== 'string' ||
        (authorRole !== 'ADMIN' &&
          authorRole !== 'TEAM' &&
          authorRole !== 'JURY' &&
          authorRole !== 'ORGANIZER')
      ) {
        return null;
      }

      return {
        id: item.id,
        text: item.text,
        authorName: item.authorName,
        authorRole,
        reviewedAt: typeof item.reviewedAt === 'string' ? item.reviewedAt : null,
        createdAt: typeof item.createdAt === 'string' ? item.createdAt : '',
      };
    })
    .filter((item): item is PlatformReview => !!item);
}

export default function AboutPage() {
  const { language, t } = useI18n();
  const isSignedIn = isAuthenticated();
  const authUser = getAuthUser();
  const fallbackContent = useMemo(() => createFallbackContent(), []);
  const ctaPath = isSignedIn ? '/app/tournaments' : '/app/register';
  const [content, setContent] = useState<PlatformAboutResponse>(() => fallbackContent);
  const [reviews, setReviews] = useState<PlatformReview[]>([]);
  const [reviewText, setReviewText] = useState('');
  const [reviewSaving, setReviewSaving] = useState(false);
  const [reviewNotice, setReviewNotice] = useState('');
  const [reviewError, setReviewError] = useState('');
  const [isReviewModalOpen, setReviewModalOpen] = useState(false);
  const visibleReviews = reviews.length > 0 ? reviews : createSampleReviews(language);
  const ctaLabel = isSignedIn
    ? content.cta.workspaceLabel[language]
    : content.cta.registerLabel[language];

  useEffect(() => {
    let cancelled = false;

    async function loadContent() {
      try {
        const data = await apiRequest<unknown>('/platform/about');
        if (!cancelled) {
          setContent(normalizeContent(data, fallbackContent));
        }
      } catch {
        if (!cancelled) {
          setContent(fallbackContent);
        }
      }
    }

    void loadContent();

    return () => {
      cancelled = true;
    };
  }, [fallbackContent]);

  useEffect(() => {
    let cancelled = false;

    async function loadReviews() {
      try {
        const data = await apiRequest<unknown>('/platform/about/reviews');
        if (!cancelled) {
          setReviews(normalizeReviews(data));
        }
      } catch {
        if (!cancelled) {
          setReviews([]);
        }
      }
    }

    void loadReviews();

    return () => {
      cancelled = true;
    };
  }, []);

  async function submitReview(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const text = reviewText.trim();
    if (text.length < 10) {
      setReviewError(t('aboutPage.reviews.validation.tooShort'));
      setReviewNotice('');
      return;
    }

    setReviewSaving(true);
    setReviewError('');
    setReviewNotice('');

    try {
      await apiRequest('/platform/about/reviews', {
        method: 'POST',
        body: { text },
      });
      setReviewText('');
      setReviewModalOpen(false);
      setReviewNotice(t('aboutPage.reviews.submitSuccess'));
    } catch {
      setReviewError(t('aboutPage.reviews.submitFailed'));
    } finally {
      setReviewSaving(false);
    }
  }

  return (
    <section className="about-page app-page">
      <article className="about-text-panel" aria-labelledby="about-page-title">
        <div className="about-text-copy">
          <p className="eyebrow">{content.hero.eyebrow[language]}</p>
          <h1 id="about-page-title">{content.hero.title[language]}</h1>
          <p>{content.hero.description[language]}</p>
        </div>
        {content.hero.bannerImageUrl ? (
          <figure className="about-hero-banner">
            <img
              src={resolveApiAssetUrl(content.hero.bannerImageUrl)}
              alt={content.hero.title[language]}
            />
          </figure>
        ) : null}
      </article>

      <section className="about-product-card" aria-labelledby="about-product-title">
        <div className="about-product-copy">
          <p className="eyebrow">{content.product.eyebrow[language]}</p>
          <h2 id="about-product-title">{content.product.title[language]}</h2>
          <p>{content.product.lead[language]}</p>
        </div>
        <div className="about-product-signal" aria-hidden="true">
          <span />
          <span />
          <span />
        </div>
      </section>

      <section className="about-role-grid" aria-label={content.roles.label[language]}>
        <article className="about-role-card about-role-card--organizers">
          <span>01</span>
          <h3>{content.roles.organizers.title[language]}</h3>
          <p>{content.roles.organizers.lead[language]}</p>
        </article>
        <article className="about-role-card about-role-card--teams">
          <span>02</span>
          <h3>{content.roles.teams.title[language]}</h3>
          <p>{content.roles.teams.lead[language]}</p>
        </article>
        <article className="about-role-card about-role-card--jury">
          <span>03</span>
          <h3>{content.roles.jury.title[language]}</h3>
          <p>{content.roles.jury.lead[language]}</p>
        </article>
      </section>

      <section className="about-reviews-panel" aria-labelledby="about-reviews-title">
        <div className="about-reviews-head">
          <div>
            <p className="eyebrow">{t('aboutPage.reviews.eyebrow')}</p>
            <h2 id="about-reviews-title">{t('aboutPage.reviews.title')}</h2>
            <p>{t('aboutPage.reviews.lead')}</p>
          </div>
          <div className="about-reviews-actions">
            <span>{t('aboutPage.reviews.moderationBadge')}</span>
            {isSignedIn && authUser ? (
              <button
                type="button"
                className="button button-primary"
                onClick={() => {
                  setReviewError('');
                  setReviewModalOpen(true);
                }}
              >
                {t('aboutPage.reviews.writeAction')}
              </button>
            ) : (
              <Link to="/app/login" className="button button-soft">
                {t('aboutPage.reviews.authAction')}
              </Link>
            )}
          </div>
        </div>

        <div className="about-reviews-grid">
          {visibleReviews.map((review) => (
            <article key={review.id} className="about-review-card">
              <p>{review.text}</p>
              <footer>
                <strong>{review.authorName}</strong>
                <span>{t(`profile.role.${review.authorRole}`)}</span>
              </footer>
            </article>
          ))}
        </div>

        {reviewNotice ? <p className="form-success">{reviewNotice}</p> : null}
      </section>

      {isReviewModalOpen && authUser ? (
        <div
          className="app-modal-overlay"
          role="presentation"
          onClick={() => setReviewModalOpen(false)}
        >
          <div
            className="app-modal-card about-review-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="about-review-modal-title"
            onClick={(event) => event.stopPropagation()}
          >
            <header className="app-modal-head">
              <h2 id="about-review-modal-title">{t('aboutPage.reviews.modalTitle')}</h2>
              <button
                type="button"
                className="button button-soft app-modal-close app-modal-secondary-action"
                onClick={() => setReviewModalOpen(false)}
              >
                {t('aboutPage.reviews.close')}
              </button>
            </header>
            <form className="about-review-form" onSubmit={(event) => void submitReview(event)}>
              <label className="field">
                <span>{t('aboutPage.reviews.formLabel')}</span>
                <textarea
                  className="textarea-input"
                  maxLength={700}
                  value={reviewText}
                  placeholder={t('aboutPage.reviews.placeholder')}
                  onChange={(event) => setReviewText(event.target.value)}
                />
              </label>
              <div className="about-review-form-footer">
                <p>
                  {t('aboutPage.reviews.signedAs')} {authUser.fullName} ·{' '}
                  {t(`profile.role.${authUser.role}`)}
                </p>
                <div className="about-review-modal-actions">
                  <button
                    type="button"
                    className="button button-soft app-modal-secondary-action"
                    onClick={() => setReviewModalOpen(false)}
                  >
                    {t('aboutPage.reviews.cancel')}
                  </button>
                  <button
                    type="submit"
                    className="button button-primary"
                    disabled={reviewSaving || reviewText.trim().length < 10}
                  >
                    {reviewSaving
                      ? t('aboutPage.reviews.submitting')
                      : t('aboutPage.reviews.submit')}
                  </button>
                </div>
              </div>
              {reviewError ? <p className="form-error">{reviewError}</p> : null}
            </form>
          </div>
        </div>
      ) : null}

      <section className="about-cta-panel" aria-labelledby="about-cta-title">
        <div>
          <p className="eyebrow">{content.cta.eyebrow[language]}</p>
          <h2 id="about-cta-title">{content.cta.title[language]}</h2>
          <p>{content.cta.lead[language]}</p>
        </div>
        <Link to={ctaPath} className="button button-primary">
          {ctaLabel}
        </Link>
      </section>

      <section className="about-contacts-panel" aria-labelledby="about-contacts-title">
        <div className="about-contacts-copy">
          <p className="eyebrow">{content.contacts.eyebrow[language]}</p>
          <h2 id="about-contacts-title">{content.contacts.title[language]}</h2>
          <p>{content.contacts.lead[language]}</p>
        </div>
        <div className="about-contacts-grid">
          {content.contacts.items.map((item, index) => {
            const label = item.label[language].trim();
            const value = item.value[language].trim();

            if (!label || !value) {
              return null;
            }

            const body = (
              <>
                <span>{label}</span>
                <strong>{value}</strong>
              </>
            );

            return item.url ? (
              <a
                key={`${label}-${index}`}
                className="about-contact-card"
                href={item.url}
                aria-label={`${label} ${value}`}
                target="_blank"
                rel="noreferrer"
              >
                {body}
              </a>
            ) : (
              <div key={`${label}-${index}`} className="about-contact-card">
                {body}
              </div>
            );
          })}
        </div>
      </section>
    </section>
  );
}
