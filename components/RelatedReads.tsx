import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { getSession, historyIndex, type HistoryEntry, type Session } from '@/lib/history';
import { relatedReads } from '@/lib/library-search';

/**
 * Under the source line: earlier summaries on the same topic ("You read about this before"),
 * found in the history on this computer. A click opens one.
 */
export function RelatedReads({ session, onOpen }: { session: Session; onOpen: (s: Session) => void }) {
  const { t, i18n } = useTranslation('session');
  const [related, setRelated] = useState<HistoryEntry[]>([]);
  const { id } = session;

  useEffect(() => {
    let live = true;
    const find = (index: HistoryEntry[] | null) => live && setRelated(relatedReads(index ?? [], id));
    setRelated([]);
    void historyIndex.getValue().then(find);
    // The index gets this summary's text once it is saved, just after it finishes.
    const unwatch = historyIndex.watch(find);
    return () => {
      live = false;
      unwatch();
    };
  }, [id]);

  if (!related.length) return null;
  const date = (at: number) => new Date(at).toLocaleDateString(i18n.language, { dateStyle: 'medium' });
  return (
    <div className="related-reads">
      <span className="related-reads__label">{t('related.title')}</span>
      <ul>
        {related.map((e) => (
          <li key={e.id}>
            <button
              type="button"
              className="link"
              onClick={() => void getSession(e.id).then((s) => s && onOpen(s))}
              title={e.text.slice(0, 200)}
            >
              {e.title}
            </button>
            <span className="related-reads__date">{date(e.createdAt)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
