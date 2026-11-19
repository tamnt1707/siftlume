import { describe, expect, it } from 'vitest';
import { AUTO, autoMode, resolveMode } from '@/lib/modes';
import { DEFAULT_SETTINGS, normalizeSettings } from '@/lib/settings';

const page = (title: string, content = 'Some text.', extra: object = {}) => ({
  kind: 'webpage',
  title,
  content,
  ...extra,
});

describe('autoMode', () => {
  it.each([
    'How to set up SSH keys on macOS',
    'Getting started with Vitest',
    'Hướng dẫn triển khai bộ điều phối mới',
    'Cách cài đặt Node.js trên Windows',
    'Docker のインストール手順',
    'Python 安装教程',
    'Cómo configurar tu router',
    'Как настроить VPN',
  ])('a how-to title is a guide: %s', (title) => {
    expect(autoMode(page(title))).toBe('guide');
  });

  it('a page of numbered steps is a guide whatever its title', () => {
    const content = ['Intro.', ...[1, 2, 3, 4, 5].map((n) => `${n}. Do thing ${n}`)].join('\n');
    expect(autoMode(page('Nightly maintenance', content))).toBe('guide');
    expect(autoMode(page('Nightly maintenance', '1. One\n2. Two'))).toBe('summary');
  });

  it('follows the page schema: recipes are guides, jobs and events are things to do', () => {
    expect(autoMode(page('Pancakes', '', { structured: ['Recipe'] }))).toBe('guide');
    expect(autoMode(page('Senior engineer', '', { structured: ['JobPosting'] }))).toBe('action');
    expect(autoMode(page('Meetup', '', { structured: ['Event'] }))).toBe('action');
  });

  it('a checklist or deadline page is action', () => {
    expect(autoMode(page('Tax filing checklist 2026'))).toBe('action');
    expect(autoMode(page('Hạn chót nộp hồ sơ học bổng'))).toBe('action');
  });

  it('everything else is a summary', () => {
    expect(autoMode(page('Stocks fall as rates rise'))).toBe('summary');
    expect(autoMode(page('The best laptops of 2026: buying guide'))).toBe('summary');
    expect(autoMode({ kind: 'pr', title: 'How to fix the build' })).toBe('summary');
    expect(autoMode({ kind: 'csv', title: 'Install counts' })).toBe('summary');
    expect(autoMode(null)).toBe('summary');
  });
});

describe('resolveMode', () => {
  it('resolves auto from the source and says so', () => {
    expect(resolveMode(AUTO, [], page('How to bake bread'))).toEqual({ base: 'guide', auto: true });
    expect(resolveMode(AUTO)).toEqual({ base: 'summary', auto: true });
  });

  it('keeps a chosen mode', () => {
    expect(resolveMode('guide')).toEqual({ base: 'guide' });
    expect(resolveMode('critique', [], page('How to bake bread'))).toEqual({ base: 'critique' });
  });
});

describe('settings', () => {
  it('starts every new analysis on auto', () => {
    expect(DEFAULT_SETTINGS.mode).toBe(AUTO);
    expect(normalizeSettings({ mode: 'summary' }).mode).toBe(AUTO);
  });

  it('lets a custom mode build on the guide, not on auto', () => {
    const modes = [
      { id: 'a', name: 'A', instruction: 'x', base: 'guide' },
      { id: 'b', name: 'B', instruction: 'x', base: 'auto' },
    ] as never;
    expect(normalizeSettings({ customModes: modes }).customModes.map((m) => m.base)).toEqual(['guide', 'summary']);
  });
});
