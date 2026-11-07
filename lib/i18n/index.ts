import i18n from 'i18next';
import { browser } from '#imports';

/**
 * UI translations (i18next). One folder per language under /locales, one JSON file per feature
 * namespace (common, picker, popup, session, settings, errors). English is the source and the
 * fallback for missing keys and unsupported languages.
 *
 * This module has no React dependency, so lib/ code and the background can use `t` directly.
 * React components get the same instance through <I18nextProvider> (see components/Themed.tsx).
 */

export const UI_LANGUAGES = [
  { code: 'en', name: 'English' },
  { code: 'vi', name: 'Tiếng Việt' },
  { code: 'ja', name: '日本語' },
  { code: 'zh-CN', name: '简体中文' },
  { code: 'zh-TW', name: '繁體中文' },
  { code: 'ko', name: '한국어' },
  { code: 'es', name: 'Español' },
  { code: 'fr', name: 'Français' },
  { code: 'de', name: 'Deutsch' },
  { code: 'pt-BR', name: 'Português (Brasil)' },
  { code: 'ru', name: 'Русский' },
  { code: 'th', name: 'ไทย' },
] as const;

export type UiLanguage = (typeof UI_LANGUAGES)[number]['code'];
export const NAMESPACES = ['common', 'picker', 'popup', 'session', 'settings', 'errors'] as const;

const SUPPORTED = new Set<string>(UI_LANGUAGES.map((l) => l.code));

// Bundled at build time: /locales/<lang>/<namespace>.json
const files = import.meta.glob<Record<string, unknown>>('../../locales/*/*.json', { eager: true, import: 'default' });
const resources: Record<string, Record<string, Record<string, unknown>>> = {};
for (const [path, data] of Object.entries(files)) {
  const [, lng, ns] = /locales\/([^/]+)\/([^/]+)\.json$/.exec(path) ?? [];
  if (lng && ns) (resources[lng] ??= {})[ns] = data;
}

/** Maps a BCP 47 tag (e.g. "vi-VN", "zh-HK", "pt") to a supported UI language, or null. */
export function matchLanguage(tag: string | undefined | null): UiLanguage | null {
  if (!tag) return null;
  const t = tag.replace('_', '-');
  if (SUPPORTED.has(t)) return t as UiLanguage;
  const [base, region] = t.toLowerCase().split('-');
  if (base === 'zh')
    return region === 'tw' || region === 'hk' || region === 'mo' || t.includes('Hant') ? 'zh-TW' : 'zh-CN';
  if (base === 'pt') return 'pt-BR';
  return SUPPORTED.has(base!) ? (base as UiLanguage) : null;
}

/** The browser's UI language, mapped to a supported one; English when unsupported. */
export function browserLanguage(): UiLanguage {
  const candidates = [
    browser.i18n?.getUILanguage?.(),
    ...(typeof navigator !== 'undefined' ? (navigator.languages ?? [navigator.language]) : []),
  ];
  for (const c of candidates) {
    const m = matchLanguage(c);
    if (m) return m;
  }
  return 'en';
}

/** Resolves the Settings value ("auto" or a code) to the language to display. */
export function resolveUiLanguage(pref: string | undefined): UiLanguage {
  return pref && pref !== 'auto' ? (matchLanguage(pref) ?? 'en') : browserLanguage();
}

void i18n.init({
  resources,
  lng: browserLanguage(),
  fallbackLng: 'en',
  supportedLngs: [...SUPPORTED],
  ns: [...NAMESPACES],
  defaultNS: 'common',
  interpolation: { escapeValue: false }, // React already escapes
  returnNull: false,
  initAsync: false,
});

export function setUiLanguage(pref: string | undefined) {
  const lng = resolveUiLanguage(pref);
  if (i18n.language !== lng) void i18n.changeLanguage(lng);
  if (typeof document !== 'undefined') document.documentElement.lang = lng;
}

export const t = i18n.t.bind(i18n);
export default i18n;
