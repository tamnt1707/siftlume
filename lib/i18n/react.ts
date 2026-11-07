import { initReactI18next } from 'react-i18next';
import i18n from './index';

// Registers the shared instance for useTranslation() anywhere in the React tree (UI entrypoints only;
// the background keeps using plain i18next). Components re-render on language change.
initReactI18next.init(i18n);

export default i18n;
