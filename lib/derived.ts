import { evidenceStatus, locateFigure, normalizeText, type EvidenceStatus } from './evidence';

/**
 * Figures the model worked out itself (a total, a difference, a percentage change) have no
 * passage of their own in the source. They come with the source figures they were computed from;
 * when every input is quoted verbatim and the arithmetic holds, the figure is shown as derived,
 * with its inputs, instead of unverified. Checked in the browser, with no request to the model.
 */

/** A source figure a derived figure was worked out from. */
export interface FigureInput {
  /** The figure as written in the source ("$3.4B", "18%"). */
  value: string;
  /** 5-25 words copied verbatim from the source that contain it. */
  quote?: string;
  /** What it is, in 1-4 words ("Q4 2024 revenue"). */
  label?: string;
}

/** How a derived figure follows from its inputs. */
export type DerivedOp = 'rounded' | 'sum' | 'average' | 'difference' | 'ratio' | 'share' | 'change' | 'product';

/**
 * Beyond the plain evidence statuses:
 * - derived: no passage of its own, but it follows from inputs that are all in the source;
 * - inferred: its passage is in the source and says it in words ("no fee" for 0, "a dozen" for 12);
 * - badInput: one of the figures it was worked out from is not backed by the source;
 * - mismatch: its inputs are in the source, but it does not follow from them.
 */
export type FigureStatus = EvidenceStatus | 'derived' | 'inferred' | 'badInput' | 'mismatch';

export interface FigureCheck {
  status: FigureStatus;
  op?: DerivedOp;
  /** For a derived figure: the inputs it was worked out from. */
  inputs?: FigureInput[];
  /** For a figure found in the source without the model's passage, or inferred: the passage. */
  quote?: string;
}

/** At most this many inputs are combined: a figure worked out from more is not checkable at a glance. */
const MAX_INPUTS = 6;

const NUMBER = /[+\-−]?[$€£¥]?\d(?:[\d.,\s  ]*\d)?%?/;

/** A scale letter stuck to the number ("186K", "$4.2B", "5tr"), or a scale word after it. */
const SCALE_LETTER: [RegExp, number][] = [
  [/^(?:k)(?![\p{L}])/iu, 1e3],
  [/^(?:mm|mn|m|tr)(?![\p{L}])/iu, 1e6],
  [/^(?:bn|b)(?![\p{L}])/iu, 1e9],
  [/^(?:tn|t)(?![\p{L}])/iu, 1e12],
];
const SCALE_WORD: [RegExp, number][] = [
  [/^\s?(?:trillions?|nghìn tỷ)/iu, 1e12],
  [/^\s?(?:billions?|milliards?|mrd|tỷ|tỉ|млрд)/iu, 1e9],
  [/^\s?(?:millions?|millones|millón|mio|triệu|млн|ล้าน)/iu, 1e6],
  [/^\s?(?:thousand|nghìn|ngàn|tausend|mille|mil|тыс|พัน|千|천)/iu, 1e3],
  [/^\s?(?:億|亿|억)/u, 1e8],
  [/^\s?(?:万|萬|만)/u, 1e4],
];
const PERCENT_WORD = /^\s?(?:%|percent|per cent|phần trăm|prozent|por ciento|pour cent|por cento|процент)/iu;

/** A figure as amounts: one per reading of its separators ("1.234" is 1234 or 1.234). */
interface Amount {
  values: number[];
  /** The figure as written, with its scale word or percent sign ("1.510 tỷ", "18%"). */
  text: string;
  /** Half the last written digit, scaled: how far rounding can move it. */
  halfUnits: number[];
  percent: boolean;
}

/** The ways a run of digits and separators can be read: [number, decimals]. */
function readings(body: string): [number, number][] {
  const digits = body.replace(/[\s  ]/g, '');
  const seps = digits.match(/[.,]/g) ?? [];
  if (!seps.length) return [[Number(digits), 0]];
  const asDecimal = (dec: string) => {
    const i = digits.lastIndexOf(dec);
    const whole = digits.slice(0, i).replace(/[.,]/g, '');
    const frac = digits.slice(i + 1);
    return [Number(`${whole}.${frac}`), frac.length] as [number, number];
  };
  const thousands: [number, number] = [Number(digits.replace(/[.,]/g, '')), 0];
  const kinds = new Set(seps);
  // Both: the last one is the decimal mark ("1,234.5", "1.234,5").
  if (kinds.size > 1) return [asDecimal(digits[Math.max(digits.lastIndexOf('.'), digits.lastIndexOf(','))]!)];
  if (seps.length > 1) return [thousands];
  const after = digits.length - digits.indexOf(seps[0]!) - 1;
  // One mark before exactly three digits reads both ways: 186.000 (Vietnamese) or 1.234 (decimal).
  return after === 3 ? [thousands, asDecimal(seps[0]!)] : [asDecimal(seps[0]!)];
}

