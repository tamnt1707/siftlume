// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { SettingsForm } from '@/components/SettingsForm';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
// jsdom has no matchMedia; the form reads it for "system" mode.
window.matchMedia ??= ((q: string) => ({
  matches: false,
  media: q,
  addEventListener: () => {},
  removeEventListener: () => {},
})) as unknown as typeof window.matchMedia;

let root: Root | null = null;
afterEach(() => {
  act(() => root?.unmount());
  root = null;
  document.body.innerHTML = '';
});

const settle = () => act(() => new Promise((r) => setTimeout(r, 50)));

describe('Settings shows the draft look on the whole page', () => {
  it('reports the mode picked before Save, and clears it when Settings closes', async () => {
    const onPreview = vi.fn();
    const el = document.body.appendChild(document.createElement('div'));
    root = createRoot(el);
    act(() => root!.render(createElement(SettingsForm, { embedded: true, initialTab: 'appearance', onPreview })));
    await settle();
    expect(onPreview).toHaveBeenLastCalledWith(expect.objectContaining({ theme: 'system' }));

    const light = [...el.querySelectorAll<HTMLButtonElement>('.segmented button')].find((b) => b.textContent === 'Light');
    act(() => light!.click());
    expect(onPreview).toHaveBeenLastCalledWith(expect.objectContaining({ theme: 'light' }));
    // Nothing was saved: the page shows the draft, storage still has the old mode.

    act(() => root!.unmount());
    root = null;
    expect(onPreview).toHaveBeenLastCalledWith(null);
  });

  it('shows each reading font option in its own typeface', async () => {
    const el = document.body.appendChild(document.createElement('div'));
    root = createRoot(el);
    act(() => root!.render(createElement(SettingsForm, { embedded: true, initialTab: 'appearance' })));
    await settle();
    const fonts = [...el.querySelectorAll<HTMLButtonElement>('.segmented button')]
      .filter((b) => b.textContent === 'Serif' || b.textContent === 'Sans')
      .map((b) => b.style.fontFamily);
    expect(fonts[0]).toContain('Source Serif');
    expect(fonts[1]).toContain('Bricolage');
  });
});
