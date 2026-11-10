import { browser } from '#imports';
import { t } from '@/lib/i18n';
import type { ExtractedSource, SourceKind } from './extractors';
import { extractTab, isReadableUrl } from './page';
import { originPattern } from './settings';

/**
 * Several open tabs summarized and compared together. Listing tabs needs the optional "tabs"
 * permission and reading them needs their sites, both asked for when the user chooses this.
 */

export const MAX_TABS = 6;

/** One tab inside a combined source, for citations and jumping back to it. */
export interface SourcePart {
  title: string;
  origin: string;
  tabId: number;
  kind: SourceKind;
}

export interface TabChoice {
  id: number;
  title: string;
  url: string;
}

/**
 * Asks to see the open tabs. Call it first thing in a click handler: Chrome only shows the prompt
 * during a user gesture. Resolves true at once if already granted.
 */
export const requestTabsPermission = () => browser.permissions.request({ permissions: ['tabs'] });

/** Readable web pages in the current window, in tab order. */
export async function listTabs(): Promise<TabChoice[]> {
  const tabs = await browser.tabs.query({ currentWindow: true });
  return tabs
    .filter((tab) => tab.id !== undefined && tab.url?.startsWith('http') && isReadableUrl(tab.url))
    .map((tab) => ({ id: tab.id!, title: tab.title || tab.url!, url: tab.url! }));
}

/** Asks for the sites of the chosen tabs; call it first thing in a click handler. */
export function requestTabsAccess(tabs: TabChoice[]) {
  const origins = [...new Set(tabs.map((tab) => originPattern(tab.url)).filter((o): o is string => Boolean(o)))];
  return browser.permissions.request({ origins });
}

const escapeAttr = (s: string) => s.replace(/"/g, "'").replace(/\s+/g, ' ');

/**
 * Reads the tabs and joins them into one source. Each tab gets an equal share of `maxChars`, so a
 * long first page cannot crowd out the others. Tabs that cannot be read are skipped and named;
 * fewer than two readable tabs is an error.
 */
export async function extractTabs(
  tabIds: number[],
  maxChars: number,
): Promise<ExtractedSource & { truncated: boolean; parts: SourcePart[]; skipped: string[] }> {
  const results = await Promise.allSettled(tabIds.map((id) => extractTab(id)));
  const read = results.flatMap((r) => (r.status === 'fulfilled' ? [r.value] : []));
  const skipped = await Promise.all(
    results.flatMap((r, i) =>
      r.status === 'rejected'
        ? [
            browser.tabs
              .get(tabIds[i]!)
              .then((tab) => tab.title || tab.url || '?')
              .catch(() => '?'),
          ]
        : [],
    ),
  );
  if (read.length < 2) {
    const reason = results.find((r): r is PromiseRejectedResult => r.status === 'rejected')?.reason;
    throw new Error(
      t('errors:multi.tooFew', { reason: reason instanceof Error ? reason.message : t('errors:page.readFailed') }),
    );
  }

  // Room for each document, after its wrapper tags.
  const share = Math.max(2000, Math.floor(maxChars / read.length) - 200);
  let truncated = false;
  const docs = read.map((src, i) => {
    let body = src.content;
    if (body.length > share) {
      body = body.slice(0, share);
      truncated = true;
    }
    return `<document index="${i + 1}" title="${escapeAttr(src.title)}" url="${src.origin ?? ''}" type="${src.kind}">\n${body}\n</document>`;
  });

  return {
    kind: 'multi',
    title: read.map((src) => src.title).join(' · '),
    content: docs.join('\n\n'),
    truncated,
    parts: read.map((src) => ({ title: src.title, origin: src.origin ?? '', tabId: src.tabId, kind: src.kind })),
    skipped,
  };
}

/** Index (0-based) of the document in a combined source that contains `quote`, or null. */
export function partForQuote(content: string, quote: string): number | null {
  const norm = (s: string) => s.replace(/\s+/g, ' ').trim().toLowerCase();
  const words = norm(quote).split(' ');
  const docs = content
    .split(/^<document index="/m)
    .slice(1)
    .map(norm);
  for (const needle of [words.join(' '), words.slice(0, 8).join(' '), words.slice(0, 4).join(' ')]) {
    if (!needle) continue;
    const i = docs.findIndex((d) => d.includes(needle));
    if (i >= 0) return i;
  }
  return null;
}

/** The content of one document of a combined source (for finding a video moment). */
export function partContent(content: string, index: number) {
  const doc = content.split(/^<document index="/m)[index + 1] ?? '';
  return doc.replace(/^[^\n]*\n/, '').replace(/\n<\/document>\s*$/, '');
}
