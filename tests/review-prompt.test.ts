import { describe, expect, it } from 'vitest';
import { ASK_AGAIN_AFTER, FIRST_ASK, INITIAL, counted, finished, later, shouldAsk } from '@/lib/review-prompt';

const after = (n: number, s = INITIAL) => Array.from({ length: n }).reduce<typeof s>((acc) => counted(acc), s);

describe('review prompt', () => {
  it('asks only after the first few summaries', () => {
    expect(shouldAsk(after(FIRST_ASK - 1))).toBe(false);
    expect(shouldAsk(after(FIRST_ASK))).toBe(true);
    expect(shouldAsk(after(FIRST_ASK + 3))).toBe(true);
  });

  it('"Later" waits for more summaries, counted from now', () => {
    const asked = after(FIRST_ASK + 2);
    const waiting = later(asked);
    expect(shouldAsk(waiting)).toBe(false);
    expect(shouldAsk(after(ASK_AGAIN_AFTER - 1, waiting))).toBe(false);
    expect(shouldAsk(after(ASK_AGAIN_AFTER, waiting))).toBe(true);
  });

  it('never asks again once reviewed or declined', () => {
    expect(shouldAsk(after(100, finished(after(FIRST_ASK))))).toBe(false);
  });
});
