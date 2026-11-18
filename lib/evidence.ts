import { createContext, useContext } from 'react';

/**
 * Checks that a figure the model wrote down is backed by the source: the passage it gives must
 * appear verbatim in the source text and contain the figure. A number in a chart looks more
 * trustworthy than one in a sentence, so the reader sees which figures could not be traced back.
 */

/** What the summary blocks need to check figures and show their passage. */
export interface Evidence {
  /** The source text the model read. */
  content: string;
  /** The passage can be shown where it came from (highlighted in the page, or played in the video). */
  canShow: boolean;
}

/** Unset outside a session (showcase, examples) and for computed data (CSV): no marks at all. */
export const EvidenceContext = createContext<Evidence | null>(null);
export const useEvidence = () => useContext(EvidenceContext);

/** Fewer words than this matches almost anywhere, so it proves nothing. */
const MIN_WORDS = 3;

/**
 * Text as a reader sees it: no Markdown link targets, emphasis or table pipes, no transcript
 * timestamps, straight quotes, one space between words, lower case.
 */
export function normalizeText(s: string) {
  return s
    .replace(/!?\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/\[\d{1,2}:\d{2}(?::\d{2})?\]/g, ' ')
    .replace(/[*_`#>|~]+/g, ' ')
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[–—]/g, '-')
    .replace(/ /g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

/**
 * The digits of a number with its separators dropped: "$4.2B" → "42", "+186.000" and "186,000" →
 * "186000". Separators differ by language (Vietnamese and German write 186.000, English 186,000),
 * and the model writes figures in the output language, so only the digits are compared.
 */
const digitsOf = (n: string) => n.replace(/\D/g, '');

const NUMBER = /[+\-\u2212$€£¥]?\d(?:[\d.,\s\u00a0\u202f]*\d)?%?/g;

/** Every number in a text, as digits: "from +133,000 to +186,000" → ["133000", "186000"]. */
const numbersIn = (text: string) => (text.match(NUMBER) ?? []).map(digitsOf);

/** The digits of the first number in a figure as written, or null without digits. */
export function digitCore(value: string) {
  const first = numbersIn(value)[0];
  return first || null;
}

/**
 * Same figure: same digits, or one is the other followed by zeros, for a scale written as a word
 * on one side and in digits on the other ("186K" or "186 nghìn" against "186,000").
 */
const sameFigure = (a: string, b: string) => {
  const [short, long] = a.length <= b.length ? [a, b] : [b, a];
  return long.startsWith(short) && /^0*$/.test(long.slice(short.length));
};

/** True when `quote` is in the source and, for a figure with digits, the passage contains them. */
export function checkEvidence(content: string, quote: string | undefined | null, value?: string | number | null) {
  if (!quote) return false;
  const q = normalizeText(quote);
  if (q.split(' ').length < MIN_WORDS || !normalizeText(content).includes(q)) return false;
  const core = value === undefined || value === null ? null : digitCore(String(value));
  if (!core) return true;
  return numbersIn(q).some((n) => sameFigure(core, n));
}

/** Where the figure sits in its passage, to mark it there: [start, end) in `quote`, or null. */
export function figureRange(quote: string, value: string | number | null | undefined): [number, number] | null {
  const core = value === undefined || value === null ? null : digitCore(String(value));
  if (!core) return null;
  for (const m of quote.matchAll(NUMBER)) {
    if (sameFigure(core, digitsOf(m[0]))) return [m.index, m.index + m[0].length];
  }
  return null;
}
