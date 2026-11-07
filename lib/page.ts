import { browser } from '#imports';
import { t } from '@/lib/i18n';
import { extractPdf, htmlToMarkdown, type ExtractedSource } from './extractors';

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
 * Reads a tab: HTML → Markdown via Readability, or PDF via pdf.js.
 * Access comes from activeTab, granted when the user opens the popup or uses the context menu on
 * that tab. The grant outlives the popup, so the result page can read the tab afterwards.
 */
export async function extractTab(tabId: number): Promise<ExtractedSource & { tabId: number }> {
  const tab = await browser.tabs.get(tabId).catch(() => null);
  if (!tab?.url) throw new Error(t('errors:page.noTab'));
  if (!isReadableUrl(tab.url)) throw new Error(t('errors:page.restricted'));

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
  if (!content.trim()) throw new Error(t('errors:page.noText'));
  return { kind: 'webpage', title: title || page.title, origin: page.url, content, tabId };
}

/** Scrolls to and highlights a quote in the original page (custom action @HighlightInPage). */
export async function highlightInTab(tabId: number, text: string): Promise<boolean> {
  const [injection] = await browser.scripting.executeScript({
    target: { tabId },
    args: [text],
    func: (needle: string) => {
      const norm = (s: string) => s.replace(/\s+/g, ' ').trim().toLowerCase();
      const target = norm(needle);
      // Try the full quote, then shorter prefixes (models sometimes paraphrase the end).
      const candidates = [target, target.split(' ').slice(0, 8).join(' '), target.split(' ').slice(0, 4).join(' ')];
      const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
      const nodes: Text[] = [];
      while (walker.nextNode()) nodes.push(walker.currentNode as Text);

      for (const c of candidates) {
        if (!c) continue;
        for (const node of nodes) {
          const idx = norm(node.data).indexOf(c);
          if (idx === -1) continue;
          const el = node.parentElement;
          if (!el) continue;
          el.scrollIntoView({ behavior: 'smooth', block: 'center' });
          const prev = el.style.cssText;
          el.style.cssText += ';background:#fde68a !important;outline:2px solid #f59e0b;transition:background .3s';
          setTimeout(() => (el.style.cssText = prev), 3500);
          return true;
        }
      }
      // Fallback: the browser's own find, which matches across text nodes.
      return (window as unknown as { find?: (s: string) => boolean }).find?.(needle.slice(0, 80)) ?? false;
    },
  });
  return Boolean(injection?.result);
}
