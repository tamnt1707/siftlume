import { useEffect, useState } from 'react';
import { DEFAULT_SETTINGS, getSettings, normalizeSettings, settingsItem, type Settings } from '@/lib/settings';

/** Reads settings from storage and stays in sync when the Settings page saves. */
export function useSettings() {
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    void getSettings().then((s) => {
      setSettings(s);
      setLoaded(true);
    });
    return settingsItem.watch((next) => setSettings(normalizeSettings(next)));
  }, []);

  return { settings, loaded };
}
