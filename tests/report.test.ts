import { describe, expect, it } from 'vitest';
import { blocksUsed, browserName, ISSUES_URL, reportUrl } from '@/lib/report';
import { CHART_SUMMARY_EXAMPLE } from '@/lib/chart-example';

const INFO = {
  version: '0.7.1',
  kind: 'webpage',
  mode: 'summary',
  custom: false,
  length: 'medium',
  language: 'auto',
  provider: 'anthropic',
  model: 'claude-haiku-5-5',
  program: CHART_SUMMARY_EXAMPLE,
  userAgent: 'Mozilla/5.0 (Macintosh) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36',
};

describe('blocksUsed', () => {
  it('lists each block once, in order', () => {
    const blocks = blocksUsed(CHART_SUMMARY_EXAMPLE);
    expect(blocks.slice(0, 4)).toEqual(['Card', 'SummaryHero', 'KeyNumbers', 'KeyNumber']);
    expect(blocks).toContain('LineChart');
    expect(new Set(blocks).size).toBe(blocks.length);
  });

  it('is empty for a program that does not parse', () => {
    expect(blocksUsed('not a program')).toEqual([]);
  });
});

describe('browserName', () => {
  it.each([
    [INFO.userAgent, 'Chrome 142'],
    ['Mozilla/5.0 Chrome/141.0 Safari/537.36 Edg/141.0.1', 'Edge 141'],
    ['Mozilla/5.0 (Macintosh) Version/19.1 Safari/605.1.15', 'Safari 19'],
  ])('%s', (ua, want) => expect(browserName(ua)).toBe(want));
});

describe('reportUrl', () => {
  const url = new URL(reportUrl(INFO));
  const body = url.searchParams.get('body')!;

  it('opens a new issue with a title and the layout label', () => {
    expect(`${url.origin}${url.pathname}`).toBe(ISSUES_URL);
    expect(url.searchParams.get('title')).toBe('Layout: webpage, summary');
    expect(url.searchParams.get('labels')).toBe('layout');
  });

  it('fills in what shaped the layout', () => {
    expect(body).toContain('- Siftlume: 0.7.1');
    expect(body).toContain('- Analysis: summary, medium, language auto');
    expect(body).toContain('- Model: anthropic / claude-haiku-5-5');
    expect(body).toMatch(/- Blocks: Card, SummaryHero, KeyNumbers/);
    expect(body).toContain('- Browser: Chrome 142');
  });

  it('leaves out the page content', () => {
    expect(body).not.toContain('Acme');
    expect(body).not.toContain('$4.2B');
  });

  it('names a custom mode by the one it builds on only', () => {
    const custom = new URL(reportUrl({ ...INFO, custom: true, mode: 'action' }));
    expect(custom.searchParams.get('title')).toBe('Layout: webpage, custom mode based on action');
  });
});
