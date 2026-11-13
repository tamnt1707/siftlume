import type { ModelMessage } from 'ai';
import { streamCompletion } from './llm';
import {
  applyPatch,
  buildQaPrompt,
  buildRepairMessage,
  buildSourceMessage,
  buildSummaryPrompt,
  languageRule,
  splitInline,
  validateDiagrams,
  validateProgram,
} from './openui';
import { readStored, type QaTurn, type SessionSource } from './history';
import { getActiveProvider, type Settings } from './settings';
import { localAnswer, localSummary } from './local-model';
import { digestSource, needsDigest } from './longread';
import { MODE_TASK, resolveMode } from './modes';

/** The user turn asking for the analysis in the session's mode. */
function modeTask(settings: Settings, source: SessionSource) {
  const { base, custom } = resolveMode(settings.mode, settings.customModes);
  const task = custom ? `${MODE_TASK[base]} Use my reading mode "${custom.name.trim()}".` : MODE_TASK[base];
  const extra = source.deep
    ? ' Document 1 is the page I am reading; the others are pages it links to. Use them to fill in what document 1 only mentions or points to.'
    : source.kind === 'multi'
      ? ' These are several sources: compare and combine them.'
      : '';
  // The language again after the source: a long source in another language otherwise wins.
  return `${task}${extra} ${languageRule(settings)}`;
}

const fence = (code: string) => '```openui-lang\n' + code + '\n```';

export interface GenerateResult {
  /** Final program (merged, and repaired if needed). */
  program: string;
  /** Prose outside the fence. */
  prose: string;
  /** Final raw model answer (stored for Q&A). */
  raw: string;
  /** Errors left after the repair attempt (empty when valid). */
  errors: string[];
  repaired: boolean;
  /** Notes taken on a long source during this call, to keep with the session. */
  digest?: string;
}

/** A long source gets its notes first (lib/longread.ts); the result carries them to be kept. */
async function withDigest<A extends BaseArgs>(args: A, run: (args: A) => Promise<GenerateResult>) {
  if (!needsDigest(args.settings, args.source)) return run(args);
  const digest = await digestSource(args.settings, args.source, args.signal);
  const res = await run({ ...args, source: { ...args.source, digest } });
  return { ...res, digest };
}

interface BaseArgs {
  settings: Settings;
  source: SessionSource;
  signal?: AbortSignal;
  /** Accumulated raw streamed text. */
  onStream: (raw: string) => void;
}

/** Parser validation plus Mermaid validation of every Diagram. */
async function fullCheck(program: string) {
  const check = validateProgram(program);
  const diagrams = await validateDiagrams(program).catch(() => []);
  return { ok: check.ok && diagrams.length === 0, errors: [...check.errors, ...diagrams] };
}

/** Streams one turn; if the program is invalid, sends the errors back to the model once for a fix. */
async function generateWithRepair(
  args: BaseArgs & {
    system: string;
    messages: ModelMessage[];
    previousProgram: string;
    editMode: boolean;
  },
): Promise<GenerateResult> {
  const { settings, system, messages, signal, onStream, previousProgram, editMode } = args;

  const raw = await streamCompletion({ settings, system, messages, signal, onText: onStream, cache: true });
  const first = splitInline(raw);
  // Text-only answer (inline mode): nothing to validate.
  if (!first.code) return { program: previousProgram, prose: first.prose, raw, errors: [], repaired: false };

  let program = editMode ? applyPatch(previousProgram, first.code) : first.code;
  let check = await fullCheck(program);
  if (check.ok) return { program, prose: first.prose, raw, errors: [], repaired: false };

  const repairRaw = await streamCompletion({
    settings,
    system,
    cache: true,
    signal,
    messages: [
      ...messages,
      { role: 'assistant', content: raw },
      { role: 'user', content: buildRepairMessage(check.errors, editMode) },
    ],
    // Do not stream the repair: it is a patch, and the UI keeps showing the first attempt meanwhile.
    onText: () => {},
  });
  const fixed = splitInline(repairRaw).code;
  if (fixed) {
    const candidate = editMode ? applyPatch(program, fixed) : fixed;
    const recheck = await fullCheck(candidate);
    // Keep the fix only if it is not worse.
    if (recheck.errors.length <= check.errors.length) {
      program = candidate;
      check = recheck;
    }
  }
  return {
    program,
    prose: first.prose,
    raw: editMode ? raw : fence(program) + (first.prose ? `\n\n${first.prose}` : ''),
    errors: check.errors,
    repaired: true,
  };
}

/** First turn (no previousProgram) creates the summary; later turns refine it with edit mode. */
export function generateSummary(
  args: BaseArgs & { previousProgram?: string; instruction?: string },
): Promise<GenerateResult> {
  return withDigest(args, summaryTurn);
}

function summaryTurn(args: BaseArgs & { previousProgram?: string; instruction?: string }): Promise<GenerateResult> {
  const { settings, source, previousProgram = '', instruction } = args;
  if (getActiveProvider(settings).preset.builtin) return localGenerate(args);
  const messages: ModelMessage[] = [
    { role: 'user', content: `${buildSourceMessage(source, source.truncated)}\n\n${modeTask(settings, source)}` },
  ];
  if (previousProgram && instruction) {
    // Edit mode: the model sees the current merged program and returns only changed statements.
    messages.push({ role: 'assistant', content: fence(previousProgram) });
    messages.push({ role: 'user', content: instruction });
  }
  return generateWithRepair({
    ...args,
    system: buildSummaryPrompt(settings, source),
    messages,
    previousProgram: instruction ? previousProgram : '',
    editMode: true,
  });
}

/**
 * In-browser models fill a JSON schema instead of writing openui-lang (see lib/local-model.ts).
 * A change request makes a new version from the source, with the request added.
 */
async function localGenerate(args: BaseArgs & { instruction?: string }): Promise<GenerateResult> {
  const program = await localSummary({
    settings: args.settings,
    source: args.source,
    instruction: args.instruction,
    signal: args.signal,
    onProgram: (program) => args.onStream(fence(program)),
  });
  args.onStream(fence(program));
  return { program, prose: '', raw: fence(program), errors: [], repaired: false };
}

export function generateAnswer(
  args: BaseArgs & { history: QaTurn[]; question: string; summaryProgram: string },
): Promise<GenerateResult> {
  return withDigest(args, answerTurn);
}

async function answerTurn(
  args: BaseArgs & { history: QaTurn[]; question: string; summaryProgram: string },
): Promise<GenerateResult> {
  const { settings, source, history, question, summaryProgram } = args;
  if (getActiveProvider(settings).preset.builtin) {
    const text = await localAnswer({
      settings,
      source,
      question,
      signal: args.signal,
      onText: args.onStream,
      history: history.map((h) => ({ question: h.question, answer: readStored(h.answer).content })),
    });
    return { program: '', prose: text, raw: text, errors: [], repaired: false };
  }
  const messages: ModelMessage[] = [
    { role: 'user', content: `${buildSourceMessage(source, source.truncated)}\n\n${modeTask(settings, source)}` },
  ];
  if (summaryProgram) messages.push({ role: 'assistant', content: fence(summaryProgram) });
  for (const turn of history) {
    messages.push({ role: 'user', content: turn.question });
    // Message Protocol: the model sees only the content, never the ]]>openui: markers.
    messages.push({ role: 'assistant', content: readStored(turn.answer).content });
  }
  messages.push({ role: 'user', content: question });

  return generateWithRepair({
    ...args,
    system: buildQaPrompt(settings, source),
    messages,
    previousProgram: '',
    editMode: false,
  });
}
