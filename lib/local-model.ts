import { browser } from '#imports';
import type { InitProgressReport, MLCEngineInterface } from '@mlc-ai/web-llm';
import { t } from '@/lib/i18n';
import { splitParts, type ExtractedSource } from './extractors';
import { OUTPUT_LANGUAGES } from './languages';
import { MODE_TASK, resolveMode } from './modes';
import { localProgram, parsePartialJson, type LocalSummary } from './local-program';
import type { Settings, SummaryLength } from './settings';

/**
 * Models that run in the browser on the GPU (WebGPU, through WebLLM): downloaded once from
 * Hugging Face when the user clicks Download, kept in the browser's cache, deleted from Settings.
 * Nothing the user reads leaves the device. The engine runs in a Web Worker so the page stays
 * smooth; the model's compiled code ships with the extension (public/webllm), only its weights
 * are downloaded.
 *
 * Small models do not write openui-lang reliably, so they fill a JSON schema (grammar-constrained
 * output) that is turned into a summary of the app's blocks (lib/local-program.ts).
 */

export interface LocalModel {
  id: string;
  label: string;
  /** Download size, in GB. */
  size: number;
  /** Compiled model code shipped in public/webllm. */
  lib: string;
  /** What it is good at, a key under settings:local.models. */
  hint: 'gemma' | 'qwen';
}

export const LOCAL_MODELS: LocalModel[] = [
  {
    id: 'gemma-4-E2B-it-q4f16_1-MLC',
    label: 'Gemma 4 E2B',
    size: 2.8,
    lib: 'gemma-4-E2B-it-q4f16_1_cs512-webgpu.wasm',
    hint: 'gemma',
  },
  {
    id: 'Qwen3.5-2B-q4f16_1-MLC',
    label: 'Qwen3.5 2B',
    size: 1.1,
    lib: 'Qwen3.5-2B-q4f16_1_cs1k-webgpu.wasm',
    hint: 'qwen',
  },
];

export const DEFAULT_LOCAL_MODEL = LOCAL_MODELS[0]!.id;
const modelOf = (id: string) => LOCAL_MODELS.find((m) => m.id === id) ?? LOCAL_MODELS[0]!;

/** Tokens the model sees at once (prompt + answer). */
const CONTEXT = 8192;
/** Characters per part of a long source: about 5,500 tokens, leaving room for the answer. */
const PART_CHARS = 16_000;

// ── Engine ──────────────────────────────────────────────────────────────────────

let webllm: Promise<typeof import('@mlc-ai/web-llm')> | null = null;
const lib = () => (webllm ??= import('@mlc-ai/web-llm'));

async function appConfig() {
  const { prebuiltAppConfig } = await lib();
  return {
    ...prebuiltAppConfig,
    model_list: LOCAL_MODELS.map((m) => {
      const base = prebuiltAppConfig.model_list.find((r) => r.model_id === m.id);
      if (!base) throw new Error(`Unknown model ${m.id}`);
      // The compiled code is loaded from the extension, never from the network.
      return {
        ...base,
        model_lib: browser.runtime.getURL(`/webllm/${m.lib}` as Parameters<typeof browser.runtime.getURL>[0]),
      };
    }),
  };
}

/** WebGPU with 16-bit floats, which both models need. */
export async function webGpuProblem(): Promise<string | null> {
  const gpu = (navigator as { gpu?: { requestAdapter(): Promise<{ features: Set<string> } | null> } }).gpu;
  if (!gpu) return t('errors:local.noWebGpu');
  const adapter = await gpu.requestAdapter().catch(() => null);
  if (!adapter) return t('errors:local.noWebGpu');
  if (!adapter.features.has('shader-f16')) return t('errors:local.noF16');
  return null;
}

let engine: Promise<MLCEngineInterface> | null = null;
let loadedModel: string | null = null;
let idleTimer: ReturnType<typeof setTimeout> | undefined;
let progressListener: ((r: InitProgressReport) => void) | null = null;

function getEngine() {
  engine ??= lib().then(async ({ CreateWebWorkerMLCEngine }) =>
    CreateWebWorkerMLCEngine(new Worker(new URL('./local-model.worker.ts', import.meta.url), { type: 'module' }), [], {
      appConfig: await appConfig(),
      initProgressCallback: (r) => progressListener?.(r),
    }),
  );
  return engine;
}

/** Frees the GPU memory a few minutes after the last use. */
function scheduleUnload() {
  clearTimeout(idleTimer);
  idleTimer = setTimeout(() => {
    void engine?.then((e) => e.unload());
    loadedModel = null;
  }, 5 * 60_000);
}

/** Loads a model into the GPU (downloading it first if needed). Progress is 0–1. */
async function loadModel(id: string, onProgress?: (progress: number) => void) {
  const e = await getEngine();
  clearTimeout(idleTimer);
  if (loadedModel !== id) {
    progressListener = onProgress ? (r) => onProgress(r.progress) : null;
    try {
      await e.reload(id, { context_window_size: CONTEXT });
    } finally {
      progressListener = null;
    }
    loadedModel = id;
  }
  return e;
}

