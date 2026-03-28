import type { Language } from '../i18n/messages';

export const TIME_ZONE_STORAGE_KEY = 'falconarena_time_zone';

export function getPreferredTimeZone() {
  if (typeof window === 'undefined') {
    return 'Europe/Kyiv';
  }

  const stored = window.localStorage.getItem(TIME_ZONE_STORAGE_KEY)?.trim();
  return stored || 'Europe/Kyiv';
}

export function setPreferredTimeZone(timeZone: string) {
  if (typeof window === 'undefined') {
    return;
  }

  window.localStorage.setItem(TIME_ZONE_STORAGE_KEY, timeZone);
}

export function formatDateTime(
  value: string,
  language: Language | string,
  timeZone = getPreferredTimeZone(),
) {
  const date = new Date(value);
  const locale = language === 'uk' ? 'uk-UA' : 'en-US';

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  try {
    return new Intl.DateTimeFormat(locale, {
      dateStyle: 'medium',
      timeStyle: 'short',
      timeZone,
    }).format(date);
  } catch {
    return new Intl.DateTimeFormat(locale, {
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(date);
  }
}
