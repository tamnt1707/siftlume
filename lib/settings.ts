import { browser, storage } from '#imports';
import { t } from '@/lib/i18n';
import { DEFAULT_APPEARANCE, type Appearance, type ColorMode } from './appearance';
import { SUMMARY_STYLES, type SummaryStyle } from './refine';
import { ANALYSIS_MODES, type AnalysisMode } from './modes';

/**
 * How the provider is called:
 * - "openai":     OpenAI Responses API via @ai-sdk/openai
 * - "anthropic":  Anthropic Messages API via @ai-sdk/anthropic
 * - "google":     Gemini API via @ai-sdk/google
 * - "compatible": any OpenAI-compatible Chat Completions endpoint
 */
export type ProviderApi = 'openai' | 'anthropic' | 'google' | 'compatible';

export type ProviderId =
  | 'openai'
  | 'anthropic'
  | 'google'
  | 'openrouter'
  | 'groq'
  | 'deepseek'
  | 'mistral'
  | 'xai'
  | 'together'
  | 'ollama'
  | 'lmstudio'
  | 'custom';

export interface ProviderPreset {
  label: string;
  api: ProviderApi;
  defaultBaseUrl: string;
  /** Suggested model used until the user loads the live model list. */
  defaultModel: string;
  needsKey: boolean;
  keyUrl?: string;
  /** Runs on the user's machine; shown with setup hints. */
  local?: boolean;
}

export const PROVIDERS: Record<ProviderId, ProviderPreset> = {
  openai: {
    label: 'OpenAI',
    api: 'openai',
    defaultBaseUrl: 'https://api.openai.com/v1',
    defaultModel: 'gpt-5-mini',
    needsKey: true,
    keyUrl: 'https://platform.openai.com/api-keys',
  },
  anthropic: {
    label: 'Anthropic (Claude)',
    api: 'anthropic',
    defaultBaseUrl: 'https://api.anthropic.com/v1',
    defaultModel: 'claude-haiku-5-5',
    needsKey: true,
    keyUrl: 'https://console.anthropic.com/settings/keys',
  },
  google: {
    label: 'Google Gemini',
    api: 'google',
    defaultBaseUrl: 'https://generativelanguage.googleapis.com/v1beta',
    defaultModel: 'gemini-2.5-flash',
    needsKey: true,
    keyUrl: 'https://aistudio.google.com/apikey',
  },
  openrouter: {
    label: 'OpenRouter',
    api: 'compatible',
    defaultBaseUrl: 'https://openrouter.ai/api/v1',
    defaultModel: 'openai/gpt-5-mini',
    needsKey: true,
    keyUrl: 'https://openrouter.ai/keys',
  },
  groq: {
    label: 'Groq',
    api: 'compatible',
    defaultBaseUrl: 'https://api.groq.com/openai/v1',
    defaultModel: 'llama-3.3-70b-versatile',
    needsKey: true,
    keyUrl: 'https://console.groq.com/keys',
  },
  deepseek: {
    label: 'DeepSeek',
    api: 'compatible',
    defaultBaseUrl: 'https://api.deepseek.com/v1',
    defaultModel: 'deepseek-chat',
    needsKey: true,
    keyUrl: 'https://platform.deepseek.com/api_keys',
  },
  mistral: {
    label: 'Mistral',
    api: 'compatible',
    defaultBaseUrl: 'https://api.mistral.ai/v1',
    defaultModel: 'mistral-small-latest',
    needsKey: true,
    keyUrl: 'https://console.mistral.ai/api-keys',
  },
  xai: {
    label: 'xAI (Grok)',
    api: 'compatible',
    defaultBaseUrl: 'https://api.x.ai/v1',
    defaultModel: 'grok-4',
    needsKey: true,
    keyUrl: 'https://console.x.ai',
  },
  together: {
    label: 'Together AI',
    api: 'compatible',
    defaultBaseUrl: 'https://api.together.xyz/v1',
    defaultModel: 'meta-llama/Llama-3.3-70B-Instruct-Turbo',
    needsKey: true,
    keyUrl: 'https://api.together.ai/settings/api-keys',
  },
  ollama: {
    label: 'Ollama (local)',
    api: 'compatible',
    defaultBaseUrl: 'http://localhost:11434/v1',
    defaultModel: '',
    needsKey: false,
    local: true,
  },
  lmstudio: {
    label: 'LM Studio (local)',
    api: 'compatible',
    defaultBaseUrl: 'http://localhost:1234/v1',
    defaultModel: '',
    needsKey: false,
    local: true,
  },
  custom: {
    label: 'Custom (OpenAI-compatible)',
    api: 'compatible',
    defaultBaseUrl: '',
    defaultModel: '',
    needsKey: false,
  },
};

export type SummaryLength = 'short' | 'medium' | 'detailed';