// ── Model management (Settings) ─────────────────────────────────────────────────

export async function isDownloaded(id: string) {
  const { hasModelInCache } = await lib();
  return hasModelInCache(id, await appConfig()).catch(() => false);
}

/** Downloads a model (from a click). Cancel with cancelDownload(). */
export async function downloadModel(id: string, onProgress: (progress: number) => void) {
  const problem = await webGpuProblem();
  if (problem) throw new Error(problem);
  await loadModel(id, onProgress);
  scheduleUnload();
}

/** Stops a download in progress; what was downloaded stays in the cache. */
export async function cancelDownload() {
  loadedModel = null;
  await engine?.then((e) => e.unload()).catch(() => {});
}

export async function deleteModel(id: string) {
  if (loadedModel === id) await cancelDownload();
  const { deleteModelAllInfoInCache } = await lib();
  await deleteModelAllInfoInCache(id, await appConfig());
}

/** Bytes the browser uses for this extension's storage (models included), when it says. */
export async function storageUsed() {
  const estimate = await navigator.storage?.estimate?.().catch(() => undefined);
  return estimate?.usage;
}

// ── Prompting ───────────────────────────────────────────────────────────────────

async function readyEngine(settings: Settings) {
  const id = modelOf(settings.providers.browser?.model || DEFAULT_LOCAL_MODEL).id;
  const problem = await webGpuProblem();
  if (problem) throw new Error(problem);
  if (loadedModel !== id && !(await isDownloaded(id))) throw new Error(t('errors:local.notDownloaded'));
  return loadModel(id);
}

/** Qwen opens with an empty thinking block even when thinking is off. */
const stripThinking = (s: string) => s.replace(/^\s*<think>[\s\S]*?(<\/think>\s*|$)/, '');

/** Streams one chat turn; resolves with the whole answer. */
async function chat(
  e: MLCEngineInterface,
  args: {
    system: string;
    user: string;
    signal?: AbortSignal;
    maxTokens: number;
    schema?: object;
    onText?: (text: string) => void;
  },
) {
  const stop = () => e.interruptGenerate();
  args.signal?.addEventListener('abort', stop);
  try {
    const stream = await e.chat.completions.create({
      stream: true,
      temperature: 0.3,
      max_tokens: args.maxTokens,
      messages: [
        { role: 'system', content: args.system },
        { role: 'user', content: args.user },
      ],
      ...(args.schema
        ? { response_format: { type: 'json_object' as const, schema: JSON.stringify(args.schema) } }
        : {}),
      extra_body: { enable_thinking: false },
    });
    let text = '';
    for await (const chunk of stream) {
      text += chunk.choices[0]?.delta?.content ?? '';
      args.onText?.(stripThinking(text));
    }
    if (args.signal?.aborted) throw new DOMException('Stopped', 'AbortError');
    return stripThinking(text);
  } finally {
    args.signal?.removeEventListener('abort', stop);
    scheduleUnload();
  }
}

/** The output language's English name, for the prompt. */
async function outputLanguage(settings: Settings, sample: string) {
  if (settings.language && settings.language !== 'auto') return settings.language;
  const code = await browser.i18n
    ?.detectLanguage?.(sample.slice(0, 2000))
    .then((r) => r.languages?.[0]?.language)
    .catch(() => undefined);
  const base = code?.split('-')[0]?.toLowerCase();
  return OUTPUT_LANGUAGES.find((l) => l.tag.split('-')[0] === base)?.name ?? 'the language of the document';
}

/** The source as it fits the model: whole, or notes taken part by part. */
async function fitSource(e: MLCEngineInterface, content: string, lang: string, signal?: AbortSignal) {
  if (content.length <= PART_CHARS) return { text: content, notes: false };
  const parts = splitParts(content, PART_CHARS);
  const notes: string[] = [];
  for (let i = 0; i < parts.length; i++) {
    if (signal?.aborted) throw new DOMException('Stopped', 'AbortError');
    const note = await chat(e, {
      system: `You take dense notes on one part of a longer document, in ${lang}. Keep the most important facts, numbers, names, dates and arguments. At most 12 bullet points of under 25 words each, no introduction.`,
      user: parts[i]!,
      signal,
      maxTokens: 700,
    });
    notes.push(`Part ${i + 1}:\n${note}`);
  }
  return { text: notes.join('\n\n').slice(0, PART_CHARS), notes: true };
}

// ── Summary ─────────────────────────────────────────────────────────────────────

const COUNTS: Record<SummaryLength, { takeaways: number; sections: number; tokens: number }> = {
  short: { takeaways: 3, sections: 0, tokens: 500 },
  medium: { takeaways: 5, sections: 2, tokens: 900 },
  detailed: { takeaways: 7, sections: 4, tokens: 1400 },
  full: { takeaways: 8, sections: 6, tokens: 2200 },
};

