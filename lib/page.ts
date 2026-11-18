import { browser } from '#imports';
import { t } from '@/lib/i18n';
import { extractPdf, htmlToMarkdown, type ExtractedSource } from './extractors';
import { extractVideo, youTubeVideoId } from './youtube';
import { extractPullRequest, pullRequestRef } from './github';
import { extractGoogleFile, googleFileRef } from './gdocs';
import { getSettings } from './settings';
import { readStructuredData } from './structured';
import { highlightQuote } from './highlight-quote';

export async function getActiveTab() {
  const [tab] = await browser.tabs.query({ active: true, lastFocusedWindow: true });
  return tab;
}

const RESTRICTED = /^(chrome|edge|about|chrome-extension|devtools|view-source):|^https:\/\/chromewebstore\.google\.com/;

/** Whether the browser lets extensions read this URL at all. */
export function isReadableUrl(url?: string) {
  return Boolean(url) && !RESTRICTED.test(url!);
}

const isPdfUrl = (url: string) => /\.pdf($|[?#])/i.test(url);

async function fetchPdf(url: string) {
  let res: Response;
  try {
    res = await fetch(url);
  } catch {
    throw new Error(t('errors:page.pdfDownload'));
  }
  if (!res.ok) throw new Error(t('errors:page.pdfStatus', { status: res.status }));
  return extractPdf(await res.arrayBuffer());
}

/**
 * Reads a tab: HTML → Markdown via Readability, PDF via pdf.js, YouTube videos from their captions,
 * GitHub pull requests through GitHub's API (lib/github.ts), Google Docs and Sheets from their
 * export (lib/gdocs.ts).
 * Access comes from activeTab, granted when the user opens the popup or uses the context menu on
 * that tab. The grant outlives the popup, so the result page can read the tab afterwards.
 */
export async function extractTab(tabId: number): Promise<ExtractedSource & { tabId: number }> {
  const tab = await browser.tabs.get(tabId).catch(() => null);
  if (!tab?.url) throw new Error(t('errors:page.noTab'));
  if (!isReadableUrl(tab.url)) throw new Error(t('errors:page.restricted'));

  if (youTubeVideoId(tab.url)) return extractVideo(tabId, tab.url);
  const pr = pullRequestRef(tab.url);
  if (pr) return { ...(await extractPullRequest(pr, (await getSettings()).githubToken)), tabId };
  const googleFile = googleFileRef(tab.url);
  if (googleFile) return { ...(await extractGoogleFile(tabId, tab.url, googleFile)), tabId };
  if (isPdfUrl(tab.url)) {
    return { kind: 'pdf', title: tab.title || tab.url, origin: tab.url, content: await fetchPdf(tab.url), tabId };
  }

  let page: { html: string; url: string; title: string; contentType: string } | undefined;
  try {
    const [injection] = await browser.scripting.executeScript({
      target: { tabId },
      func: () => ({
        html: document.documentElement.outerHTML,
        url: location.href,
        title: document.title,
        contentType: document.contentType,
      }),
    });
    page = injection?.result as typeof page;
  } catch {
    throw new Error(t('errors:page.noAccess'));
  }
  if (!page) throw new Error(t('errors:page.readFailed'));
  if (page.contentType === 'application/pdf') {
    return { kind: 'pdf', title: page.title || page.url, origin: page.url, content: await fetchPdf(page.url), tabId };
  }

  const { title, content } = htmlToMarkdown(page.html, page.url);
  // Recipes, products, job postings, events: the page's own schema.org data goes first. It also
  // rescues shop pages whose text is rendered by scripts Readability does not see.
  const data = readStructuredData(page.html);
  if (!content.trim() && !data) throw new Error(t('errors:page.noText'));
  return {
    kind: 'webpage',
    title: title || page.title,
    origin: page.url,
    content: data ? `${data.markdown}\n\n---\n\n${content}` : content,
    structured: data?.types,
    tabId,
  };
}

/** Scrolls to and highlights a quote in the original page (custom action @HighlightInPage). */
export async function highlightInTab(tabId: number, text: string): Promise<boolean> {
  const [injection] = await browser.scripting.executeScript({ target: { tabId }, args: [text], func: highlightQuote });
  return Boolean(injection?.result);
}
