import { describe, expect, it } from 'vitest';
import { googleFileRef } from '@/lib/gdocs';
import { pullRequestRef, pullRequestUrl } from '@/lib/github';
import { splitParts, truncate } from '@/lib/extractors';

describe('googleFileRef', () => {
  it('reads a Drive file link with its account', () => {
    expect(googleFileRef('https://drive.google.com/file/d/1AbC-d_9/view?usp=sharing')).toEqual({
      type: 'drive',
      path: '/file/d/1AbC-d_9',
      gid: null,
      id: '1AbC-d_9',
      authuser: null,
    });
    expect(googleFileRef('https://drive.google.com/file/u/2/d/XYZ/view')).toMatchObject({ id: 'XYZ', authuser: '2' });
    expect(googleFileRef('https://drive.google.com/file/d/XYZ/view?authuser=1')).toMatchObject({ authuser: '1' });
  });

  it('reads Docs, Sheets (with the open sheet) and Slides', () => {
    expect(googleFileRef('https://docs.google.com/document/d/DOC1/edit')).toMatchObject({
      type: 'document',
      path: '/document/d/DOC1',
    });
    expect(googleFileRef('https://docs.google.com/spreadsheets/u/1/d/SHEET/edit#gid=42')).toMatchObject({
      type: 'spreadsheet',
      path: '/spreadsheets/u/1/d/SHEET',
      gid: '42',
    });
    expect(googleFileRef('https://docs.google.com/presentation/d/DECK/edit')).toMatchObject({ type: 'presentation' });
  });

  it('leaves published pages, folders and other sites alone', () => {
    expect(googleFileRef('https://docs.google.com/document/d/e/2PACX/pub')).toBeNull();
    expect(googleFileRef('https://drive.google.com/drive/folders/abc')).toBeNull();
    expect(googleFileRef('https://example.com/file/d/abc')).toBeNull();
    expect(googleFileRef('not a url')).toBeNull();
    expect(googleFileRef(undefined)).toBeNull();
  });
});

describe('pullRequestRef', () => {
  it('reads a pull request from any of its tabs', () => {
    const ref = { owner: 'tamnt1707', repo: 'siftlume', number: 5 };
    expect(pullRequestRef('https://github.com/tamnt1707/siftlume/pull/5')).toEqual(ref);
    expect(pullRequestRef('https://github.com/tamnt1707/siftlume/pull/5/files#diff-1')).toEqual(ref);
    expect(pullRequestUrl(ref)).toBe('https://github.com/tamnt1707/siftlume/pull/5');
  });

  it('leaves issues, other hosts and look-alikes alone', () => {
    expect(pullRequestRef('https://github.com/tamnt1707/siftlume/issues/5')).toBeNull();
    expect(pullRequestRef('https://github.com/tamnt1707/siftlume/pull/5x')).toBeNull();
    expect(pullRequestRef('https://gitlab.com/a/b/pull/5')).toBeNull();
  });
});

describe('splitParts', () => {
  it('keeps paragraphs whole and parts under the size', () => {
    const paras = ['a'.repeat(40), 'b'.repeat(40), 'c'.repeat(40)];
    const parts = splitParts(paras.join('\n\n'), 90);
    expect(parts).toEqual([`${paras[0]}\n\n${paras[1]}`, paras[2]]);
    for (const p of parts) expect(p.length).toBeLessThanOrEqual(90);
  });

  it('cuts a paragraph longer than the size', () => {
    expect(splitParts('x'.repeat(25), 10)).toEqual(['x'.repeat(10), 'x'.repeat(10), 'x'.repeat(5)]);
  });
});

describe('truncate', () => {
  it('says whether it cut', () => {
    expect(truncate('hello', 10)).toEqual({ content: 'hello', truncated: false });
    expect(truncate('hello world', 5)).toEqual({ content: 'hello', truncated: true });
  });
});
