import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { amountOf, derivation, figureCheck, figuresInPassage } from '@/lib/derived';

const SOURCE = `Fourth-quarter revenue of $3.4B was followed by first-quarter revenue of $3.6B.
Revenue reached $4.2B in the third quarter, up 18% from a year earlier.
Cloud made up 58% of revenue and software contributed 27% of the total.
Doanh thu quý 3 đạt 186.000 tỷ đồng, quý 2 đạt 150.000 tỷ đồng.
The company employs 1,250 engineers and 750 people in sales.`;

describe('amountOf', () => {
  it.each([
    ['$4.2B', [4.2e9]],
    ['18%', [18]],
    ['-12%', [-12]],
    ['+$0.8B', [0.8e9]],
    ['1.2 million', [1.2e6]],
    ['186 nghìn', [186e3]],
    ['3 tỷ', [3e9]],
    ['5万', [5e4]],
    ['1.234,5', [1234.5]],
  ])('%s', (value, want) => {
    expect(amountOf(value)!.values).toEqual(want);
  });

  it('reads one mark before three digits both ways', () => {
    expect(amountOf('186.000')!.values).toEqual([186000, 186]);
    expect(amountOf('1,250')!.values).toEqual([1250, 1.25]);
  });

  it('does not read a word starting with a scale letter as a scale', () => {
    expect(amountOf('5 months')!.values).toEqual([5]);
    expect(amountOf('12 more')!.values).toEqual([12]);
  });

  it('marks percentages', () => {
    expect(amountOf('35%')!.percent).toBe(true);
    expect(amountOf('35 percent')!.percent).toBe(true);
    expect(amountOf('$35')!.percent).toBe(false);
  });

  it('has no amount without digits', () => {
    expect(amountOf('most')).toBeNull();
  });
});

describe('derivation', () => {
  it('finds a sum, a difference and an average', () => {
    expect(derivation('2,000', ['1,250', '750'])).toBe('sum');
    expect(derivation('$0.8B', ['$3.4B', '$4.2B'])).toBe('difference');
    expect(derivation('$800M', ['$3.4B', '$4.2B'])).toBe('difference');
    expect(derivation('1,000', ['1,250', '750'])).toBe('average');
  });

  it('finds a percentage change, either way round and with the sign left out', () => {
    expect(derivation('+23.5%', ['$3.4B', '$4.2B'])).toBe('change');
    expect(derivation('19%', ['$4.2B', '$3.4B'])).toBe('change');
  });

  it('finds a share and percentage points', () => {
    expect(derivation('60%', ['750', '1,250'])).toBe('share');
    expect(derivation('85%', ['58%', '27%'])).toBe('sum');
    expect(derivation('31 points', ['58%', '27%'])).toBeNull();
  });

  it('accepts a rounded figure', () => {
    expect(derivation('4.2M', ['4,213,000'])).toBe('rounded');
    expect(derivation('4.3M', ['4,213,000'])).toBeNull();
    expect(derivation('5', ['4.6'])).toBe('rounded');
  });

  it('reads Vietnamese thousands separators', () => {
    expect(derivation('336.000 tỷ', ['186.000 tỷ', '150.000 tỷ'])).toBe('sum');
  });

  it('rejects a figure that does not follow', () => {
    expect(derivation('$1B', ['$3.4B', '$4.2B'])).toBeNull();
    expect(derivation('40%', ['$3.4B', '$4.2B'])).toBeNull();
  });

  it('does not add amounts into a percentage', () => {
    expect(derivation('2%', ['1', '1'])).toBeNull();
  });

  it('needs inputs it can read', () => {
    expect(derivation('5', [])).toBeNull();
    expect(derivation('5', ['two', '3'])).toBeNull();
    expect(derivation('many', ['2', '3'])).toBeNull();
  });
});

describe('figureCheck', () => {
  const q4 = { label: 'Q4', value: '$3.4B', quote: 'Fourth-quarter revenue of $3.4B was followed' };
  const q3 = { label: 'Q3', value: '$4.2B', quote: 'Revenue reached $4.2B in the third quarter' };

  it('keeps a figure with its own passage as ok', () => {
    expect(figureCheck(SOURCE, 'Revenue reached $4.2B in the third quarter', '$4.2B', [q4])).toEqual({ status: 'ok' });
  });

  it('marks a figure worked out from quoted inputs as derived', () => {
    expect(figureCheck(SOURCE, null, '+$0.8B', [q4, q3])).toEqual({
      status: 'derived',
      op: 'difference',
      inputs: [q4, q3],
    });
  });

  it('is not derived when the arithmetic does not hold', () => {
    expect(figureCheck(SOURCE, null, '$1.2B', [q4, q3])).toEqual({ status: 'mismatch' });
  });

  it('is not derived when an input is not in the source', () => {
    const made = { value: '$3.0B', quote: 'Fourth-quarter revenue of $3.0B was followed' };
    expect(figureCheck(SOURCE, null, '$1.2B', [made, q3])).toEqual({ status: 'badInput' });
    expect(figureCheck(SOURCE, null, '$1.2B', [{ value: '$3.0B' }, q3])).toEqual({ status: 'badInput' });
  });

  it('keeps the plain reason without inputs', () => {
    expect(figureCheck(SOURCE, null, '$0.8B')).toEqual({ status: 'noQuote' });
    expect(figureCheck(SOURCE, null, '$0.8B', [])).toEqual({ status: 'noQuote' });
  });
});

