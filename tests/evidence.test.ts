import { describe, expect, it } from 'vitest';
import { checkEvidence, digitCore, figureRange, normalizeText } from '@/lib/evidence';

const SOURCE = `Employers added **186,000** jobs in [December](https://bls.gov/x), up from +133,000.
Revenue reached $4.2B in the third quarter, up 18% from a year earlier.
Unemployment was 1% in the region and 10% nationwide.
“Cloud” made up 58% of revenue — the rest came from hardware.
Lượng việc làm tăng thêm 186 nghìn trong tháng 12.
[01:23] we now serve 1.2 million active customers`;

describe('normalizeText', () => {
  it('drops Markdown, timestamps and typographic quotes', () => {
    expect(normalizeText('**Bold** [link](https://x.y) “quoted” — [01:23]  Text')).toBe('bold link "quoted" - text');
  });
});

describe('digitCore', () => {
  it.each([
    ['$4.2B', '42'],
    ['+186.000', '186000'],
    ['186,000', '186000'],
    ['186 000', '186000'],
    ['31%', '31'],
    ['no digits', null],
  ])('%s → %s', (value, want) => {
    expect(digitCore(value)).toBe(want);
  });
});

describe('checkEvidence', () => {
  it('accepts a verbatim passage that contains the figure', () => {
    expect(checkEvidence(SOURCE, 'Revenue reached $4.2B in the third quarter', '$4.2B')).toBe(true);
  });

  it('ignores Markdown and quote style in the source', () => {
    expect(checkEvidence(SOURCE, 'Employers added 186,000 jobs in December', '186,000')).toBe(true);
    expect(checkEvidence(SOURCE, '"Cloud" made up 58% of revenue', '58%')).toBe(true);
  });

  it('matches figures written with other separators (Vietnamese, German)', () => {
    expect(checkEvidence(SOURCE, 'Employers added 186,000 jobs', '+186.000')).toBe(true);
    expect(checkEvidence(SOURCE, 'Employers added 186,000 jobs', '186 000')).toBe(true);
  });

  it('matches a scale written as a word or suffix on either side', () => {
    expect(checkEvidence(SOURCE, 'Employers added 186,000 jobs', '186K')).toBe(true);
    expect(checkEvidence(SOURCE, 'việc làm tăng thêm 186 nghìn', '186,000')).toBe(true);
    expect(checkEvidence(SOURCE, 'we now serve 1.2 million active customers', '1.2M')).toBe(true);
  });

  it('rejects a passage that is not in the source', () => {
    expect(checkEvidence(SOURCE, 'Revenue reached $5B in the third quarter', '$5B')).toBe(false);
  });

  it('rejects a passage without the figure', () => {
    expect(checkEvidence(SOURCE, 'Revenue reached $4.2B in the third quarter', '18%')).toBe(false);
  });

  it('does not treat 1% and 10% as the same figure', () => {
    expect(checkEvidence(SOURCE, 'Unemployment was 1% in the region', '10%')).toBe(false);
    expect(checkEvidence(SOURCE, 'and 10% nationwide', '1%')).toBe(false);
    expect(checkEvidence(SOURCE, 'Unemployment was 1% in the region', '1%')).toBe(true);
  });

  it('does not stretch 186 into 1,860,000 without a scale word', () => {
    expect(checkEvidence('They counted 1,860,000 votes in total', 'counted 1,860,000 votes', '186')).toBe(false);
  });

  it('lets a bare chart number stand for a scaled figure', () => {
    expect(checkEvidence(SOURCE, 'Employers added 186,000 jobs', 186)).toBe(true);
    expect(checkEvidence(SOURCE, 'Unemployment was 1% in the region', 1)).toBe(true);
  });

  it('rejects quotes too short to prove anything', () => {
    expect(checkEvidence(SOURCE, '186,000 jobs', '186,000')).toBe(false);
    expect(checkEvidence(SOURCE, '', '186,000')).toBe(false);
    expect(checkEvidence(SOURCE, null, '186,000')).toBe(false);
  });

  it('accepts a passage alone when the value has no digits', () => {
    expect(checkEvidence(SOURCE, 'the rest came from hardware', 'most')).toBe(true);
    expect(checkEvidence(SOURCE, 'the rest came from hardware')).toBe(true);
  });
});

describe('figureRange', () => {
  it('finds the figure inside its passage', () => {
    const quote = 'Revenue reached $4.2B in the third quarter, up 18%';
    const [start, end] = figureRange(quote, '18%')!;
    expect(quote.slice(start, end)).toBe('18%');
  });

  it('finds a figure written with other separators', () => {
    const quote = 'Employers added 186,000 jobs';
    const [start, end] = figureRange(quote, '+186.000')!;
    expect(quote.slice(start, end)).toBe('186,000');
  });

  it('picks the right one of two close figures', () => {
    const quote = 'Unemployment was 1% in the region and 10% nationwide';
    const [start, end] = figureRange(quote, '10%')!;
    expect(quote.slice(start, end)).toBe('10%');
  });

  it('returns null without a figure', () => {
    expect(figureRange('no numbers here at all', '5%')).toBeNull();
    expect(figureRange('Revenue was 5%', null)).toBeNull();
  });
});
