import { beforeEach, describe, expect, it } from 'vitest';
import { fakeBrowser } from 'wxt/testing/fake-browser';
import { DEFAULT_SETTINGS, getSettings, rememberLastUsed, settingsItem } from '@/lib/settings';

beforeEach(() => fakeBrowser.reset());

describe('the language and length picked on a summary become the default', () => {
  it('writes only the language, keeping the rest as stored', async () => {
    await settingsItem.setValue({ ...DEFAULT_SETTINGS, provider: 'anthropic', length: 'detailed', language: 'auto' });
    expect(await rememberLastUsed({ language: 'Vietnamese' })).toBe(true);
    const s = await getSettings();
    expect(s).toMatchObject({ language: 'Vietnamese', provider: 'anthropic', length: 'detailed' });
  });

  it('works before anything was saved, and says when nothing changed', async () => {
    expect(await rememberLastUsed({ language: 'Japanese' })).toBe(true);
    expect((await getSettings()).language).toBe('Japanese');
    expect(await rememberLastUsed({ language: 'Japanese' })).toBe(false);
  });

  it('remembers the length the same way, and never the reading mode', async () => {
    await settingsItem.setValue({ ...DEFAULT_SETTINGS, length: 'medium', language: 'Vietnamese' });
    expect(await rememberLastUsed({ length: 'full' })).toBe(true);
    const s = await getSettings();
    expect(s).toMatchObject({ length: 'full', language: 'Vietnamese', mode: DEFAULT_SETTINGS.mode });
  });
});
