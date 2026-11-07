import { Globe02Icon } from '@hugeicons/core-free-icons';
import { useTranslation } from 'react-i18next';
import { browserLanguage, UI_LANGUAGES } from '@/lib/i18n';
import { getSettings, settingsItem } from '@/lib/settings';
import { Icon } from './Icon';
import { Select } from './Select';

/**
 * Interface language picker. Unlike other settings it applies and saves immediately:
 * nobody wants to read the rest of the form in the old language before pressing Save.
 */
export function LanguagePicker({ value, onChange }: { value: string; onChange: (code: string) => void }) {
  const { t } = useTranslation('settings');
  const browserName = UI_LANGUAGES.find((l) => l.code === browserLanguage())?.name ?? 'English';

  const change = async (code: string) => {
    onChange(code);
    const stored = await getSettings();
    await settingsItem.setValue({ ...stored, uiLanguage: code });
  };

  return (
    <Select
      variant="pill"
      value={value}
      onChange={(code) => void change(code)}
      aria-label={t('appearance.uiLanguage')}
      leading={<Icon icon={Globe02Icon} size={16} />}
      options={[
        { value: 'auto', label: t('appearance.uiLanguageAuto', { language: browserName }) },
        ...UI_LANGUAGES.map((l) => ({ value: l.code, label: l.name })),
      ]}
    />
  );
}
