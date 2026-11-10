import { browser } from '#imports';
import { t } from '@/lib/i18n';
import { extractPdf, htmlToMarkdown, type ExtractedSource } from './extractors';
import { streamCompletion } from './llm';
import { combineSources } from './multi';
import { extractTab } from './page';
import { originPattern, type Settings } from './settings';

/**
 * Deep read: the page plus a few pages it links to, summarized together. A linked page is fetched
 * directly (fast, no tab, no cookies); when that gives nothing useful (pages built by scripts,
 * logins, paywalls) it is opened in a background tab, read like any tab, and closed.
 */

export const MAX_LINKS = 5;

export interface PageLink {
  url: string;
  /** The link's text. */
  text: string;
  /** The sentence around it, to judge what it leads to. */
  context: string;
}

/** Links that are not worth reading: sharing, sign-in, feeds, media and downloads. */
const SKIP_URL =
  /\/(share|sharer|intent|login|signin|sign-in|signup|subscribe|register|cart|checkout)\b|^mailto:|\.(png|jpe?g|gif|webp|svg|mp3|mp4|zip|dmg|exe|rss|xml)([?#]|$)/i;
const SKIP_HOST = /(^|\.)(facebook|twitter|x|linkedin|pinterest|reddit|t|wa|whatsapp|telegram)\.(com|me|org)$/i;

/**
 * Links in the main text of a page, in reading order. The page is already Markdown of its main
 * content (navigation, footers and ads removed), so these are the links the article itself makes.
 */
export function findLinks(source: ExtractedSource): PageLink[] {
  const self = source.origin?.split('#')[0];
  const seen = new Set<string>();
  const links: PageLink[] = [];
  const re = /(?<!!)\[([^\]]{2,200})\]\((https?:\/\/[^)\s]+)(?:\s+"[^"]*")?\)/g;
  for (const m of source.content.matchAll(re)) {
    const text = m[1]!.replace(/[*_`]/g, '').trim();
    const url = m[2]!;
    const bare = url.split('#')[0]!;
    let host = '';
    try {
      host = new URL(url).hostname;
    } catch {
      continue;
    }
    if (bare === self || seen.has(bare) || SKIP_URL.test(url) || SKIP_HOST.test(host) || text.length < 3) continue;
    seen.add(bare);
    const at = m.index ?? 0;
    const context = source.content
      .slice(Math.max(0, at - 120), at + m[0].length + 120)
      .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
      .replace(/\s+/g, ' ')
      .trim();
    links.push({ url, text, context });
    if (links.length >= 40) break;
  }
  return links;
}

/** Asks for the sites of the chosen links; call it first thing in a click handler. */
export function requestLinksAccess(urls: string[]) {
  const origins = [...new Set(urls.map(originPattern).filter((o): o is string => Boolean(o)))];
  return browser.permissions.request({ origins });
}

/** Too little text to be the page itself: a script-built page, a login or a paywall. */
const tooThin = (text: string) => text.replace(/\s+/g, ' ').trim().length < 600;

async function fetchPage(url: string, signal?: AbortSignal): Promise<ExtractedSource | null> {
  const timeout = AbortSignal.timeout(15_000);
  const res = await fetch(url, {
    credentials: 'omit',
    redirect: 'follow',
    signal: signal ? AbortSignal.any([signal, timeout]) : timeout,
  }).catch(() => null);
  if (!res?.ok) return null;
  const type = res.headers.get('content-type') ?? '';
  if (type.includes('pdf') || /\.pdf([?#]|$)/i.test(res.url)) {
    const content = await extractPdf(await res.arrayBuffer());
    return tooThin(content) ? null : { kind: 'pdf', title: res.url.split('/').pop() || url, origin: url, content };
  }
  if (!type.includes('html')) return null;
  const { title, content } = htmlToMarkdown(await res.text(), res.url);
  return tooThin(content) ? null : { kind: 'webpage', title: title || url, origin: url, content };
}

/** Opens the link in a background tab, waits for it to render, reads it and closes the tab. */
async function readInTab(url: string): Promise<ExtractedSource> {
  const tab = await browser.tabs.create({ url, active: false });
  const id = tab.id!;
  try {
    await new Promise<void>((resolve) => {
      const done = () => {
        browser.tabs.onUpdated.removeListener(onUpdated);
        clearTimeout(timer);
        resolve();
      };
      const onUpdated = (tabId: number, change: { status?: string }) => {
        if (tabId === id && change.status === 'complete') done();
      };
      const timer = setTimeout(done, 20_000);
      browser.tabs.onUpdated.addListener(onUpdated);
    });
    // Pages built by scripts fill in after "complete".
    await new Promise((r) => setTimeout(r, 1500));
    const { tabId: _tab, ...src } = await extractTab(id);
    return { ...src, origin: url };
  } finally {
    void browser.tabs.remove(id).catch(() => {});
  }
}

export async function readLink(url: string, signal?: AbortSignal): Promise<ExtractedSource> {
  const fetched = await fetchPage(url, signal).catch(() => null);
  if (fetched) return fetched;
  if (signal?.aborted) throw new Error(t('errors:llm.stopped'));
  return readInTab(url);
}

/**
 * Reads the chosen links and joins them with the page into one source: the page is document 1.
 * Links that cannot be read are skipped and named; none readable is an error.
 */
export async function deepSource(
  page: ExtractedSource & { tabId?: number },
  urls: string[],
  maxChars: number,
  signal?: AbortSignal,
) {
  const results = await Promise.allSettled(urls.map((url) => readLink(url, signal)));
  const read = results.flatMap((r) => (r.status === 'fulfilled' ? [r.value] : []));
  const skipped = results.flatMap((r, i) => (r.status === 'rejected' ? [urls[i]!] : []));
  if (!read.length) throw new Error(t('errors:deep.noneRead'));
  const combined = combineSources([page, ...read], maxChars, skipped, { deep: true });
  return { ...combined, title: t('common:deepOf', { title: page.title }), tabId: page.tabId };
}

/** Asks the model which links are worth reading to complete the summary. Returns their indexes. */
export async function pickLinks(settings: Settings, page: ExtractedSource, links: PageLink[], signal?: AbortSignal) {
  const list = links.map((l, i) => `${i + 1}. ${l.text} — ${l.url}\n   Context: ${l.context}`).join('\n');
  const raw = await streamCompletion({
    settings,
    signal,
    system:
      'You choose which links in an article are worth opening to understand it fully: the sources, reports, documentation or pages the article relies on or only points to. Skip navigation, sign-up, social media, ads and unrelated pages. Answer with the numbers only, comma-separated, best first.',
    messages: [
      {
        role: 'user',
        content: `Article: ${page.title}\n\n${page.content.slice(0, 4000)}\n\nLinks:\n${list}\n\nPick up to ${MAX_LINKS}.`,
      },
    ],
    onText: () => {},
  });
  const picked = [...raw.matchAll(/\d+/g)].map((m) => Number(m[0]) - 1).filter((i) => i >= 0 && i < links.length);
  return [...new Set(picked)].slice(0, MAX_LINKS);
}
