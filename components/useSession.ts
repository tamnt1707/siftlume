import { useCallback, useEffect, useRef, useState } from 'react';
import { t } from '@/lib/i18n';
import { describeError } from '@/lib/llm';
import { generateAnswer, generateSummary } from '@/lib/generate';
import { extractTab } from '@/lib/page';
import { extractTabs } from '@/lib/multi';
import { deepSource } from '@/lib/deep';
import { extractFile, truncate, type ExtractedSource } from '@/lib/extractors';
import { newId, readStored, saveSession, writeStored, type Session, type SessionOptions } from '@/lib/history';
import { configProblem, type Settings } from '@/lib/settings';
import type { ModeId } from '@/lib/modes';

export type Phase = 'idle' | 'extracting' | 'summarizing' | 'refining' | 'answering';

export function useSession(settings: Settings) {
  const [session, setSession] = useState<Session | null>(null);
  const [phase, setPhase] = useState<Phase>('idle');
  const [streamRaw, setStreamRaw] = useState('');
  const [pendingQuestion, setPendingQuestion] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [warning, setWarning] = useState<string | null>(null);

  const abortRef = useRef<AbortController | null>(null);
  const sessionRef = useRef<Session | null>(null);
  const settingsRef = useRef(settings);
  settingsRef.current = settings;

  /** Global settings with this session's overrides (result-screen length and language). */
  const effective = (session?: Session | null): Settings => ({ ...settingsRef.current, ...session?.options });

  const commit = useCallback((next: Session) => {
    sessionRef.current = next;
    setSession(next);
    void saveSession(next);
  }, []);

  const begin = (p: Phase) => {
    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    setError(null);
    setWarning(null);
    setStreamRaw('');
    setPhase(p);
    return ctrl;
  };

  const finish = () => {
    setPhase('idle');
    setStreamRaw('');
    setPendingQuestion(null);
  };

  const checkSettings = () => configProblem(settingsRef.current);

  const reportRemaining = (errors: string[]) => {
    if (errors.length) setWarning(t('session:warnings.invalidUi', { count: errors.length }));
  };

  const runSummary = useCallback(
    async (src: Session['source'], base: Session) => {
      const ctrl = begin('summarizing');
      try {
        const res = await generateSummary({
          settings: effective(base),
          source: src,
          signal: ctrl.signal,
          onStream: setStreamRaw,
        });
        reportRemaining(res.errors);
        if (!res.program && res.prose) setWarning(t('session:warnings.textInstead'));
        commit({ ...base, summary: writeStored(res.program, { note: res.prose }), updatedAt: Date.now() });
      } catch (e) {
        if (!ctrl.signal.aborted) setError(describeError(e, settingsRef.current));
      } finally {
        if (abortRef.current === ctrl) finish();
      }
    },
    [commit],
  );

  /** Creates a session from an extracted source and summarizes it right away. */
  const start = useCallback(
    async (src: ExtractedSource & { tabId?: number; truncated?: boolean }, mode: ModeId = 'summary') => {
      const missing = checkSettings();
      if (missing) {
        finish();
        return setError(missing);
      }
      const { content, truncated } = truncate(src.content, settingsRef.current.maxChars);
      // A combined source was already cut to fit, each tab to its share.
      const source = { ...src, content, truncated: truncated || Boolean(src.truncated) };
      const now = Date.now();
      // Mode and length belong to the session: reopening it later keeps its kind of analysis.
      const base: Session = {
        id: newId(),
        createdAt: now,
        updatedAt: now,
        source,
        summary: null,
        qa: [],
        options: { mode, length: settingsRef.current.length },
      };
      commit(base);
      await runSummary(source, base);
    },
    [commit, runSummary],
  );

  const fromTab = useCallback(
    async (tabId: number, mode?: ModeId) => {
      const ctrl = begin('extracting');
      try {
        const src = await extractTab(tabId);
        if (ctrl.signal.aborted) return;
        await start(src, mode);
      } catch (e) {
        if (abortRef.current === ctrl) {
          setError(describeError(e, settingsRef.current));
          finish();
        }
      }
    },
    [start],
  );

  /** Several tabs summarized and compared together. */
  const fromTabs = useCallback(
    async (tabIds: number[], mode?: ModeId) => {
      const ctrl = begin('extracting');
      try {
        const src = await extractTabs(tabIds, settingsRef.current.maxChars);
        if (ctrl.signal.aborted) return;
        await start(src, mode);
      } catch (e) {
        if (abortRef.current === ctrl) {
          setError(describeError(e, settingsRef.current));
          finish();
        }
      }
    },
    [start],
  );

  /** Deep read: the current page plus pages it links to, summarized together as a new session. */
  const deepen = useCallback(
    async (urls: string[]) => {
      const current = sessionRef.current;
      if (!current || !urls.length) return;
      const ctrl = begin('extracting');
      try {
        const { truncated: _cut, ...page } = current.source;
        const src = await deepSource(page, urls, settingsRef.current.maxChars, ctrl.signal);
        if (ctrl.signal.aborted) return;
        await start(src, current.options?.mode);
      } catch (e) {
        if (abortRef.current === ctrl) {
          setError(describeError(e, settingsRef.current));
          finish();
        }
      }
    },
    [start],
  );

  const fromText = useCallback(
    (text: string, opts: { title?: string; origin?: string; tabId?: number; mode?: ModeId } = {}) => {
      if (!text.trim()) return setError(t('errors:nothingToSummarize'));
      const { title = t('common:pastedText'), origin, tabId, mode } = opts;
      void start({ kind: 'text', title, origin, content: text, tabId }, mode);
    },
    [start],
  );

  const fromFile = useCallback(
    async (file: File, mode?: ModeId) => {
      const ctrl = begin('extracting');
      try {
        const src = await extractFile(file);
        if (ctrl.signal.aborted) return;
        await start(src, mode);
      } catch (e) {
        if (abortRef.current === ctrl) {
          setError(describeError(e, settingsRef.current));
          finish();
        }
      }
    },
    [start],
  );

  /** Refines the summary with edit mode: the model returns a patch merged into the current program. */
  const refine = useCallback(
    async (instruction: string) => {
      const current = sessionRef.current;
      if (!current || !instruction.trim()) return;
      const missing = checkSettings();
      if (missing) return setError(missing);
      const { content: program, context } = readStored(current.summary);
      if (!program) return runSummary(current.source, current);

      const ctrl = begin('refining');
      try {
        const res = await generateSummary({
          settings: effective(current),
          source: current.source,
          previousProgram: program,
          instruction,
          signal: ctrl.signal,
          onStream: setStreamRaw,
        });
        reportRemaining(res.errors);
        commit({
          ...current,
          summary: writeStored(res.program, { formState: context.formState, note: res.prose }),
          updatedAt: Date.now(),
        });
      } catch (e) {
        if (!ctrl.signal.aborted) setError(describeError(e, settingsRef.current));
      } finally {
        if (abortRef.current === ctrl) finish();
      }
    },
    [commit, runSummary],
  );

  /**
   * Summarizes the same source again from scratch (e.g. after switching model). The current summary
   * stays visible until the new one has arrived; questions and answers are kept.
   */
  const resummarize = useCallback(
    (options?: SessionOptions) => {
      const current = sessionRef.current;
      if (!current) return;
      const missing = checkSettings();
      if (missing) return setError(missing);
      const next = options ? { ...current, options: { ...current.options, ...options } } : current;
      void runSummary(next.source, next);
    },
    [runSummary],
  );

  const ask = useCallback(
    async (question: string) => {
      const current = sessionRef.current;
      if (!current || !question.trim()) return;
      const missing = checkSettings();
      if (missing) return setError(missing);

      const ctrl = begin('answering');
      setPendingQuestion(question);
      try {
        const res = await generateAnswer({
          settings: effective(current),
          source: current.source,
          history: current.qa,
          question,
          summaryProgram: readStored(current.summary).content,
          signal: ctrl.signal,
          onStream: setStreamRaw,
        });
        reportRemaining(res.errors);
        const latest = sessionRef.current ?? current;
        commit({
          ...latest,
          qa: [...latest.qa, { id: newId(), question, answer: writeStored(res.raw) }],
          updatedAt: Date.now(),
        });
      } catch (e) {
        if (!ctrl.signal.aborted) setError(describeError(e, settingsRef.current));
      } finally {
        if (abortRef.current === ctrl) finish();
      }
    },
    [commit],
  );

  // Persist the summary's form/$state (Message Protocol context), debounced.
  const saveTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const updateSummaryState = useCallback((formState: Record<string, unknown>) => {
    const current = sessionRef.current;
    if (!current?.summary) return;
    const { content, context } = readStored(current.summary);
    const next = { ...current, summary: writeStored(content, { ...context, formState }) };
    sessionRef.current = next;
    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => void saveSession(next), 500);
  }, []);

  const updateAnswerState = useCallback((turnId: string, formState: Record<string, unknown>) => {
    const current = sessionRef.current;
    if (!current) return;
    const qa = current.qa.map((t) => {
      if (t.id !== turnId) return t;
      const { content, context } = readStored(t.answer);
      return { ...t, answer: writeStored(content, { ...context, formState }) };
    });
    const next = { ...current, qa };
    sessionRef.current = next;
    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => void saveSession(next), 500);
  }, []);

  const stop = useCallback(() => {
    abortRef.current?.abort();
    finish();
  }, []);

  const open = useCallback(
    (s: Session) => {
      abortRef.current?.abort();
      finish();
      setError(null);
      setWarning(null);
      sessionRef.current = s;
      setSession(s);
      // A session saved before its summary finished (e.g. the tab was closed): finish it now.
      if (!s.summary && !configProblem(settingsRef.current)) void runSummary(s.source, s);
    },
    [runSummary],
  );

  const reset = useCallback(() => {
    abortRef.current?.abort();
    finish();
    setError(null);
    setWarning(null);
    sessionRef.current = null;
    setSession(null);
  }, []);

  useEffect(() => () => abortRef.current?.abort(), []);

  return {
    session,
    phase,
    streamRaw,
    pendingQuestion,
    error,
    warning,
    setError,
    fromTab,
    fromTabs,
    deepen,
    fromText,
    fromFile,
    refine,
    resummarize,
    ask,
    stop,
    open,
    reset,
    updateSummaryState,
    updateAnswerState,
  };
}

export type SessionController = ReturnType<typeof useSession>;
