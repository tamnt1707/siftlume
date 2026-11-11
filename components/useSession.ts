import { useCallback, useEffect, useRef, useState } from 'react';
import { t } from '@/lib/i18n';
import { describeError } from '@/lib/llm';
import { generateAnswer, generateSummary } from '@/lib/generate';
import { extractTab } from '@/lib/page';
import { extractTabs } from '@/lib/multi';
import { deepSource, findLinks, linksAllowed, pickLinks } from '@/lib/deep';
import { extractFile, truncate, type ExtractedSource } from '@/lib/extractors';
import { keepChars } from '@/lib/longread';
import { newId, readStored, saveSession, writeStored, type Session, type SessionOptions } from '@/lib/history';
import { configProblem, type Settings } from '@/lib/settings';
import type { ModeId } from '@/lib/modes';

/** Keeps the notes taken on a long source, so later turns do not read it again. */
const withNotes = <S extends Session['source']>(source: S, digest?: string): S =>
  digest ? { ...source, digest } : source;

export type Phase = 'idle' | 'extracting' | 'summarizing' | 'refining' | 'answering';

export function useSession(settings: Settings) {
  const [session, setSession] = useState<Session | null>(null);
  const [phase, setPhase] = useState<Phase>('idle');
  const [streamRaw, setStreamRaw] = useState('');
  const [pendingQuestion, setPendingQuestion] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [warning, setWarning] = useState<string | null>(null);
  /**
   * Deep read from the start screen, waiting for access to the sites of the links the AI picked:
   * Chrome only asks during a click, and the click that started it is long over by then.
   */
  const [pendingDeep, setPendingDeep] = useState<{
    page: ExtractedSource & { tabId?: number };
    urls: string[];
    mode?: ModeId;
  } | null>(null);

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
        commit({
          ...base,
          source: withNotes(src, res.digest),
          summary: writeStored(res.program, { note: res.prose }),
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

  /** Creates a session from an extracted source and summarizes it right away. */
  const start = useCallback(
    async (src: ExtractedSource & { tabId?: number; truncated?: boolean }, mode: ModeId = 'summary') => {
      const missing = checkSettings();
      if (missing) {
        finish();
        return setError(missing);
      }
      // Long sources are kept whole up to several parts; they are read part by part (lib/longread.ts).
      const { content, truncated } = truncate(src.content, keepChars(settingsRef.current));
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
    async (tabId: number, mode?: ModeId, opts: { deep?: boolean } = {}) => {
      const ctrl = begin('extracting');
      setPendingDeep(null);
      try {
        const src = await extractTab(tabId);
        if (ctrl.signal.aborted) return;
        // Deep read: the AI picks the links worth reading, then they are read with the page.
        const links = opts.deep && (src.kind === 'webpage' || src.kind === 'markdown') ? findLinks(src) : [];
        if (links.length) {
          const picked = await pickLinks(settingsRef.current, src, links, ctrl.signal).catch(() => []);
          if (ctrl.signal.aborted) return;
          const urls = picked.map((i) => links[i]!.url);
          if (urls.length && (await linksAllowed(urls))) {
            const deep = await deepSource(src, urls, settingsRef.current.maxChars, ctrl.signal).catch(() => null);
            if (ctrl.signal.aborted) return;
            return await start(deep ?? src, mode);
          }
          if (urls.length) {
            setPendingDeep({ page: src, urls, mode });
            return finish();
          }
        }
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

  /** Answer to the access request for a pending deep read: read the links, or summarize the page alone. */
  const resolveDeep = useCallback(
    async (allowed: boolean) => {
      const pending = pendingDeep;
      if (!pending) return;
      setPendingDeep(null);
      if (!allowed) return start(pending.page, pending.mode);
      const ctrl = begin('extracting');
      const deep = await deepSource(pending.page, pending.urls, settingsRef.current.maxChars, ctrl.signal).catch(
        () => null,
      );
      if (ctrl.signal.aborted) return;
      await start(deep ?? pending.page, pending.mode);
    },
    [pendingDeep, start],
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
          source: withNotes(current.source, res.digest),
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
          source: withNotes(latest.source, res.digest),
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
    pendingDeep,
    resolveDeep,
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
