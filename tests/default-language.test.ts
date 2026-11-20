import { beforeEach, describe, expect, it } from 'vitest';
import { fakeBrowser } from 'wxt/testing/fake-browser';
import { DEFAULT_SETTINGS, getSettings, setDefaultLanguage, settingsItem } from '@/lib/settings';

beforeEach(() => fakeBrowser.reset());

describe('the language picked on a summary becomes the default', () => {
  it('writes only the language, keeping the rest as stored', async () => {
    await settingsItem.setValue({ ...DEFAULT_SETTINGS, provider: 'anthropic', length: 'detailed', language: 'auto' });
    expect(await setDefaultLanguage('Vietnamese')).toBe(true);
    const s = await getSettings();
    expect(s).toMatchObject({ language: 'Vietnamese', provider: 'anthropic', length: 'detailed' });
  });

  it('works before anything was saved, and says when nothing changed', async () => {
    expect(await setDefaultLanguage('Japanese')).toBe(true);
    expect((await getSettings()).language).toBe('Japanese');
    expect(await setDefaultLanguage('Japanese')).toBe(false);
  });
});
