import { describe, expect, it } from 'vitest';
import { markdownToSpeech, programToMarkdown } from '@/lib/markdown';
import { CHART_SUMMARY_EXAMPLE } from '@/lib/chart-example';
import { DIAGRAM_SUMMARY_EXAMPLE } from '@/lib/diagram-example';
import { matchLanguage } from '@/lib/i18n';

// The text a reader gets from "Show as text", Copy and Download.
describe('programToMarkdown', () => {
  const md = programToMarkdown(CHART_SUMMARY_EXAMPLE);

  it('starts with the title and the TL;DR', () => {
    expect(md.startsWith('# Acme Q3 earnings')).toBe(true);
    expect(md).toContain('> **TL;DR** Cloud drove 18% revenue growth');
  });

  it('lists key figures with their change', () => {
    expect(md).toContain('- **$4.2B** revenue (+18%)');
    expect(md).toContain('- **31%** operating margin');
  });

  it('turns charts into tables, one column per series', () => {
    expect(md).toContain('|  | Revenue ($B) |');
    expect(md).toContain('| Q3 25 | 4.2 |');
    expect(md).toContain('| Cloud | 58 |');
  });

  it('keeps each charted value with its source passage', () => {
    expect(md).toContain('| Q3 25 | $4.2B | “Revenue reached $4.2B in the third quarter” |');
  });

  it('leaves out follow-up questions and OpenUI syntax', () => {
    expect(md).not.toContain('Why is hardware shrinking?');
    expect(md).not.toMatch(/\w+ = [A-Z]\w*\(/);
  });

  it('keeps diagrams as Mermaid', () => {
    expect(programToMarkdown(DIAGRAM_SUMMARY_EXAMPLE)).toMatch(/```mermaid\n(flowchart|graph|sequenceDiagram)/);
  });

  it('links the source page at the end', () => {
    const withSource = programToMarkdown(CHART_SUMMARY_EXAMPLE, { title: 'Acme', origin: 'https://acme.test/q3' });
    expect(withSource.trimEnd()).toMatch(/\[Acme\]\(https:\/\/acme\.test\/q3\)$/);
  });

  it('escapes pipes inside table cells', () => {
    const program = `root = Card([bars])
bars = BarList([BarItem("Pro | Team", 12, "12 seats")], "Plans")`;
    expect(programToMarkdown(program)).toContain('| Pro \\| Team | 12 seats |');
  });

  it('returns nothing for an empty program', () => {
    expect(programToMarkdown('').trim()).toBe('');
  });
});

describe('markdownToSpeech', () => {
  it('reads text, not tables, code or link targets', () => {
    const speech = markdownToSpeech(
      '# Title\n\n| a | b |\n|---|---|\n\nSee [the report](https://x.y).\n\n```mermaid\nA-->B\n```',
    );
    expect(speech).toBe('Title.\nSee the report.');
  });

  it('ends each paragraph with one stop', () => {
    expect(markdownToSpeech('Is it done?\n\nYes.\n\nShip it')).toBe('Is it done?\nYes.\nShip it');
  });
});

describe('matchLanguage', () => {
  it.each([
    ['vi-VN', 'vi'],
    ['zh-HK', 'zh-TW'],
    ['zh-Hant', 'zh-TW'],
    ['zh', 'zh-CN'],
    ['pt-PT', 'pt-BR'],
    ['en_US', 'en'],
    ['sw', null],
    [undefined, null],
  ])('%s → %s', (tag, want) => {
    expect(matchLanguage(tag)).toBe(want);
  });
});
