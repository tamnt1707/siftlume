import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { SparklesIcon } from '@hugeicons/core-free-icons';
import { findLinks, MAX_LINKS, pickLinks, requestLinksAccess } from '@/lib/deep';
import { describeError } from '@/lib/llm';
import type { Settings } from '@/lib/settings';
import type { Session } from '@/lib/history';
import { Icon } from './Icon';
import type { SessionController } from './useSession';

const hostOf = (url: string) => {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
};

/** Deep read is offered for pages with links in their main text. */
export const canDeepRead = (session: Session) =>
  (session.source.kind === 'webpage' || session.source.kind === 'markdown') && findLinks(session.source).length > 0;

/**
 * Result screen, under the source line: the links in the page's main text, to read up to five of
 * them and summarize them with the page. "Let AI choose" ticks the ones worth reading.
 */
export function DeepRead({
  ctrl,
  session,
  settings,
  onClose,
}: {
  ctrl: SessionController;
  session: Session;
  settings: Settings;
  onClose: () => void;
}) {
  const { t } = useTranslation('session');
  const links = useMemo(() => findLinks(session.source), [session.source]);
  const [selected, setSelected] = useState<string[]>([]);
  const [picking, setPicking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const busy = ctrl.phase !== 'idle' || picking;

  const toggle = (url: string) =>
    setSelected((sel) => (sel.includes(url) ? sel.filter((x) => x !== url) : [...sel, url]));

  const aiPick = async () => {
    setPicking(true);
    setError(null);
    try {
      const picked = await pickLinks({ ...settings, ...session.options }, session.source, links);
      setSelected(picked.map((i) => links[i]!.url));
      if (!picked.length) setError(t('deep.aiNone'));
    } catch (e) {
      setError(describeError(e, settings));
    } finally {
      setPicking(false);
    }
  };

  const run = () => {
    setError(null);
    // No await before the request: Chrome only prompts during the click.
    void requestLinksAccess(selected).then((ok) => {
      if (!ok) return setError(t('deep.denied'));
      onClose();
      void ctrl.deepen(selected);
    });
  };

  return (
    <section className="tabs-picker tabs-picker--open deep-read" aria-label={t('deep.title')}>
      <div className="tabs-picker__head">
        <strong>{t('deep.title')}</strong>
        <span className="muted">{t('deep.count', { count: selected.length, max: MAX_LINKS })}</span>
        <button type="button" className="btn btn--sm" disabled={busy} onClick={() => void aiPick()}>
          <Icon icon={SparklesIcon} size={14} />
          {picking ? t('deep.aiPicking') : t('deep.aiPick')}
        </button>
      </div>
      <p className="hint">{t('deep.hint', { max: MAX_LINKS })}</p>
      <ul className="tabs-picker__list">
        {links.map((link) => {
          const on = selected.includes(link.url);
          return (
            <li key={link.url}>
              <label className={`tabs-picker__item ${on ? 'is-on' : ''}`} title={link.context}>
                <input
                  type="checkbox"
                  checked={on}
                  disabled={busy || (!on && selected.length >= MAX_LINKS)}
                  onChange={() => toggle(link.url)}
                />
                <span className="tabs-picker__text">
                  <span className="tabs-picker__title">{link.text}</span>
                  <span className="tabs-picker__host">{hostOf(link.url)}</span>
                </span>
              </label>
            </li>
          );
        })}
      </ul>
      <div className="deep-read__actions">
        <button type="button" className="btn btn--sm" onClick={onClose}>
          {t('deep.cancel')}
        </button>
        <button type="button" className="btn btn--primary btn--sm" disabled={busy || !selected.length} onClick={run}>
          {t('deep.run', { count: selected.length })}
        </button>
      </div>
      {error && <p className="hint">{error}</p>}
    </section>
  );
}
