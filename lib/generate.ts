import type { ModelMessage } from 'ai';
import { streamCompletion } from './llm';
import {
  applyPatch,
  buildQaPrompt,
  buildRepairMessage,
  buildSourceMessage,
  buildSummaryPrompt,
  splitInline,
  validateDiagrams,
  validateProgram,
} from './openui';
import { readStored, type QaTurn, type SessionSource } from './history';
import type { Settings } from './settings';

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

  const raw = await streamCompletion({ settings, system, messages, signal, onText: onStream });
  const first = splitInline(raw);
  // Text-only answer (inline mode): nothing to validate.
  if (!first.code) return { program: previousProgram, prose: first.prose, raw, errors: [], repaired: false };

  let program = editMode ? applyPatch(previousProgram, first.code) : first.code;
  let check = await fullCheck(program);
  if (check.ok) return { program, prose: first.prose, raw, errors: [], repaired: false };

  const repairRaw = await streamCompletion({
    settings,
    system,
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
  const { settings, source, previousProgram = '', instruction } = args;
  const messages: ModelMessage[] = [
    { role: 'user', content: `${buildSourceMessage(source, source.truncated)}\n\nSummarize this source.` },
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

export function generateAnswer(
  args: BaseArgs & { history: QaTurn[]; question: string; summaryProgram: string },
): Promise<GenerateResult> {
  const { settings, source, history, question, summaryProgram } = args;
  const messages: ModelMessage[] = [
    { role: 'user', content: `${buildSourceMessage(source, source.truncated)}\n\nSummarize this source.` },
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
