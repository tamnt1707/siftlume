import { describe, expect, it } from 'vitest';
import { blocksOf, compareSources, hasChanges, pageKey, previousRead, wordDiff } from '@/lib/changes';
import type { HistoryEntry } from '@/lib/history';

describe('pageKey', () => {
  it('treats visits of the same page as one address', () => {
    const key = 'example.com/pricing';
    expect(pageKey('https://www.example.com/pricing/')).toBe(key);
    expect(pageKey('https://example.com/pricing#team')).toBe(key);
    expect(pageKey('http://example.com/pricing?utm_source=x&fbclid=1')).toBe(key);
  });

  it('keeps parameters that pick the content', () => {
    expect(pageKey('https://example.com/item?id=2&lang=vi')).toBe('example.com/item?id=2&lang=vi');
    expect(pageKey('https://example.com/item?lang=vi&id=2')).toBe('example.com/item?id=2&lang=vi');
    expect(pageKey('https://example.com/item?id=3')).not.toBe(pageKey('https://example.com/item?id=2'));
  });

  it('has no address for pasted text and files', () => {
    expect(pageKey(undefined)).toBeNull();
    expect(pageKey('text')).toBeNull();
  });
});

describe('previousRead', () => {
  const entry = (id: string, origin: string, createdAt: number) =>
    ({ id, origin, createdAt, updatedAt: createdAt, title: id, kind: 'webpage', qa: 0, text: '' }) as HistoryEntry;
  const index = [
    entry('now', 'https://example.com/pricing', 300),
    entry('older', 'https://example.com/pricing', 100),
    entry('last', 'https://www.example.com/pricing/', 200),
    entry('other', 'https://example.com/blog', 250),
  ];

  it('finds the latest earlier read of the same page', () => {
    expect(previousRead(index, { id: 'now', origin: 'https://example.com/pricing', createdAt: 300 })?.id).toBe('last');
  });

  it('finds nothing for a first read or a source without an address', () => {
    expect(previousRead(index, { id: 'older', origin: 'https://example.com/pricing', createdAt: 100 })).toBeNull();
    expect(previousRead(index, { id: 'x', origin: 'text', createdAt: 999 })).toBeNull();
  });
});

describe('blocksOf', () => {
  it('splits paragraphs and list items, without Markdown noise', () => {
    expect(blocksOf('# Plans\n\nThe **Pro** plan [costs](https://x.y) $10.\n- Item one\n- Item two\n\n---')).toEqual([
      'Plans',
      'The Pro plan costs $10.',
      'Item one',
      'Item two',
    ]);
  });
});

describe('wordDiff', () => {
  it('marks the words that changed', () => {
    expect(wordDiff('The Pro plan costs $10 a month.', 'The Pro plan costs $12 a month.')).toEqual([
      { text: 'The Pro plan costs', kind: 'same' },
      { text: '$10', kind: 'removed' },
      { text: '$12', kind: 'added' },
      { text: 'a month.', kind: 'same' },
    ]);
  });
});

describe('compareSources', () => {
  const before = `# Pricing

The Pro plan costs $10 a month and includes 5 seats.

Annual billing saves 20%.

Contact sales for Enterprise.`;

  it('finds edited, new and removed paragraphs', () => {
    const after = `# Pricing

The Pro plan costs $12 a month and includes 5 seats.

Contact sales for Enterprise.

A new Team plan starts at $30 a month.`;
    const c = compareSources(before, after);
    expect(c.changed).toHaveLength(1);
    expect(c.changed[0]!.before).toContain('$10');
    expect(c.changed[0]!.after).toContain('$12');
    expect(c.added).toEqual(['A new Team plan starts at $30 a month.']);
    expect(c.removed).toEqual(['Annual billing saves 20%.']);
  });

  it('sees no change when only spacing or link targets moved', () => {
    const after = before.replace('Contact sales', 'Contact  [sales](https://new.link)').replace(/\n\n/g, '\n\n\n');
    expect(hasChanges(compareSources(before, after))).toBe(false);
  });

  it('reports a rewritten paragraph as removed and added', () => {
    const c = compareSources('Old text about cats and dogs.', 'Completely different sentence here now.');
    expect(c.changed).toEqual([]);
    expect(c.removed).toEqual(['Old text about cats and dogs.']);
    expect(c.added).toEqual(['Completely different sentence here now.']);
  });
});
