import { browser, storage } from '#imports';

/**
 * A summarize request handed from the popup or context menu to the result page.
 * Kept in storage.session (memory only, cleared when the browser closes) so large pasted text
 * does not have to travel in the URL.
 */
export type PendingRequest =
  { type: 'tab'; tabId: number } | { type: 'text'; text: string; title?: string; url?: string; tabId?: number };

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
export type AppRoute = { request: string } | { session: string; print?: '1' } | { view: 'new' | 'history' };

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
