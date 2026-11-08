import { defineConfig } from 'wxt';

// See https://wxt.dev/api/reference/wxt/interfaces/inlineconfig.html
export default defineConfig({
  modules: ['@wxt-dev/module-react'],
  manifest: {
    // Localized from public/_locales/<lang>/messages.json; English is the default.
    default_locale: 'en',
    name: '__MSG_extName__',
    description: '__MSG_extDescription__',
    permissions: [
      'storage',
      'sidePanel',
      'activeTab',
      'scripting',
      'contextMenus',
      'unlimitedStorage',
      'declarativeNetRequestWithHostAccess',
      'favicon',
      'clipboardWrite',
    ],
    // Requested at runtime for the provider API domain (Settings → Save), so calls bypass CORS.
    optional_host_permissions: ['<all_urls>'],
    action: { default_title: '__MSG_actionTitle__' },
    commands: {
      // Opens the popup.
      _execute_action: { suggested_key: { default: 'Alt+Shift+S' }, description: '__MSG_commandOpen__' },
    },
  },
});
