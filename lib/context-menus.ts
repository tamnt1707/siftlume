import { browser } from '#imports';
import type { DisplayMode } from './settings';

/** Chrome _locales message (follows the browser language), with an English fallback. */
const msg = (key: 'menuSummarizePage' | 'menuSummarizeSelection', fallback: string) =>
  browser.i18n.getMessage(key) || fallback;

/** Creates an item and swallows "duplicate id" errors instead of leaving runtime.lastError unchecked. */
function create(props: Parameters<typeof browser.contextMenus.create>[0]) {
  browser.contextMenus.create(props, () => void browser.runtime.lastError);
}

let queue: Promise<void> = Promise.resolve();

/**
 * Context menu items carry the display mode in their id ("summarize-page:sidepanel").
 * The click handler must open the side panel synchronously, so it cannot await settings first.
 * Re-run whenever the display setting changes.
 *
 * Calls are serialized: startup and onInstalled can both trigger a sync, and two overlapping
 * removeAll() → create() runs would create the same ids twice.
 */
export function syncContextMenus(display: DisplayMode) {
  queue = queue
    .then(async () => {
      await browser.contextMenus.removeAll();
      create({
        id: `summarize-page:${display}`,
        title: msg('menuSummarizePage', 'Summarize this page'),
        contexts: ['page'],
      });
      create({
        id: `summarize-selection:${display}`,
        title: msg('menuSummarizeSelection', 'Summarize selection'),
        contexts: ['selection'],
      });
    })
    .catch(console.error);
  return queue;
}

export function parseMenuId(id: string | number): { action: 'page' | 'selection'; display: DisplayMode } {
  const [action, display] = String(id).split(':');
  return {
    action: action === 'summarize-selection' ? 'selection' : 'page',
    display: display === 'sidepanel' ? 'sidepanel' : 'tab',
  };
}
