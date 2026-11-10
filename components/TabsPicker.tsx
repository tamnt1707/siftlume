import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Layers01Icon, RefreshIcon } from '@hugeicons/core-free-icons';
import { browser } from '#imports';
import { listTabs, MAX_TABS, requestTabsAccess, requestTabsPermission, type TabChoice } from '@/lib/multi';
import type { ModeId } from '@/lib/modes';
import { HAS_FAVICON_CACHE } from '@/lib/platform';
import { probeVideo, youTubeVideoId, type VideoProbe } from '@/lib/youtube';
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
  granted,
}: {
  ctrl: SessionController;
  mode: ModeId;
  /** The side panel's own tab, ticked to start with. */
  currentTabId?: number;
  /**
   * Answer to the permission request the parent made when this tab was clicked (a click is
   * needed for the prompt). Undefined until answered.
   */
  granted?: boolean;
}) {
  const { t } = useTranslation(['picker', 'common']);
  const [tabs, setTabs] = useState<TabChoice[] | null>(null);
  const [selected, setSelected] = useState<number[]>([]);
  const [error, setError] = useState<string | null>(null);
  const busy = ctrl.phase !== 'idle';
  // YouTube tabs: whether each video has captions. Null when the page cannot be checked yet (no
  // access to youtube.com before the first combine), so the video is read and judged then.
  const [probes, setProbes] = useState<Record<number, VideoProbe | null>>({});
  const blocked = (id: number) => {
    const p = probes[id];
    return Boolean(p && (p.live || !p.captions));
  };

  useEffect(() => {
    const videos = (tabs ?? []).filter((tab) => youTubeVideoId(tab.url));
    if (!videos.length) return;
    let live = true;
    void Promise.all(videos.map(async (tab) => [tab.id, await probeVideo(tab.id)] as const)).then((pairs) => {
      if (!live) return;
      const next = Object.fromEntries(pairs);
      setProbes(next);
      // A video that cannot be summarized is never ticked (the panel's own tab may have been).
      setSelected((sel) => sel.filter((id) => !(next[id] && (next[id]!.live || !next[id]!.captions))));
    });
    return () => {
      live = false;
    };
  }, [tabs]);

  /** Caption line under a YouTube tab: which captions it will read, or why it cannot. */
  const videoNote = (id: number) => {
    const p = probes[id];
    if (!p) return null;
    if (p.live) return t('video.live');
    if (!p.captions) return t('video.noCaptions');
    const label = p.captions.label.replace(/\s*\(.*\)$/, '');
    return label ? t(p.captions.auto ? 'video.autoCaptions' : 'video.captions', { label }) : null;
  };

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

  // Already allowed (earlier visit, or opened from the popup): list the tabs straight away.
  useEffect(() => {
    void browser.permissions.contains({ permissions: ['tabs'] }).then((ok) => ok && load());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (granted) load();
    else if (granted === false) setError(t('tabs.denied'));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [granted]);

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
            const isVideo = Boolean(youTubeVideoId(tab.url));
            const note = isVideo ? videoNote(tab.id) : null;
            return (
              <li key={tab.id}>
                <label className={`tabs-picker__item ${on ? 'is-on' : ''} ${blocked(tab.id) ? 'is-blocked' : ''}`}>
                  <input
                    type="checkbox"
                    checked={on}
                    disabled={busy || blocked(tab.id) || (!on && selected.length >= MAX_TABS)}
                    onChange={() => toggle(tab.id)}
                  />
                  {HAS_FAVICON_CACHE && <img className="source__favicon" src={faviconUrl(tab.url)} alt="" />}
                  <span className="tabs-picker__text">
                    <span className="tabs-picker__title">{tab.title}</span>
                    <span className="tabs-picker__host">
                      {isVideo && <span className="badge badge--sm">{t('common:kind.video')}</span>}
                      {note ?? hostOf(tab.url)}
                    </span>
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
