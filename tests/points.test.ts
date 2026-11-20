import { describe, expect, it } from 'vitest';
import { parseProgram, programNodes } from '@/lib/markdown';
import { CRITIQUE_EXAMPLE } from '@/lib/mode-example';
import { VISUAL_SUMMARY_EXAMPLE } from '@/lib/summary-example';

/** The props of every block of one type in a program. */
const propsOf = (program: string, type: string) =>
  [...programNodes(parseProgram(program))].filter((n) => n.typeName === type).map((n) => n.props ?? {});

describe('points carry the passage they come from', () => {
  it('reads a takeaway quote after its detail, with or without a detail', () => {
    const [t1, t2, t3] = propsOf(VISUAL_SUMMARY_EXAMPLE, 'Takeaway');
    expect(t1).toMatchObject({
      detail: 'Local brands dominate on price',
      quote: expect.stringContaining('six in every ten'),
    });
    expect(t2?.quote).toContain('level with comparable petrol cars');
    expect(t2?.detail ?? null).toBeNull();
    expect(t3?.quote).toBeUndefined();
  });

  it('reads the quote of timeline events, claims and arguments', () => {
    expect(propsOf(VISUAL_SUMMARY_EXAMPLE, 'TimelineEvent')[0]?.quote).toBe('a price war began in China in 2023');
    const claims = propsOf(CRITIQUE_EXAMPLE, 'Claim');
    expect(claims[0]).toMatchObject({ status: 'supported', quote: expect.stringContaining('300 firms') });
    expect(propsOf(CRITIQUE_EXAMPLE, 'Argument')[0]).toMatchObject({
      stance: 'for',
      quote: expect.stringContaining('fewer patents'),
    });
  });
});
