import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Delete02Icon } from '@hugeicons/core-free-icons';
import { Icon } from './Icon';
import { deleteSession, historyItem, type Session } from '@/lib/history';

export function HistoryList({
  onOpen,
  limit,
  compact,
}: {
  onOpen: (s: Session) => void;
  limit?: number;
  compact?: boolean;
}) {
  const { t, i18n } = useTranslation('common');
  const [items, setItems] = useState<Session[]>([]);

  useEffect(() => {
    void historyItem.getValue().then(setItems);
    return historyItem.watch((v) => setItems(v ?? []));
  }, []);

  const shown = limit ? items.slice(0, limit) : items;
  if (!shown.length) return compact ? null : <p className="muted center">{t('history.empty')}</p>;

  return (
    <ul className={`history ${compact ? 'history--compact' : ''}`}>
      {shown.map((s) => (
        <li key={s.id}>
          <button className="history__item" onClick={() => onOpen(s)}>
            <span className="history__title">
              <span className="badge">{t(`kindShort.${s.source.kind}`)}</span> {s.source.title}
            </span>
            {!compact && (
              <span className="muted">
                {new Date(s.updatedAt).toLocaleString(i18n.language)}
                {s.qa.length > 0 && ` · ${t('history.questions', { count: s.qa.length })}`}
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
