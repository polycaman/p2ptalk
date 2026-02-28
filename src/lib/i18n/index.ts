import { writable, derived } from 'svelte/store';
import type { Translations } from './translations';
import { translations } from './translations';

export type Locale = 'tr' | 'en' | 'de' | 'es' | 'fr' | 'ru' | 'uk' | 'fa' | 'ja' | 'ko';

export const SUPPORTED_LOCALES: { code: Locale; label: string; flag: string }[] = [
  { code: 'tr', label: 'Türkçe', flag: '🇹🇷' },
  { code: 'en', label: 'English', flag: '🇬🇧' },
  { code: 'de', label: 'Deutsch', flag: '🇩🇪' },
  { code: 'es', label: 'Español', flag: '🇪🇸' },
  { code: 'fr', label: 'Français', flag: '🇫🇷' },
  { code: 'ru', label: 'Русский', flag: '🇷🇺' },
  { code: 'uk', label: 'Українська', flag: '🇺🇦' },
  { code: 'fa', label: 'فارسی', flag: '🇮🇷' },
  { code: 'ja', label: '日本語', flag: '🇯🇵' },
  { code: 'ko', label: '한국어', flag: '🇰🇷' },
];

const LOCALE_CODES = SUPPORTED_LOCALES.map(l => l.code);

function detectBrowserLocale(): Locale {
  if (typeof navigator === 'undefined') return 'en';
  const langs = navigator.languages || [navigator.language];
  for (const lang of langs) {
    const code = lang.split('-')[0].toLowerCase() as Locale;
    if (LOCALE_CODES.includes(code)) return code;
  }
  return 'en';
}

function getInitialLocale(): Locale {
  if (typeof localStorage !== 'undefined') {
    const stored = localStorage.getItem('p2ptalk_locale') as Locale;
    if (stored && LOCALE_CODES.includes(stored)) return stored;
  }
  return detectBrowserLocale();
}

export const locale = writable<Locale>(getInitialLocale());

// Persist to localStorage on change
locale.subscribe((val) => {
  if (typeof localStorage !== 'undefined') {
    localStorage.setItem('p2ptalk_locale', val);
  }
  // Update document dir for RTL languages
  if (typeof document !== 'undefined') {
    document.documentElement.dir = val === 'fa' ? 'rtl' : 'ltr';
    document.documentElement.lang = val;
  }
});

/**
 * Derived store: t
 * Usage: $t('key') or $t('key', { n: 5 })
 * Supports simple interpolation: {n}, {name}, etc.
 */
export const t = derived(locale, ($locale) => {
  return (key: string, params?: Record<string, string | number>): string => {
    const dict = translations[$locale] || translations['en'];
    let text = dict[key as keyof Translations] || translations['en'][key as keyof Translations] || key;

    if (params) {
      for (const [k, v] of Object.entries(params)) {
        text = text.replace(new RegExp(`\\{${k}\\}`, 'g'), String(v));
      }
    }

    return text;
  };
});
