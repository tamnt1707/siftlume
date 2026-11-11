import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Delete02Icon } from '@hugeicons/core-free-icons';
import { Icon } from './Icon';
import {
  deleteSession,
  getSession,
  historyIndex,
  migrateHistory,
  type HistoryEntry,
  type Session,
} from '@/lib/history';

/** Saved summaries, newest first, or the given entries (search results). */
export function HistoryList({
  onOpen,
  limit,
  compact,
  entries,
}: {
  onOpen: (s: Session) => void;
  limit?: number;
  compact?: boolean;
  /** Shown instead of the whole history. */
  entries?: HistoryEntry[];
}) {
  const { t, i18n } = useTranslation('common');
  const [all, setAll] = useState<HistoryEntry[]>([]);

  useEffect(() => {
    if (entries) return;
    void migrateHistory().then(() => historyIndex.getValue().then(setAll));
    return historyIndex.watch((v) => setAll(v ?? []));
  }, [entries]);

  const items = entries ?? all;
  const shown = limit ? items.slice(0, limit) : items;
  if (!shown.length) return compact ? null : <p className="muted center">{t('history.empty')}</p>;

  const open = (id: string) => void getSession(id).then((s) => s && onOpen(s));

  return (
    <ul className={`history ${compact ? 'history--compact' : ''}`}>
      {shown.map((s) => (
        <li key={s.id}>
          <button className="history__item" onClick={() => open(s.id)}>
            <span className="history__title">
              <span className="badge">{t(`kindShort.${s.kind}`)}</span> {s.title}
            </span>
            {!compact && (
              <span className="muted">
                {new Date(s.updatedAt).toLocaleString(i18n.language)}
                {s.qa > 0 && ` · ${t('history.questions', { count: s.qa })}`}
              </span>
            )}
          </button>
          {!compact && (
            <button
              className="icon-btn"
              title={t('actions.delete')}
              aria-label={t('actions.delete')}
              onClick={() => void deleteSession(s.id)}
            >
              <Icon icon={Delete02Icon} size={16} />
            </button>
          )}
        </li>
      ))}
    </ul>
  );
}
