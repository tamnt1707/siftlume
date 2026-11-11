import { browser } from '#imports';
import type { MLCEngineInterface } from '@mlc-ai/web-llm';
import { t } from '@/lib/i18n';
import { splitParts, type ExtractedSource } from './extractors';
import { OUTPUT_LANGUAGES } from './languages';
import { MODE_TASK, resolveMode } from './modes';
import { localProgram, parsePartialJson, repairJson, type LocalSummary } from './local-program';
import type { Settings, SummaryLength } from './settings';

/**
 * Models that run in the browser on the GPU (WebGPU): downloaded once from Hugging Face when the
 * user clicks Download, kept in the browser's cache, deleted from Settings. Nothing the user
 * reads leaves the device. Two runtimes, each in a Web Worker so the page stays smooth:
 * - WebLLM (Gemma 4 E2B): compiled model code in public/webllm, grammar-constrained JSON;
 * - transformers.js (LFM3 1.7B): ONNX Runtime in public/ort, JSON from the prompt.
 * Only the weights are downloaded; nothing executable is fetched.
 *
 * Small models do not write openui-lang reliably, so they fill a JSON schema that is turned into
 * a summary of the app's blocks (lib/local-program.ts).
 */

export interface LocalModel {
  id: string;
  label: string;
  /** Download size, in GB. */
  size: number;
  runtime: 'webllm' | 'transformers';
  /** WebLLM: compiled model code shipped in public/webllm. */
  lib?: string;
  /** What it is good at, a key under settings:local.models. */
  hint: 'gemma' | 'lfm';
}

export const LOCAL_MODELS: LocalModel[] = [
  {
    id: 'gemma-4-E2B-it-q4f16_1-MLC',
    label: 'Gemma 4 E2B',
    size: 2.8,
    runtime: 'webllm',
    lib: 'gemma-4-E2B-it-q4f16_1_cs512-webgpu.wasm',
    hint: 'gemma',
  },
  { id: 'onnx-community/LFM3-1.7B-ONNX', label: 'LFM3 1.7B', size: 1.1, runtime: 'transformers', hint: 'lfm' },
];

export const DEFAULT_LOCAL_MODEL = LOCAL_MODELS[0]!.id;
const modelOf = (id: string) => LOCAL_MODELS.find((m) => m.id === id) ?? LOCAL_MODELS[0]!;

/** Tokens the model sees at once (prompt + answer). */
const CONTEXT = 8192;
/** Characters per part of a long source: about 5,500 tokens, leaving room for the answer. */
const PART_CHARS = 16_000;

/** WebGPU with 16-bit floats, which the models need. */
export async function webGpuProblem(): Promise<string | null> {
  const gpu = (navigator as { gpu?: { requestAdapter(): Promise<{ features: Set<string> } | null> } }).gpu;
  if (!gpu) return t('errors:local.noWebGpu');
  const adapter = await gpu.requestAdapter().catch(() => null);
  if (!adapter) return t('errors:local.noWebGpu');
  if (!adapter.features.has('shader-f16')) return t('errors:local.noF16');
  return null;
}

interface ChatArgs {
  system: string;
  user: string;
  signal?: AbortSignal;
  maxTokens: number;
  /** JSON schema of the answer: enforced by WebLLM, described in the prompt otherwise. */
  schema?: object;
  onText?: (text: string) => void;
}

/** One runtime: load a model into the GPU (downloading it if needed), chat, free it. */
interface Runtime {
  load(id: string, onProgress?: (progress: number) => void): Promise<void>;
  chat(args: ChatArgs): Promise<string>;
  unload(): Promise<void>;
  isDownloaded(id: string): Promise<boolean>;
  remove(id: string): Promise<void>;
}

// ── WebLLM ──────────────────────────────────────────────────────────────────────

let webllm: Promise<typeof import('@mlc-ai/web-llm')> | null = null;
const webllmLib = () => (webllm ??= import('@mlc-ai/web-llm'));

