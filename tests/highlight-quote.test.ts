// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { clearHighlights, highlightQuote } from '@/lib/highlight-quote';

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
    expect(highlightQuote('Employers added 186,000 jobs in December')).toBe(1);
    expect(selected()).toBe('Employers added 186,000 jobs in December');
  });

  it('matches straight quotes and dashes against curly ones', () => {
    expect(highlightQuote('beating "forecasts" - again')).toBe(1);
    expect(selected()).toBe('beating “forecasts” – again');
  });

  it('ignores case and extra whitespace', () => {
    expect(highlightQuote('the unemployment rate HELD at 4.1%')).toBe(1);
    expect(selected().replace(/\s+/g, ' ')).toBe('The unemployment rate held at 4.1%');
  });

  it('falls back to the first words when the end was paraphrased', () => {
    expect(highlightQuote('Employers added 186,000 jobs in December, far above what anyone expected')).toBe(1);
    expect(selected()).toBe('Employers added 186,000 jobs in December,');
  });

  it('skips scripts and hidden text', () => {
    expect(highlightQuote('Secret paragraph about revenue growth')).toBe(0);
    const article = document.querySelector('article')!;
    expect(highlightQuote('Employers added 186,000 jobs')).toBe(1);
    expect(article.contains(getSelection()!.anchorNode)).toBe(true);
  });

  it('searches only inside the given root, without the page find fallback', () => {
    document.body.innerHTML = `
      <section class="summary"><blockquote>Revenue reached $4.2B in the quarter</blockquote></section>
      <section class="source-text"><pre>Intro.\nRevenue reached $4.2B in the quarter, a record.</pre></section>`;
    const find = vi.fn(() => true);
    vi.stubGlobal('find', find);
    const source = document.querySelector('.source-text')!;
    expect(highlightQuote('Revenue reached $4.2B in the quarter', source)).toBe(1);
    expect(source.contains(getSelection()!.anchorNode)).toBe(true);
    expect(highlightQuote('A passage that is nowhere at all', source)).toBe(0);
    expect(find).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
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
    expect(highlightQuote('reached $4.2B in the third')).toBe(1);
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

  it("marks several passages at once, in the reader's colour, until cleared", () => {
    document.body.innerHTML =
      '<p>Revenue reached <em>$4.2B</em> in the third quarter.</p><p>Cloud made up 58% of revenue.</p>';
    expect(
      highlightQuote(['Revenue reached $4.2B in the third', 'Cloud made up 58%', 'not in the page'], null, '#ffe45c'),
    ).toBe(2);
    const all = registry.get('siftlume-passages') as FakeHighlight;
    expect(all.ranges.map(String)).toEqual(['Revenue reached $4.2B in the third', 'Cloud made up 58%']);
    expect(document.getElementById('siftlume-quote')?.textContent).toContain(
      '::highlight(siftlume-passages){background-color:#ffe45c',
    );
    vi.advanceTimersByTime(60_000);
    expect(registry.has('siftlume-passages')).toBe(true);
    clearHighlights();
    expect(registry.has('siftlume-passages')).toBe(false);
  });

  it("keeps an unsafe colour out of the page's CSS", () => {
    highlightQuote(['Revenue reached $4.2B'], null, 'red;}body{display:none');
    expect(document.getElementById('siftlume-quote')?.textContent).not.toContain('display:none');
  });

  it("finds none of several passages without falling back to the browser's find", () => {
    expect(highlightQuote(['nothing like this', 'nor this'])).toBe(0);
    expect(registry.has('siftlume-passages')).toBe(false);
  });
});
