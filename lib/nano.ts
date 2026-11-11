import { browser } from '#imports';
import { t } from '@/lib/i18n';
import { splitParts, type ExtractedSource } from './extractors';
import { nanoProgram, parsePartialJson, type NanoSummary } from './nano-program';
import { OUTPUT_LANGUAGES } from './languages';
import { MODE_TASK, resolveMode } from './modes';
import type { Settings, SummaryLength } from './settings';

/**
 * Gemini Nano through Chrome's built-in Prompt API: runs on the user's device, no key, no data
 * leaves the browser. The model is small and its context window is a few thousand tokens, so it
 * does not write openui-lang: it fills a JSON schema (structured output) that is turned into a
 * summary program here, and long sources are read in parts first (notes per part, then one
 * summary of the notes).
 */

// ── Prompt API types (Chrome 138+ in extensions) ────────────────────────────────

type Availability = 'unavailable' | 'downloadable' | 'downloading' | 'available';
interface LanguageSpec {
  type: 'text';
  languages: string[];
}
interface CreateOptions {
  initialPrompts?: { role: 'system' | 'user' | 'assistant'; content: string }[];
  expectedInputs?: LanguageSpec[];
  expectedOutputs?: LanguageSpec[];
  signal?: AbortSignal;
  monitor?: (m: EventTarget) => void;
}
interface PromptOptions {
  signal?: AbortSignal;
  responseConstraint?: object;
}
interface NanoSession {
  prompt(input: string, options?: PromptOptions): Promise<string>;
  promptStreaming(input: string, options?: PromptOptions): ReadableStream<string>;
  measureContextUsage?(input: string, options?: PromptOptions): Promise<number>;
  contextWindow?: number;
  contextUsage?: number;
  /** Older Chrome names of the same values. */
  measureInputUsage?(input: string): Promise<number>;
  inputQuota?: number;
  inputUsage?: number;
  destroy(): void;
}
interface LanguageModelStatic {
  availability(options?: Omit<CreateOptions, 'initialPrompts' | 'signal' | 'monitor'>): Promise<Availability>;
  create(options?: CreateOptions): Promise<NanoSession>;
}

const api = () => (globalThis as { LanguageModel?: LanguageModelStatic }).LanguageModel;

/** The browser has the Prompt API at all (Chrome desktop 138+). */
export const hasNano = () => Boolean(api());

/** Languages Gemini Nano reads and writes; others are "in development". */
export const NANO_LANGUAGES = ['en', 'ja', 'es', 'de', 'fr'];

export type NanoStatus = Availability | 'unsupported';

export async function nanoStatus(): Promise<NanoStatus> {
  const lm = api();
  if (!lm) return 'unsupported';
  try {
    return await lm.availability(langOptions('en'));
  } catch {
    return 'unavailable';
  }
}

/**
 * Downloads the model. Call it from a click: Chrome only starts the download with user
 * activation. Progress is 0–1.
 */
export async function downloadNano(onProgress: (loaded: number) => void) {
  const lm = api();
  if (!lm) throw new Error(t('errors:nano.unsupported'));
  const session = await lm.create({
    ...langOptions('en'),
    monitor: (m) => m.addEventListener('downloadprogress', (e) => onProgress(Number((e as ProgressEvent).loaded) || 0)),
  });
  session.destroy();
}

function langOptions(out: string) {
  const inputs = [...new Set(['en', out])];
  return {
    expectedInputs: [{ type: 'text' as const, languages: inputs }],
    expectedOutputs: [{ type: 'text' as const, languages: [out] }],
  };
}

/**
 * The language to write in: the chosen output language, or the source's own for "same as
 * source". Nano writes only a few languages; anything else falls back to English (flagged).
 */
