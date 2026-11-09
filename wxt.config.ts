import { defineConfig } from 'wxt';

/** Browsers without chrome.sidePanel or the _favicon endpoint. */
const CHROMIUM_ONLY_SKIP = ['safari', 'firefox'];

// See https://wxt.dev/api/reference/wxt/interfaces/inlineconfig.html
export default defineConfig({
  modules: ['@wxt-dev/module-react'],
  // Safari (macOS and iOS) also runs Manifest V3; WXT would default it to V2.
  manifestVersion: 3,
  manifest: ({ browser }) => ({
    // Localized from public/_locales/<lang>/messages.json; English is the default.
    default_locale: 'en',
    name: '__MSG_extName__',
    description: '__MSG_extDescription__',
    permissions: [
      'storage',
      'activeTab',
      'scripting',
      'contextMenus',
      'unlimitedStorage',
      'declarativeNetRequestWithHostAccess',
      'clipboardWrite',
      // Chromium only (lib/platform.ts): the side panel and the favicon cache.
      ...(CHROMIUM_ONLY_SKIP.includes(browser) ? [] : ['sidePanel', 'favicon']),
    ],
    // Requested at runtime for the provider API domain (Settings → Save), so calls bypass CORS.
    optional_host_permissions: ['<all_urls>'],
    action: { default_title: '__MSG_actionTitle__' },
    commands: {
      // Opens the popup.
      _execute_action: { suggested_key: { default: 'Alt+Shift+S' }, description: '__MSG_commandOpen__' },
    },
  }),
});
