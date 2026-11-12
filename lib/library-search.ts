import type { HistoryEntry } from './history';

/**
 * Searching the history with BM25: a word counts more when it is rare across the summaries, a few
 * mentions count almost as much as many, and a short summary that mentions it is more about it
 * than a long one. Title words weigh more; words next to each other as in the query (a Vietnamese
 * compound like "học máy") add a bonus. Accents and case are ignored ("hoc may" finds "Học máy").
 *
 * Words are tokens between spaces and punctuation. Scripts written without spaces (Chinese,
 * Japanese, Thai…) are cut into overlapping pairs of characters, the usual way to index them.
 * Checked by scripts/check-examples.ts.
 */

/** Lowercase, without accents, đ → d. */
export const fold = (s: string) =>
  s.normalize('NFD').replace(/\p{M}/gu, '').replace(/đ/g, 'd').replace(/Đ/g, 'D').toLowerCase();

const NO_SPACE = '\\p{sc=Han}\\p{sc=Hiragana}\\p{sc=Katakana}\\p{sc=Thai}\\p{sc=Lao}\\p{sc=Khmer}\\p{sc=Myanmar}';
const RUN = new RegExp(`[${NO_SPACE}]+|(?:(?![${NO_SPACE}])[\\p{L}\\p{N}])+`, 'gu');
const NO_SPACE_RUN = new RegExp(`^[${NO_SPACE}]`, 'u');

/** Folded text → tokens: words, and character pairs for scripts without spaces. */
export function tokenize(s: string): string[] {
  const out: string[] = [];
  for (const run of fold(s).match(RUN) ?? []) {
    if (!NO_SPACE_RUN.test(run)) {
      if (run.length > 1) out.push(run);
      continue;
    }
    const chars = [...run];
    if (chars.length === 1) out.push(run);
    for (let i = 0; i + 1 < chars.length; i++) out.push(chars[i]! + chars[i + 1]!);
  }
  return out;
}

/**
 * Words that say nothing about a topic in a question ("what did I read about…"), folded. Only
 * dropped from questions; a search typed in the box keeps every word.
 */
const STOP = new Set(
  (
    'la gi cua va cac nhung mot nay do cho voi trong ve da duoc khong nao the nhu toi minh ban thi ma de tu den khi sao ' +
    'bao nhieu hay hoi doc gan day chua roi hon nhat ' +
    'the an of to in on for and or is are was were what which who how why when did do does me my we about with ' +
    'that this it from by as at be have has read tell any some there'
  ).split(' '),
);

const K1 = 1.2;
const B = 0.75;
/** A title word counts as this many words of the summary. */
const TITLE_WEIGHT = 3;
/** A word only matched as the start of a longer one ("vect" → "vector") counts this much. */
const PREFIX_WEIGHT = 0.5;

interface Doc {
  entry: HistoryEntry;
  /** Weighted counts: title words count TITLE_WEIGHT times. */
  tf: Map<string, number>;
  len: number;
  /** " a b c " of the title and the text, for phrase checks. */
  joined: string;
}

interface Index {
  docs: Doc[];
  avgLen: number;
}

const indexes = new WeakMap<HistoryEntry[], Index>();

/** The index of a list of entries, built once per list (the list changes when history does). */
function indexOf(entries: HistoryEntry[]): Index {
  let index = indexes.get(entries);
  if (index) return index;
  const docs = entries.map((entry): Doc => {
    const title = tokenize(entry.title);
    const text = tokenize(entry.text);
    const tf = new Map<string, number>();
    for (const w of title) tf.set(w, (tf.get(w) ?? 0) + TITLE_WEIGHT);
    for (const w of text) tf.set(w, (tf.get(w) ?? 0) + 1);
    return {
      entry,
      tf,
      len: title.length * TITLE_WEIGHT + text.length,
      joined: ` ${title.join(' ')} | ${text.join(' ')} `,
    };
  });
  const avgLen = docs.reduce((sum, d) => sum + d.len, 0) / Math.max(1, docs.length) || 1;
  index = { docs, avgLen };
  indexes.set(entries, index);
  return index;
}

/** How often a query word occurs in a doc: exactly, or (weighted less) as the start of a word. */
function termFrequency(doc: Doc, term: string, prefix: boolean) {
  let tf = doc.tf.get(term) ?? 0;
  if (prefix) for (const [w, n] of doc.tf) if (w.length > term.length && w.startsWith(term)) tf += n * PREFIX_WEIGHT;
  return tf;
}

export interface Ranked {
  entry: HistoryEntry;
  score: number;
  /** How many distinct query words it contains. */
  matched: number;
}

/**
 * BM25 scores of every entry for these words. `prefix`: a word may also match the start of a
 * longer one (words of 3+ letters, and the last word, still being typed).
 */
export function rank(entries: HistoryEntry[], terms: string[], prefix = true): Ranked[] {
  const { docs, avgLen } = indexOf(entries);
  const unique = [...new Set(terms)];
  const n = docs.length;
  const tfs = unique.map((term, i) => {
    const allowPrefix = prefix && (term.length >= 3 || i === unique.length - 1) && !NO_SPACE_RUN.test(term);
    return docs.map((d) => termFrequency(d, term, allowPrefix));
  });
  const idf = tfs.map((row) => {
    const df = row.filter((tf) => tf > 0).length;
    return Math.log(1 + (n - df + 0.5) / (df + 0.5));
  });
  return docs.map((doc, j) => {
    let score = 0;
    let matched = 0;
    unique.forEach((_, i) => {
      const tf = tfs[i]![j]!;
      if (!tf) return;
      matched++;
      score += (idf[i]! * tf * (K1 + 1)) / (tf + K1 * (1 - B + (B * doc.len) / avgLen));
    });
    // Neighbouring query words found side by side: a phrase ("hoc may", "vector database").
    for (let i = 0; i + 1 < terms.length; i++) {
      if (doc.joined.includes(` ${terms[i]} ${terms[i + 1]} `)) {
        const a = idf[unique.indexOf(terms[i]!)]!;
        const b = idf[unique.indexOf(terms[i + 1]!)]!;
        score += (a + b) / 2;
      }
    }
    return { entry: doc.entry, score, matched };
  });
}

const best = (a: Ranked, b: Ranked) => b.score - a.score || b.entry.updatedAt - a.entry.updatedAt;

/**
 * The search box: entries containing at least half of the query's words, most relevant first.
 * Empty query: all, newest first (as stored).
 */
export function searchHistory(entries: HistoryEntry[], query: string) {
  const terms = tokenize(query);
  if (!terms.length) return entries;
  const need = Math.max(1, Math.ceil(new Set(terms).size / 2));
  return rank(entries, terms)
    .filter((x) => x.score > 0 && x.matched >= need)
    .sort(best)
    .map((x) => x.entry);
}

/**
 * The summaries to answer a question from: the most relevant to its topic words (any of them),
 * dropping those far behind the best; when none matches, the most recent ones.
 */
export function pickForQuestion(entries: HistoryEntry[], question: string, max: number) {
  const all = tokenize(question);
  const topical = all.filter((w) => !STOP.has(w));
  const terms = topical.length ? topical : all;
  const ranked = terms.length
    ? rank(entries, terms, false)
        .filter((x) => x.score > 0)
        .sort(best)
    : [];
  const top = ranked[0]?.score ?? 0;
  const picked = ranked.filter((x) => x.score >= top * 0.25).map((x) => x.entry);
  const recent = [...entries].sort((a, b) => b.updatedAt - a.updatedAt);
  return (picked.length ? picked : recent).slice(0, max);
}