async function outputLanguage(settings: Settings, sample: string) {
  let tag: string | undefined;
  if (settings.language && settings.language !== 'auto') {
    tag = OUTPUT_LANGUAGES.find((l) => l.name === settings.language)?.tag;
  } else {
    const detected = await browser.i18n
      ?.detectLanguage?.(sample.slice(0, 2000))
      .then((r) => r.languages?.[0]?.language)
      .catch(() => undefined);
    tag = detected;
  }
  const base = tag?.split('-')[0]?.toLowerCase();
  if (base && NANO_LANGUAGES.includes(base)) return { code: base, fallback: false };
  return { code: 'en', fallback: Boolean(base && base !== 'en') };
}

const LANGUAGE_NAMES: Record<string, string> = {
  en: 'English',
  ja: 'Japanese',
  es: 'Spanish',
  de: 'German',
  fr: 'French',
};

async function openSession(system: string, out: string, signal?: AbortSignal) {
  const lm = api();
  if (!lm) throw new Error(t('errors:nano.unsupported'));
  const options = langOptions(out);
  const status = await lm.availability(options).catch(() => 'unavailable' as const);
  if (status === 'unavailable') throw new Error(t('errors:nano.unavailable'));
  if (status !== 'available') throw new Error(t('errors:nano.notDownloaded'));
  return lm.create({ ...options, signal, initialPrompts: [{ role: 'system', content: system }] });
}

const windowOf = (s: NanoSession) => s.contextWindow ?? s.inputQuota ?? 6000;
const usageOf = (s: NanoSession) => s.contextUsage ?? s.inputUsage ?? 0;
async function measure(s: NanoSession, text: string) {
  try {
    if (s.measureContextUsage) return await s.measureContextUsage(text);
    if (s.measureInputUsage) return await s.measureInputUsage(text);
  } catch {
    /* fall through to the estimate */
  }
  return Math.ceil(text.length / 3);
}

/** Room left for input, keeping space for the answer. */
const room = (s: NanoSession, reserve: number) => Math.max(500, windowOf(s) - usageOf(s) - reserve);

/**
 * Streams one prompt; chunks are deltas in current Chrome, the whole text in older versions.
 * A small model can fall into repeating itself until Chrome's output limit (minutes later), so
 * the answer is cut at `maxChars` and what came so far is used.
 */
async function stream(
  session: NanoSession,
  input: string,
  options: { signal?: AbortSignal; responseConstraint?: object; maxChars: number },
  onText: (s: string) => void,
) {
  let text = '';
  const { maxChars, ...promptOptions } = options;
  const reader = session.promptStreaming(input, promptOptions).getReader();
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    text = value.startsWith(text) && text ? value : text + value;
    onText(text);
    if (text.length > maxChars) {
      void reader.cancel().catch(() => {});
      break;
    }
  }
  return text;
}

/**
 * The source as it fits the model: whole when it fits, otherwise notes taken part by part.
 * `onPart` reports progress (part, parts).
 */
async function fitSource(
  content: string,
  out: string,
  signal: AbortSignal | undefined,
  reserve: number,
  onPart?: (part: number, parts: number) => void,
) {
  const probe = await openSession('You read documents.', out, signal);
  try {
    const budget = room(probe, reserve);
    const tokens = await measure(probe, content);
    if (tokens <= budget) return { text: content, notes: false };
    // Characters per token, measured on this text, to size the parts.
    const ratio = content.length / Math.max(1, tokens);
    const size = Math.floor(budget * 0.8 * ratio);
    const parts = splitParts(content, Math.max(1500, size));
    const notes: string[] = [];
    const lang = LANGUAGE_NAMES[out] ?? 'English';
    for (let i = 0; i < parts.length; i++) {
      if (signal?.aborted) throw new DOMException('Stopped', 'AbortError');
      onPart?.(i + 1, parts.length);
      const s = await openSession(
        `You take dense notes on one part of a longer document, in ${lang}. Keep the most important facts, numbers, names, dates and arguments. At most 12 bullet points of under 25 words each, no introduction.`,
        out,
        signal,
      );
      try {
        notes.push(`Part ${i + 1}:\n${await stream(s, parts[i]!, { signal, maxChars: 2500 }, () => {})}`);
      } finally {
        s.destroy();
      }
    }
    // Notes that are still too long are cut: better a summary of most of it than none.
    let text = notes.join('\n\n');
    const noteTokens = await measure(probe, text);
    if (noteTokens > budget) text = text.slice(0, Math.floor(budget * ratio * 0.9));
    return { text, notes: true };
  } finally {
    probe.destroy();
  }
}

