import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Add01Icon, Clock01Icon, FileSearchIcon, Settings02Icon } from '@hugeicons/core-free-icons';
import { Icon } from '@/components/Icon';
import { Themed } from '@/components/Themed';
import { browser } from '#imports';
import { HistoryList } from '@/components/HistoryList';
import { ModelSwitcher } from '@/components/ModelSwitcher';
import { SessionView } from '@/components/SessionView';
import { SettingsForm, type SettingsGuard } from '@/components/SettingsForm';
import { SourcePicker, type PageTarget } from '@/components/SourcePicker';
import { SiftLoader } from '@/components/SiftLoader';
import { isReadableUrl } from '@/lib/page';
import { useSession } from '@/components/useSession';
import { useSettings } from '@/components/useSettings';
import { historyItem, type Session } from '@/lib/history';
import { openApp, takePanelRequest, takeRequest, watchPanelRequests, type PendingRequest } from '@/lib/pending';
import { configProblem } from '@/lib/settings';
import { requestLinksAccess } from '@/lib/deep';

type View = 'main' | 'history' | 'settings';

/** Replaces the query string without reloading, so a refresh reopens the same view. */
function setRoute(params: Record<string, string>) {
  const qs = new URLSearchParams(params).toString();
  history.replaceState(null, '', `${location.pathname}${qs ? `?${qs}` : ''}`);
}

/**
 * Result view, used on two surfaces:
 * - "page":  full-page tab opened by the popup / context menu. Routes: ?request=<id>,
 *            ?session=<id>, ?view=new | ?view=history.
 * - "panel": the side panel of one tab (sidepanel.html?tab=<id>). Requests for that tab arrive
 *            through storage; the panel only ever shows that tab's summaries.
 */
/** Phone-width windows (Safari on iOS) get the side panel's single-column layout. */
function useNarrow(max = 560) {
  const query = `(max-width: ${max}px)`;
  const [narrow, setNarrow] = useState(() => matchMedia(query).matches);
  useEffect(() => {
    const m = matchMedia(query);
    const onChange = () => setNarrow(m.matches);
    m.addEventListener('change', onChange);
    return () => m.removeEventListener('change', onChange);
  }, [query]);
  return narrow;
}

