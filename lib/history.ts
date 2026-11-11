import { buildMessage, parseMessage } from '@openuidev/react-lang';
import { storage } from '#imports';
import type { ExtractedSource } from './extractors';
import type { SummaryLength } from './settings';
import type { ModeId } from './modes';
import { programToMarkdown } from './markdown';

/**
 * History uses the OpenUI Message Protocol: every response is stored with buildMessage
 * (program + context holding formState/$state) and read back with parseMessage.
 * The Renderer accepts stored messages directly; only `content` is ever sent back to the model.
 */

export type SessionSource = ExtractedSource & { truncated: boolean; tabId?: number };

export interface QaTurn {
  id: string;
  question: string;
  /** Stored message (buildMessage). Content is the raw inline-mode answer (prose + fence). */
  answer: string;
}

export interface Session {
  id: string;
  createdAt: number;
  updatedAt: number;
  source: SessionSource;
  /** Stored message (buildMessage). Content is the program merged across all refinements. */
  summary: string | null;
  qa: QaTurn[];
  /** Per-session overrides chosen on the result screen (mode, length, output language). */
  options?: SessionOptions;
}

export interface SessionOptions {
  mode?: ModeId;
  length?: SummaryLength;
  language?: string;
}

export interface StoredContext {
  /** Renderer form + $state (from onStateUpdate), restored through initialState. */
  formState?: Record<string, unknown>;
  /** The sentence outside the fence from the latest turn. */
  note?: string;
}

export function writeStored(content: string, context?: StoredContext) {
  const ctx =
    context && (context.note || (context.formState && Object.keys(context.formState).length)) ? context : undefined;
  return buildMessage({ content, context: ctx, attributes: { app: 'ai-summarizer@1' }, end: true });
}

export function readStored(stored: string | null) {
  if (!stored) return { content: '', context: {} as StoredContext };
  const { content, context } = parseMessage(stored);
  return { content, context: (context && typeof context === 'object' ? context : {}) as StoredContext };
}

/**
 * Storage: an index of every summary (title, dates and the summary's text, for the list and
 * search) under `local:historyIndex`, and each session in its own key `local:session:<id>`.
 * Sessions can be large (long sources and their notes), so saving one never rewrites the others.
 */
const MAX_SESSIONS = 200;
/** Characters of summary text kept in the index for search. */
const INDEX_TEXT = 4000;

export interface HistoryEntry {
  id: string;
  title: string;
  kind: SessionSource['kind'];
  origin?: string;
  createdAt: number;
  updatedAt: number;
  qa: number;
  /** The summary as plain text, for search. */
  text: string;
}

export const historyIndex = storage.defineItem<HistoryEntry[]>('local:historyIndex', { fallback: [] });
const sessionItem = (id: string) => storage.defineItem<Session | null>(`local:session:${id}`, { fallback: null });
/** Before 0.5: every session in one list. Moved to the index on first use. */
const legacyHistory = storage.defineItem<Session[] | null>('local:history', { fallback: null });

function entryOf(session: Session): HistoryEntry {
  const program = readStored(session.summary).content;
  let text = '';
  try {
    text = program ? programToMarkdown(program) : '';
  } catch {
    text = program;
  }
  const questions = session.qa.map((q) => q.question).join('\n');
  return {
    id: session.id,
    title: session.source.title,
    kind: session.source.kind,
    origin: session.source.origin,
    createdAt: session.createdAt,
    updatedAt: session.updatedAt,
    qa: session.qa.length,
    text: `${text}\n${questions}`.slice(0, INDEX_TEXT),
  };
}

let migrated: Promise<void> | null = null;
/** Moves the old single list into the index and per-session keys, once. */
export function migrateHistory() {
  migrated ??= (async () => {
    const old = await legacyHistory.getValue();
    if (!old) return;
    const index = await historyIndex.getValue();
    const known = new Set(index.map((e) => e.id));
    const added = old.filter((s) => !known.has(s.id));
    for (const s of added) await sessionItem(s.id).setValue(s);
    await historyIndex.setValue([...index, ...added.map(entryOf)].sort((a, b) => b.updatedAt - a.updatedAt));
    await legacyHistory.removeValue();
  })().catch(() => {});
  return migrated;
}

export async function getSession(id: string) {
  await migrateHistory();
  return sessionItem(id).getValue();
}

export async function saveSession(session: Session) {
  await migrateHistory();
  await sessionItem(session.id).setValue(session);
  const index = await historyIndex.getValue();
  const next = [entryOf(session), ...index.filter((e) => e.id !== session.id)];
  for (const dropped of next.slice(MAX_SESSIONS)) await sessionItem(dropped.id).removeValue();
  await historyIndex.setValue(next.slice(0, MAX_SESSIONS));
}

export async function deleteSession(id: string) {
  await migrateHistory();
  await sessionItem(id).removeValue();
  await historyIndex.setValue((await historyIndex.getValue()).filter((e) => e.id !== id));
}

export function newId() {
  return crypto.randomUUID();
}