// ── Summary ─────────────────────────────────────────────────────────────────────

/** Longest JSON answer accepted before it is cut (a model repeating itself). */
const MAX_JSON: Record<SummaryLength, number> = { short: 2500, medium: 4000, detailed: 6000 };

const COUNTS: Record<SummaryLength, { takeaways: number; sections: number }> = {
  short: { takeaways: 3, sections: 0 },
  medium: { takeaways: 5, sections: 2 },
  detailed: { takeaways: 7, sections: 4 },
};

function schema(length: SummaryLength) {
  const c = COUNTS[length];
  const str = (maxLength: number) => ({ type: 'string', maxLength });
  return {
    type: 'object',
    required: ['title', 'tldr', 'takeaways', 'followUps'],
    properties: {
      title: str(90),
      tldr: str(200),
      keyNumbers: {
        type: 'array',
        maxItems: 4,
        items: { type: 'object', required: ['value', 'label'], properties: { value: str(24), label: str(60) } },
      },
      takeaways: {
        type: 'array',
        minItems: 1,
        maxItems: c.takeaways,
        items: { type: 'object', required: ['text'], properties: { text: str(120), detail: str(200) } },
      },
      steps: { type: 'array', maxItems: 8, items: str(160) },
      sections: {
        type: 'array',
        maxItems: c.sections,
        items: {
          type: 'object',
          required: ['heading', 'points'],
          properties: {
            heading: str,
            points: { type: 'array', minItems: 1, maxItems: 6, items: str(200) },
          },
        },
      },
      followUps: { type: 'array', maxItems: 3, items: str(100) },
    },
  };
}

const MODE_HINTS = {
  summary: 'takeaways are the main points.',
  explain: 'takeaways explain the key ideas in plain words; steps describe how it works, if it is a process.',
  critique:
    'takeaways judge the main claims and how well the source supports them; sections can hold "Strengths" and "Weaknesses".',
  action: 'steps are the things the reader must do, in order; takeaways are what to decide or remember.',
} as const;

function summaryInstructions(settings: Settings, lang: string, instruction?: string) {
  const { base, custom } = resolveMode(settings.mode, settings.customModes);
  const c = COUNTS[settings.length];
  return [
    `${MODE_TASK[base]} Answer in ${lang} with the JSON object only.`,
    `title: a short title. tldr: one sentence of at most 20 words. keyNumbers: only real headline figures from the source (value like "$4.2B" or "31%", short label), otherwise omit. ${MODE_HINTS[base]} Up to ${c.takeaways} takeaways of at most 12 words each, most important first; detail is an optional short explanation.`,
    c.sections
      ? `sections: up to ${c.sections} more topics with 2-6 short points each, for detail that does not fit the takeaways.`
      : 'No sections.',
    'steps: only for instructions or things to do, otherwise omit. followUps: 2-3 short questions the reader may ask next.',
    'Use only information from the document. Never invent facts or numbers.',
    custom ? `The reader's own reading mode "${custom.name.trim()}": ${custom.instruction.trim()}` : '',
    settings.customInstructions.trim() ? `The reader's instructions: ${settings.customInstructions.trim()}` : '',
    instruction ? `Change request for this version: ${instruction}` : '',
  ]
    .filter(Boolean)
    .join('\n');
}

const WPM = 230;

/** Streams a structured answer, calling `onPartial` with what has parsed so far. */
function streamJson(
  session: NanoSession,
  input: string,
  responseConstraint: object,
  signal: AbortSignal | undefined,
  maxChars: number,
  onPartial: (partial: NanoSummary | null) => void,
) {
  let last = 0;
  return stream(session, input, { signal, responseConstraint, maxChars }, (text) => {
    // Parsing every token is wasted work; a few times a second is enough to look live.
    if (Date.now() - last > 250) {
      last = Date.now();
      onPartial(parsePartialJson(text));
    }
  });
}