export default function App({ surface = 'page' }: { surface?: 'page' | 'panel' }) {
  const isPanel = surface === 'panel';
  // Layout only: a narrow page looks like the panel but keeps the page's behavior.
  const compact = useNarrow() || isPanel;
  const { t } = useTranslation(['common', 'errors', 'session']);
  const { settings, loaded } = useSettings();
  const ctrl = useSession(settings);
  const [view, setView] = useState<View>('main');
  const [toast, setToast] = useState<string | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const routed = useRef(false);
  /** ?view=tabs (the popup's "Combine tabs"): the start screen lists the open tabs. */
  const [startTabs, setStartTabs] = useState(false);
  /** Set by ?print=1: print once the opened session's summary has rendered. */
  const printWhenReady = useRef(false);

  const notify = useCallback((msg: string) => {
    setToast(msg);
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 2500);
  }, []);

  const problem = loaded ? configProblem(settings) : null;
  const problemRef = useRef(problem);
  problemRef.current = problem;
  /** A request that arrived before any provider was set up; it runs once Settings are saved. */
  const held = useRef<PendingRequest | null>(null);

  const run = useCallback(
    (req: PendingRequest | null) => {
      if (!req) return ctrl.setError(t('errors:requestExpired'));
      if (problemRef.current) {
        held.current = req;
        return setView('settings');
      }
      setView('main');
      if (req.type === 'tab') void ctrl.fromTab(req.tabId, req.mode, { deep: req.deep });
      else
        ctrl.fromText(req.text, {
          title: req.title ? t('selectionOf', { title: req.title }) : t('pastedText'),
          origin: req.url,
          tabId: req.tabId,
          mode: req.mode,
        });
    },
    [ctrl],
  );

  // Side panel: run requests addressed to this tab's panel (including the one that opened it).
  const panelTabId = isPanel ? Number(new URLSearchParams(location.search).get('tab')) : NaN;
  useEffect(() => {
    if (!isPanel || !loaded || !Number.isFinite(panelTabId)) return;
    const pull = () =>
      void takePanelRequest(panelTabId).then((req) => {
        if (req) run(req);
      });
    pull();
    return watchPanelRequests(panelTabId, pull);
  }, [isPanel, loaded, panelTabId, run]);

  // Side panel: the tab this panel belongs to, for "Summarize this page".
  const [pageTarget, setPageTarget] = useState<PageTarget | undefined>();
  /**
   * Whether the panel has asked for its tab yet. Until then the start screen waits: drawing it
   * without the page first showed the taller Text tab, then swapped to This page, and the
   * scrollbar flashed on and off.
   */
  const [pageChecked, setPageChecked] = useState(!isPanel || !Number.isFinite(panelTabId));
  useEffect(() => {
    if (!isPanel || !Number.isFinite(panelTabId)) return;
    const load = () =>
      void browser.tabs
        .get(panelTabId)
        .then((t) => setPageTarget({ id: panelTabId, title: t.title, url: t.url, readable: isReadableUrl(t.url) }))
        .catch(() => setPageTarget(undefined))
        .finally(() => setPageChecked(true));
    load();
    const onUpdated = (id: number, change: { title?: string; url?: string }) => {
      if (id === panelTabId && (change.title || change.url)) load();
    };
    browser.tabs.onUpdated.addListener(onUpdated);
    return () => browser.tabs.onUpdated.removeListener(onUpdated);
  }, [isPanel, panelTabId]);

  // Page: handle the initial route once settings are loaded (the request needs the provider config).
  useEffect(() => {
    if (isPanel || !loaded || routed.current) return;
    routed.current = true;
    const params = new URLSearchParams(location.search);

    const requestId = params.get('request');
    const sessionId = params.get('session');
    if (params.get('view') === 'history') setView('history');
    if (params.get('view') === 'tabs') setStartTabs(true);

    if (requestId) {
      void takeRequest(requestId).then(run);
    } else if (sessionId) {
      printWhenReady.current = params.get('print') === '1';
      void historyItem.getValue().then((list) => {
        const s = list.find((x) => x.id === sessionId);
        if (s) ctrl.open(s);
        else ctrl.setError(t('errors:notInHistory'));
      });
    }
  }, [isPanel, loaded, ctrl, run]);

  // Keep the URL pointing at the current session, and the tab title in sync.
  const sessionId = ctrl.session?.id;
  const sessionTitle = ctrl.session?.source.title;
  useEffect(() => {
    if (isPanel) return;
    if (sessionId) setRoute({ session: sessionId });
    document.title = sessionTitle ? `${sessionTitle} | ${t('appName')}` : t('appName');
  }, [isPanel, sessionId, sessionTitle, t]);

  // ?print=1: wait for the summary, fonts and async blocks (charts, diagrams) to lay out, then print.
  const hasSummary = Boolean(ctrl.session?.summary);
  useEffect(() => {
    if (!printWhenReady.current || !hasSummary || ctrl.phase !== 'idle') return;
    printWhenReady.current = false;
    let timer: ReturnType<typeof setTimeout>;
    void document.fonts.ready.then(() => {
      timer = setTimeout(() => window.print(), 800);
    });
    return () => clearTimeout(timer);
  }, [hasSummary, ctrl.phase]);

  // Nothing works without a provider: a first run opens on Settings instead of the start screen.
  const setupShown = useRef(false);
  useEffect(() => {
    if (!loaded || setupShown.current) return;
    setupShown.current = true;
    if (problem) setView('settings');
  }, [loaded, problem]);

  // Settings saved: run the request that was waiting for them.
  useEffect(() => {
    if (problem || !held.current) return;
    const req = held.current;
    held.current = null;
    run(req);
  }, [problem, run]);

  // Settings registers a guard here; leaving it with unsaved edits asks to save or discard first.
  const settingsGuard = useRef<SettingsGuard | null>(null);
  const leaveSettings = (proceed: () => void) =>
    view === 'settings' && settingsGuard.current ? settingsGuard.current(proceed) : proceed();

  const route = (params: Record<string, string>) => !isPanel && setRoute(params);
  const goNew = () =>
    leaveSettings(() => {
      ctrl.reset();
      setView('main');
      route({ view: 'new' });
    });
  const openSession = (s: Session) => {
    // A tab's panel only shows that page's summaries; other sessions open as a full page.
    if (isPanel && s.source.tabId !== panelTabId) {
      void openApp({ session: s.id });
      return setView('main');
    }
    ctrl.open(s);
    setView('main');
  };

  return (
    <Themed settings={settings} className={`app ${compact ? 'app--panel' : 'app--page'}`}>
      <header className="topbar">
        <button className="brand" onClick={goNew} title={t('actions.newSummary')}>
          {t('appName')}
        </button>
        <ModelSwitcher settings={settings} disabled={ctrl.phase !== 'idle'} onManage={() => setView('settings')} />
        <nav>
          {isPanel ? (
            <button
              className="icon-btn"
              onClick={goNew}
              title={t('actions.newSummary')}
              aria-label={t('actions.newSummary')}
            >
              <Icon icon={Add01Icon} />
            </button>
          ) : (
            <button className="btn btn--sm" onClick={goNew}>
              <Icon icon={Add01Icon} size={16} />
              {t('actions.new')}
            </button>
          )}
          <button
            className={`icon-btn ${view === 'history' ? 'active' : ''}`}
            onClick={() =>
              leaveSettings(() => {
                const next = view === 'history' ? 'main' : 'history';
                setView(next);
                if (next === 'history') route({ view: 'history' });
                else if (sessionId) route({ session: sessionId });
              })
            }
            title={t('actions.history')}
            aria-label={t('actions.history')}
          >
            <Icon icon={Clock01Icon} />
          </button>
          <button
            className={`icon-btn ${view === 'settings' ? 'active' : ''}`}
            onClick={() => (view === 'settings' ? leaveSettings(() => setView('main')) : setView('settings'))}
            title={t('actions.settings')}
            aria-label={t('actions.settings')}
          >
            <Icon icon={Settings02Icon} />
          </button>
        </nav>
      </header>

      <main className="content">
        {problem && view !== 'settings' && (
          <div className="banner">
            {problem}{' '}
            <button className="link" onClick={() => setView('settings')}>
              {t('actions.openSettings')}
            </button>
          </div>
        )}
        {ctrl.error && (
          <div className="banner banner--error" role="alert">
            <span>{ctrl.error}</span>
            <button className="link" onClick={() => ctrl.setError(null)}>
              {t('actions.dismiss')}
            </button>
          </div>
        )}
        {ctrl.warning && <div className="banner banner--warn">{ctrl.warning}</div>}

        {view === 'settings' ? (
          <SettingsForm
            embedded
            guardRef={settingsGuard}
            onClose={() => setView('main')}
            onReady={() => setView('main')}
          />
        ) : view === 'history' ? (
          <div className="narrow">
            <h2 className="section-title">{t('actions.history')}</h2>
            <HistoryList onOpen={openSession} />
          </div>
        ) : ctrl.session ? (
          <SessionView
            ctrl={ctrl}
            notify={notify}
            layout={compact ? 'panel' : 'page'}
            settings={settings}
            onExpand={isPanel && sessionId ? () => void openApp({ session: sessionId }) : undefined}
            onPrint={isPanel && sessionId ? () => void openApp({ session: sessionId, print: '1' }) : undefined}
          />
        ) : ctrl.phase === 'extracting' ? (
          <SiftLoader stage="reading" title={t('loader.reading')} onStop={ctrl.stop} />
        ) : ctrl.pendingDeep ? (
          // Deep read waiting for site access: asked in the middle of the screen, where the
          // progress was, with the page-only summary as the other choice.
          <section className="deep-consent" role="alertdialog" aria-labelledby="deep-consent-title">
            <Icon icon={FileSearchIcon} size={28} />
            <h2 id="deep-consent-title">{t('session:deep.consentTitle')}</h2>
            <p>{t('session:deep.consent', { count: ctrl.pendingDeep.urls.length })}</p>
            <div className="deep-consent__actions">
              <button
                className="btn btn--primary"
                // No await before the request: Chrome only prompts during the click.
                onClick={() => void requestLinksAccess(ctrl.pendingDeep!.urls).then((ok) => ctrl.resolveDeep(ok))}
              >
                {t('session:deep.allow')}
              </button>
              <button className="btn" onClick={() => void ctrl.resolveDeep(false)}>
                {t('session:deep.pageOnly')}
              </button>
            </div>
          </section>
        ) : !loaded || !pageChecked ? null : (
          <div className="narrow">
            <SourcePicker ctrl={ctrl} page={pageTarget} settings={settings} startTabs={startTabs} />
          </div>
        )}
      </main>

      {toast && <div className="toast">{toast}</div>}
    </Themed>
  );
}
