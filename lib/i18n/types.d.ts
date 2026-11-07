import 'i18next';
import type common from '../../locales/en/common.json';
import type errors from '../../locales/en/errors.json';
import type picker from '../../locales/en/picker.json';
import type popup from '../../locales/en/popup.json';
import type session from '../../locales/en/session.json';
import type settings from '../../locales/en/settings.json';

// Type-checked keys: t('settings:model.load') fails to compile if the key is missing in English.
declare module 'i18next' {
  interface CustomTypeOptions {
    defaultNS: 'common';
    resources: {
      common: typeof common;
      errors: typeof errors;
      picker: typeof picker;
      popup: typeof popup;
      session: typeof session;
      settings: typeof settings;
    };
  }
}
