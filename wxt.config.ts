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
    // Asked for only when the user combines several tabs: lists the open tabs to pick from.
    optional_permissions: ['tabs'],
    // The in-browser models (lib/local-model.ts) run compiled WebAssembly shipped in the package.
    // MV3's default policy blocks WebAssembly; 'wasm-unsafe-eval' allows it and nothing else
    // (no eval, no remote code).
    content_security_policy: { extension_pages: "script-src 'self' 'wasm-unsafe-eval'; object-src 'self';" },
    action: { default_title: '__MSG_actionTitle__' },
    commands: {
      // Opens the popup.
      _execute_action: { suggested_key: { default: 'Alt+Shift+S' }, description: '__MSG_commandOpen__' },
    },
  }),
});
