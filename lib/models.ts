import { storage } from '#imports';
import { t } from '@/lib/i18n';
import { allowLocalOrigin } from './local-origin';
import { PROVIDERS, type ProviderConfig, type ProviderId, type Settings } from './settings';

export interface ModelOption {
  id: string;
  label?: string;
}

/** Model ids that are obviously not chat/text models (embeddings, audio, images, moderation...). */
const NON_CHAT =
  /(embed|embedding|whisper|tts|audio|transcribe|dall-e|image|moderation|rerank|realtime|search|guard|vision-preview)/i;

/**
 * Loads the model list straight from the provider's API with the user's key.
 * - OpenAI-compatible: GET {base}/models (Bearer)
 * - Anthropic:         GET {base}/models (x-api-key)
 * - Gemini:            GET {base}/models (x-goog-api-key), filtered to generateContent models
 */
export async function fetchModels(id: ProviderId, cfg: ProviderConfig, signal?: AbortSignal): Promise<ModelOption[]> {
  const preset = PROVIDERS[id];
  const base = (cfg.baseUrl || preset.defaultBaseUrl).replace(/\/+$/, '');
  if (!base) throw new Error(t('errors:models.baseUrlRequired'));
  await allowLocalOrigin(base);

  let models: ModelOption[];

  if (preset.api === 'anthropic') {
    const json = await getJson(`${base}/models?limit=1000`, signal, {
      'x-api-key': cfg.apiKey,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
    });
    models = (json.data ?? []).map((m: { id: string; display_name?: string }) => ({ id: m.id, label: m.display_name }));
  } else if (preset.api === 'google') {
    const json = await getJson(`${base}/models?pageSize=1000`, signal, { 'x-goog-api-key': cfg.apiKey });
    models = (json.models ?? [])
      .filter((m: { supportedGenerationMethods?: string[] }) =>
        m.supportedGenerationMethods?.includes('generateContent'),
      )
      .map((m: { name: string; displayName?: string }) => ({
        id: m.name.replace(/^models\//, ''),
        label: m.displayName,
      }));
  } else {
    const headers: Record<string, string> = {};
    if (cfg.apiKey) headers.Authorization = `Bearer ${cfg.apiKey}`;
    const json = await getJson(`${base}/models`, signal, headers);
    const list = Array.isArray(json) ? json : (json.data ?? json.models ?? []);
    models = list.map((m: { id?: string; name?: string }) => ({
      id: m.id ?? m.name ?? '',
      label: m.name && m.name !== m.id ? m.name : undefined,
    }));
  }

  models = models.filter((m) => m.id && !NON_CHAT.test(m.id));
  if (id === 'ollama') models = await keepOllamaChatModels(base, models, signal);
  return models.sort((a, b) => a.id.localeCompare(b.id));
}

/**
 * Ollama lists every installed model, including ones that cannot chat (they fail with
 * "does not support chat"). /api/show reports capabilities; keep models with "completion".
 */
async function keepOllamaChatModels(base: string, models: ModelOption[], signal?: AbortSignal) {
  const nativeBase = base.replace(/\/v1$/, '');
  const checks = await Promise.all(
    models.map(async (m) => {
      try {
        const res = await fetch(`${nativeBase}/api/show`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ model: m.id }),
          signal,
        });
        if (!res.ok) return true; // Unknown: keep it rather than hide a usable model.
        const info = (await res.json()) as { capabilities?: string[] };
        return !info.capabilities || info.capabilities.includes('completion');
      } catch {
        return true;
      }
    }),
  );
  return models.filter((_, i) => checks[i]);
}

async function getJson(url: string, signal: AbortSignal | undefined, headers: Record<string, string>) {
  let res: Response;
  try {
    res = await fetch(url, { headers, signal });
  } catch {
    throw new Error(t('errors:models.unreachable'));
  }
  if (res.status === 401) throw new Error(t('errors:models.keyRejected'));
  if (res.status === 403) throw new Error(t('errors:models.forbidden'));
  if (!res.ok) throw new Error(t('errors:models.http', { status: res.status }));
  return res.json();
}

/** Last loaded model list per provider, so the side panel can switch models without a request. */
export const modelCacheItem = storage.defineItem<Partial<Record<ProviderId, ModelOption[]>>>('local:modelCache', {
  fallback: {},
});

export type ModelCache = Partial<Record<ProviderId, ModelOption[]>>;

/**
 * A provider is connected when it can be used without more setup: a saved API key, or for keyless
 * providers (Ollama, LM Studio, custom) a chosen model or a model list loaded from the server.
 */
export function isProviderConnected(settings: Settings, id: ProviderId, cache: ModelCache = {}) {
  const cfg = settings.providers[id];
  if (PROVIDERS[id].needsKey) return Boolean(cfg?.apiKey?.trim());
  return Boolean(cfg?.model?.trim() || cache[id]?.length);
}
