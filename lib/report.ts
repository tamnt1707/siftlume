import { parseProgram, programNodes } from './markdown';

/**
 * "Layout not right?": a GitHub issue filled in with what shapes a layout (the source type, the
 * analysis, the model and the blocks it picked), so a wrong pick can be reproduced. The page's
 * address and content are left out; the reader can add the address if the page is public.
 */

export const ISSUES_URL = 'https://github.com/tamnt1707/siftlume/issues/new';

export interface ReportInfo {
  version: string;
  /** Source kind: webpage, pdf, video… */
  kind: string;
  /** Built-in analysis (a custom mode reports the one it builds on, not its private text). */
  mode: string;
  custom: boolean;
  length: string;
  language: string;
  provider: string;
  model: string;
  program: string;
  userAgent: string;
}

/** The distinct blocks of a summary, in order of first appearance. */
export function blocksUsed(program: string): string[] {
  const seen = new Set<string>();
  try {
    for (const node of programNodes(parseProgram(program))) if (node.typeName) seen.add(node.typeName);
  } catch {
    // A program that does not parse still gets a report, without its blocks.
  }
  return [...seen];
}

/** "Chrome 142", "Edg 141", or the first word of the user agent. */
export function browserName(userAgent: string) {
  // Edge and Opera also say "Chrome", and Chrome also says "Safari": check the specific ones first.
  for (const [token, name] of [
    ['Edg', 'Edge'],
    ['OPR', 'Opera'],
    ['Firefox', 'Firefox'],
    ['Chrome', 'Chrome'],
    ['Version', 'Safari'],
  ]) {
    const m = userAgent.match(new RegExp(`${token}/(\\d+)`));
    if (m) return `${name} ${m[1]}`;
  }
  return userAgent.split(' ')[0] ?? '';
}

export function reportUrl(info: ReportInfo) {
  const mode = info.custom ? `custom mode based on ${info.mode}` : info.mode;
  const title = `Layout: ${info.kind}, ${mode}`;
  const body = [
    '**What was wrong with the layout?**',
    '<!-- For example: a chart where a table would read better, key figures missing, the wrong blocks for this kind of page. A screenshot helps. -->',
    '',
    '',
    '**Page address (only if it is public, optional)**',
    '',
    '',
    '---',
    `- Siftlume: ${info.version}`,
    `- Source: ${info.kind}`,
    `- Analysis: ${mode}, ${info.length}, language ${info.language}`,
    `- Model: ${info.provider} / ${info.model}`,
    `- Blocks: ${blocksUsed(info.program).join(', ') || '(none)'}`,
    `- Browser: ${browserName(info.userAgent)}`,
  ].join('\n');
  const params = new URLSearchParams({ title, body, labels: 'layout' });
  return `${ISSUES_URL}?${params}`;
}