/** The first number in a figure as written, as amounts, or null without digits. */
export function amountOf(value: string | number): Amount | null {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? { values: [value], text: String(value), halfUnits: [0], percent: false } : null;
  }
  const text = value.normalize('NFKC');
  const m = text.match(NUMBER);
  if (!m || m.index === undefined) return null;
  const raw = m[0];
  const sign = /^[-−]/.test(raw) ? -1 : 1;
  const rest = text.slice(m.index + raw.length);
  const percentWord = raw.endsWith('%') ? null : rest.match(PERCENT_WORD);
  const percent = raw.endsWith('%') || !!percentWord;
  const body = raw.replace(/^[+\-−]?[$€£¥]?/, '').replace(/%$/, '');
  let scale = 1;
  let suffix = percentWord?.[0] ?? '';
  if (!percent) {
    for (const [re, mult] of [...SCALE_LETTER, ...SCALE_WORD]) {
      const found = rest.match(re);
      if (found) {
        scale = mult;
        suffix = found[0];
        break;
      }
    }
  }
  const read = readings(body);
  return {
    values: read.map(([n]) => sign * n * scale),
    text: (raw + suffix).trim(),
    halfUnits: read.map(([, dec]) => 0.5 * 10 ** -dec * scale),
    percent,
  };
}

/** Every way of picking one reading per input. */
function combinations(amounts: Amount[]): number[][] {
  return amounts.reduce<number[][]>((acc, a) => acc.flatMap((xs) => a.values.map((v) => [...xs, v])), [[]]);
}

/** What the inputs can give, with the operation: only those that make sense for the target's kind. */
function results(xs: number[], inputsPercent: boolean[], targetPercent: boolean): [DerivedOp, number][] {
  const out: [DerivedOp, number][] = [];
  // Adding up or rounding keeps the kind: percentages give percentage points, amounts give amounts.
  const sameKind = inputsPercent.every((p) => p === targetPercent);
  if (xs.length === 1) {
    if (sameKind) out.push(['rounded', xs[0]!]);
    return out;
  }
  if (sameKind) {
    const sum = xs.reduce((s, x) => s + x, 0);
    out.push(['sum', sum], ['average', sum / xs.length]);
  }
  if (xs.length !== 2) return out;
  const [a, b] = xs as [number, number];
  if (sameKind) out.push(['difference', a - b], ['difference', b - a]);
  out.push(['product', a * b]);
  if (inputsPercent.some(Boolean)) out.push(['product', (a * b) / 100]);
  if (targetPercent) {
    if (b) out.push(['share', (a / b) * 100]);
    if (a) out.push(['share', (b / a) * 100]);
    if (!inputsPercent.some(Boolean)) {
      if (a) out.push(['change', ((b - a) / a) * 100]);
      if (b) out.push(['change', ((a - b) / b) * 100]);
    }
  } else {
    if (b) out.push(['ratio', a / b]);
    if (a) out.push(['ratio', b / a]);
  }
  return out;
}

/** How a figure follows from its inputs, and which of them it uses. */
interface Derivation {
  op: DerivedOp;
  used: number[];
}

/**
 * The op when `given` give `target`: a result counts when it rounds to the figure as written
 * (half its last digit, but no more than 10%: "$1B" is not $0.8B rounded), or is within 0.5% of
 * it; a sign the writer left out ("fell 12%") is forgiven.
 */
function matchOp(target: Amount, given: Amount[]): DerivedOp | null {
  const percents = given.map((a) => a.percent);
  for (const xs of combinations(given)) {
    for (const [op, r] of results(xs, percents, target.percent)) {
      if (!Number.isFinite(r)) continue;
      for (const [i, t] of target.values.entries()) {
        const tol = Math.max(Math.min(target.halfUnits[i]!, Math.abs(t) * 0.1), Math.abs(t) * 0.005, 1e-9);
        if (Math.abs(r - t) <= tol || Math.abs(Math.abs(r) - Math.abs(t)) <= tol) return op;
      }
    }
  }
  return null;
}

/**
 * How `value` follows from `inputs`, or null. With `pairs`, any two of them may be the ones it
 * was worked out from (figures found in a passage, where the others are context).
 */
function derive(value: string | number, inputs: (string | number)[], pairs = false): Derivation | null {
  if (!inputs.length || inputs.length > MAX_INPUTS) return null;
  const target = amountOf(value);
  const amounts = inputs.map(amountOf);
  if (!target || amounts.some((a) => !a)) return null;
  const given = amounts as Amount[];
  const all = matchOp(target, given);
  if (all) return { op: all, used: given.map((_, i) => i) };
  if (!pairs) return null;
  for (let a = 0; a < given.length; a++) {
    for (let b = a + 1; b < given.length; b++) {
      const op = matchOp(target, [given[a]!, given[b]!]);
      if (op) return { op, used: [a, b] };
    }
  }
  return null;
}

/** How `value` follows from `inputs`, or null. */
export function derivation(value: string | number, inputs: (string | number)[]): DerivedOp | null {
  return derive(value, inputs)?.op ?? null;
}

