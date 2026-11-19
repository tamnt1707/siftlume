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
/** Chinese and Japanese have no spaces between words: a passage of this many characters instead. */
const MIN_CJK = 6;
const CJK_CHAR = /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}]/gu;

/**
 * A space next to a Chinese or Japanese character: PDFs put them between characters, and writers
 * differ on spaces around Latin words and digits in such text ("古い cron を 7 件").
 */
const CJK = '\\p{Script=Han}\\p{Script=Hiragana}\\p{Script=Katakana}ー々、。「」';
const CJK_GAP = new RegExp(`(?<=[${CJK}]) | (?=[${CJK}])`, 'gu');

/**
 * Text as a reader sees it: no Markdown link targets, emphasis or table pipes, no transcript
 * timestamps, straight quotes, one space between words, lower case. Text pulled out of PDFs and
 * files is evened out too: full-width digits and letters (１９：００), ligatures (ﬁ), soft hyphens
 * and zero-width characters, and spaces between Chinese or Japanese characters.
 */
export function normalizeText(s: string) {
  return s
    .normalize('NFKC')
    .replace(/[\u00ad\u200b-\u200d\u2060\ufeff]/g, '')
    .replace(/!?\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/\[\d{1,2}:\d{2}(?::\d{2})?\]/g, ' ')
    .replace(/[*_`#>|~]+/g, ' ')
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[–—]/g, '-')
    .replace(/\s+/g, ' ')
    .replace(CJK_GAP, '')
    .trim()
    .toLowerCase();
}

/**
 * The source as normalized text, as is and with words a PDF broke across lines put back together:
 * without the hyphen ("back-\nground" → "background") and with it ("state-\nof-the-art"); the
 * model may quote any of them. Kept for the last source, as
 * every figure of a summary is checked against the same one.
 */
let normalized: { content: string; variants: string[] } | null = null;
function sourceVariants(content: string) {
  if (normalized?.content !== content) {
    const broken = /(\p{Ll})-[ \t]*\r?\n[ \t]*(\p{Ll})/gu;
    const variants = [normalizeText(content)];
    if (broken.test(content)) {
      variants.push(normalizeText(content.replace(broken, '$1$2')), normalizeText(content.replace(broken, '$1-$2')));
    }
    normalized = { content, variants };
  }
  return normalized.variants;
}

/**
 * The digits of a number with its separators dropped: "$4.2B" → "42", "+186.000" and "186,000" →
 * "186000". Separators differ by language (Vietnamese and German write 186.000, English 186,000),
 * and the model writes figures in the output language, so only the digits are compared.
 */
const digitsOf = (n: string) => n.replace(/\D/g, '');

const NUMBER = /[+\-\u2212$€£¥]?\d(?:[\d.,\s\u00a0\u202f]*\d)?%?/g;

/**
 * A scale right after a number: a letter stuck to it ("186K", "$4.2B", "$1.5bn") or a word
 * ("1.2 million", "186 nghìn", "3 tỷ", "5万"). Only then can the digits stand for more zeros.
 */
const SCALE =
  /^(?:(?:k|m|mm|b|bn|t|tn|tr)(?![\p{L}])|\s?(?:thousand|million|billion|trillion|nghìn|ngàn|triệu|tỷ|tỉ|tausend|mio|mrd|millions?|milliards?|millones|mil|mille|тыс|млн|млрд|พัน|ล้าน|千|万|萬|億|亿|천|만|억))/iu;

interface Figure {
  digits: string;
  scaled: boolean;
  index: number;
  length: number;
}

/** Every number in a text: "from +133,000 to 186K" → 133000, then 186 with a scale. */
function figuresIn(text: string): Figure[] {
  return [...text.matchAll(NUMBER)].map((m) => ({
    digits: digitsOf(m[0]),
    scaled: SCALE.test(text.slice(m.index + m[0].length, m.index + m[0].length + 12)),
    index: m.index,
    length: m[0].length,
  }));
}

/** The digits of the first number in a figure as written, or null without digits. */
export function digitCore(value: string) {
  return figuresIn(value)[0]?.digits || null;
}

/**
 * Same figure: same digits, or the shorter one has a scale word and the longer one is it followed
 * by zeros ("186K" or "186 nghìn" against "186,000"). Without a scale, 1% and 10% stay apart.
 */
const sameFigure = (a: Figure, b: Figure) => {
  if (a.digits === b.digits) return true;
  const [short, long] = a.digits.length <= b.digits.length ? [a, b] : [b, a];
  return short.scaled && long.digits.startsWith(short.digits) && /^0*$/.test(long.digits.slice(short.digits.length));
};

/**
 * The figure a summary block shows. A bare number (a bar's value) is plotted in the chart's unit,
 * which is often thousands or millions, so it may stand for more zeros.
 */
function firstFigure(value: string | number | null | undefined) {
  if (value === undefined || value === null) return null;
  const figure = figuresIn(String(value).normalize('NFKC')).find((f) => f.digits);
  return figure && typeof value === 'number' ? { ...figure, scaled: true } : (figure ?? null);
}

/**
 * Why a figure is or is not backed by the source:
 * - ok: the passage is in the source word for word and contains the figure;
 * - noQuote: no passage was given (often a figure the model counted or worked out);
 * - short: the passage is too short to prove anything;
 * - notFound: the passage is not in the source word for word;
 * - noFigure: the passage is in the source but does not contain the figure.
 */
export type EvidenceStatus = 'ok' | 'noQuote' | 'short' | 'notFound' | 'noFigure';

export function evidenceStatus(
  content: string,
  quote: string | undefined | null,
  value?: string | number | null,
): EvidenceStatus {
  if (!quote?.trim()) return 'noQuote';
  const q = normalizeText(quote);
  if (q.split(' ').length < MIN_WORDS && (q.match(CJK_CHAR)?.length ?? 0) < MIN_CJK) return 'short';
  if (!sourceVariants(content).some((c) => c.includes(q))) return 'notFound';
  const figure = firstFigure(value);
  if (!figure) return 'ok';
  return figuresIn(q).some((f) => sameFigure(figure, f)) ? 'ok' : 'noFigure';
}

/** True when `quote` is in the source and, for a figure with digits, the passage contains them. */
export function checkEvidence(content: string, quote: string | undefined | null, value?: string | number | null) {
  return evidenceStatus(content, quote, value) === 'ok';
}

/** Where the figure sits in its passage, to mark it there: [start, end) in `quote`, or null. */
export function figureRange(quote: string, value: string | number | null | undefined): [number, number] | null {
  const figure = firstFigure(value);
  if (!figure) return null;
  const found = figuresIn(quote).find((f) => sameFigure(figure, f));
  return found ? [found.index, found.index + found.length] : null;
}
