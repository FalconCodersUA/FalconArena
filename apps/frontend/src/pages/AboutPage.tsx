import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useI18n } from '../i18n/I18nProvider';
import { apiRequest, resolveApiAssetUrl } from '../lib/api';
import { isAuthenticated } from '../lib/auth';

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

export default function AboutPage() {
  const { language } = useI18n();
  const isSignedIn = isAuthenticated();
  const fallbackContent = useMemo(() => createFallbackContent(), []);
  const ctaPath = isSignedIn ? '/app/tournaments' : '/app/register';
  const [content, setContent] = useState<PlatformAboutResponse>(() => fallbackContent);
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
