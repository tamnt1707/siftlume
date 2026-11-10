import type { ProviderPreset } from './settings';

/**
 * Picks the model Settings suggests for a provider: fast and low cost, which is what summaries
 * need. No runtime imports, so scripts can test it directly.
 */
/** Snapshots, previews and experiments rank below stable ids; "-latest" aliases rank first. */
const UNSTABLE = /(preview|exp|beta|alpha|\d{8}|\d{4}-\d{2}-\d{2})/i;
const NOT_TEXT = /(audio|tts|image|live|realtime|search|transcribe|vision|thinking|reasoning|code)/i;

/** The numbers in an id ("gemini-3.5-flash" → [3, 5]), compared to find the newest release. */
const versionOf = (id: string) => (id.match(/\d+/g) ?? []).map(Number).filter((n) => n < 10_000);

function newerFirst(a: string, b: string) {
  const rank = (id: string) => (/latest/.test(id) ? -1 : UNSTABLE.test(id) ? 1 : 0);
  const stable = rank(a) - rank(b);
  if (stable) return stable;
  const va = versionOf(a);
  const vb = versionOf(b);
  for (let i = 0; i < Math.max(va.length, vb.length); i++) {
    const d = (vb[i] ?? -1) - (va[i] ?? -1);
    if (d) return d;
  }
  return a.length - b.length;
}

/**
 * The fastest, cheapest model to suggest for a provider: the newest model in the live list that
 * matches the provider's `fastModels` patterns (best pattern first). Before a list is loaded, the
 * preset's `recommendedModel`. Undefined when nothing fits, e.g. local providers.
 */
export function recommendModel(preset: ProviderPreset, list: { id: string }[]): string | undefined {
  if (!list.length) return preset.recommendedModel;
  const ids = list.map((m) => m.id).filter((m) => !NOT_TEXT.test(m.replace(/fast-non-reasoning/, 'fast')));
  for (const pattern of preset.fastModels ?? []) {
    const hits = ids.filter((m) => pattern.test(m)).sort(newerFirst);
    if (hits.length) return hits[0];
  }
  return preset.recommendedModel && ids.includes(preset.recommendedModel) ? preset.recommendedModel : undefined;
}
