import { describe, expect, it } from 'vitest';
import { documentName, sourceDocuments } from '@/lib/documents';
import { sideCheck } from '@/lib/genui/consensus';
import { parseProgram, programNodes, programToMarkdown } from '@/lib/markdown';
import { summaryPassages } from '@/lib/passages';
import { SOURCES_COMPARED_EXAMPLE } from '@/lib/analysis-example';

/** Three tabs combined the way lib/multi.ts does it. */
const doc = (i: number, title: string, url: string, body: string) =>
  `<document index="${i}" title="${title}" url="${url}" type="webpage">\n${body}\n</document>`;
const CONTENT = [
  doc(
    1,
    'Council approves $9 congestion charge',
    'https://www.citydaily.example/charge',
    'From March, drivers will pay $9 a day to enter downtown from March 1. Officials project a 15 percent drop in rush-hour traffic. Residents with a permit get a 90 percent discount.',
  ),
  doc(
    2,
    'Retailers brace for the downtown fee',
    'https://retailnews.example/fee',
    'The council set a $9 daily fee on cars entering the downtown zone starting in March. Store owners warn that shoppers will simply drive to the malls outside the zone.',
  ),
  doc(
    3,
    'Will the charge cut traffic?',
    '',
    'After the $9 congestion fee approved on Friday, independent analysts say the drop is unlikely to exceed 5 percent.',
  ),
].join('\n\n');

const propsOf = (type: string) =>
  [...programNodes(parseProgram(SOURCES_COMPARED_EXAMPLE))].filter((n) => n.typeName === type).map((n) => n.props ?? {});

describe('what the sources say', () => {
  it('names each document by its site, or its title without an address', () => {
    const docs = sourceDocuments(CONTENT);
    expect(docs.map((d) => d.index)).toEqual([1, 2, 3]);
    expect(docs.map(documentName)).toEqual(['citydaily.example', 'retailnews.example', 'Will the charge cut traffic?']);
    expect(sourceDocuments('A single page, no documents.')).toEqual([]);
  });

  it('checks a side’s passage against its own document', () => {
    const quote = 'officials project a 15 percent drop in rush-hour traffic';
    expect(sideCheck(CONTENT, 1, quote)).toBe('ok');
    // Real, but from another outlet: flagged, not shown as this one's.
    expect(sideCheck(CONTENT, 3, quote)).toBe('elsewhere');
    expect(sideCheck(CONTENT, 2, 'the fee will be scrapped before the election')).toBe('other');
  });

  it('reads the example: verdicts, document numbers and quotes', () => {
    expect(propsOf('SourcePoint').map((p) => p.verdict)).toEqual(['agree', 'differ', 'only', 'only']);
    const sides = propsOf('SourceSide');
    expect(sides[0]).toMatchObject({ source: 1, quote: expect.stringContaining('$9 a day') });
    expect(sides.map((s) => s.source)).toEqual([1, 2, 3, 1, 3, 2, 1]);
    for (const s of sides) expect(sideCheck(CONTENT, s.source as number, s.quote as string)).toBe('ok');
  });

  it('marks every side on the page and exports them as Markdown', () => {
    expect(summaryPassages(SOURCES_COMPARED_EXAMPLE, CONTENT)).toHaveLength(7);
    const md = programToMarkdown(SOURCES_COMPARED_EXAMPLE);
    expect(md).toContain('- **Differ**: How much traffic falls');
    expect(md).toContain('  - [3] Analysts expect 5% at most');
  });
});
