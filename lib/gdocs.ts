import { browser } from '#imports';
import { t } from '@/lib/i18n';
import { extractCsv, type ExtractedSource } from './extractors';

/**
 * Google Docs and Sheets draw their content on a canvas, so the page's HTML has almost no text.
 * They are read the way File → Download works: inside the tab (the user's own Google session,
 * so private and shared files work), the export link of the same file is fetched. Docs come back
 * as Markdown, the open sheet of a spreadsheet as CSV (the CSV tools then apply).
 *
 * The export link redirects to googleusercontent.com, which allows any origin; the request runs
 * in the extension's isolated world, so the page's own content security policy does not apply.
 */

export interface GoogleFileRef {
  type: 'document' | 'spreadsheet';
  /** Path up to the file id, keeping the account (/u/1/) so the right Google account is used. */
  path: string;
  /** Spreadsheets: the open sheet, from the URL. */
  gid: string | null;
}

/** The Google Doc or Sheet a docs.google.com URL opens, or null (published /d/e/ pages read as web pages). */
export function googleFileRef(url?: string): GoogleFileRef | null {
  if (!url) return null;
  try {
    const u = new URL(url);
    if (u.hostname !== 'docs.google.com') return null;
    const m = u.pathname.match(/^\/(document|spreadsheets)(?:\/u\/\d+)?\/d\/([\w-]+)/);
    if (!m || m[2] === 'e') return null;
    const gid = u.hash.match(/gid=(\d+)/)?.[1] ?? u.searchParams.get('gid');
    return { type: m[1] === 'document' ? 'document' : 'spreadsheet', path: m[0], gid };
  } catch {
    return null;
  }
}

interface InPage {
  title: string;
  /** Spreadsheets: the open sheet's name and how many sheets the file has. */
  sheet?: string;
  sheets?: number;
  text?: string;
  /** Set when no export worked: the HTTP status, 0 for a network error, -1 for an HTML page instead of the file. */
  status?: number;
}

/** Runs in the Google tab. Must be self-contained: it is serialized by chrome.scripting. */
async function exportInPage(path: string, formats: string[], gid: string | null): Promise<InPage> {
  // "Name - Google Docs", in the interface language ("- Google Tài liệu", "- Hojas de cálculo de Google").
  const title = document.title.replace(/\s+-\s+[^-]*Google[^-]*$/, '').trim();
  const sheet = document.querySelector('.docs-sheet-active-tab .docs-sheet-tab-name')?.textContent?.trim();
  const sheets = document.querySelectorAll('.docs-sheet-tab').length || undefined;
  let status = 0;
  for (const format of formats) {
    const url = `${location.origin}${path}/export?format=${format}${gid ? `&gid=${gid}` : ''}`;
    try {
      const res = await fetch(url);
      // Signed out, no access, or downloading turned off: Google answers with an HTML page.
      if (res.ok && (res.headers.get('content-type') ?? '').includes('text/html')) {
        status = -1;
        continue;
      }
      if (!res.ok) {
        status = res.status;
        continue;
      }
      return { title, sheet, sheets, text: await res.text() };
    } catch {
      status = 0;
    }
  }
  return { title, sheet, sheets, status };
}

export async function extractGoogleFile(tabId: number, url: string, ref: GoogleFileRef): Promise<ExtractedSource> {
  // Markdown keeps headings, lists and tables; plain text is the fallback.
  const formats = ref.type === 'document' ? ['md', 'txt'] : ['csv'];
  let result: InPage | undefined;
  try {
    const [injection] = await browser.scripting.executeScript({
      target: { tabId },
      func: exportInPage,
      args: [ref.path, formats, ref.gid],
    });
    result = injection?.result as InPage | undefined;
  } catch {
    throw new Error(t('errors:page.noAccess'));
  }
  if (!result) throw new Error(t('errors:page.readFailed'));
  if (result.text === undefined) {
    if (result.status === -1 || [401, 403, 404].includes(result.status!)) throw new Error(t('errors:gdocs.blocked'));
    if (result.status === 0) throw new Error(t('errors:gdocs.network'));
    throw new Error(t('errors:gdocs.failed', { status: result.status }));
  }
  const text = result.text.replace(/^﻿/, '');
  if (!text.trim()) throw new Error(t(ref.type === 'document' ? 'errors:gdocs.emptyDoc' : 'errors:gdocs.emptySheet'));
  const title = result.title || (ref.type === 'document' ? 'Google Docs' : 'Google Sheets');

  if (ref.type === 'document') return { kind: 'markdown', title, origin: url, content: text };

  const { content, dataset } = extractCsv(text);
  const others =
    result.sheets && result.sheets > 1
      ? `This is the sheet "${result.sheet ?? '?'}" of a spreadsheet with ${result.sheets} sheets; only this sheet was read.\n\n`
      : '';
  return {
    kind: 'csv',
    title: result.sheet && result.sheets && result.sheets > 1 ? `${title} · ${result.sheet}` : title,
    origin: url,
    content: others + content,
    csv: dataset,
  };
}
