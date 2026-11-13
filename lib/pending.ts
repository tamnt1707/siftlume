import type { ModeId } from './modes';
import { browser, storage } from '#imports';

/**
 * A summarize request handed from the popup or context menu to the result page.
 * Kept in storage.session (memory only, cleared when the browser closes) so large pasted text
 * does not have to travel in the URL.
 */
export type PendingRequest = (
  { type: 'tab'; tabId: number } | { type: 'text'; text: string; title?: string; url?: string; tabId?: number }
) & {
  /** Analysis mode picked in the popup; missing means a summary. */
  mode?: ModeId;
  /** Deep read ticked in the popup: also read the links the AI picks. */
  deep?: boolean;
};

const requestsItem = storage.defineItem<Record<string, PendingRequest & { at: number }>>('session:requests', {
  fallback: {},
});

export async function queueRequest(req: PendingRequest) {
  const id = crypto.randomUUID();
  const all = await requestsItem.getValue();
  // Drop stale requests (older than 10 minutes) while we are here.
  const fresh = Object.fromEntries(Object.entries(all).filter(([, r]) => Date.now() - r.at < 10 * 60_000));
  await requestsItem.setValue({ ...fresh, [id]: { ...req, at: Date.now() } });
  return id;
}

/** Returns the request once and removes it, so reloading the result page does not re-run it. */
export async function takeRequest(id: string): Promise<PendingRequest | null> {
  const all = await requestsItem.getValue();
  const req = all[id];
  if (!req) return null;
  const { [id]: _taken, ...rest } = all;
  await requestsItem.setValue(rest);
  return req;
}

/** `print`: open the print dialog once the summary is shown (used from the side panel, which cannot print). */
export type AppRoute = { request: string } | { session: string; print?: '1' } | { view: 'new' | 'history' | 'tabs' };

/** Opens the full-page result view in a new tab, next to the tab it came from. */
export async function openApp(route: AppRoute, opener?: { id?: number; index?: number; windowId?: number }) {
  const params = new URLSearchParams(route as Record<string, string>);
  await browser.tabs.create({
    url: browser.runtime.getURL(`/app.html?${params}`),
    index: opener?.index !== undefined ? opener.index + 1 : undefined,
    openerTabId: opener?.id,
    windowId: opener?.windowId,
  });
}

// ── Per-tab side panel ─────────────────────────────────────────────────────────
// The panel belongs to the tab that was analyzed: it is enabled only for that tab, hidden on
// other tabs, and closed when that tab navigates to another URL (see background.ts).

/** Requests addressed to each tab's panel, keyed by tab id. */
const panelRequestsItem = storage.defineItem<Record<string, { id: string; at: number }>>('session:panelRequests', {
  fallback: {},
});

/** URL each panel was opened for, so navigation away from it can close the panel. */
export const panelUrlsItem = storage.defineItem<Record<string, string>>('session:panelUrls', { fallback: {} });

/** Compares URLs without the fragment: in-page anchors keep the panel open. */
export const sameDocument = (a?: string, b?: string) => Boolean(a && b) && a!.split('#')[0] === b!.split('#')[0];

/**
 * Enables and opens the side panel for one tab. Must be called synchronously inside the click /
 * context-menu handler (no await before it): Chrome only opens the panel during a user gesture.
 */
export function openSidePanelForTab(tabId: number) {
  void browser.sidePanel.setOptions({ tabId, path: `sidepanel.html?tab=${tabId}`, enabled: true });
  return browser.sidePanel.open({ tabId });
}

/** Width of the panel window, about Chrome's side panel. */
const PANEL_WINDOW_WIDTH = 420;
/** The panel window opened for each tab, to reuse it (lost when the service worker restarts). */
const panelWindows = new Map<number, number>();

/**
 * Opens a tab's side panel, or, where Chrome has none (an installed web app's window, a popup
 * window), the same panel in a narrow window beside it. Call it synchronously in the click
 * handler: the side panel needs the user gesture.
 */
