import en from './en.json';
import es from './es.json';
import type { Locale } from '../session';

export type MessageKey = keyof typeof en;
export const LOCALES: readonly Locale[] = ['en', 'es'];
export const LOCALE_STORAGE_KEY = 'openttd-web.locale';
const MESSAGES: Record<Locale, Record<MessageKey, string>> = { en, es };

export function detectLocale(languages: readonly string[]): Locale {
  return languages.some((l) => l.toLowerCase().startsWith('es')) ? 'es' : 'en';
}

export function loadLocale(
  storage: Pick<Storage, 'getItem'> | undefined,
  languages: readonly string[],
): Locale {
  try {
    const saved = storage?.getItem(LOCALE_STORAGE_KEY);
    if (saved === 'en' || saved === 'es') return saved;
  } catch {
    // Storage blocked (private mode): fall back to the browser language.
  }
  return detectLocale(languages);
}

export function saveLocale(storage: Pick<Storage, 'setItem'> | undefined, locale: Locale): void {
  try {
    storage?.setItem(LOCALE_STORAGE_KEY, locale);
  } catch {
    // Not persisted; the choice still applies to this session.
  }
}

export function translate(
  locale: Locale,
  key: MessageKey,
  params: Record<string, string | number> = {},
): string {
  const text = MESSAGES[locale][key] ?? MESSAGES.en[key];
  return text.replace(/\{(\w+)\}/g, (match, name: string) => String(params[name] ?? match));
}

export function formatMoney(locale: Locale, pounds: number): string {
  return new Intl.NumberFormat(locale === 'en' ? 'en-GB' : 'es', {
    style: 'currency',
    currency: 'GBP',
    currencyDisplay: 'narrowSymbol',
    maximumFractionDigits: 0,
  }).format(pounds);
}

export function formatDate(locale: Locale, year: number, month: number, day: number): string {
  return new Intl.DateTimeFormat(locale === 'en' ? 'en-GB' : 'es', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(Date.UTC(year, month, day));
}
