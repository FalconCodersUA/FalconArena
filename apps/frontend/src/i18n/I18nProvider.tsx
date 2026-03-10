import { createContext, ReactNode, useContext, useEffect, useMemo, useState } from 'react';
import { DEFAULT_LANGUAGE, Language, messages, SUPPORTED_LANGUAGES } from './messages';

type I18nContextValue = {
  language: Language;
  setLanguage: (language: Language) => void;
  t: (key: string) => string;
};

const LANG_STORAGE_KEY = 'falconarena_language';

const I18nContext = createContext<I18nContextValue | null>(null);

function resolveMessage(language: Language, key: string): string {
  const parts = key.split('.');
  let current: unknown = messages[language];

  for (const part of parts) {
    if (!current || typeof current !== 'object') {
      return key;
    }

    current = (current as Record<string, unknown>)[part];
  }

  return typeof current === 'string' ? current : key;
}

function getInitialLanguage(): Language {
  const stored = localStorage.getItem(LANG_STORAGE_KEY);
  if (stored && SUPPORTED_LANGUAGES.includes(stored as Language)) {
    return stored as Language;
  }

  return DEFAULT_LANGUAGE;
}

export function I18nProvider({ children }: { children: ReactNode }) {
  const [language, setLanguage] = useState<Language>(getInitialLanguage);

  useEffect(() => {
    localStorage.setItem(LANG_STORAGE_KEY, language);
    document.documentElement.lang = language;
  }, [language]);

  const value = useMemo<I18nContextValue>(
    () => ({
      language,
      setLanguage,
      t: (key: string) => resolveMessage(language, key),
    }),
    [language],
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  const value = useContext(I18nContext);
  if (!value) {
    throw new Error('useI18n must be used inside I18nProvider');
  }

  return value;
}
