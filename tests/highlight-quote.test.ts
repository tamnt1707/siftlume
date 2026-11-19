// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { highlightQuote } from '@/lib/highlight-quote';

// jsdom does no layout: give every element and range a place on screen.
const rect = { top: 100, bottom: 120, left: 0, right: 100, height: 20, width: 100, x: 0, y: 100 } as DOMRect;
Element.prototype.scrollIntoView = vi.fn();
Range.prototype.getBoundingClientRect = () => rect;

const selected = () => getSelection()?.toString() ?? '';

describe('highlightQuote (selection fallback)', () => {
  beforeEach(() => {
    document.body.innerHTML = `
      <script>var hidden = "Employers added 186,000 jobs";</script>
      <article>
        <h1>Jobs report</h1>
        <p>Employers <b>added 186,000</b> jobs in <a href="#">December</a>, beating “forecasts” – again.</p>
        <p hidden>Secret paragraph about revenue growth</p>
        <p>The   unemployment
           rate held at 4.1%.</p>
      </article>`;
    getSelection()?.removeAllRanges();
  });

  it('marks exactly the passage, across bold text and links', () => {
    expect(highlightQuote('Employers added 186,000 jobs in December')).toBe(true);
    expect(selected()).toBe('Employers added 186,000 jobs in December');
  });

  it('matches straight quotes and dashes against curly ones', () => {
    expect(highlightQuote('beating "forecasts" - again')).toBe(true);
    expect(selected()).toBe('beating “forecasts” – again');
  });

  it('ignores case and extra whitespace', () => {
    expect(highlightQuote('the unemployment rate HELD at 4.1%')).toBe(true);
    expect(selected().replace(/\s+/g, ' ')).toBe('The unemployment rate held at 4.1%');
  });

  it('falls back to the first words when the end was paraphrased', () => {
    expect(highlightQuote('Employers added 186,000 jobs in December, far above what anyone expected')).toBe(true);
    expect(selected()).toBe('Employers added 186,000 jobs in December,');
  });

  it('skips scripts and hidden text', () => {
    expect(highlightQuote('Secret paragraph about revenue growth')).toBe(false);
    const article = document.querySelector('article')!;
    expect(highlightQuote('Employers added 186,000 jobs')).toBe(true);
    expect(article.contains(getSelection()!.anchorNode)).toBe(true);
  });

  it('scrolls the passage into view', () => {
    highlightQuote('rate held at 4.1%');
    expect(Element.prototype.scrollIntoView).toHaveBeenCalledWith({ block: 'center' });
  });
});

describe('highlightQuote (CSS Custom Highlight API)', () => {
  const registry = new Map<string, unknown>();
  class FakeHighlight {
    ranges: Range[];
    constructor(...ranges: Range[]) {
      this.ranges = ranges;
    }
  }

  beforeEach(() => {
    vi.useFakeTimers();
    registry.clear();
    vi.stubGlobal('CSS', { highlights: registry });
    vi.stubGlobal('Highlight', FakeHighlight);
    document.head.innerHTML = '';
    document.body.innerHTML = '<p>Revenue reached <em>$4.2B</em> in the third quarter.</p>';
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('highlights only the passage, without touching the page', () => {
    const before = document.body.innerHTML;
    expect(highlightQuote('reached $4.2B in the third')).toBe(true);
    const highlight = registry.get('siftlume-quote') as FakeHighlight;
    expect(highlight.ranges[0]!.toString()).toBe('reached $4.2B in the third');
    expect(document.body.innerHTML).toBe(before);
    expect(document.getElementById('siftlume-quote')?.textContent).toContain('::highlight(siftlume-quote)');
  });

  it('clears the highlight after a few seconds', () => {
    highlightQuote('Revenue reached $4.2B');
    expect(registry.has('siftlume-quote')).toBe(true);
    vi.advanceTimersByTime(8000);
    expect(registry.has('siftlume-quote')).toBe(false);
  });
});
