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
  /** It is shown in the extension's source text pane (PDFs, files, Google files), not in a page. */
  inSource?: boolean;
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
 * A Markdown link: its text, then a target that may hold escaped parentheses and a title with
 * its own ("…/Consolidation_\(business\) "Consolidation (business)""), as Wikipedia pages have.
 */
const LINK_TARGET = String.raw`\((?:\\.|"[^"]*"|[^)\\"])*\)`;
const MD_LINK = new RegExp(String.raw`!?\[((?:\\.|[^\]\\])*)\]` + LINK_TARGET, 'g');
/** A footnote link ("[\[2\]](…#cite_note-2)"). */
const FOOTNOTE_LINK = new RegExp(String.raw`\[\\?\[[^\]\\]*\\?\]\]` + LINK_TARGET, 'g');
/** Markdown escapes put back: "\[2\]" → "[2]". */
const unescapeMd = (s: string) => s.replace(/\\([[\]()*_`#>.!\-+|~])/g, '$1');

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
    .replace(MD_LINK, '$1')
    .replace(/\\(?=[[\]()*_`#>.!\-+|~])/g, '')
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

const MONTH =
  '(?:jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|june?|july?|aug(?:ust)?|sept?(?:ember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?|januar|februar|märz|mai|juni|juli|oktober|dezember|janvier|février|mars|avril|juin|juillet|août|septembre|octobre|novembre|décembre|enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|octubre|noviembre|diciembre|janeiro|fevereiro|março|maio|junho|julho|setembro|outubro|dezembro|tháng)';
const MONTH_BEFORE = new RegExp(`(?<![\\p{L}])${MONTH}\\.?\\s$`, 'iu');
const MONTH_AFTER = new RegExp(`^\\s(?:${MONTH})(?![\\p{L}])`, 'iu');

/**
 * A number that is not an amount: the ordinal of a numbered list ("26. ↑ Annual report"), a day
 * next to its month ("26 February", "March 26"), or part of a date or range ("2026-11-12").
 */
function notAFigure(sentence: string, f: Figure) {
  const before = sentence.slice(0, f.index);
  const after = sentence.slice(f.index + f.length);
  if (!before.trim() && /^[.)](?:\s|$)/.test(after)) return true;
  if (MONTH_BEFORE.test(before) || MONTH_AFTER.test(after)) return true;
  if (/[-/]$/.test(sentence.slice(f.index, f.index + 1)) && /\d$/.test(before)) return true;
  return /^[-/]\d/.test(after);
}

/** Words kept on each side of a figure found in the source, for its passage. */
const AROUND = 8;

/** A line of Markdown as a reader sees it: no link targets, footnote links or emphasis. */
const plainLine = (line: string) =>
  unescapeMd(line.replace(FOOTNOTE_LINK, '').replace(MD_LINK, '$1'))
    .replace(/[*_`#>]+/g, '')
    .replace(/\s+/g, ' ')
    .trim();

/**
 * A name with a version or a code in it, not an amount: "AGPL-3.0", "GPT-4o", "ISO-27001". It is
 * looked up as written. Two letters or more, a digit, no spaces; a scale ("1.5bn") is an amount.
 */
const TERM = /^(?=.*\p{L}.*\p{L})(?=.*\d)[\p{L}\d.+_/-]+$/u;
const isTerm = (value: string) => TERM.test(value) && !/^[$€£¥]?[\d.,]+(?:k|m|mm|b|bn|t|tn|tr)$/i.test(value);

/** A table's separator row ("| --- | :--: |"). */
const SEPARATOR_CELL = /^:?-{2,}:?$/;

/**
 * A passage for a figure the model gave no usable passage for, found in the source itself: the
 * words around it, when it is written exactly once. Running text comes first. A table cell
 * counts too when it says what the number is ("13 languages"); a cell holding only a number (a
 * rank, a value column) does not, as every small number is in one. A figure written more than
 * once is left alone, as which one is meant cannot be told. "26" is not "2026", and a percentage
 * is not a plain number. A name such as "AGPL-3.0" is looked up as written instead.
 */
export function locateFigure(content: string, value: string | number | null | undefined): string | null {
  if (typeof value === 'string' && isTerm(value.trim())) return locateTerm(content, value.trim());
  const figure = firstFigure(value);
  if (!figure) return null;
  const percent = String(value).includes('%');
  const inText: string[] = [];
  const inTables: string[] = [];
  /** Records the figure's occurrences in `text`; `inCell` says where a table cell runs. */
  const scan = (text: string, hits: string[], inCell?: (at: number) => boolean) => {
    for (const f of figuresIn(text)) {
      if (!sameFigure(figure, f)) continue;
      if (text.slice(f.index, f.index + f.length).endsWith('%') !== percent) continue;
      if (notAFigure(text, f) || (inCell && !inCell(f.index))) continue;
      const words = text.split(' ');
      const at = text.slice(0, f.index).split(' ').length - 1;
      hits.push(words.slice(Math.max(0, at - AROUND), at + AROUND + 1).join(' '));
    }
  };
  for (const line of content.split('\n')) {
    if (/^\s*\|/.test(line)) {
      const cells = line
        .split('|')
        .map(plainLine)
        .filter((c) => c && !SEPARATOR_CELL.test(c));
      // The row as one text (as the reader's text has it, without the pipes), and where each cell sits.
      const text = cells.join(' ');
      const spans: [number, number, boolean][] = [];
      let at = 0;
      for (const cell of cells) {
        spans.push([at, at + cell.length, /\p{L}/u.test(cell.replace(NUMBER, ''))]);
        at += cell.length + 1;
      }
      scan(text, inTables, (i) => spans.some(([a, b, words]) => words && i >= a && i < b));
      continue;
    }
    for (const sentence of plainLine(line).split(/(?<=[.!?。！？])\s+/)) scan(sentence, inText);
  }
  const hits = inText.length ? inText : inTables;
  if (hits.length !== 1) return null;
  const passage = hits[0]!;
  return evidenceStatus(content, passage, value) === 'ok' ? passage : null;
}

/** The words around the first place a name is written ("released under the AGPL-3.0 license"). */
function locateTerm(content: string, term: string): string | null {
  const needle = term.toLowerCase();
  for (const line of content.split('\n')) {
    const text = line.includes('|') ? line.split('|').map(plainLine).filter(Boolean).join(' ') : plainLine(line);
    const index = text.toLowerCase().indexOf(needle);
    if (index === -1) continue;
    const words = text.split(' ');
    const at = text.slice(0, index).split(' ').length - 1;
    const passage = words.slice(Math.max(0, at - AROUND), at + AROUND + 1).join(' ');
    if (evidenceStatus(content, passage, term) === 'ok') return passage;
  }
  return null;
}
