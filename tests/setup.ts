import { fakeBrowser } from 'wxt/testing/fake-browser';

// The fake browser leaves i18n.getUILanguage unimplemented; lib/i18n reads it on import.
fakeBrowser.i18n.getUILanguage = () => 'en';
