import { parseMenuId, syncContextMenus } from '@/lib/context-menus';
import {
  closeSidePanelForTab,
  openApp,
  openSidePanelForTab,
  panelUrlsItem,
  rememberPanelUrl,
  queueRequest,
  sameDocument,
  sendToSidePanel,
  type PendingRequest,
} from '@/lib/pending';
import { getSettings, settingsItem, type DisplayMode } from '@/lib/settings';
import { HAS_SIDE_PANEL, hasContextMenus } from '@/lib/platform';

export default defineBackground(() => {
  // The side panel is off by default and enabled per tab, only for the tab it belongs to.
  // Safari and Firefox have none: settings force "tab", so the icon always opens the popup.
  if (HAS_SIDE_PANEL) {
    browser.sidePanel.setPanelBehavior({ openPanelOnActionClick: false }).catch(console.error);
    browser.sidePanel.setOptions({ enabled: false }).catch(console.error);
  }
  const menus = hasContextMenus();

  /**
   * The toolbar icon depends on Settings → Show results in:
   * - "tab":       the icon opens the popup launcher.
   * - "sidepanel": no popup; a click opens this tab's side panel, where everything happens.
   */
  const syncAction = (display: DisplayMode) =>
    browser.action.setPopup({ popup: display === 'tab' ? 'popup.html' : '' }).catch(console.error);

  const refreshMenus = () =>
    void getSettings().then((s) => {
      if (menus) void syncContextMenus(s.display);
      void syncAction(s.display);
    });
  refreshMenus();
  browser.runtime.onInstalled.addListener(({ reason }) => {
    refreshMenus();
    if (reason === 'install') browser.runtime.openOptionsPage();
  });
  browser.runtime.onStartup.addListener(refreshMenus);
  settingsItem.watch((next, prev) => {
    if (next?.display !== prev?.display) refreshMenus();
  });

  if (HAS_SIDE_PANEL) {
    // The summary belongs to a page: close the panel when its tab navigates elsewhere.
    browser.tabs.onUpdated.addListener((tabId, change) => {
      if (!change.url) return;
      void panelUrlsItem.getValue().then((urls) => {
        const url = urls[tabId];
        if (url && !sameDocument(url, change.url)) void closeSidePanelForTab(tabId);
      });
    });
    browser.tabs.onRemoved.addListener((tabId) => void closeSidePanelForTab(tabId));

    // Only fires when the popup is disabled (side panel mode). The click grants activeTab,
    // so the panel can read this page without a permission prompt.
    browser.action.onClicked.addListener((tab) => {
      if (!tab.id) return;
      // Must be called before any await to keep the user gesture.
      void openSidePanelForTab(tab.id).catch(console.error);
      if (tab.url) void rememberPanelUrl(tab.id, tab.url);
    });
  }

  // The context menu grants activeTab on that tab, so the panel / result page can read it.
  if (!menus) return;
  browser.contextMenus.onClicked.addListener((info, tab) => {
    if (!tab?.id) return;
    const { action, display } = parseMenuId(info.menuItemId);
    const req: PendingRequest =
      action === 'selection' && info.selectionText
        ? { type: 'text', text: info.selectionText, title: tab.title, url: tab.url, tabId: tab.id }
        : { type: 'tab', tabId: tab.id };

    if (display === 'sidepanel' && HAS_SIDE_PANEL) {
      // Must be called before any await to keep the user gesture.
      void openSidePanelForTab(tab.id).catch(console.error);
      void sendToSidePanel(tab.id, req, tab.url);
    } else {
      void queueRequest(req).then((id) => openApp({ request: id }, tab));
    }
  });
});
