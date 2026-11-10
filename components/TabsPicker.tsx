import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Layers01Icon, RefreshIcon } from '@hugeicons/core-free-icons';
import { browser } from '#imports';
import { listTabs, MAX_TABS, requestTabsAccess, requestTabsPermission, type TabChoice } from '@/lib/multi';
import type { ModeId } from '@/lib/modes';
import { HAS_FAVICON_CACHE } from '@/lib/platform';
import { Icon } from './Icon';
import type { SessionController } from './useSession';

const faviconUrl = (pageUrl: string) =>
  `chrome-extension://${browser.runtime.id}/_favicon/?pageUrl=${encodeURIComponent(pageUrl)}&size=32`;

const hostOf = (url: string) => {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
};

/**
 * Start screen: pick 2–6 open tabs to summarize and compare together. Seeing the tab list needs
 * the optional "tabs" permission, reading them needs their sites: both are asked for on click.
 */
export function TabsPicker({
  ctrl,
  mode,
  currentTabId,
  startOpen,
}: {
  ctrl: SessionController;
  mode: ModeId;
  /** The side panel's own tab, ticked to start with. */
  currentTabId?: number;
  /** Opened from the popup's "Combine tabs": list the tabs right away if allowed. */
  startOpen?: boolean;
}) {
  const { t } = useTranslation('picker');
  const [tabs, setTabs] = useState<TabChoice[] | null>(null);
  const [selected, setSelected] = useState<number[]>([]);
  const [error, setError] = useState<string | null>(null);
  const busy = ctrl.phase !== 'idle';

  const load = () =>
    void listTabs().then((list) => {
      setTabs(list);
      setSelected((sel) => {
        const kept = sel.filter((id) => list.some((tab) => tab.id === id));
        return kept.length || currentTabId === undefined || !list.some((tab) => tab.id === currentTabId)
          ? kept
          : [currentTabId];
      });
    });

  useEffect(() => {
    if (!startOpen) return;
    void browser.permissions.contains({ permissions: ['tabs'] }).then((ok) => ok && load());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [startOpen]);

  const open = () => {
    setError(null);
    // No await before the request: Chrome only prompts during the click.
    void requestTabsPermission().then((ok) => (ok ? load() : setError(t('tabs.denied'))));
  };

  const run = () => {
    const chosen = (tabs ?? []).filter((tab) => selected.includes(tab.id));
    setError(null);
    void requestTabsAccess(chosen).then((ok) =>
      ok
        ? ctrl.fromTabs(
            chosen.map((tab) => tab.id),
            mode,
          )
        : setError(t('tabs.denied')),
    );
  };

  const toggle = (id: number) => setSelected((sel) => (sel.includes(id) ? sel.filter((x) => x !== id) : [...sel, id]));

  if (!tabs)
    return (
      <div className="tabs-picker">
        <button className="btn btn--block" disabled={busy} onClick={open}>
          <Icon icon={Layers01Icon} size={16} />
          {t('tabs.open')}
        </button>
        <p className="hint">{error ?? t('tabs.hint', { max: MAX_TABS })}</p>
      </div>
    );

  return (
    <div className="tabs-picker tabs-picker--open">
      <div className="tabs-picker__head">
        <strong>{t('tabs.title')}</strong>
        <span className="muted">{t('tabs.count', { count: selected.length, max: MAX_TABS })}</span>
        <button className="icon-btn" title={t('tabs.refresh')} aria-label={t('tabs.refresh')} onClick={load}>
          <Icon icon={RefreshIcon} size={16} />
        </button>
      </div>
      {tabs.length < 2 ? (
        <p className="hint">{t('tabs.none')}</p>
      ) : (
        <ul className="tabs-picker__list">
          {tabs.map((tab) => {
            const on = selected.includes(tab.id);
            return (
              <li key={tab.id}>
                <label className={`tabs-picker__item ${on ? 'is-on' : ''}`}>
                  <input
                    type="checkbox"
                    checked={on}
                    disabled={busy || (!on && selected.length >= MAX_TABS)}
                    onChange={() => toggle(tab.id)}
                  />
                  {HAS_FAVICON_CACHE && <img className="source__favicon" src={faviconUrl(tab.url)} alt="" />}
                  <span className="tabs-picker__text">
                    <span className="tabs-picker__title">{tab.title}</span>
                    <span className="tabs-picker__host">{hostOf(tab.url)}</span>
                  </span>
                </label>
              </li>
            );
          })}
        </ul>
      )}
      <button className="btn btn--primary btn--block" disabled={busy || selected.length < 2} onClick={run}>
        <Icon icon={Layers01Icon} size={16} />
        {t('tabs.run', { count: selected.length })}
      </button>
      {error && <p className="hint">{error}</p>}
    </div>
  );
}
