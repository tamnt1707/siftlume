import { streamText, type ModelMessage } from 'ai';
import { t } from '@/lib/i18n';
import { createOpenAI } from '@ai-sdk/openai';
import { createAnthropic } from '@ai-sdk/anthropic';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { allowLocalOrigin, isLocalUrl } from './local-origin';
import { localComplete } from './local-model';
import { getActiveProvider, type Settings } from './settings';

/** Builds an AI SDK model that calls the provider directly from the extension (BYOK, no backend). */
export function createModel(settings: Settings) {
  const p = getActiveProvider(settings);
  const baseURL = p.resolvedBaseUrl;

  switch (p.preset.api) {
    case 'anthropic':
      return createAnthropic({
        apiKey: p.apiKey,
        baseURL,
        // Required by Anthropic when calling the API from a browser context.
        headers: { 'anthropic-dangerous-direct-browser-access': 'true' },
      })(p.model);
    case 'google':
      return createGoogleGenerativeAI({ apiKey: p.apiKey, baseURL })(p.model);
    case 'openai':
      return createOpenAI({ apiKey: p.apiKey, baseURL })(p.model);
    case 'compatible':
    case 'builtin':
      // OpenAI-compatible servers implement Chat Completions, not the Responses API.
      // (In-browser models never get here: streamCompletion and lib/generate.ts call lib/local-model.ts.)
      return createOpenAI({ apiKey: p.apiKey || 'not-needed', baseURL, name: p.id }).chat(p.model);
  }
}

export interface StreamOptions {
  settings: Settings;
  system: string;
  messages: ModelMessage[];
  signal?: AbortSignal;
  /** Called with the full text received so far. */
  onText: (fullText: string) => void;
}

/** Streams a completion and resolves with the final text. */
export async function streamCompletion({ settings, system, messages, signal, onText }: StreamOptions) {
  if (getActiveProvider(settings).preset.builtin) {
    const input = messages.map((m) => (typeof m.content === 'string' ? m.content : '')).join('\n\n');
    return localComplete({ settings, system, input, signal, onText });
  }
  await allowLocalOrigin(getActiveProvider(settings).resolvedBaseUrl);
  let streamError: unknown;
  const result = streamText({
    model: createModel(settings),
    system,
    messages,
    abortSignal: signal,
    onError: ({ error }) => {
      streamError = error;
    },
  });

  let text = '';
  for await (const delta of result.textStream) {
    text += delta;
    onText(text);
  }
  if (streamError) throw streamError;
  return text;
}

/** Turns provider/network errors into a short, actionable message. */
export function describeError(err: unknown, settings?: Settings): string {
  if (err instanceof Error) {
    if (err.name === 'AbortError') return t('errors:llm.stopped');
    const status = (err as { statusCode?: number }).statusCode;
    const local = settings ? isLocalUrl(getActiveProvider(settings).resolvedBaseUrl) : false;
    if (status === 403 && local) return t('errors:llm.localRefused');
    if (status === 401) return t('errors:llm.keyRejected');
    if (status === 403) return t('errors:llm.accessDenied');
    if (status === 404) return t('errors:llm.notFound');
    if (status === 429) return t('errors:llm.rateLimited');
    if (/Failed to fetch|NetworkError|Load failed/i.test(err.message)) return t('errors:llm.network');
    return err.message;
  }
  return String(err);
}
