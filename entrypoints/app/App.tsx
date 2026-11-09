import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Add01Icon, Clock01Icon, Settings02Icon } from '@hugeicons/core-free-icons';
import { Icon } from '@/components/Icon';
import { Themed } from '@/components/Themed';
import { browser } from '#imports';
import { HistoryList } from '@/components/HistoryList';
import { ModelSwitcher } from '@/components/ModelSwitcher';
import { SessionView } from '@/components/SessionView';
import { SettingsForm } from '@/components/SettingsForm';
import { SourcePicker, type PageTarget } from '@/components/SourcePicker';
import { SiftLoader } from '@/components/SiftLoader';
import { isReadableUrl } from '@/lib/page';
import { useSession } from '@/components/useSession';
import { useSettings } from '@/components/useSettings';
import { historyItem, type Session } from '@/lib/history';
import { openApp, takePanelRequest, takeRequest, watchPanelRequests, type PendingRequest } from '@/lib/pending';
import { configProblem } from '@/lib/settings';

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
export default function App({ surface = 'page' }: { surface?: 'page' | 'panel' }) {
  const isPanel = surface === 'panel';
  const { t } = useTranslation(['common', 'errors']);
  const { settings, loaded } = useSettings();
  const ctrl = useSession(settings);
  const [view, setView] = useState<View>('main');
  const [toast, setToast] = useState<string | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const routed = useRef(false);
  /** Set by ?print=1: print once the opened session's summary has rendered. */
  const printWhenReady = useRef(false);

  const notify = useCallback((msg: string) => {
    setToast(msg);
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 2500);
  }, []);

  const run = useCallback(
    (req: PendingRequest | null) => {
      if (!req) return ctrl.setError(t('errors:requestExpired'));
      setView('main');
      if (req.type === 'tab') void ctrl.fromTab(req.tabId);
      else
        ctrl.fromText(
          req.text,
          req.title ? t('selectionOf', { title: req.title }) : t('pastedText'),
          req.url,
          req.tabId,
        );
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
  useEffect(() => {
    if (!isPanel || !Number.isFinite(panelTabId)) return;
    const load = () =>
      void browser.tabs
        .get(panelTabId)
        .then((t) => setPageTarget({ id: panelTabId, title: t.title, readable: isReadableUrl(t.url) }))
        .catch(() => setPageTarget(undefined));
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

  const problem = loaded ? configProblem(settings) : null;
  const route = (params: Record<string, string>) => !isPanel && setRoute(params);
  const goNew = () => {
    ctrl.reset();
    setView('main');
    route({ view: 'new' });
  };
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
    <Themed settings={settings} className={`app ${isPanel ? 'app--panel' : 'app--page'}`}>
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
            onClick={() => {
              const next = view === 'history' ? 'main' : 'history';
              setView(next);
              if (next === 'history') route({ view: 'history' });
              else if (sessionId) route({ session: sessionId });
            }}
            title={t('actions.history')}
            aria-label={t('actions.history')}
          >
            <Icon icon={Clock01Icon} />
          </button>
          <button
            className={`icon-btn ${view === 'settings' ? 'active' : ''}`}
            onClick={() => setView(view === 'settings' ? 'main' : 'settings')}
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
          <SettingsForm embedded onClose={() => setView('main')} />
        ) : view === 'history' ? (
          <div className="narrow">
            <h2 className="section-title">{t('actions.history')}</h2>
            <HistoryList onOpen={openSession} />
          </div>
        ) : ctrl.session ? (
          <SessionView
            ctrl={ctrl}
            notify={notify}
            layout={isPanel ? 'panel' : 'page'}
            settings={settings}
            onExpand={isPanel && sessionId ? () => void openApp({ session: sessionId }) : undefined}
            onPrint={isPanel && sessionId ? () => void openApp({ session: sessionId, print: '1' }) : undefined}
          />
        ) : ctrl.phase === 'extracting' ? (
          <SiftLoader stage="reading" title={t('loader.reading')} onStop={ctrl.stop} />
        ) : (
          <div className="narrow">
            <SourcePicker ctrl={ctrl} page={pageTarget} />
          </div>
        )}
      </main>

      {toast && <div className="toast">{toast}</div>}
    </Themed>
  );
}