describe('figures worked out from their own passage', () => {
  const src = 'Doanh thu quý 3 đạt 1.510 tỷ đồng. Doanh thu quý 4 đạt 1.870 tỷ đồng nhờ mùa mua sắm cuối năm.';

  it('lists the figures of a passage, without years', () => {
    expect(figuresInPassage('Công ty có 3.200 nhân viên vào cuối năm 2025, so với 2.800 nhân viên')).toEqual([
      '3.200',
      '2.800',
    ]);
    expect(figuresInPassage('quý 3 đạt 1.510 tỷ đồng')).toEqual(['3', '1.510 tỷ']);
  });

  it('derives a figure from two figures in a passage that does not show it', () => {
    const quote = 'Doanh thu quý 3 đạt 1.510 tỷ đồng. Doanh thu quý 4 đạt 1.870 tỷ đồng';
    expect(figureCheck(src, quote, '+23,8%')).toEqual({
      status: 'derived',
      op: 'change',
      inputs: [
        { value: '1.510 tỷ', quote },
        { value: '1.870 tỷ', quote },
      ],
    });
    expect(figureCheck(src, quote, '360 tỷ')).toMatchObject({ status: 'derived', op: 'difference' });
  });

  it('stays unverified when nothing in the passage gives it', () => {
    const quote = 'Doanh thu quý 3 đạt 1.510 tỷ đồng. Doanh thu quý 4 đạt 1.870 tỷ đồng';
    expect(figureCheck(src, quote, '50%')).toEqual({ status: 'noFigure' });
  });
});

describe('figures the model gave no passage for', () => {
  const wiki = `This list comprises the world's largest companies by [consolidated revenue](https://en.wikipedia.org/wiki/Revenue), according to the 2026 *Fortune* Global 500 ranking, which covers fiscal years ending on or before 31 March 2026.[[2]](#cite_note-2) Among the 50 largest companies, 26 are in the [United States](https://x.y/US), 17 are in [Asia](https://x.y/Asia), and 7 are in [Europe](https://x.y/EU).[[2]](#cite_note-2)

| Rank | Name | Revenue (USD millions) |
| --- | --- | --- |
| 17 | Toyota | 312,018 |
| 26 | Cardinal Health | 226,827 |`;

  it('finds a figure written once in running text, not in the table or in a year', () => {
    const us = figureCheck(wiki, null, '26');
    expect(us.status).toBe('ok');
    expect(us.quote).toContain('26 are in the United States');
    expect(figureCheck(wiki, null, '17').quote).toContain('17 are in Asia');
  });

  it('also when the model passage is wrong', () => {
    expect(figureCheck(wiki, 'twenty-six companies are American ones', '26').status).toBe('ok');
  });

  it('leaves a figure written more than once, or not at all', () => {
    expect(figureCheck(`${wiki}\nAnother 26 firms were left out.`, null, '26')).toEqual({ status: 'noQuote' });
    expect(figureCheck(wiki, null, '26%')).toEqual({ status: 'noQuote' });
    expect(figureCheck(wiki, null, '99')).toEqual({ status: 'noQuote' });
  });
});

// The Markdown Siftlume made from the Wikipedia page (2026-11-20), references and all: footnote
// links with escaped brackets, link titles with parentheses, numbered references and their dates.
describe('figures found on a real page', () => {
  const page = readFileSync(new URL('./fixtures/wikipedia-largest-companies.md', import.meta.url), 'utf8');

  it.each([
    ['26', '26 are in the United States'],
    ['17', '17 are in Asia'],
    ['7', '7 are in Europe'],
  ])('%s', (value, passage) => {
    const check = figureCheck(page, null, value);
    expect(check.status).toBe('ok');
    expect(check.quote).toContain(passage);
  });

  it('leaves a figure written in several places', () => {
    expect(figureCheck(page, null, '50').status).toBe('noQuote');
  });
});

// The Markdown Siftlume made from browserpod.io/blog/browserpod-40 (2026-11-20).
describe('figures the source says in words', () => {
  const page = readFileSync(new URL('./fixtures/browserpod-40.md', import.meta.url), 'utf8');

  it.each([
    ['0', 'No usage limit, no fee, nothing metered.'],
    ['0', 'No account, no key, no call-home.'],
    ['0', 'a private, isolated, zero-cost microVM that runs on their own device'],
    ['$0', 'you can now use it as a library completely for free'],
  ])('%s from "%s"', (value, quote) => {
    expect(figureCheck(page, quote, value)).toEqual({ status: 'inferred', quote });
  });

  it('reads small numbers spelled out', () => {
    const src = 'The release adds twelve new built-in programs and a dozen fixes.';
    expect(figureCheck(src, 'The release adds twelve new built-in programs', '12').status).toBe('inferred');
    expect(figureCheck(src, 'The release adds twelve new built-in programs', '11').status).toBe('noFigure');
  });

  it('needs the words to say it', () => {
    expect(figureCheck(page, 'BrowserPod Pro is now Edge Pro, at the same price', '0').status).toBe('noFigure');
    expect(figureCheck(page, 'No usage limit, no fee, nothing metered.', '5').status).toBe('noFigure');
    expect(figureCheck(page, 'No usage limit, no fee, nothing metered.', '0%').status).toBe('noFigure');
  });

  it('needs the passage to be in the source', () => {
    expect(figureCheck(page, 'There is no fee of any kind at all', '0').status).toBe('notFound');
  });
});