function schema(length: SummaryLength) {
  const c = COUNTS[length];
  const str = { type: 'string' };
  return {
    type: 'object',
    required: ['title', 'tldr', 'takeaways', 'followUps'],
    properties: {
      title: str,
      tldr: str,
      keyNumbers: {
        type: 'array',
        maxItems: 4,
        items: { type: 'object', required: ['value', 'label'], properties: { value: str, label: str } },
      },
      takeaways: {
        type: 'array',
        minItems: 1,
        maxItems: c.takeaways,
        items: { type: 'object', required: ['text'], properties: { text: str, detail: str } },
      },
      steps: { type: 'array', maxItems: 8, items: str },
      sections: {
        type: 'array',
        maxItems: c.sections,
        items: {
          type: 'object',
          required: ['heading', 'points'],
          properties: { heading: str, points: { type: 'array', minItems: 1, maxItems: 6, items: str } },
        },
      },
      followUps: { type: 'array', maxItems: 3, items: str },
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
  const full = settings.length === 'full';
  return [
    `${MODE_TASK[base]} Write every text field in ${lang}. Answer with the JSON object only.`,
    `title: a short title. tldr: one sentence of at most 20 words. keyNumbers: only headline figures written in the document, with a short label; omit when there are none. ${MODE_HINTS[base]} Up to ${c.takeaways} takeaways of at most 12 words each, most important first; detail is an optional ${full ? '1-2 sentence' : 'short'} explanation.`,
    c.sections
      ? `sections: up to ${c.sections} more topics with 2-6 ${full ? 'full-sentence' : 'short'} points each, for detail that does not fit the takeaways.`
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

/** Summarizes a source on the device. Resolves with the program. */
export async function localSummary(args: {
  settings: Settings;
  source: ExtractedSource;
  instruction?: string;
  signal?: AbortSignal;
  /** The summary so far, rebuilt as the answer streams in. */
  onProgram?: (program: string) => void;
}) {
  const { settings, source, instruction, signal, onProgram } = args;
  const e = await readyEngine(settings);
  const lang = await outputLanguage(settings, source.content);
  const fitted = await fitSource(e, source.content, lang, signal);
  const words = source.content.trim().split(/\s+/).length;
  const minutes = Math.max(1, Math.round(words / WPM));
  const foldable = settings.length !== 'full';
  let last = 0;
  const raw = await chat(e, {
    system: `You summarize documents for a reader who wants the gist in seconds.\n${summaryInstructions(settings, lang, instruction)}`,
    // The language again next to the document: small models follow the nearest instruction.
    user: `${fitted.notes ? 'Notes taken on' : 'Document'}: ${source.title}\n\n${fitted.text}\n\n(Write the JSON in ${lang}.)`,
    signal,
    maxTokens: COUNTS[settings.length].tokens,
    schema: schema(settings.length),
    onText: (text) => {
      // Parsing every token is wasted work; a few times a second is enough to look live.
      if (Date.now() - last < 250) return;
      last = Date.now();
      const partial = parsePartialJson(text);
      if (partial?.title || partial?.tldr) onProgram?.(localProgram(partial, source, minutes, foldable));
    },
  });
  let data: LocalSummary | null;
  try {
    data = JSON.parse(raw) as LocalSummary;
  } catch {
    data = parsePartialJson(raw);
  }
  if (!data?.tldr) throw new Error(t('errors:local.badAnswer'));
  return localProgram(data, source, minutes, foldable);
}

/** Answers a question about the source in plain text, streamed. */
export async function localAnswer(args: {
  settings: Settings;
  source: ExtractedSource;
  history: { question: string; answer: string }[];
  question: string;
  signal?: AbortSignal;
  onText: (text: string) => void;
}) {
  const { settings, source, history, question, signal, onText } = args;
  const e = await readyEngine(settings);
  const lang = settings.language && settings.language !== 'auto' ? settings.language : 'the language of the question';
  const fitted = await fitSource(e, source.content, lang, signal);
  const past = history
    .slice(-3)
    .map((h) => `Q: ${h.question}\nA: ${h.answer.slice(0, 600)}`)
    .join('\n\n');
  return chat(e, {
    system: `You answer questions about a document, in ${lang}, using only what it says. Short factual answers: 1-3 sentences. Use a short Markdown list for steps or several points. If the document does not say, answer that it does not.`,
    user: `${fitted.notes ? 'Notes on the document' : 'Document'} "${source.title}":\n${fitted.text}${past ? `\n\nEarlier questions:\n${past}` : ''}\n\nQuestion: ${question}`,
    signal,
    maxTokens: 800,
    onText,
  });
}

/** Any other plain prompt (choosing links, asking the history): trimmed to fit. */
export async function localComplete(args: {
  settings: Settings;
  system: string;
  input: string;
  signal?: AbortSignal;
  onText: (text: string) => void;
}) {
  const e = await readyEngine(args.settings);
  return chat(e, {
    system: args.system,
    user: args.input.slice(0, PART_CHARS),
    signal: args.signal,
    maxTokens: 900,
    onText: args.onText,
  });
}
