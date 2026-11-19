import type { HistoryEntry } from './history';

/**
 * "What changed since you last read this": the page's text now against the text saved with an
 * earlier summary of the same address. Compared paragraph by paragraph in the browser, with no
 * request to the model: a paragraph that was edited shows its words added and removed, a new one
 * is added, a missing one removed.
 */

/** Tracking and session parameters that change between visits of the same page. */
const NOISE_PARAMS = /^(utm_\w+|fbclid|gclid|mc_cid|mc_eid|ref|ref_src|igshid|si)$/i;

/** One address for the same page: no fragment, tracking parameters, "www." or trailing slash. */
export function pageKey(url: string | undefined): string | null {
  if (!url?.startsWith('http')) return null;
  try {
    const u = new URL(url);
    const params = [...u.searchParams].filter(([k]) => !NOISE_PARAMS.test(k)).sort(([a], [b]) => a.localeCompare(b));
    const query = params.length ? `?${new URLSearchParams(params)}` : '';
    return `${u.hostname.replace(/^www\./, '')}${u.pathname.replace(/\/+$/, '')}${query}`;
  } catch {
    return null;
  }
}

/** The latest earlier summary of the same page, or null. */
export function previousRead(
  index: HistoryEntry[],
  current: { id: string; origin?: string; createdAt: number },
): HistoryEntry | null {
  const key = pageKey(current.origin);
  if (!key) return null;
  return (
    index
      .filter((e) => e.id !== current.id && e.createdAt < current.createdAt && pageKey(e.origin) === key)
      .sort((a, b) => b.createdAt - a.createdAt)[0] ?? null
  );
}

export type WordPart = { text: string; kind: 'same' | 'added' | 'removed' };

export interface SourceChanges {
  /** Paragraphs edited in place, with their words marked. */
  changed: { before: string; after: string; parts: WordPart[] }[];
  added: string[];
  removed: string[];
}

/** Paragraphs and list items as plain text: Markdown bullets, headings marks, emphasis and spacing removed. */
export function blocksOf(text: string): string[] {
  return text
    .split(/\n\s*\n|\n(?=\s*(?:[-*+]|\d+[.)]|#{1,6})\s)/)
    .map((b) =>
      b
        .replace(/!?\[([^\]]*)\]\([^)]*\)/g, '$1')
        .replace(/^\s*(?:[-*+]|\d+[.)]|#{1,6})\s+/, '')
        .replace(/[*_`]+/g, '')
        .replace(/\s+/g, ' ')
        .trim(),
    )
    .filter((b) => /[\p{L}\p{N}]/u.test(b));
}

/** Longest common subsequence of two lists, as pairs of indexes. */
function lcs<T>(a: T[], b: T[], same: (x: T, y: T) => boolean): [number, number][] {
  const n = a.length;
  const m = b.length;
  const table = Array.from({ length: n + 1 }, () => new Uint32Array(m + 1));
  for (let i = n - 1; i >= 0; i--)
    for (let j = m - 1; j >= 0; j--)
      table[i]![j] = same(a[i]!, b[j]!) ? table[i + 1]![j + 1]! + 1 : Math.max(table[i + 1]![j]!, table[i]![j + 1]!);
  const pairs: [number, number][] = [];
  for (let i = 0, j = 0; i < n && j < m;) {
    if (same(a[i]!, b[j]!)) {
      pairs.push([i, j]);
      i++;
      j++;
    } else if (table[i + 1]![j]! >= table[i]![j + 1]!) i++;
    else j++;
  }
  return pairs;
}

const wordsOf = (s: string) => s.match(/\S+/g) ?? [];

/** How alike two paragraphs are: shared words over all words (0 to 1). */
function likeness(a: string, b: string) {
  const wa = new Set(wordsOf(a.toLowerCase()));
  const wb = new Set(wordsOf(b.toLowerCase()));
  let shared = 0;
  for (const w of wa) if (wb.has(w)) shared++;
  return shared / Math.max(1, wa.size + wb.size - shared);
}

/** Words of `before` and `after`, each marked same, added or removed, runs merged. */
export function wordDiff(before: string, after: string): WordPart[] {
  const a = wordsOf(before);
  const b = wordsOf(after);
  const parts: WordPart[] = [];
  const push = (text: string, kind: WordPart['kind']) => {
    const last = parts[parts.length - 1];
    if (last?.kind === kind) last.text += ` ${text}`;
    else parts.push({ text, kind });
  };
  let i = 0;
  let j = 0;
  for (const [pi, pj] of [...lcs(a, b, (x, y) => x === y), [a.length, b.length] as [number, number]]) {
    while (i < pi) push(a[i++]!, 'removed');
    while (j < pj) push(b[j++]!, 'added');
    if (i < a.length && j < b.length) push(a[i]!, 'same');
    i++;
    j++;
  }
  return parts;
}

/** Long pages: past this many paragraphs on a side, the rest is not compared. */
const MAX_BLOCKS = 1500;
/** Paragraphs at least this alike are one paragraph edited, not one removed and one added. */
const EDITED = 0.4;

export function compareSources(before: string, after: string): SourceChanges {
  const a = blocksOf(before).slice(0, MAX_BLOCKS);
  const b = blocksOf(after).slice(0, MAX_BLOCKS);
  const out: SourceChanges = { changed: [], added: [], removed: [] };
  // Between two matching paragraphs, what is left on each side was edited, added or removed.
  const settle = (gone: string[], come: string[]) => {
    const unmatched = new Set(come.map((_, k) => k));
    for (const old of gone) {
      let best = -1;
      let score = EDITED;
      for (const k of unmatched) {
        const s = likeness(old, come[k]!);
        if (s >= score) [best, score] = [k, s];
      }
      if (best === -1) out.removed.push(old);
      else {
        unmatched.delete(best);
        out.changed.push({ before: old, after: come[best]!, parts: wordDiff(old, come[best]!) });
      }
    }
    for (const k of [...unmatched].sort((x, y) => x - y)) out.added.push(come[k]!);
  };
  let i = 0;
  let j = 0;
  for (const [pi, pj] of [...lcs(a, b, (x, y) => x === y), [a.length, b.length] as [number, number]]) {
    if (pi > i || pj > j) settle(a.slice(i, pi), b.slice(j, pj));
    i = pi + 1;
    j = pj + 1;
  }
  return out;
}

export const hasChanges = (c: SourceChanges) => c.changed.length + c.added.length + c.removed.length > 0;
