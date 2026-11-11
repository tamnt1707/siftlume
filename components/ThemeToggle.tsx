import { useTranslation } from 'react-i18next';
import { Moon02Icon, Sun03Icon } from '@hugeicons/core-free-icons';
import { getSettings, settingsItem, type Settings } from '@/lib/settings';
import { Icon } from './Icon';
import { useIsDark } from './Themed';

/**
 * Header button that flips between light and dark. It stores an explicit mode, so "Match system"
 * stays available in Settings → Appearance.
 */
export function ThemeToggle({ settings }: { settings: Settings }) {
  const { t } = useTranslation('common');
  const dark = useIsDark(settings.theme);
  const label = dark ? t('actions.lightMode') : t('actions.darkMode');
  const toggle = async () => {
    // Write over what is stored, not the props: another view may have saved since.
    const stored = await getSettings();
    await settingsItem.setValue({ ...stored, theme: dark ? 'light' : 'dark' });
  };
  return (
    <button className="icon-btn" onClick={() => void toggle()} title={label} aria-label={label}>
      <Icon icon={dark ? Sun03Icon : Moon02Icon} />
    </button>
  );
}
