import type { HistoryEntry } from './history';

/**
 * Searching the history: every query word must appear in the title or the summary, accents and
 * case ignored (so "hoc may" finds "Học máy"). Title matches rank first, then newer first.
 */

/** Lowercase, without accents, đ → d. */
export const fold = (s: string) =>
  s.normalize('NFD').replace(/\p{M}/gu, '').replace(/đ/g, 'd').replace(/Đ/g, 'D').toLowerCase();

const words = (q: string) =>
  fold(q)
    .split(/[^\p{L}\p{N}]+/u)
    .filter((w) => w.length > 1);

export function scoreEntry(entry: HistoryEntry, terms: string[]) {
  const title = fold(entry.title);
  const text = fold(entry.text);
  let score = 0;
  for (const term of terms) {
    const inTitle = title.includes(term);
    const count = text.split(term).length - 1;
    if (!inTitle && !count) return 0;
    score += (inTitle ? 5 : 0) + Math.min(count, 5);
  }
  return score;
}

/** Entries matching every word of the query, best first. Empty query: all, newest first. */
export function searchHistory(entries: HistoryEntry[], query: string) {
  const terms = words(query);
  if (!terms.length) return entries;
  return entries
    .map((entry) => ({ entry, score: scoreEntry(entry, terms) }))
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score || b.entry.updatedAt - a.entry.updatedAt)
    .map((x) => x.entry);
}

/**
 * The summaries to answer a question from: those sharing the most words with it (any word, not
 * all), else the most recent ones.
 */
export function pickForQuestion(entries: HistoryEntry[], question: string, max: number) {
  const terms = words(question).filter((w) => w.length > 2);
  const scored = entries
    .map((entry) => ({
      entry,
      score: terms.reduce((sum, term) => sum + Math.min(1, scoreEntry(entry, [term])), 0),
    }))
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score || b.entry.updatedAt - a.entry.updatedAt)
    .map((x) => x.entry);
  return (scored.length ? scored : entries).slice(0, max);
}
