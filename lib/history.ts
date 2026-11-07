import { buildMessage, parseMessage } from '@openuidev/react-lang';
import { storage } from '#imports';
import type { ExtractedSource } from './extractors';

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

const MAX_SESSIONS = 20;

export const historyItem = storage.defineItem<Session[]>('local:history', { fallback: [] });

export async function saveSession(session: Session) {
  const list = await historyItem.getValue();
  const next = [session, ...list.filter((s) => s.id !== session.id)].slice(0, MAX_SESSIONS);
  await historyItem.setValue(next);
}

export async function deleteSession(id: string) {
  const list = await historyItem.getValue();
  await historyItem.setValue(list.filter((s) => s.id !== id));
}

export function newId() {
  return crypto.randomUUID();
}
