import { browser } from '#imports';

/**
 * Features only Chromium browsers have. Safari (macOS and iOS) and Firefox builds go without them:
 * results always open in a tab, and source favicons are hidden.
 */
const CHROMIUM = !import.meta.env.SAFARI && !import.meta.env.FIREFOX;

/** chrome.sidePanel: the "Inline (side panel)" display mode. */
export const HAS_SIDE_PANEL = CHROMIUM;

/** Chromium's _favicon endpoint for extension pages. */
export const HAS_FAVICON_CACHE = CHROMIUM;

/** Right-click menu items. Safari on macOS has them; iOS has no context menu. */
export const hasContextMenus = () => typeof browser.contextMenus?.create === 'function';

/** Session rules that let the app reach local model servers (Ollama, LM Studio). */
export const hasSessionRules = () => typeof browser.declarativeNetRequest?.updateSessionRules === 'function';
