export type Language = 'uk' | 'en';

type MessageTree = {
  [key: string]: string | MessageTree;
};

type TranslationMap = Record<Language, MessageTree>;

export const DEFAULT_LANGUAGE: Language = 'uk';
export const SUPPORTED_LANGUAGES: Language[] = ['uk', 'en'];

export const messages: TranslationMap = {
  uk: {
    shell: {
      navAria: 'Основна навігація',
      home: 'Головна',
      login: 'Увійти',
      logout: 'Вийти',
      languageAria: 'Перемикач мови',
    },
    language: {
      uk: 'Українська',
      en: 'English',
    },
    login: {
      eyebrow: 'Доступ до панелі',
      title: 'Увійдіть у FalconArena',
      lead: 'Використайте акаунт організатора, журі, команди або адміністратора для входу в систему.',
      email: 'Email',
      password: 'Пароль',
      submit: 'Увійти',
      submitting: 'Вхід...',
      requestFailed: 'Помилка під час входу',
    },
    tournaments: {
      eyebrow: 'Актуальні дані',
      title: 'Список турнірів',
      lead: 'Відкриті, активні та завершені турніри в одному місці.',
      loading: 'Завантаження турнірів...',
      empty: 'Турніри ще не створені.',
      emptyFiltered: 'За цим фільтром турнірів немає.',
      retry: 'Спробувати знову',
      requestFailed: 'Не вдалося завантажити турніри',
      registrationOpens: 'Початок реєстрації',
      registrationCloses: 'Завершення реєстрації',
      registrationState: 'Реєстрація команд',
      totalLabel: 'Всього турнірів',
      filters: {
        all: 'Усі',
        registrationOpen: 'Реєстрація відкрита',
        running: 'Триває',
        finished: 'Завершені',
      },
      sections: {
        active: 'Активні',
        upcoming: 'Майбутні',
        finished: 'Завершені',
      },
      available: 'доступна',
      closed: 'закрита',
      status: {
        DRAFT: 'Чернетка',
        REGISTRATION: 'Реєстрація',
        RUNNING: 'Триває',
        FINISHED: 'Завершено',
      },
    },
    notFound: {
      title: 'Сторінку не знайдено',
      lead: 'Цей маршрут відсутній у поточній версії застосунку.',
      action: 'До турнірів',
    },
  },
  en: {
    shell: {
      navAria: 'Primary navigation',
      home: 'Home',
      login: 'Login',
      logout: 'Logout',
      languageAria: 'Language switcher',
    },
    language: {
      uk: 'Українська',
      en: 'English',
    },
    login: {
      eyebrow: 'Control panel access',
      title: 'Sign in to FalconArena',
      lead: 'Use an organizer, jury, team, or admin account to access the platform.',
      email: 'Email',
      password: 'Password',
      submit: 'Sign in',
      submitting: 'Signing in...',
      requestFailed: 'Login request failed',
    },
    tournaments: {
      eyebrow: 'Live data',
      title: 'Tournament list',
      lead: 'Open registration, active rounds, and finished events in one place.',
      loading: 'Loading tournaments...',
      empty: 'No tournaments are available yet.',
      emptyFiltered: 'No tournaments match this filter.',
      retry: 'Try again',
      requestFailed: 'Could not load tournaments',
      registrationOpens: 'Registration opens',
      registrationCloses: 'Registration closes',
      registrationState: 'Team registration',
      totalLabel: 'Total tournaments',
      filters: {
        all: 'All',
        registrationOpen: 'Registration open',
        running: 'Running',
        finished: 'Finished',
      },
      sections: {
        active: 'Active',
        upcoming: 'Upcoming',
        finished: 'Finished',
      },
      available: 'available',
      closed: 'closed',
      status: {
        DRAFT: 'Draft',
        REGISTRATION: 'Registration',
        RUNNING: 'Running',
        FINISHED: 'Finished',
      },
    },
    notFound: {
      title: 'Page not found',
      lead: 'This route does not exist in the current app version.',
      action: 'Go to tournaments',
    },
  },
};