export async function openPanelForTab(tab: { id?: number; windowId?: number }) {
  const tabId = tab.id!;
  const opening = openSidePanelForTab(tabId);
  if (tab.windowId === undefined) return opening;
  // Not an ordinary browser window: whatever open() did, the panel would not be seen there. An
  // installed app's window is only returned when asked for by type.
  const win = await browser.windows
    .get(tab.windowId, { windowTypes: ['normal', 'popup', 'app', 'devtools'] })
    .catch(() => null);
  if (!win || win.type !== 'normal') {
    opening.catch(() => {});
    return openPanelWindow(tabId, win);
  }
  await opening;
}

async function openPanelWindow(
  tabId: number,
  beside: { left?: number; top?: number; width?: number; height?: number } | null,
) {
  const existing = panelWindows.get(tabId);
  if (existing !== undefined) {
    const ok = await browser.windows.update(existing, { focused: true }).catch(() => null);
    if (ok) return;
    panelWindows.delete(tabId);
  }
  // On the right edge of the app's window, over its content, so both stay on screen.
  const left =
    beside?.left !== undefined && beside.width !== undefined
      ? Math.max(0, beside.left + beside.width - PANEL_WINDOW_WIDTH)
      : undefined;
  const win = await browser.windows.create({
    url: browser.runtime.getURL(`/sidepanel.html?tab=${tabId}` as Parameters<typeof browser.runtime.getURL>[0]),
    type: 'popup',
    width: PANEL_WINDOW_WIDTH,
    height: beside?.height,
    left,
    top: beside?.top,
  });
  if (win?.id !== undefined) panelWindows.set(tabId, win.id);
}

/** A window was closed: forget it if it was a panel window. */
export function forgetPanelWindow(windowId: number) {
  for (const [tabId, id] of panelWindows) if (id === windowId) panelWindows.delete(tabId);
}

/** Closes the panel window opened for a tab, if any. */
export async function closePanelWindowForTab(tabId: number) {
  const id = panelWindows.get(tabId);
  if (id === undefined) return;
  panelWindows.delete(tabId);
  await browser.windows.remove(id).catch(() => {});
}

/** Remembers which URL a tab's panel belongs to, so navigating away closes it. */
export async function rememberPanelUrl(tabId: number, url: string) {
  const urls = await panelUrlsItem.getValue();
  await panelUrlsItem.setValue({ ...urls, [tabId]: url });
}

/** Queues a request for a tab's panel and remembers which URL the panel belongs to. */
export async function sendToSidePanel(tabId: number, req: PendingRequest, url?: string) {
  const id = await queueRequest(req);
  const all = await panelRequestsItem.getValue();
  await panelRequestsItem.setValue({ ...all, [tabId]: { id, at: Date.now() } });
  if (url) await rememberPanelUrl(tabId, url);
}

/** Takes the pending request for this tab's panel, if any. */
export async function takePanelRequest(tabId: number) {
  const all = await panelRequestsItem.getValue();
  const r = all[tabId];
  if (!r) return null;
  const { [tabId]: _taken, ...rest } = all;
  await panelRequestsItem.setValue(rest);
  return Date.now() - r.at < 60_000 ? takeRequest(r.id) : null;
}

export function watchPanelRequests(tabId: number, onRequest: () => void) {
  return panelRequestsItem.watch((next) => {
    if (next?.[tabId]) onRequest();
  });
}

/** Disables (and so closes) a tab's panel and forgets its URL. */
export async function closeSidePanelForTab(tabId: number) {
  await browser.sidePanel.setOptions({ tabId, enabled: false }).catch(() => {});
  const urls = await panelUrlsItem.getValue();
  if (tabId in urls) {
    const { [tabId]: _gone, ...rest } = urls;
    await panelUrlsItem.setValue(rest);
  }
}
