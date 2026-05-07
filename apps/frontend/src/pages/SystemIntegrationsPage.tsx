import { useEffect, useState } from 'react';
import QuietLoadingCard from '../components/QuietLoadingCard';
import { useI18n } from '../i18n/I18nProvider';
import { getAuthUser } from '../lib/auth';
import { apiRequest, uploadApiFile } from '../lib/api';
import { normalizeApiErrorMessage } from '../lib/errorMessages';

type GoogleSheetsSettingsResponse = {
  webhookUrl: string;
  secret: string;
  defaultSheetName: string;
  isConfigured: boolean;
  lastCheckedAt: string | null;
  lastCheckStatus: string | null;
  lastCheckMessage: string | null;
  lastExportAt: string | null;
  lastExportStatus: string | null;
  lastExportMessage: string | null;
  lastExportUrl: string | null;
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

type EmailTestResponse = {
  ok: boolean;
  status: string;
  message: string;
  checkedAt: string;
};

type NotificationRulesResponse = {
  registrationStarted: boolean;
  roundStarted: boolean;
  submissionReceived: boolean;
  deadlineReminder: boolean;
  submissionClosed: boolean;
  source: 'database' | 'default';
};

type TournamentDefaultsResponse = {
  minTeamMembers: number;
  maxTeamMembers: number;
  defaultMinReviewersPerSubmission: number;
  defaultProjectTimeZone: string;
  hideTeamsUntilRegistrationClose: boolean;
  defaultTournamentMaxTeams: number | null;
  defaultRegistrationWindowHours: number;
  defaultRoundDurationHours: number;
  defaultTournamentDescription: string;
  defaultRoundDescription: string;
  source: 'database' | 'default';
};

type LocalizedText = {
  uk: string;
  en: string;
};

type PlatformContentResponse = {
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

type PlatformContentBannerUploadResponse = {
  url: string;
};

type PlatformContentPath = string[];

type PlatformReviewStatus = 'PENDING' | 'APPROVED' | 'REJECTED';

type PlatformReviewResponse = {
  id: string;
  text: string;
  status: PlatformReviewStatus;
  author: {
    id: string;
    fullName: string;
    email: string | null;
    role: 'ADMIN' | 'TEAM' | 'JURY' | 'ORGANIZER';
  };
  moderator: {
    id: string;
    fullName: string;
    email: string | null;
  } | null;
  reviewedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

const LEGACY_CTA_TITLE_UK =
  'Відкрийте турнірний простір і перевірте платформу в реальному сценарії';
const CURRENT_CTA_TITLE_UK =
  'Відкрийте турнірний простір і перевірте себе в реальному сценарії';

function createPlatformContentPayload(platformContent: PlatformContentResponse) {
  return {
    hero: platformContent.hero,
    product: platformContent.product,
    roles: platformContent.roles,
    cta: platformContent.cta,
    contacts: platformContent.contacts,
  };
}

function trimToUndefined(value: string) {
  const normalized = value.trim();
  return normalized.length > 0 ? normalized : undefined;
}

function localized(uk: string, en: string): LocalizedText {
  return { uk, en };
}

function createDefaultPlatformContent(): PlatformContentResponse {
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
        'Відкрийте турнірний простір і перевірте себе в реальному сценарії',
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

  const uk = typeof value.uk === 'string' && value.uk.trim() ? value.uk.trim() : fallback.uk;
  const en = typeof value.en === 'string' && value.en.trim() ? value.en.trim() : fallback.en;

  return {
    uk: uk === LEGACY_CTA_TITLE_UK ? CURRENT_CTA_TITLE_UK : uk,
    en,
  };
}

function mergeOptionalString(value: unknown) {
  const normalized = typeof value === 'string' ? value.trim() : '';
  return normalized.length > 0 ? normalized : null;
}

function mergeContactItems(
  value: unknown,
  fallback: PlatformContentResponse['contacts']['items'],
) {
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

function normalizePlatformContent(value: unknown): PlatformContentResponse {
  const fallback = createDefaultPlatformContent();
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

function normalizePlatformReviews(value: unknown): PlatformReviewResponse[] {
  const source = Array.isArray(value) ? value : [];

  return source
    .map((item) => {
      if (!isRecord(item) || !isRecord(item.author)) {
        return null;
      }

      const status = item.status;
      const role = item.author.role;

      if (
        typeof item.id !== 'string' ||
        typeof item.text !== 'string' ||
        (status !== 'PENDING' && status !== 'APPROVED' && status !== 'REJECTED') ||
        typeof item.author.id !== 'string' ||
        typeof item.author.fullName !== 'string' ||
        (role !== 'ADMIN' && role !== 'TEAM' && role !== 'JURY' && role !== 'ORGANIZER')
      ) {
        return null;
      }

      const moderator = isRecord(item.moderator) ? item.moderator : null;

      return {
        id: item.id,
        text: item.text,
        status,
        author: {
          id: item.author.id,
          fullName: item.author.fullName,
          email: typeof item.author.email === 'string' ? item.author.email : null,
          role,
        },
        moderator:
          moderator && typeof moderator.id === 'string' && typeof moderator.fullName === 'string'
            ? {
                id: moderator.id,
                fullName: moderator.fullName,
                email: typeof moderator.email === 'string' ? moderator.email : null,
              }
            : null,
        reviewedAt: typeof item.reviewedAt === 'string' ? item.reviewedAt : null,
        createdAt: typeof item.createdAt === 'string' ? item.createdAt : '',
        updatedAt: typeof item.updatedAt === 'string' ? item.updatedAt : '',
      };
    })
    .filter((item): item is PlatformReviewResponse => !!item);
}

function formatDateTime(value: string | null, language: 'uk' | 'en', fallback: string) {
  if (!value) {
    return fallback;
  }

  return new Date(value).toLocaleString(language === 'uk' ? 'uk-UA' : 'en-US');
}

export default function SystemIntegrationsPage() {
  const { language, t } = useI18n();
  const authUser = getAuthUser();
  const [googleSheets, setGoogleSheets] = useState<GoogleSheetsSettingsResponse | null>(null);
  const [emailSettings, setEmailSettings] = useState<EmailSettingsResponse | null>(null);
  const [notificationRules, setNotificationRules] = useState<NotificationRulesResponse | null>(null);
  const [tournamentDefaults, setTournamentDefaults] =
    useState<TournamentDefaultsResponse | null>(null);
  const [platformContent, setPlatformContent] =
    useState<PlatformContentResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [googleSaving, setGoogleSaving] = useState(false);
  const [googleTesting, setGoogleTesting] = useState(false);
  const [emailSaving, setEmailSaving] = useState(false);
  const [emailTesting, setEmailTesting] = useState(false);
  const [rulesSaving, setRulesSaving] = useState(false);
  const [googleError, setGoogleError] = useState('');
  const [googleNotice, setGoogleNotice] = useState('');
  const [emailError, setEmailError] = useState('');
  const [emailNotice, setEmailNotice] = useState('');
  const [emailTestRecipient, setEmailTestRecipient] = useState(authUser?.email ?? '');
  const [rulesError, setRulesError] = useState('');
  const [rulesNotice, setRulesNotice] = useState('');
  const [defaultsSaving, setDefaultsSaving] = useState(false);
  const [defaultsError, setDefaultsError] = useState('');
  const [defaultsNotice, setDefaultsNotice] = useState('');
  const [platformContentSaving, setPlatformContentSaving] = useState(false);
  const [platformBannerUploading, setPlatformBannerUploading] = useState(false);
  const [platformBannerFileSelected, setPlatformBannerFileSelected] = useState(false);
  const [platformContentError, setPlatformContentError] = useState('');
  const [platformContentNotice, setPlatformContentNotice] = useState('');
  const [platformReviews, setPlatformReviews] = useState<PlatformReviewResponse[]>([]);
  const [platformReviewsFilter, setPlatformReviewsFilter] =
    useState<PlatformReviewStatus | 'ALL'>('PENDING');
  const [platformReviewsSavingId, setPlatformReviewsSavingId] = useState('');
  const [platformReviewsError, setPlatformReviewsError] = useState('');
  const [platformReviewsNotice, setPlatformReviewsNotice] = useState('');

  function getPlatformContentField(path: PlatformContentPath, locale: 'uk' | 'en') {
    let current: unknown = platformContent;

    for (const key of path) {
      if (!isRecord(current) && !Array.isArray(current)) {
        return '';
      }

      current = (current as Record<string, unknown>)[key];
    }

    return isRecord(current) && typeof current[locale] === 'string'
      ? current[locale]
      : '';
  }

  function getPlatformContentString(path: PlatformContentPath) {
    let current: unknown = platformContent;

    for (const key of path) {
      if (!isRecord(current) && !Array.isArray(current)) {
        return '';
      }

      current = (current as Record<string, unknown>)[key];
    }

    return typeof current === 'string' ? current : '';
  }

  function updatePlatformContentField(
    path: PlatformContentPath,
    locale: 'uk' | 'en',
    value: string,
  ) {
    setPlatformContent((current) => {
      if (!current) {
        return current;
      }

      const next = structuredClone(current);
      let target = next as unknown as Record<string, unknown>;

      for (const key of path) {
        target = target[key] as Record<string, unknown>;
      }

      target[locale] = value;
      return next;
    });
  }

  function updatePlatformContentString(path: PlatformContentPath, value: string) {
    setPlatformContent((current) => {
      if (!current) {
        return current;
      }

      const next = structuredClone(current);
      let target = next as unknown as Record<string, unknown>;
      const lastKey = path[path.length - 1];

      for (const key of path.slice(0, -1)) {
        target = target[key] as Record<string, unknown>;
      }

      target[lastKey] = value;
      return next;
    });
  }

  function updatePlatformContentHeroBanner(value: string) {
    setPlatformContent((current) =>
      current
        ? {
            ...current,
            hero: {
              ...current.hero,
              bannerImageUrl: value,
            },
          }
        : current,
    );
  }

  async function loadSettings() {
    setLoading(true);
    setLoadError('');
    setPlatformContentError('');
    setPlatformReviewsError('');

    try {
      const [googleData, emailData, rulesData, defaultsData] = await Promise.all([
        apiRequest<GoogleSheetsSettingsResponse>('/admin/system-integrations/google-sheets'),
        apiRequest<EmailSettingsResponse>('/admin/system-integrations/email'),
        apiRequest<NotificationRulesResponse>('/admin/system-integrations/notification-rules'),
        apiRequest<TournamentDefaultsResponse>(
          '/admin/system-integrations/tournament-defaults',
        ),
      ]);
      setGoogleSheets(googleData);
      setEmailSettings(emailData);
      setNotificationRules(rulesData);
      setTournamentDefaults(defaultsData);

      try {
        const contentData = await apiRequest<unknown>(
          '/admin/system-integrations/platform-content',
        );
        setPlatformContent(normalizePlatformContent(contentData));
      } catch {
        setPlatformContent(createDefaultPlatformContent());
        setPlatformContentError(t('systemIntegrations.platformContent.unavailable'));
      }

      try {
        const reviewsData = await apiRequest<unknown>(
          '/admin/system-integrations/platform-reviews',
        );
        setPlatformReviews(normalizePlatformReviews(reviewsData));
      } catch {
        setPlatformReviews([]);
        setPlatformReviewsError(t('systemIntegrations.platformReviews.unavailable'));
      }
    } catch (requestError) {
      setLoadError(
        normalizeApiErrorMessage(requestError, t, t('systemIntegrations.loadFailed')),
      );
      setGoogleSheets(null);
      setEmailSettings(null);
      setNotificationRules(null);
      setTournamentDefaults(null);
      setPlatformContent(null);
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
        normalizeApiErrorMessage(requestError, t, t('systemIntegrations.saveFailed')),
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
        normalizeApiErrorMessage(requestError, t, t('systemIntegrations.testFailed')),
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
        normalizeApiErrorMessage(requestError, t, t('systemIntegrations.saveFailed')),
      );
    } finally {
      setEmailSaving(false);
    }
  }

  async function testEmailDelivery() {
    if (!emailTestRecipient.trim()) {
      setEmailError(t('systemIntegrations.email.recipientRequired'));
      setEmailNotice('');
      return;
    }

    setEmailTesting(true);
    setEmailNotice('');
    setEmailError('');

    try {
      const result = await apiRequest<EmailTestResponse>(
        '/admin/system-integrations/email/test',
        {
          method: 'POST',
          body: {
            recipientEmail: emailTestRecipient.trim(),
          },
        },
      );

      setEmailSettings((current) =>
        current
          ? {
              ...current,
              lastCheckedAt: result.checkedAt,
              lastCheckStatus: result.status,
              lastCheckMessage: result.message,
            }
          : current,
      );
      setEmailNotice(result.message);
    } catch (requestError) {
      setEmailError(
        normalizeApiErrorMessage(requestError, t, t('systemIntegrations.testFailed')),
      );
    } finally {
      setEmailTesting(false);
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
        normalizeApiErrorMessage(requestError, t, t('systemIntegrations.saveFailed')),
      );
    } finally {
      setRulesSaving(false);
    }
  }

  async function saveTournamentDefaults() {
    if (!tournamentDefaults) {
      return;
    }

    setDefaultsSaving(true);
    setDefaultsNotice('');
    setDefaultsError('');

    try {
      const saved = await apiRequest<TournamentDefaultsResponse>(
        '/admin/system-integrations/tournament-defaults',
        {
          method: 'PATCH',
          body: {
            minTeamMembers: tournamentDefaults.minTeamMembers,
            maxTeamMembers: tournamentDefaults.maxTeamMembers,
            defaultMinReviewersPerSubmission:
              tournamentDefaults.defaultMinReviewersPerSubmission,
            defaultProjectTimeZone: trimToUndefined(
              tournamentDefaults.defaultProjectTimeZone,
            ),
            hideTeamsUntilRegistrationClose:
              tournamentDefaults.hideTeamsUntilRegistrationClose,
            defaultTournamentMaxTeams:
              tournamentDefaults.defaultTournamentMaxTeams ?? undefined,
            defaultRegistrationWindowHours:
              tournamentDefaults.defaultRegistrationWindowHours,
            defaultRoundDurationHours:
              tournamentDefaults.defaultRoundDurationHours,
            defaultTournamentDescription: trimToUndefined(
              tournamentDefaults.defaultTournamentDescription,
            ),
            defaultRoundDescription: trimToUndefined(
              tournamentDefaults.defaultRoundDescription,
            ),
          },
        },
      );
      setTournamentDefaults(saved);
      setDefaultsNotice(t('systemIntegrations.saved'));
    } catch (requestError) {
      setDefaultsError(
        normalizeApiErrorMessage(requestError, t, t('systemIntegrations.saveFailed')),
      );
    } finally {
      setDefaultsSaving(false);
    }
  }

  async function savePlatformContent() {
    if (!platformContent) {
      return;
    }

    setPlatformContentSaving(true);
    setPlatformContentNotice('');
    setPlatformContentError('');

    try {
      const saved = await apiRequest<unknown>(
        '/admin/system-integrations/platform-content',
        {
          method: 'PATCH',
          body: createPlatformContentPayload(platformContent),
        },
      );
      setPlatformContent(normalizePlatformContent(saved));
      setPlatformContentNotice(t('systemIntegrations.saved'));
    } catch (requestError) {
      setPlatformContentError(
        normalizeApiErrorMessage(requestError, t, t('systemIntegrations.saveFailed')),
      );
    } finally {
      setPlatformContentSaving(false);
    }
  }

  async function uploadPlatformBanner(file: File | undefined) {
    if (!file || !platformContent) {
      return;
    }

    setPlatformBannerUploading(true);
    setPlatformContentNotice('');
    setPlatformContentError('');

    try {
      const result = await uploadApiFile<PlatformContentBannerUploadResponse>(
        '/admin/system-integrations/platform-content/banner',
        'file',
        file,
      );
      const nextContent = {
        ...platformContent,
        hero: {
          ...platformContent.hero,
          bannerImageUrl: result.url,
        },
      };
      setPlatformContent(nextContent);

      const saved = await apiRequest<unknown>(
        '/admin/system-integrations/platform-content',
        {
          method: 'PATCH',
          body: createPlatformContentPayload(nextContent),
        },
      );
      setPlatformContent(normalizePlatformContent(saved));
      setPlatformBannerFileSelected(true);
      setPlatformContentNotice(t('systemIntegrations.platformContent.bannerUploaded'));
    } catch (requestError) {
      setPlatformContentError(
        normalizeApiErrorMessage(
          requestError,
          t,
          t('systemIntegrations.platformContent.bannerUploadFailed'),
        ),
      );
    } finally {
      setPlatformBannerUploading(false);
    }
  }

  async function moderatePlatformReview(reviewId: string, status: PlatformReviewStatus) {
    setPlatformReviewsSavingId(reviewId);
    setPlatformReviewsError('');
    setPlatformReviewsNotice('');

    try {
      const updated = await apiRequest<unknown>(
        `/admin/system-integrations/platform-reviews/${reviewId}`,
        {
          method: 'PATCH',
          body: { status },
        },
      );
      const [normalized] = normalizePlatformReviews([updated]);
      if (normalized) {
        setPlatformReviews((current) =>
          current.map((review) => (review.id === normalized.id ? normalized : review)),
        );
      }
      setPlatformReviewsNotice(t('systemIntegrations.platformReviews.saved'));
    } catch (requestError) {
      setPlatformReviewsError(
        normalizeApiErrorMessage(
          requestError,
          t,
          t('systemIntegrations.platformReviews.saveFailed'),
        ),
      );
    } finally {
      setPlatformReviewsSavingId('');
    }
  }

  if (loading) {
    return <QuietLoadingCard label={t('systemIntegrations.loading')} />;
  }

  if (!googleSheets && !emailSettings && !notificationRules && !tournamentDefaults && !platformContent) {
    return (
      <article className="card state-card">
        <p className="form-error">{loadError || t('systemIntegrations.loadFailed')}</p>
        <button type="button" className="button button-soft" onClick={() => void loadSettings()}>
          {t('systemIntegrations.retry')}
        </button>
      </article>
    );
  }

  if (!googleSheets || !emailSettings || !notificationRules || !tournamentDefaults || !platformContent) {
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
  const enabledRuleCount = [
    notificationRules.registrationStarted,
    notificationRules.roundStarted,
    notificationRules.submissionReceived,
    notificationRules.deadlineReminder,
    notificationRules.submissionClosed,
  ].filter(Boolean).length;
  const configuredToolCount = [googleSheets.isConfigured, emailStatusKey === 'active', true, true]
    .filter(Boolean)
    .length;
  const operationalCards = [
    {
      id: 'integrations-google-sheets',
      eyebrow: t('systemIntegrations.googleSheets.title'),
      title: t('systemIntegrations.workspaceCards.googleSheetsTitle'),
      lead: googleSheets.isConfigured
        ? t('systemIntegrations.workspaceCards.googleSheetsReady')
        : t('systemIntegrations.workspaceCards.googleSheetsPending'),
      status: googleSheets.isConfigured
        ? t('systemIntegrations.googleSheets.configured')
        : t('systemIntegrations.googleSheets.notConfigured'),
    },
    {
      id: 'integrations-email',
      eyebrow: t('systemIntegrations.email.title'),
      title: t('systemIntegrations.workspaceCards.emailTitle'),
      lead:
        emailStatusKey === 'active'
          ? t('systemIntegrations.workspaceCards.emailReady')
          : t('systemIntegrations.workspaceCards.emailPending'),
      status: t(`systemIntegrations.email.status.${emailStatusKey}`),
    },
    {
      id: 'integrations-defaults',
      eyebrow: t('systemIntegrations.tournamentDefaults.title'),
      title: t('systemIntegrations.workspaceCards.defaultsTitle'),
      lead: t('systemIntegrations.workspaceCards.defaultsLead'),
      status: t(
        `systemIntegrations.tournamentDefaults.sources.${tournamentDefaults.source}`,
      ),
    },
    {
      id: 'integrations-rules',
      eyebrow: t('systemIntegrations.notificationRules.title'),
      title: t('systemIntegrations.workspaceCards.rulesTitle'),
      lead: `${enabledRuleCount} ${t('systemIntegrations.workspaceCards.rulesLead')}`,
      status: t(`systemIntegrations.notificationRules.sources.${notificationRules.source}`),
    },
  ];
  const onboardingSteps = [
    {
      id: 'google',
      title: t('systemIntegrations.onboarding.steps.google.title'),
      lead: t('systemIntegrations.onboarding.steps.google.lead'),
      target: '#integrations-google-sheets',
    },
    {
      id: 'email',
      title: t('systemIntegrations.onboarding.steps.email.title'),
      lead: t('systemIntegrations.onboarding.steps.email.lead'),
      target: '#integrations-email',
    },
    {
      id: 'defaults',
      title: t('systemIntegrations.onboarding.steps.defaults.title'),
      lead: t('systemIntegrations.onboarding.steps.defaults.lead'),
      target: '#integrations-defaults',
    },
  ];
  const workspaceCardClassName = (cardId: string) => {
    switch (cardId) {
      case 'integrations-google-sheets':
        return 'dashboard-tool-card dashboard-tool-card--teal';
      case 'integrations-email':
        return 'dashboard-tool-card dashboard-tool-card--purple';
      case 'integrations-defaults':
        return 'dashboard-tool-card dashboard-tool-card--orange';
      case 'integrations-rules':
        return 'dashboard-tool-card dashboard-tool-card--berry';
      default:
        return 'dashboard-tool-card';
    }
  };
  const platformContentSections = [
    {
      id: 'hero',
      title: t('systemIntegrations.platformContent.sections.hero'),
      fields: [
        {
          label: t('systemIntegrations.platformContent.form.heroEyebrow'),
          path: ['hero', 'eyebrow'],
        },
        {
          label: t('systemIntegrations.platformContent.form.heroTitle'),
          path: ['hero', 'title'],
        },
        {
          label: t('systemIntegrations.platformContent.form.heroDescription'),
          path: ['hero', 'description'],
          multiline: true,
        },
      ],
    },
    {
      id: 'product',
      title: t('systemIntegrations.platformContent.sections.product'),
      fields: [
        {
          label: t('systemIntegrations.platformContent.form.productEyebrow'),
          path: ['product', 'eyebrow'],
        },
        {
          label: t('systemIntegrations.platformContent.form.productTitle'),
          path: ['product', 'title'],
        },
        {
          label: t('systemIntegrations.platformContent.form.productLead'),
          path: ['product', 'lead'],
          multiline: true,
        },
      ],
    },
    {
      id: 'roles',
      title: t('systemIntegrations.platformContent.sections.roles'),
      fields: [
        {
          label: t('systemIntegrations.platformContent.form.rolesLabel'),
          path: ['roles', 'label'],
        },
        {
          label: t('systemIntegrations.platformContent.form.organizersTitle'),
          path: ['roles', 'organizers', 'title'],
        },
        {
          label: t('systemIntegrations.platformContent.form.organizersLead'),
          path: ['roles', 'organizers', 'lead'],
          multiline: true,
        },
        {
          label: t('systemIntegrations.platformContent.form.teamsTitle'),
          path: ['roles', 'teams', 'title'],
        },
        {
          label: t('systemIntegrations.platformContent.form.teamsLead'),
          path: ['roles', 'teams', 'lead'],
          multiline: true,
        },
        {
          label: t('systemIntegrations.platformContent.form.juryTitle'),
          path: ['roles', 'jury', 'title'],
        },
        {
          label: t('systemIntegrations.platformContent.form.juryLead'),
          path: ['roles', 'jury', 'lead'],
          multiline: true,
        },
      ],
    },
    {
      id: 'cta',
      title: t('systemIntegrations.platformContent.sections.cta'),
      fields: [
        {
          label: t('systemIntegrations.platformContent.form.ctaEyebrow'),
          path: ['cta', 'eyebrow'],
        },
        {
          label: t('systemIntegrations.platformContent.form.ctaTitle'),
          path: ['cta', 'title'],
        },
        {
          label: t('systemIntegrations.platformContent.form.ctaLead'),
          path: ['cta', 'lead'],
          multiline: true,
        },
        {
          label: t('systemIntegrations.platformContent.form.registerLabel'),
          path: ['cta', 'registerLabel'],
        },
        {
          label: t('systemIntegrations.platformContent.form.workspaceLabel'),
          path: ['cta', 'workspaceLabel'],
        },
      ],
    },
    {
      id: 'contacts',
      title: t('systemIntegrations.platformContent.sections.contacts'),
      fields: [
        {
          label: t('systemIntegrations.platformContent.form.contactsEyebrow'),
          path: ['contacts', 'eyebrow'],
        },
        {
          label: t('systemIntegrations.platformContent.form.contactsTitle'),
          path: ['contacts', 'title'],
        },
        {
          label: t('systemIntegrations.platformContent.form.contactsLead'),
          path: ['contacts', 'lead'],
          multiline: true,
        },
      ],
    },
  ] satisfies Array<{
    id: string;
    title: string;
    fields: Array<{
      label: string;
      path: PlatformContentPath;
      multiline?: boolean;
    }>;
  }>;
  const platformContactItems = platformContent.contacts.items.map((item, index) => ({
    id: `contact-${index}`,
    label: item.label[language] || `${t('systemIntegrations.platformContent.form.contact')} ${index + 1}`,
    index,
  }));
  const platformReviewStatusFilters = ['PENDING', 'APPROVED', 'REJECTED', 'ALL'] as const;
  const filteredPlatformReviews = platformReviews.filter((review) =>
    platformReviewsFilter === 'ALL' ? true : review.status === platformReviewsFilter,
  );

  return (
    <section className="team-dashboard">
      <header className="section-header">
        <p className="eyebrow">{t('systemIntegrations.eyebrow')}</p>
        <h1>{t('systemIntegrations.title')}</h1>
        <p className="lead">{t('systemIntegrations.lead')}</p>
      </header>

      <article className="card panel-card integrations-workspace-card">
        <div className="integrations-workspace-head">
          <div className="integrations-workspace-copy">
            <p className="eyebrow dashboard-workspace-eyebrow">
              {t('systemIntegrations.workspaceEyebrow')}
            </p>
            <h2>{t('systemIntegrations.workspaceTitle')}</h2>
            <p>{t('systemIntegrations.workspaceLead')}</p>
          </div>
          <div className="dashboard-workspace-status integrations-workspace-status">
            <span>{t('systemIntegrations.workspaceStatusLabel')}</span>
            <strong>{configuredToolCount}/4</strong>
            <p>{t('systemIntegrations.workspaceStatusLead')}</p>
          </div>
        </div>

        <div className="dashboard-toolset-grid integrations-toolset-grid">
          {operationalCards.map((card) => (
            <a key={card.id} href={`#${card.id}`} className={workspaceCardClassName(card.id)}>
              <span>{card.eyebrow}</span>
              <strong>{card.title}</strong>
              <p>{card.lead}</p>
              <em>{card.status}</em>
            </a>
          ))}
        </div>
      </article>

      <article className="card panel-card dashboard-onboarding-card">
        <div className="dashboard-workspace-panel-head">
          <h2>{t('systemIntegrations.onboarding.title')}</h2>
          <p>{t('systemIntegrations.onboarding.lead')}</p>
        </div>
        <div className="onboarding-grid">
          {onboardingSteps.map((step, index) => (
            <article key={step.id} className="onboarding-card">
              <span className="onboarding-step">{index + 1}</span>
              <strong>{step.title}</strong>
              <p>{step.lead}</p>
              <div className="onboarding-card-actions">
                <a href={step.target} className="button button-soft onboarding-action-primary">
                  {t('shell.open')}
                </a>
                {step.id === 'defaults' ? (
                  <a
                    href="#integrations-rules"
                    className="button button-ghost onboarding-action-secondary"
                  >
                    {t('systemIntegrations.notificationRules.title')}
                  </a>
                ) : null}
              </div>
            </article>
          ))}
        </div>
      </article>

      <article id="integrations-google-sheets" className="card panel-card">
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
          <div>
            <dt>{t('systemIntegrations.googleSheets.lastExport')}</dt>
            <dd>
              {formatDateTime(
                googleSheets.lastExportAt,
                language,
                t('systemIntegrations.googleSheets.notExported'),
              )}
            </dd>
          </div>
          <div>
            <dt>{t('systemIntegrations.googleSheets.lastExportStatus')}</dt>
            <dd>
              {googleSheets.lastExportStatus ||
                t('systemIntegrations.googleSheets.unknown')}
            </dd>
          </div>
        </div>

        {googleSheets.lastCheckMessage ? (
          <div className="state-callout subtle">
            <strong>{t('systemIntegrations.googleSheets.connectionMessage')}</strong>
            <p>{googleSheets.lastCheckMessage}</p>
          </div>
        ) : null}

        {googleSheets.lastExportMessage ? (
          <div className="state-callout subtle">
            <strong>{t('systemIntegrations.googleSheets.exportMessage')}</strong>
            <p>{googleSheets.lastExportMessage}</p>
            {googleSheets.lastExportUrl ? (
              <a
                className="inline-link"
                href={googleSheets.lastExportUrl}
                target="_blank"
                rel="noreferrer"
              >
                {t('systemIntegrations.googleSheets.openLastExport')}
              </a>
            ) : null}
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
            className="button tournaments-card-action tournaments-card-action--secondary"
            onClick={() => void testGoogleSheetsConnection()}
            disabled={googleTesting}
          >
            {googleTesting
              ? t('systemIntegrations.googleSheets.testing')
              : t('systemIntegrations.googleSheets.testConnection')}
          </button>
          <button
            type="button"
            className="button button-primary admin-primary-action"
            onClick={() => void saveGoogleSheets()}
            disabled={googleSaving}
          >
            {googleSaving ? t('systemIntegrations.saving') : t('systemIntegrations.save')}
          </button>
        </div>

        {googleNotice ? <p className="form-success">{googleNotice}</p> : null}
        {googleError ? <p className="form-error">{googleError}</p> : null}
      </article>

      <article id="integrations-email" className="card panel-card">
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
          <div>
            <dt>{t('systemIntegrations.email.lastDelivery')}</dt>
            <dd>
              {formatDateTime(
                emailSettings.lastCheckedAt,
                language,
                t('systemIntegrations.email.notDelivered'),
              )}
            </dd>
          </div>
          <div>
            <dt>{t('systemIntegrations.email.lastDeliveryStatus')}</dt>
            <dd>{emailSettings.lastCheckStatus || t('systemIntegrations.email.unknown')}</dd>
          </div>
        </div>

        {emailStatusKey === 'incomplete' ? (
          <div className="state-callout subtle">
            <strong>{t('systemIntegrations.email.incompleteTitle')}</strong>
            <p>{t('systemIntegrations.email.incompleteLead')}</p>
          </div>
        ) : null}

        {emailSettings.lastCheckMessage ? (
          <div className="state-callout subtle">
            <strong>{t('systemIntegrations.email.lastMessage')}</strong>
            <p>{emailSettings.lastCheckMessage}</p>
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
          <label className="field">
            <span>{t('systemIntegrations.email.form.recipientEmail')}</span>
            <input
              type="email"
              value={emailTestRecipient}
              onChange={(event) => setEmailTestRecipient(event.target.value)}
            />
          </label>
        </div>

        <div className="status-actions">
          <button
            type="button"
            className="button tournaments-card-action tournaments-card-action--secondary"
            onClick={() => void testEmailDelivery()}
            disabled={emailTesting}
          >
            {emailTesting
              ? t('systemIntegrations.email.testing')
              : t('systemIntegrations.email.testSend')}
          </button>
          <button
            type="button"
            className="button button-primary admin-primary-action"
            onClick={() => void saveEmailSettings()}
            disabled={emailSaving}
          >
            {emailSaving ? t('systemIntegrations.saving') : t('systemIntegrations.save')}
          </button>
        </div>

        {emailNotice ? <p className="form-success">{emailNotice}</p> : null}
        {emailError ? <p className="form-error">{emailError}</p> : null}
      </article>

      <article id="integrations-defaults" className="card panel-card">
        <div className="tournament-head">
          <h2>{t('systemIntegrations.tournamentDefaults.title')}</h2>
          <span className="status-pill active">
            {t(`systemIntegrations.tournamentDefaults.sources.${tournamentDefaults.source}`)}
          </span>
        </div>

        <p className="inline-hint">{t('systemIntegrations.tournamentDefaults.lead')}</p>
        <div className="state-callout subtle">
          <strong>
            {t(`systemIntegrations.tournamentDefaults.sources.${tournamentDefaults.source}`)}
          </strong>
          <p>
            {t(
              `systemIntegrations.tournamentDefaults.sourceHints.${tournamentDefaults.source}`,
            )}
          </p>
        </div>

        <div className="profile-settings-fields two-col">
          <label className="field">
            <span>{t('systemIntegrations.tournamentDefaults.form.minTeamMembers')}</span>
            <input
              type="number"
              min={1}
              max={20}
              value={tournamentDefaults.minTeamMembers}
              onChange={(event) =>
                setTournamentDefaults((current) =>
                  current
                    ? {
                        ...current,
                        minTeamMembers: Number(event.target.value) || 1,
                      }
                    : current,
                )
              }
            />
          </label>
          <label className="field">
            <span>{t('systemIntegrations.tournamentDefaults.form.maxTeamMembers')}</span>
            <input
              type="number"
              min={1}
              max={20}
              value={tournamentDefaults.maxTeamMembers}
              onChange={(event) =>
                setTournamentDefaults((current) =>
                  current
                    ? {
                        ...current,
                        maxTeamMembers: Number(event.target.value) || 1,
                      }
                    : current,
                )
              }
            />
          </label>
          <label className="field">
            <span>
              {t('systemIntegrations.tournamentDefaults.form.defaultMinReviewersPerSubmission')}
            </span>
            <input
              type="number"
              min={1}
              max={12}
              value={tournamentDefaults.defaultMinReviewersPerSubmission}
              onChange={(event) =>
                setTournamentDefaults((current) =>
                  current
                    ? {
                        ...current,
                        defaultMinReviewersPerSubmission:
                          Number(event.target.value) || 1,
                      }
                    : current,
                )
              }
            />
          </label>
          <label className="field">
            <span>{t('systemIntegrations.tournamentDefaults.form.defaultProjectTimeZone')}</span>
            <input
              value={tournamentDefaults.defaultProjectTimeZone}
              onChange={(event) =>
                setTournamentDefaults((current) =>
                  current
                    ? {
                        ...current,
                        defaultProjectTimeZone: event.target.value,
                      }
                    : current,
                )
              }
            />
          </label>
          <label className="field">
            <span>{t('systemIntegrations.tournamentDefaults.form.defaultTournamentMaxTeams')}</span>
            <input
              type="number"
              min={1}
              max={500}
              value={tournamentDefaults.defaultTournamentMaxTeams ?? ''}
              onChange={(event) =>
                setTournamentDefaults((current) =>
                  current
                    ? {
                        ...current,
                        defaultTournamentMaxTeams: event.target.value
                          ? Number(event.target.value)
                          : null,
                      }
                    : current,
                )
              }
            />
          </label>
          <label className="field">
            <span>
              {t('systemIntegrations.tournamentDefaults.form.defaultRegistrationWindowHours')}
            </span>
            <input
              type="number"
              min={1}
              max={720}
              value={tournamentDefaults.defaultRegistrationWindowHours}
              onChange={(event) =>
                setTournamentDefaults((current) =>
                  current
                    ? {
                        ...current,
                        defaultRegistrationWindowHours:
                          Number(event.target.value) || 1,
                      }
                    : current,
                )
              }
            />
          </label>
          <label className="field">
            <span>{t('systemIntegrations.tournamentDefaults.form.defaultRoundDurationHours')}</span>
            <input
              type="number"
              min={1}
              max={720}
              value={tournamentDefaults.defaultRoundDurationHours}
              onChange={(event) =>
                setTournamentDefaults((current) =>
                  current
                    ? {
                        ...current,
                        defaultRoundDurationHours:
                          Number(event.target.value) || 1,
                      }
                    : current,
                )
              }
            />
          </label>
        </div>

        <div className="profile-preferences-block">
          <label
            className="profile-toggle-row"
            htmlFor="tournament-default-hide-teams-until-close"
          >
            <button
              id="tournament-default-hide-teams-until-close"
              type="button"
              className={`settings-toggle${tournamentDefaults.hideTeamsUntilRegistrationClose ? ' on' : ''}`}
              onClick={() =>
                setTournamentDefaults((current) =>
                  current
                    ? {
                        ...current,
                        hideTeamsUntilRegistrationClose:
                          !current.hideTeamsUntilRegistrationClose,
                      }
                    : current,
                )
              }
              aria-label={t('systemIntegrations.tournamentDefaults.form.hideTeamsUntilRegistrationClose')}
              aria-pressed={tournamentDefaults.hideTeamsUntilRegistrationClose}
            />
            <span>
              {t('systemIntegrations.tournamentDefaults.form.hideTeamsUntilRegistrationClose')}
            </span>
          </label>
        </div>

        <div className="profile-settings-fields">
          <label className="field">
            <span>{t('systemIntegrations.tournamentDefaults.form.defaultTournamentDescription')}</span>
            <textarea
              className="textarea-input"
              value={tournamentDefaults.defaultTournamentDescription}
              onChange={(event) =>
                setTournamentDefaults((current) =>
                  current
                    ? {
                        ...current,
                        defaultTournamentDescription: event.target.value,
                      }
                    : current,
                )
              }
            />
          </label>
          <label className="field">
            <span>{t('systemIntegrations.tournamentDefaults.form.defaultRoundDescription')}</span>
            <textarea
              className="textarea-input"
              value={tournamentDefaults.defaultRoundDescription}
              onChange={(event) =>
                setTournamentDefaults((current) =>
                  current
                    ? {
                        ...current,
                        defaultRoundDescription: event.target.value,
                      }
                    : current,
                )
              }
            />
          </label>
        </div>

        <div className="status-actions">
          <button
            type="button"
            className="button button-primary admin-primary-action"
            onClick={() => void saveTournamentDefaults()}
            disabled={defaultsSaving}
          >
            {defaultsSaving ? t('systemIntegrations.saving') : t('systemIntegrations.save')}
          </button>
        </div>

        {defaultsNotice ? <p className="form-success">{defaultsNotice}</p> : null}
        {defaultsError ? <p className="form-error">{defaultsError}</p> : null}
      </article>

      <article id="integrations-rules" className="card panel-card">
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

        <div className="profile-preferences-block integrations-toggle-list">
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
            className="button button-primary admin-primary-action"
            onClick={() => void saveNotificationRules()}
            disabled={rulesSaving}
          >
            {rulesSaving ? t('systemIntegrations.saving') : t('systemIntegrations.save')}
          </button>
        </div>

        {rulesNotice ? <p className="form-success">{rulesNotice}</p> : null}
        {rulesError ? <p className="form-error">{rulesError}</p> : null}
      </article>

      <article id="integrations-platform-content" className="card panel-card">
        <div className="tournament-head">
          <h2>{t('systemIntegrations.platformContent.title')}</h2>
          <span className="status-pill active">
            {t(`systemIntegrations.platformContent.sources.${platformContent.source}`)}
          </span>
        </div>

        <p className="inline-hint">{t('systemIntegrations.platformContent.lead')}</p>
        <div className="state-callout subtle">
          <strong>
            {t(`systemIntegrations.platformContent.sources.${platformContent.source}`)}
          </strong>
          <p>
            {t(
              `systemIntegrations.platformContent.sourceHints.${platformContent.source}`,
            )}
          </p>
        </div>

        <div className="platform-content-editor">
          <section className="platform-content-section">
            <h3>{t('systemIntegrations.platformContent.sections.heroMedia')}</h3>
            <label className="field platform-content-banner-field">
              <span>{t('systemIntegrations.platformContent.form.heroBannerImageUrl')}</span>
              <input
                type="text"
                inputMode="url"
                value={platformContent.hero.bannerImageUrl ?? ''}
                placeholder={t('systemIntegrations.platformContent.form.heroBannerPlaceholder')}
                onChange={(event) => updatePlatformContentHeroBanner(event.target.value)}
              />
            </label>
            <div className="field platform-content-banner-field">
              <span id="platform-content-banner-upload-label">
                {t('systemIntegrations.platformContent.form.heroBannerUpload')}
              </span>
              <div className="platform-content-upload-control">
                <input
                  id="platform-content-banner-upload"
                  className="visually-hidden"
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  disabled={platformBannerUploading}
                  aria-labelledby="platform-content-banner-upload-label"
                  onChange={(event) => {
                    void uploadPlatformBanner(event.currentTarget.files?.[0]);
                    event.currentTarget.value = '';
                  }}
                />
                <label
                  htmlFor="platform-content-banner-upload"
                  className="button button-soft platform-content-upload-button"
                  aria-disabled={platformBannerUploading}
                >
                  {platformBannerUploading
                    ? t('systemIntegrations.platformContent.bannerUploading')
                    : t('systemIntegrations.platformContent.form.heroBannerChooseFile')}
                </label>
                <span className="platform-content-file-state">
                  {platformBannerFileSelected
                    ? t('systemIntegrations.platformContent.form.heroBannerFileSelected')
                    : t('systemIntegrations.platformContent.form.heroBannerNoFile')}
                </span>
              </div>
            </div>
            <p className="inline-hint platform-content-upload-hint">
              {platformBannerUploading
                ? t('systemIntegrations.platformContent.bannerUploading')
                : t('systemIntegrations.platformContent.bannerUploadHint')}
            </p>
          </section>

          {platformContentSections.map((section) => (
            <section key={section.id} className="platform-content-section">
              <h3>{section.title}</h3>
              <div className="platform-content-field-grid">
                {section.fields.map((field) => (
                  <div key={field.path.join('.')} className="platform-content-localized-field">
                    <strong>{field.label}</strong>
                    <label className="field">
                      <span>{t('systemIntegrations.platformContent.locales.uk')}</span>
                      {field.multiline ? (
                        <textarea
                          className="textarea-input platform-content-textarea"
                          value={getPlatformContentField(field.path, 'uk')}
                          onChange={(event) =>
                            updatePlatformContentField(field.path, 'uk', event.target.value)
                          }
                        />
                      ) : (
                        <input
                          value={getPlatformContentField(field.path, 'uk')}
                          onChange={(event) =>
                            updatePlatformContentField(field.path, 'uk', event.target.value)
                          }
                        />
                      )}
                    </label>
                    <label className="field">
                      <span>{t('systemIntegrations.platformContent.locales.en')}</span>
                      {field.multiline ? (
                        <textarea
                          className="textarea-input platform-content-textarea"
                          value={getPlatformContentField(field.path, 'en')}
                          onChange={(event) =>
                            updatePlatformContentField(field.path, 'en', event.target.value)
                          }
                        />
                      ) : (
                        <input
                          value={getPlatformContentField(field.path, 'en')}
                          onChange={(event) =>
                            updatePlatformContentField(field.path, 'en', event.target.value)
                          }
                        />
                      )}
                    </label>
                  </div>
                ))}
              </div>
            </section>
          ))}

          <section className="platform-content-section">
            <h3>{t('systemIntegrations.platformContent.sections.contactChannels')}</h3>
            <div className="platform-content-contact-grid">
              {platformContactItems.map((contact) => (
                <div key={contact.id} className="platform-content-localized-field">
                  <strong>{contact.label}</strong>
                  <label className="field">
                    <span>{t('systemIntegrations.platformContent.form.contactLabelUk')}</span>
                    <input
                      value={getPlatformContentField(
                        ['contacts', 'items', String(contact.index), 'label'],
                        'uk',
                      )}
                      onChange={(event) =>
                        updatePlatformContentField(
                          ['contacts', 'items', String(contact.index), 'label'],
                          'uk',
                          event.target.value,
                        )
                      }
                    />
                  </label>
                  <label className="field">
                    <span>{t('systemIntegrations.platformContent.form.contactLabelEn')}</span>
                    <input
                      value={getPlatformContentField(
                        ['contacts', 'items', String(contact.index), 'label'],
                        'en',
                      )}
                      onChange={(event) =>
                        updatePlatformContentField(
                          ['contacts', 'items', String(contact.index), 'label'],
                          'en',
                          event.target.value,
                        )
                      }
                    />
                  </label>
                  <label className="field">
                    <span>{t('systemIntegrations.platformContent.form.contactValueUk')}</span>
                    <input
                      value={getPlatformContentField(
                        ['contacts', 'items', String(contact.index), 'value'],
                        'uk',
                      )}
                      onChange={(event) =>
                        updatePlatformContentField(
                          ['contacts', 'items', String(contact.index), 'value'],
                          'uk',
                          event.target.value,
                        )
                      }
                    />
                  </label>
                  <label className="field">
                    <span>{t('systemIntegrations.platformContent.form.contactValueEn')}</span>
                    <input
                      value={getPlatformContentField(
                        ['contacts', 'items', String(contact.index), 'value'],
                        'en',
                      )}
                      onChange={(event) =>
                        updatePlatformContentField(
                          ['contacts', 'items', String(contact.index), 'value'],
                          'en',
                          event.target.value,
                        )
                      }
                    />
                  </label>
                  <label className="field">
                    <span>{t('systemIntegrations.platformContent.form.contactUrl')}</span>
                    <input
                      value={getPlatformContentString([
                        'contacts',
                        'items',
                        String(contact.index),
                        'url',
                      ])}
                      placeholder="https://"
                      onChange={(event) =>
                        updatePlatformContentString(
                          ['contacts', 'items', String(contact.index), 'url'],
                          event.target.value,
                        )
                      }
                    />
                  </label>
                </div>
              ))}
            </div>
          </section>
        </div>

        <div className="status-actions">
          <button
            type="button"
            className="button button-primary admin-primary-action"
            onClick={() => void savePlatformContent()}
            disabled={platformContentSaving || platformBannerUploading}
          >
            {platformContentSaving || platformBannerUploading
              ? t('systemIntegrations.saving')
              : t('systemIntegrations.save')}
          </button>
        </div>

        {platformContentNotice ? <p className="form-success">{platformContentNotice}</p> : null}
        {platformContentError ? <p className="form-error">{platformContentError}</p> : null}
      </article>

      <article id="integrations-platform-reviews" className="card panel-card">
        <div className="tournament-head">
          <h2>{t('systemIntegrations.platformReviews.title')}</h2>
          <span className="status-pill active">
            {t('systemIntegrations.platformReviews.moderation')}
          </span>
        </div>

        <p className="inline-hint">{t('systemIntegrations.platformReviews.lead')}</p>

        <div className="platform-review-filter-row" role="group" aria-label={t('systemIntegrations.platformReviews.filterAria')}>
          {platformReviewStatusFilters.map((status) => (
            <button
              key={status}
              type="button"
              className={`button button-soft ${platformReviewsFilter === status ? 'active' : ''}`}
              onClick={() => setPlatformReviewsFilter(status)}
            >
              {t(`systemIntegrations.platformReviews.filters.${status}`)}
            </button>
          ))}
        </div>

        {filteredPlatformReviews.length > 0 ? (
          <div className="platform-review-admin-grid">
            {filteredPlatformReviews.map((review) => (
              <article key={review.id} className="platform-review-admin-card">
                <div className="platform-review-admin-head">
                  <div>
                    <strong>{review.author.fullName}</strong>
                    <span>
                      {t(`profile.role.${review.author.role}`)}
                      {review.author.email ? ` · ${review.author.email}` : ''}
                    </span>
                  </div>
                  <span className={`status-pill platform-review-status-${review.status.toLowerCase()}`}>
                    {t(`systemIntegrations.platformReviews.status.${review.status}`)}
                  </span>
                </div>
                <p>{review.text}</p>
                <dl className="platform-review-admin-meta">
                  <div>
                    <dt>{t('systemIntegrations.platformReviews.updatedAt')}</dt>
                    <dd>
                      {formatDateTime(
                        review.updatedAt,
                        language,
                        t('systemIntegrations.platformReviews.notReviewed'),
                      )}
                    </dd>
                  </div>
                  <div>
                    <dt>{t('systemIntegrations.platformReviews.moderator')}</dt>
                    <dd>{review.moderator?.fullName ?? t('systemIntegrations.platformReviews.notReviewed')}</dd>
                  </div>
                </dl>
                <div className="status-actions">
                  <button
                    type="button"
                    className="button button-primary admin-primary-action"
                    disabled={platformReviewsSavingId === review.id || review.status === 'APPROVED'}
                    onClick={() => void moderatePlatformReview(review.id, 'APPROVED')}
                  >
                    {t('systemIntegrations.platformReviews.approve')}
                  </button>
                  <button
                    type="button"
                    className="button button-soft"
                    disabled={platformReviewsSavingId === review.id || review.status === 'REJECTED'}
                    onClick={() => void moderatePlatformReview(review.id, 'REJECTED')}
                  >
                    {t('systemIntegrations.platformReviews.reject')}
                  </button>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <div className="state-callout subtle">
            <strong>{t('systemIntegrations.platformReviews.emptyTitle')}</strong>
            <p>{t('systemIntegrations.platformReviews.emptyLead')}</p>
          </div>
        )}

        {platformReviewsNotice ? <p className="form-success">{platformReviewsNotice}</p> : null}
        {platformReviewsError ? <p className="form-error">{platformReviewsError}</p> : null}
      </article>
    </section>
  );
}
