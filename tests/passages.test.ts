import { describe, expect, it } from 'vitest';
import { CHART_SUMMARY_EXAMPLE } from '@/lib/chart-example';
import { summaryPassages } from '@/lib/passages';

// The text the chart example's quotes come from.
const SOURCE = `Acme reported results. Revenue reached $4.2B in the third quarter, up 18% from a year earlier.
The operating margin improved to 31%. We now serve 1.2M active customers.
Fourth-quarter revenue of $3.4B, then first-quarter revenue rose to $3.6B and second-quarter revenue of $3.9B.
Cloud made up 58% of revenue, software contributed 27% and hardware fell to 15% of the total.
Sales in Asia grew 26%, Europe was up 15% and the Americas added 11%.`;

describe('summaryPassages', () => {
  it('collects the quotes of every block, derived inputs included, in reading order', () => {
    const passages = summaryPassages(CHART_SUMMARY_EXAMPLE, SOURCE);
    expect(passages[0]).toBe('Revenue reached $4.2B in the third quarter, up 18% from a year earlier');
    expect(passages).toContain('fourth-quarter revenue of $3.4B'); // an input of the derived figure
    expect(passages).toContain('cloud made up 58% of revenue');
    expect(passages).toContain('the Americas added 11%');
  });

  it('keeps each passage once', () => {
    const passages = summaryPassages(CHART_SUMMARY_EXAMPLE, SOURCE);
    expect(new Set(passages.map((p) => p.toLowerCase())).size).toBe(passages.length);
  });

  it('leaves out passages that are not in the source word for word', () => {
    const program = `root = Card([n])
n = KeyNumbers([a, b])
a = KeyNumber("31%", "margin", null, "operating margin improved to 31%")
b = KeyNumber("40%", "margin", null, "operating margin jumped to a record 40%")`;
    expect(summaryPassages(program, SOURCE)).toEqual(['operating margin improved to 31%']);
  });

  it('has nothing to mark in a summary without quotes, or one that does not parse', () => {
    expect(summaryPassages('root = Card([t])\nt = TextContent("Hello")', SOURCE)).toEqual([]);
    expect(summaryPassages('not a program at all (((', SOURCE)).toEqual([]);
  });
});