export interface ProviderConfig {
  apiKey: string;
  /** Empty = provider default. */
  baseUrl: string;
  model: string;
}

export interface Settings {
  provider: ProviderId;
  /** Per-provider credentials and model, so switching providers keeps each key. */
  providers: Partial<Record<ProviderId, ProviderConfig>>;
  /** Interface language: "auto" follows the browser (English when unsupported), or a UI language code. */
  uiLanguage: string;
  /** Output language. "auto" = same language as the source. */
  language: string;
  /** What the reader wants: summary, explanation, critique or action items. Last choice is kept. */
  mode: AnalysisMode;
  length: SummaryLength;
  /** Styles applied to every new summary (Settings → Summary → Always include). */
  styles: SummaryStyle[];
  customInstructions: string;
  /** Max characters of source content sent to the model. */
  maxChars: number;
  theme: ColorMode;
  /** Inkmark design system choices: preset or custom colors, corners, reading font. */
  appearance: Appearance;
  /** Where results open: next to the page in the side panel, or in a new full-page tab. */
  display: DisplayMode;
}

export type DisplayMode = 'sidepanel' | 'tab';

export const DEFAULT_SETTINGS: Settings = {
  provider: 'openai',
  providers: {},
  uiLanguage: 'auto',
  language: 'auto',
  mode: 'summary',
  length: 'medium',
  styles: [],
  customInstructions: '',
  maxChars: 60_000,
  theme: 'system',
  appearance: DEFAULT_APPEARANCE,
  display: 'sidepanel',
};

/** The provider settings actually used for a request. */
export interface ActiveProvider extends ProviderConfig {
  id: ProviderId;
  preset: ProviderPreset;
  /** Resolved base URL without trailing slash. */
  resolvedBaseUrl: string;
}

export function getProviderConfig(s: Settings, id: ProviderId = s.provider): ProviderConfig {
  return { apiKey: '', baseUrl: '', model: PROVIDERS[id].defaultModel, ...s.providers[id] };
}

export function getActiveProvider(s: Settings): ActiveProvider {
  const preset = PROVIDERS[s.provider];
  const cfg = getProviderConfig(s);
  return {
    ...cfg,
    id: s.provider,
    preset,
    resolvedBaseUrl: (cfg.baseUrl || preset.defaultBaseUrl).replace(/\/+$/, ''),
  };
}

/** Returns a user-facing problem with the configuration, or null when it is usable. */
export function configProblem(s: Settings): string | null {
  const p = getActiveProvider(s);
  if (!p.resolvedBaseUrl) return t('errors:config.baseUrl');
  if (p.preset.needsKey && !p.apiKey.trim()) return t('errors:config.apiKey', { provider: p.preset.label });
  if (!p.model.trim()) return t('errors:config.model');
  return null;
}

// "local:" (not "sync:") so API keys are never synced through the user's browser account.
export const settingsItem = storage.defineItem<Settings>('local:settings', {
  fallback: DEFAULT_SETTINGS,
});

/** Fills in defaults and drops values from older versions. */
export function normalizeSettings(raw: Partial<Settings> | null | undefined): Settings {
  const s = { ...DEFAULT_SETTINGS, ...raw };
  if (s.display !== 'sidepanel' && s.display !== 'tab') s.display = DEFAULT_SETTINGS.display;
  if (!(s.provider in PROVIDERS)) s.provider = DEFAULT_SETTINGS.provider;
  // The analysis mode is chosen per run (start screen, result toolbar) and stored on the session;
  // every new analysis starts as a summary, whatever an older version saved here.
  s.mode = DEFAULT_SETTINGS.mode;
  if (s.theme !== 'light' && s.theme !== 'dark' && s.theme !== 'system') s.theme = DEFAULT_SETTINGS.theme;
  s.appearance = { ...DEFAULT_APPEARANCE, ...s.appearance };
  s.styles = Array.isArray(s.styles) ? s.styles.filter((x) => SUMMARY_STYLES.includes(x)) : [];
  return s;
}

export async function getSettings(): Promise<Settings> {
  return normalizeSettings(await settingsItem.getValue());
}

/** Match pattern for chrome.permissions, e.g. "https://api.openai.com/*". */
export function originPattern(url: string): string | null {
  try {
    const u = new URL(url);
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return null;
    return `${u.protocol}//${u.hostname}/*`;
  } catch {
    return null;
  }
}

/**
 * Asks for host permission on the provider's API origin, so the extension page can call it
 * without CORS restrictions. Call it directly inside a click handler (no await before it),
 * otherwise Chrome drops the user gesture. Resolves true right away if already granted.
 */
export function requestOriginPermission(url: string): Promise<boolean> {
  const pattern = originPattern(url);
  if (!pattern) return Promise.resolve(false);
  return browser.permissions.request({ origins: [pattern] });
}