export interface NanoProgress {
  /** Reading a long source part by part. */
  part?: number;
  parts?: number;
}

/** Summarizes a source with Gemini Nano. Resolves with the program and an optional note. */
export async function nanoSummary(args: {
  settings: Settings;
  source: ExtractedSource;
  instruction?: string;
  signal?: AbortSignal;
  onProgress?: (p: NanoProgress) => void;
  /** The summary so far, rebuilt as the answer streams in. */
  onProgram?: (program: string) => void;
}) {
  const { settings, source, instruction, signal, onProgress, onProgram } = args;
  const out = await outputLanguage(settings, source.content);
  const lang = LANGUAGE_NAMES[out.code] ?? 'English';
  const fitted = await fitSource(source.content, out.code, signal, 1500, (part, parts) =>
    onProgress?.({ part, parts }),
  );
  const system = `You summarize documents for a reader who wants the gist in seconds.\n${summaryInstructions(settings, lang, instruction)}`;
  const session = await openSession(system, out.code, signal);
  try {
    const input = `${fitted.notes ? 'Notes taken on' : 'Document'}: ${source.title}\n\n${fitted.text}`;
    const words = source.content.trim().split(/\s+/).length;
    const minutes = Math.max(1, Math.round(words / WPM));
    // The JSON streams in: show what is complete so far, as a summary that grows.
    const raw = await streamJson(
      session,
      input,
      schema(settings.length),
      signal,
      MAX_JSON[settings.length],
      (partial) => {
        if (partial?.title || partial?.tldr) onProgram?.(nanoProgram(partial, source, minutes));
      },
    );
    let data: NanoSummary;
    try {
      data = JSON.parse(raw) as NanoSummary;
    } catch {
      const partial = parsePartialJson(raw);
      if (!partial?.tldr) throw new Error(t('errors:nano.badAnswer'));
      data = partial;
    }
    const program = nanoProgram(data, source, minutes);
    const note = out.fallback ? t('errors:nano.englishOnly') : '';
    return { program, note };
  } finally {
    session.destroy();
  }
}

/** Answers a question about the source in plain text, streamed. */
export async function nanoAnswer(args: {
  settings: Settings;
  source: ExtractedSource;
  history: { question: string; answer: string }[];
  question: string;
  signal?: AbortSignal;
  onText: (text: string) => void;
}) {
  const { settings, source, history, question, signal, onText } = args;
  const out = await outputLanguage(settings, source.content);
  const lang = LANGUAGE_NAMES[out.code] ?? 'English';
  const fitted = await fitSource(source.content, out.code, signal, 2000);
  const past = history
    .slice(-3)
    .map((h) => `Q: ${h.question}\nA: ${h.answer.slice(0, 600)}`)
    .join('\n\n');
  const system = `You answer questions about a document, in ${lang}, using only what it says. Short factual answers: 1-3 sentences. Use a short Markdown list for steps or several points. If the document does not say, answer that it does not.`;
  const session = await openSession(system, out.code, signal);
  try {
    const input = `${fitted.notes ? 'Notes on the document' : 'Document'} "${source.title}":\n${fitted.text}${past ? `\n\nEarlier questions:\n${past}` : ''}\n\nQuestion: ${question}`;
    return await stream(session, input, { signal, maxChars: 4000 }, onText);
  } finally {
    session.destroy();
  }
}

/** Any other plain prompt (e.g. choosing links): system + one user text, trimmed to fit. */
export async function nanoComplete(args: {
  system: string;
  input: string;
  signal?: AbortSignal;
  onText: (text: string) => void;
}) {
  const session = await openSession(args.system, 'en', args.signal);
  try {
    const budget = room(session, 800);
    const tokens = await measure(session, args.input);
    const input = tokens > budget ? args.input.slice(0, Math.floor((args.input.length * budget) / tokens)) : args.input;
    return await stream(session, input, { signal: args.signal, maxChars: 4000 }, args.onText);
  } finally {
    session.destroy();
  }
}