const NUMBERS = new RegExp(NUMBER.source, 'g');
/** A bare year ("2025") is when, not how much: never an input. */
const YEAR = /^(?:1[89]|20)\d\d$/;

/** The figures written in a passage, each as it is written there; years left out. */
export function figuresInPassage(passage: string): string[] {
  const text = passage.normalize('NFKC');
  return [...text.matchAll(NUMBERS)]
    .filter((m) => !YEAR.test(m[0].trim()))
    .map((m) => amountOf(text.slice(m.index))?.text)
    .filter((x): x is string => !!x);
}

/**
 * Words that say "none" ("no fee", "free", "zero-cost", "không cần", "miễn phí", "無料"): a 0 can
 * be read from them. Latin-script words stand alone; Chinese, Japanese and Thai have no spaces.
 */
const ZERO_WORDS = new RegExp(
  [
    '(?<![\\p{L}])(?:no|none|zero|free|without|nothing|never|kein|keine|keinen|keiner|null|kostenlos|gratis|ohne|aucun|aucune|zéro|gratuit|gratuite|gratuits|sans|ningún|ninguna|ninguno|cero|gratuito|sin|nenhum|nenhuma|grátis|sem|нет|ноль|бесплатно|без|không|chẳng|miễn phí|없|없이|무료)(?![\\p{L}])',
    '無料|不要|なし|ゼロ|免费|免費|无需|無需|不需要|零|ฟรี|ไม่มี|ไม่ต้อง',
  ].join('|'),
  'iu',
);

/** Small numbers written as words, in English (the language most sources are in). */
const NUMBER_WORDS: Record<string, number> = {
  one: 1,
  two: 2,
  three: 3,
  four: 4,
  five: 5,
  six: 6,
  seven: 7,
  eight: 8,
  nine: 9,
  ten: 10,
  eleven: 11,
  twelve: 12,
  dozen: 12,
  thirteen: 13,
  fourteen: 14,
  fifteen: 15,
  sixteen: 16,
  seventeen: 17,
  eighteen: 18,
  nineteen: 19,
  twenty: 20,
  single: 1,
  twice: 2,
  double: 2,
  triple: 3,
};

/** The passage says the figure in words: "none" for 0, or a small number spelled out. */
function saysInWords(passage: string, value: string | number) {
  const amount = amountOf(value);
  if (!amount || amount.percent) return false;
  const text = normalizeText(passage);
  if (amount.values.every((v) => v === 0)) return ZERO_WORDS.test(text);
  const said = new Set(
    text
      .split(/[^\p{L}]+/u)
      .map((w) => NUMBER_WORDS[w])
      .filter((n) => n !== undefined),
  );
  return amount.values.some((v) => said.has(Math.abs(v)));
}

/**
 * Whether a figure is backed by the source: its own passage first; without one, the figures it
 * was worked out from, and the arithmetic. A passage that is in the source but does not show the
 * figure may hold the figures it was worked out from ("Q3 1,510 … Q4 1,870" for "+23.8%"): those
 * count as its inputs. Last, a figure the model gave no usable passage for may still be written in
 * the source, once, in running text: that passage is used (lib/evidence.ts locateFigure). A
 * passage that says the figure in words ("no fee" for 0) makes it inferred.
 */
export function figureCheck(
  content: string,
  quote: string | undefined | null,
  value?: string | number | null,
  inputs?: FigureInput[] | null,
): FigureCheck {
  const check = checkFigure(content, quote, value, inputs);
  if (check.status === 'ok' || check.status === 'derived' || value === undefined || value === null) return check;
  // In the source, in words rather than digits: "No account, no key" for "0 accounts".
  if (check.status === 'noFigure' && saysInWords(quote!, value)) return { status: 'inferred', quote: quote! };
  const found = locateFigure(content, value);
  return found ? { status: 'ok', quote: found } : check;
}

function checkFigure(
  content: string,
  quote: string | undefined | null,
  value?: string | number | null,
  inputs?: FigureInput[] | null,
): FigureCheck {
  const own = evidenceStatus(content, quote, value);
  if (own === 'ok' || value === undefined || value === null) return { status: own };
  if (inputs?.length) {
    if (inputs.some((i) => evidenceStatus(content, i.quote, i.value) !== 'ok')) return { status: 'badInput' };
    const found = derive(
      value,
      inputs.map((i) => i.value),
    );
    return found ? { status: 'derived', op: found.op, inputs } : { status: 'mismatch' };
  }
  if (own === 'noFigure') {
    const inPassage = figuresInPassage(quote!);
    const found = derive(value, inPassage, true);
    if (found) {
      return {
        status: 'derived',
        op: found.op,
        inputs: found.used.map((i) => ({ value: inPassage[i]!, quote: quote! })),
      };
    }
  }
  return { status: own };
}

/** Backed by the source: directly, worked out from it, or read from its words. */
export const isBacked = (s: FigureStatus) => s === 'ok' || s === 'derived' || s === 'inferred';
