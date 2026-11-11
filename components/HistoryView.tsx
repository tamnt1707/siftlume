import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { MarkDownRenderer } from '@openuidev/react-ui';
import { Search01Icon, SparklesIcon, StopIcon } from '@hugeicons/core-free-icons';
import { askHistory } from '@/lib/ask-history';
import { getSession, historyIndex, migrateHistory, type HistoryEntry, type Session } from '@/lib/history';
import { searchHistory } from '@/lib/library-search';
import { describeError } from '@/lib/llm';
import { configProblem, type Settings } from '@/lib/settings';
import { HistoryList } from './HistoryList';
import { Icon } from './Icon';

/**
 * History as a small library: search every summary (title and content, accents ignored), and ask
 * a question answered from the summaries, with the ones it used listed to open.
 */
export function HistoryView({ settings, onOpen }: { settings: Settings; onOpen: (s: Session) => void }) {
  const { t } = useTranslation('common');
  const [entries, setEntries] = useState<HistoryEntry[]>([]);
  const [query, setQuery] = useState('');
  const [answer, setAnswer] = useState<{ question: string; text: string; sources: HistoryEntry[] } | null>(null);
  const [asking, setAsking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abort = useRef<AbortController | null>(null);

  useEffect(() => {
    void migrateHistory().then(() => historyIndex.getValue().then(setEntries));
    return historyIndex.watch((v) => setEntries(v ?? []));
  }, []);
  useEffect(() => () => abort.current?.abort(), []);

  const found = searchHistory(entries, query);
  const question = query.trim();

  const ask = async () => {
    const problem = configProblem(settings);
    if (problem) return setError(problem);
    abort.current?.abort();
    const ctrl = new AbortController();
    abort.current = ctrl;
    setAsking(true);
    setError(null);
    setAnswer({ question, text: '', sources: [] });
    try {
      const res = await askHistory({
        settings,
        entries,
        question,
        signal: ctrl.signal,
        onText: (text) => setAnswer((a) => (a ? { ...a, text } : a)),
      });
      const byId = new Map(entries.map((e) => [e.id, e]));
      setAnswer({
        question,
        text: res.text,
        sources: res.sources.map((s) => byId.get(s.id)).filter((e): e is HistoryEntry => Boolean(e)),
      });
    } catch (e) {
      if (!ctrl.signal.aborted) setError(describeError(e, settings));
    } finally {
      if (abort.current === ctrl) setAsking(false);
    }
  };

  const open = (id: string) => void getSession(id).then((s) => s && onOpen(s));

  return (
    <div className="history-view">
      <form
        className="history-search"
        onSubmit={(e) => {
          e.preventDefault();
          if (question && !asking) void ask();
        }}
      >
        <Icon icon={Search01Icon} size={16} className="history-search__icon" />
        <input
          className="input"
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t('history.searchPlaceholder')}
          aria-label={t('history.searchPlaceholder')}
          disabled={!entries.length}
        />
        {asking ? (
          <button type="button" className="btn btn--sm" onClick={() => abort.current?.abort()}>
            <Icon icon={StopIcon} size={14} />
            {t('actions.stop')}
          </button>
        ) : (
          <button type="submit" className="btn btn--sm btn--primary" disabled={!question} title={t('history.askHint')}>
            <Icon icon={SparklesIcon} size={14} />
            {t('history.ask')}
          </button>
        )}
      </form>
      {error && <p className="hint hint--error">{error}</p>}

      {answer && (
        <section className="history-answer" aria-live="polite">
          <p className="history-answer__question">{answer.question}</p>
          {answer.text ? (
            <MarkDownRenderer textMarkdown={answer.text} variant="clear" />
          ) : (
            <p className="muted">{t('history.asking')}</p>
          )}
          {answer.sources.length > 0 && (
            <ol className="history-answer__sources" aria-label={t('history.sources')}>
              {answer.sources.map((s, i) => (
                <li key={s.id}>
                  <button className="link" onClick={() => open(s.id)}>
                    <span className="source__part-index">{i + 1}</span>
                    {s.title}
                  </button>
                </li>
              ))}
            </ol>
          )}
        </section>
      )}

      {question && !found.length ? (
        <p className="muted center">{t('history.noMatch')}</p>
      ) : (
        <HistoryList entries={found} onOpen={onOpen} />
      )}
    </div>
  );
}