async function appConfig() {
  const { prebuiltAppConfig } = await webllmLib();
  return {
    ...prebuiltAppConfig,
    model_list: LOCAL_MODELS.filter((m) => m.runtime === 'webllm').map((m) => {
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

let mlcEngine: Promise<MLCEngineInterface> | null = null;
let mlcProgress: ((progress: number) => void) | null = null;
const mlc = () =>
  (mlcEngine ??= webllmLib().then(async ({ CreateWebWorkerMLCEngine }) =>
    CreateWebWorkerMLCEngine(new Worker(new URL('./local-model.worker.ts', import.meta.url), { type: 'module' }), [], {
      appConfig: await appConfig(),
      initProgressCallback: (r) => mlcProgress?.(r.progress),
    }),
  ));

const webllmRuntime: Runtime = {
  async load(id, onProgress) {
    const e = await mlc();
    mlcProgress = onProgress ?? null;
    try {
      await e.reload(id, { context_window_size: CONTEXT });
    } finally {
      mlcProgress = null;
    }
  },
  async chat(args) {
    const e = await mlc();
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
        args.onText?.(text);
      }
      return text;
    } finally {
      args.signal?.removeEventListener('abort', stop);
    }
  },
  async unload() {
    await mlcEngine?.then((e) => e.unload()).catch(() => {});
  },
  async isDownloaded(id) {
    const { hasModelInCache } = await webllmLib();
    return hasModelInCache(id, await appConfig()).catch(() => false);
  },
  async remove(id) {
    const { deleteModelAllInfoInCache } = await webllmLib();
    await deleteModelAllInfoInCache(id, await appConfig());
  },
};

// ── transformers.js ─────────────────────────────────────────────────────────────

/** transformers.js keeps downloaded files in this Cache Storage cache, keyed by their URL. */
const HF_CACHE = 'transformers-cache';
const hfFile = (id: string, file: string) => `https://huggingface.co/${id}/resolve/main/${file}`;

let tWorker: Worker | null = null;
const transformersWorker = () =>
  (tWorker ??= new Worker(new URL('./transformers.worker.ts', import.meta.url), { type: 'module' }));

/** Sends one request to the worker; resolves on `until`, with the text so far. */
function ask(
  msg: Record<string, unknown>,
  until: 'loaded' | 'done',
  on?: { progress?: (v: number) => void; text?: (t: string) => void },
) {
  const w = transformersWorker();
  return new Promise<string>((resolve, reject) => {
    const listener = (e: MessageEvent) => {
      const m = e.data as { type: string; value?: number; text?: string; message?: string };
      if (m.type === 'progress') on?.progress?.(m.value ?? 0);
      else if (m.type === 'text') on?.text?.(m.text ?? '');
      else if (m.type === until || m.type === 'error') {
        w.removeEventListener('message', listener);
        if (m.type === 'error') reject(new Error(m.message));
        else resolve(m.text ?? '');
      }
    };
    w.addEventListener('message', listener);
    w.postMessage(msg);
  });
}

/** The answer's shape, for runtimes that cannot enforce the schema. */
const JSON_SHAPE =
  'JSON shape (omit optional fields you do not need): {"title": "...", "tldr": "...", "keyNumbers": [{"value": "...", "label": "..."}], "takeaways": [{"text": "...", "detail": "..."}], "steps": ["..."], "sections": [{"heading": "...", "points": ["..."]}], "followUps": ["..."]}';

const transformersRuntime: Runtime = {
  async load(id, onProgress) {
    await ask({ type: 'load', id }, 'loaded', { progress: onProgress });
  },
  async chat(args) {
    const stop = () => tWorker?.postMessage({ type: 'interrupt' });
    args.signal?.addEventListener('abort', stop);
    try {
      return await ask(
        {
          type: 'generate',
          system: args.schema ? `${args.system}\n${JSON_SHAPE}` : args.system,
          user: args.user,
          maxTokens: args.maxTokens,
        },
        'done',
        { text: args.onText },
      );
    } finally {
      args.signal?.removeEventListener('abort', stop);
    }
  },
  async unload() {
    // Stopping the worker also stops a download in progress.
    tWorker?.terminate();
    tWorker = null;
  },
  async isDownloaded(id) {
    const cache = await caches.open(HF_CACHE).catch(() => null);
    return Boolean(await cache?.match(hfFile(id, 'onnx/model_q4f16.onnx_data')));
  },
  async remove(id) {
    const cache = await caches.open(HF_CACHE);
    for (const req of await cache.keys()) if (req.url.includes(`/${id}/`)) await cache.delete(req);
  },
};

const runtimeOf = (id: string) => (modelOf(id).runtime === 'webllm' ? webllmRuntime : transformersRuntime);

// ── Loading ─────────────────────────────────────────────────────────────────────

/** The model in the GPU now: one at a time. */
let loaded: string | null = null;
let idleTimer: ReturnType<typeof setTimeout> | undefined;

/** Frees the GPU memory a few minutes after the last use. */
function scheduleUnload() {
  clearTimeout(idleTimer);
  idleTimer = setTimeout(() => void unloadAll(), 5 * 60_000);
}

async function unloadAll() {
  loaded = null;
  await Promise.all([webllmRuntime.unload(), transformersRuntime.unload()]);
}

/** Loads a model into the GPU (downloading it first if needed). Progress is 0–1. */
async function loadModel(id: string, onProgress?: (progress: number) => void) {
  clearTimeout(idleTimer);
  const runtime = runtimeOf(id);
  if (loaded !== id) {
    if (loaded && runtimeOf(loaded) !== runtime) await runtimeOf(loaded).unload();
    loaded = null;
    await runtime.load(id, onProgress);
    loaded = id;
  }
  return runtime;
}

// ── Model management (Settings) ─────────────────────────────────────────────────

export const isDownloaded = (id: string) => runtimeOf(id).isDownloaded(id);

/** Downloads a model (from a click). Cancel with cancelDownload(). */
export async function downloadModel(id: string, onProgress: (progress: number) => void) {
  const problem = await webGpuProblem();
  if (problem) throw new Error(problem);
  await loadModel(id, onProgress);
  scheduleUnload();
}

/** Stops a download in progress; what was downloaded stays in the cache. */
export const cancelDownload = unloadAll;

export async function deleteModel(id: string) {
  if (loaded === id) await unloadAll();
  await runtimeOf(id).remove(id);
}

// ── Prompting ───────────────────────────────────────────────────────────────────

async function readyEngine(settings: Settings) {
  const id = modelOf(settings.providers.browser?.model || DEFAULT_LOCAL_MODEL).id;
  const problem = await webGpuProblem();
  if (problem) throw new Error(problem);
  if (loaded !== id && !(await isDownloaded(id))) throw new Error(t('errors:local.notDownloaded'));
  return loadModel(id);
}

/** Thinking blocks (empty with thinking off) and code fences around the answer. */
const clean = (s: string) =>
  s
    .replace(/^\s*<think>[\s\S]*?(<\/think>\s*|$)/, '')
    .replace(/^\s*```(?:json)?\s*/, '')
    .replace(/\s*```\s*$/, '');

/** Streams one chat turn; resolves with the whole answer. */
async function chat(runtime: Runtime, args: ChatArgs) {
  try {
    const text = clean(await runtime.chat({ ...args, onText: args.onText && ((t) => args.onText!(clean(t))) }));
    if (args.signal?.aborted) throw new DOMException('Stopped', 'AbortError');
    return text;
  } finally {
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
async function fitSource(e: Runtime, content: string, lang: string, signal?: AbortSignal) {
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

/**
 * The JSON object in an answer. Models without enforced output may write a sentence around it
 * or misplace a bracket: the first object is read with its brackets repaired, finished or still
 * streaming.
 */
export function readJson(text: string): LocalSummary | null {
  try {
    return JSON.parse(repairJson(text)) as LocalSummary;
  } catch {
    const start = text.indexOf('{');
    return start < 0 ? null : parsePartialJson(text.slice(start));
  }
}

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
      const partial = readJson(text);
      if (partial?.title || partial?.tldr) onProgram?.(localProgram(partial, source, minutes, foldable));
    },
  });
  const data = readJson(raw);
  if (!data?.tldr) {
    console.warn('[Siftlume] Unreadable answer from the in-browser model:', raw);
    throw new Error(t('errors:local.badAnswer'));
  }
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
