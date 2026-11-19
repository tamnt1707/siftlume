import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Cancel01Icon, GitCompareIcon } from '@hugeicons/core-free-icons';
import { compareSources, hasChanges, previousRead, type SourceChanges } from '@/lib/changes';
import { getSession, historyIndex, type HistoryEntry, type Session } from '@/lib/history';
import { Icon } from './Icon';

/** Items shown per list before "+N more". */
const SHOWN = 12;

/**
 * Under the source line of a page read before: "You read this on 12 Nov · What changed". The
 * changes come from the text saved with that earlier summary, compared in the browser.
 */
export function WhatsNew({ session }: { session: Session }) {
  const { t, i18n } = useTranslation('session');
  const [previous, setPrevious] = useState<HistoryEntry | null>(null);
  const [open, setOpen] = useState(false);
  const [changes, setChanges] = useState<SourceChanges | 'gone' | null>(null);
  const { id, createdAt } = session;
  const { origin, content } = session.source;

  useEffect(() => {
    let live = true;
    setPrevious(null);
    setOpen(false);
    setChanges(null);
    void historyIndex.getValue().then((index) => {
      if (live) setPrevious(previousRead(index, { id, origin, createdAt }));
    });
    return () => {
      live = false;
    };
  }, [id, origin, createdAt]);

  // Compared once, when first opened.
  useEffect(() => {
    if (!open || !previous || changes) return;
    let live = true;
    void getSession(previous.id).then((old) => {
      if (live) setChanges(old ? compareSources(old.source.content, content) : 'gone');
    });
    return () => {
      live = false;
    };
  }, [open, previous, changes, content]);

  const date = useMemo(
    () => (previous ? new Date(previous.createdAt).toLocaleDateString(i18n.language, { dateStyle: 'medium' }) : ''),
    [previous, i18n.language],
  );
  if (!previous) return null;

  const list = (items: string[], className: string) => (
    <ul className={`whats-new__list ${className}`}>
      {items.slice(0, SHOWN).map((text, i) => (
        <li key={i}>{text}</li>
      ))}
      {items.length > SHOWN && <li className="whats-new__more">{t('changes.more', { n: items.length - SHOWN })}</li>}
    </ul>
  );

  return (
    <div className="whats-new">
      <p className="whats-new__line">
        {t('changes.seen', { date })}{' '}
        <button type="button" className="link" onClick={() => setOpen((v) => !v)} aria-expanded={open}>
          {open ? t('changes.hide') : t('changes.show')}
        </button>
      </p>
      {open && (
        <section className="whats-new__panel" aria-live="polite">
          <header>
            <Icon icon={GitCompareIcon} size={15} />
            <strong>{t('changes.title', { date })}</strong>
            <button type="button" className="tool-btn" onClick={() => setOpen(false)} title={t('changes.hide')}>
              <Icon icon={Cancel01Icon} size={14} />
            </button>
          </header>
          {changes === null ? (
            <p className="muted">{t('changes.comparing')}</p>
          ) : changes === 'gone' ? (
            <p className="muted">{t('changes.gone')}</p>
          ) : !hasChanges(changes) ? (
            <p className="muted">{t('changes.none')}</p>
          ) : (
            <>
              {changes.changed.length > 0 && (
                <>
                  <h4>
                    {t('changes.edited')} <span className="whats-new__count">{changes.changed.length}</span>
                  </h4>
                  <ul className="whats-new__list">
                    {changes.changed.slice(0, SHOWN).map((c, i) => (
                      <li key={i}>
                        {c.parts.map((p, k) =>
                          p.kind === 'added' ? (
                            <ins key={k}>{p.text} </ins>
                          ) : p.kind === 'removed' ? (
                            <del key={k}>{p.text} </del>
                          ) : (
                            <span key={k}>{p.text} </span>
                          ),
                        )}
                      </li>
                    ))}
                    {changes.changed.length > SHOWN && (
                      <li className="whats-new__more">{t('changes.more', { n: changes.changed.length - SHOWN })}</li>
                    )}
                  </ul>
                </>
              )}
              {changes.added.length > 0 && (
                <>
                  <h4>
                    {t('changes.added')} <span className="whats-new__count">{changes.added.length}</span>
                  </h4>
                  {list(changes.added, 'whats-new__list--added')}
                </>
              )}
              {changes.removed.length > 0 && (
                <>
                  <h4>
                    {t('changes.removed')} <span className="whats-new__count">{changes.removed.length}</span>
                  </h4>
                  {list(changes.removed, 'whats-new__list--removed')}
                </>
              )}
            </>
          )}
          {(session.source.truncated || previous.kind !== session.source.kind) && (
            <p className="hint">{t('changes.partial')}</p>
          )}
        </section>
      )}
    </div>
  );
}
