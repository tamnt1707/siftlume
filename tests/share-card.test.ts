import { describe, expect, it } from 'vitest';
import { shareContent, wrapText } from '@/lib/share-card';
import { CHART_SUMMARY_EXAMPLE } from '@/lib/chart-example';

describe('shareContent', () => {
  it('takes the title, TL;DR and up to three key figures', () => {
    const c = shareContent(CHART_SUMMARY_EXAMPLE, { title: 'Acme', origin: 'https://www.acme.test/q3' })!;
    expect(c.title).toBe('Acme Q3 earnings');
    expect(c.tldr).toBe('Cloud drove 18% revenue growth while hardware kept shrinking.');
    expect(c.source).toBe('acme.test');
    expect(c.figures).toEqual([
      { value: '$4.2B', label: 'revenue', change: '+18%' },
      { value: '31%', label: 'operating margin', change: undefined },
      { value: '1.2M', label: 'active customers', change: '+9%' },
    ]);
    expect(c.points).toEqual([]);
  });

  it('uses takeaways when there are not enough figures', () => {
    const program = `root = Card([hero, numbers, tk])
hero = SummaryHero("Title", "The short version.", "Example News", 4)
numbers = KeyNumbers([KeyNumber("5%", "growth")])
tk = Takeaways([Takeaway("First point"), Takeaway("Second point"), Takeaway("Third"), Takeaway("Fourth")])`;
    const c = shareContent(program, { title: 'Pasted text', origin: 'text' })!;
    expect(c.figures).toEqual([]);
    expect(c.points).toEqual(['First point', 'Second point', 'Third']);
    expect(c.source).toBe('Example News');
    expect(c.readMinutes).toBe(4);
  });

  it('gives nothing without a TL;DR', () => {
    expect(shareContent('root = Card([TextContent("Just text")])')).toBeNull();
    expect(shareContent('')).toBeNull();
  });
});

describe('wrapText', () => {
  // One unit per character: easy widths to reason about.
  const measure = (s: string) => Array.from(s).length;

  it('breaks at spaces', () => {
    expect(wrapText(measure, 'one two three four', 9, 3)).toEqual(['one two', 'three', 'four']);
  });

  it('ends the last line with an ellipsis when text is left', () => {
    expect(wrapText(measure, 'one two three four five', 9, 2)).toEqual(['one two', 'three…']);
  });

  it('breaks text without spaces anywhere', () => {
    expect(wrapText(measure, '量子计算机的发展速度', 4, 3)).toEqual(['量子计算', '机的发展', '速度']);
  });

  it('keeps a short text as one line', () => {
    expect(wrapText(measure, '  short  ', 20, 2)).toEqual(['short']);
  });
});
