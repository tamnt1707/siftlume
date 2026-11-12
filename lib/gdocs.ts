import { browser } from '#imports';
import { t } from '@/lib/i18n';
import { extractCsv, extractPdf, type ExtractedSource } from './extractors';

/**
 * Google Docs, Sheets, Slides and PDFs in Drive's viewer draw their content on a canvas, so the
 * page's HTML has almost no text. They are read the way File → Download works: inside the tab (the
 * user's own Google session, so private and shared files work), the file's export or download link
 * is fetched. Docs come back as Markdown, the open sheet of a spreadsheet as CSV (the CSV tools then
 * apply), a presentation as its slides and speaker notes (read from the .pptx export, unzipped in
 * the tab so only text comes back), a Drive PDF as the PDF itself (read with pdf.js).
 *
 * The export links redirect to googleusercontent.com, which allows any origin; the requests run in
 * the extension's isolated world, so the page's own content security policy does not apply.
 */

export interface GoogleFileRef {
  type: 'document' | 'spreadsheet' | 'presentation' | 'drive';
  /** Path up to the file id, keeping the account (/u/1/) so the right Google account is used. */
  path: string;
  /** Spreadsheets: the open sheet, from the URL. */
  gid: string | null;
  /** Drive files: the file id and the signed-in account index, for the download link. */
  id?: string;
  authuser?: string | null;
}

const DOCS_TYPES = { document: 'document', spreadsheets: 'spreadsheet', presentation: 'presentation' } as const;

/**
 * The Google Doc, Sheet, Slides deck or Drive file a URL opens, or null (published /d/e/ pages
 * are ordinary web pages).
 */
export function googleFileRef(url?: string): GoogleFileRef | null {
  if (!url) return null;
  try {
    const u = new URL(url);
    if (u.hostname === 'drive.google.com') {
      const m = u.pathname.match(/^\/file(?:\/u\/(\d+))?\/d\/([\w-]+)/);
      if (!m) return null;
      return { type: 'drive', path: m[0], gid: null, id: m[2], authuser: m[1] ?? u.searchParams.get('authuser') };
    }
    if (u.hostname !== 'docs.google.com') return null;
    const m = u.pathname.match(/^\/(document|spreadsheets|presentation)(?:\/u\/\d+)?\/d\/([\w-]+)/);
    if (!m || m[2] === 'e') return null;
    const gid = u.hash.match(/gid=(\d+)/)?.[1] ?? u.searchParams.get('gid');
    return { type: DOCS_TYPES[m[1] as keyof typeof DOCS_TYPES], path: m[0], gid };
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

/**
 * Runs in the Slides tab (self-contained, serialized by chrome.scripting). Downloads the .pptx
 * export, unzips only its slide and notes XML with the browser's own DecompressionStream, and
 * returns Markdown: one "## Slide n" section per slide, then its speaker notes. Falls back to the
 * plain-text export (no slide breaks, no notes) when the .pptx cannot be read.
 */
async function slidesInPage(path: string): Promise<InPage> {
  const title = document.title.replace(/\s+-\s+[^-]*Google[^-]*$/, '').trim();
  const fail = (res: Response) => (res.ok ? -1 : res.status);
  const isHtml = (res: Response) => (res.headers.get('content-type') ?? '').includes('text/html');

  async function unzip(buf: ArrayBuffer, want: (name: string) => boolean) {
    const view = new DataView(buf);
    let eocd = buf.byteLength - 22;
    while (eocd >= 0 && view.getUint32(eocd, true) !== 0x06054b50) eocd--;
    if (eocd < 0) throw new Error('not a zip');
    const count = view.getUint16(eocd + 10, true);
    let at = view.getUint32(eocd + 16, true);
    const files = new Map<string, string>();
    const decoder = new TextDecoder();
    for (let i = 0; i < count; i++) {
      if (view.getUint32(at, true) !== 0x02014b50) break;
      const method = view.getUint16(at + 10, true);
      const size = view.getUint32(at + 20, true);
      const nameLen = view.getUint16(at + 28, true);
      const extraLen = view.getUint16(at + 30, true);
      const commentLen = view.getUint16(at + 32, true);
      const local = view.getUint32(at + 42, true);
      const name = decoder.decode(new Uint8Array(buf, at + 46, nameLen));
      at += 46 + nameLen + extraLen + commentLen;
      if (!want(name)) continue;
      const start = local + 30 + view.getUint16(local + 26, true) + view.getUint16(local + 28, true);
      const data = new Uint8Array(buf, start, size);
      if (method === 0) files.set(name, decoder.decode(data));
      else if (method === 8) {
        const stream = new Blob([data]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
        files.set(name, await new Response(stream).text());
      }
    }
    return files;
  }

  // The XML is read with regular expressions, not DOMParser: Google's pages enforce Trusted Types,
  // which blocks DOMParser.parseFromString. The .pptx parts are machine-written and regular.
  const decode = (text: string) =>
    text
      .replace(/&#x([0-9a-f]+);/gi, (_, h: string) => String.fromCodePoint(parseInt(h, 16)))
      .replace(/&#(\d+);/g, (_, d: string) => String.fromCodePoint(Number(d)))
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&apos;/g, "'")
      .replace(/&amp;/g, '&');
  const all = (text: string, re: RegExp) => [...text.matchAll(re)].map((m) => m[0]);
  const attr = (tag: string, name: string) => tag.match(new RegExp(`\\s${name}="([^"]*)"`))?.[1] ?? '';
  /** Text of each DrawingML paragraph (<a:p>), its runs (<a:t>) joined. */
  const paragraphs = (part: string) =>
    all(part, /<a:p[\s>][\s\S]*?<\/a:p>/g)
      // A line break inside a paragraph (<a:br/>) separates its runs.
      .map((p) => p.replace(/<a:br\b[^>]*\/>/g, '<a:t> </a:t>'))
      .map((p) => decode([...p.matchAll(/<a:t(?:\s[^>]*)?>([^<]*)<\/a:t>/g)].map((m) => m[1]).join('')).trim())
      .filter(Boolean);
  const shapes = (part: string) => all(part, /<p:sp(?:\s[^>]*)?>[\s\S]*?<\/p:sp>/g);
  const placeholder = (shape: string) => attr(shape.match(/<p:ph\b[^>]*>/)?.[0] ?? '', 'type');
  /** Relationship targets of a part ("../slides/slide3.xml"), resolved against its folder. */
  const targets = (rels: string | undefined, folder: string) =>
    all(rels ?? '', /<Relationship\s[^>]*>/g).map((r) => ({
      id: attr(r, 'Id'),
      type: attr(r, 'Type'),
      target: new URL(attr(r, 'Target'), `https://x/${folder}/`).pathname.slice(1),
    }));

  try {
    const res = await fetch(`${location.origin}${path}/export/pptx`);
    if (!res.ok || isHtml(res)) return { title, status: fail(res) };
    const files = await unzip(await res.arrayBuffer(), (n) => n.endsWith('.xml') || n.endsWith('.rels'));
    // Slide order from the presentation, then each slide's notes from its relationships.
    const presRels = targets(files.get('ppt/_rels/presentation.xml.rels'), 'ppt');
    const order = all(files.get('ppt/presentation.xml') ?? '', /<p:sldId\s[^>]*>/g)
      .map((tag) => presRels.find((r) => r.id === attr(tag, 'r:id'))?.target)
      .filter((t): t is string => Boolean(t));
    const slides = order.map((slide, i) => {
      const part = files.get(slide) ?? '';
      const isTitle = (sp: string) => /title/i.test(placeholder(sp));
      const heading = shapes(part).filter(isTitle).flatMap(paragraphs).join(' ');
      const body = shapes(part)
        .filter((sp) => !isTitle(sp))
        .flatMap(paragraphs);
      // Tables live in <p:graphicFrame>, outside <p:sp>.
      const tables = all(part, /<p:graphicFrame[\s>][\s\S]*?<\/p:graphicFrame>/g).flatMap(paragraphs);
      const folder = slide.slice(0, slide.lastIndexOf('/'));
      const notesPart = targets(files.get(`${folder}/_rels/${slide.slice(folder.length + 1)}.rels`), folder).find((r) =>
        r.type.endsWith('/notesSlide'),
      )?.target;
      const notes = shapes((notesPart && files.get(notesPart)) || '')
        .filter((sp) => placeholder(sp) === 'body')
        .flatMap(paragraphs);
      return [
        `## Slide ${i + 1}${heading ? `: ${heading}` : ''}`,
        ...[...body, ...tables].map((line) => `- ${line}`),
        notes.length ? `Speaker notes: ${notes.join(' ')}` : '',
      ]
        .filter(Boolean)
        .join('\n');
    });
    if (slides.length) return { title, text: slides.join('\n\n'), sheets: slides.length };
  } catch {
    // Not a readable .pptx: the plain-text export below.
  }
  try {
    const res = await fetch(`${location.origin}${path}/export/txt`);
    if (!res.ok || isHtml(res)) return { title, status: fail(res) };
    return { title, text: await res.text() };
  } catch {
    return { title, status: 0 };
  }
}

/** Largest Drive PDF read: it comes back from the tab as base64 inside one message. */
const MAX_DRIVE_PDF = 40 * 1024 * 1024;

/**
 * Runs in the Drive tab (self-contained). Downloads the file, checks it is a PDF and not too big,
 * and returns it as base64.
 */
async function driveInPage(
  id: string,
  authuser: string | null,
  max: number,
): Promise<InPage & { notPdf?: boolean; tooBig?: boolean }> {
  const title = document.title.replace(/\s+-\s+Google Drive\s*$/i, '').trim();
  const url = `${location.origin}/uc?export=download&id=${id}${authuser ? `&authuser=${authuser}` : ''}`;
  try {
    const res = await fetch(url);
    if (!res.ok || (res.headers.get('content-type') ?? '').includes('text/html'))
      return { title, status: res.ok ? -1 : res.status };
    const size = Number(res.headers.get('content-length'));
    if (size > max) return { title, tooBig: true };
    const blob = await res.blob();
    if (blob.size > max) return { title, tooBig: true };
    const head = new Uint8Array(await blob.slice(0, 5).arrayBuffer());
    if (String.fromCharCode(...head) !== '%PDF-') return { title, notPdf: true };
    const dataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(blob);
    });
    return { title, text: dataUrl.slice(dataUrl.indexOf(',') + 1) };
  } catch {
    return { title, status: 0 };
  }
}

const base64ToBuffer = (b64: string) => Uint8Array.from(atob(b64), (c) => c.charCodeAt(0)).buffer;

function exportError(status?: number) {
  if (status === -1 || [401, 403, 404].includes(status!)) return new Error(t('errors:gdocs.blocked'));
  if (status === 0) return new Error(t('errors:gdocs.network'));
  return new Error(t('errors:gdocs.failed', { status }));
}

async function inTab<T>(tabId: number, run: () => Promise<chrome.scripting.InjectionResult<T>[]>): Promise<T> {
  let result: T | undefined;
  try {
    result = (await run())[0]?.result as T | undefined;
  } catch {
    throw new Error(t('errors:page.noAccess'));
  }
  if (!result) throw new Error(t('errors:page.readFailed'));
  return result;
}

export async function extractGoogleFile(tabId: number, url: string, ref: GoogleFileRef): Promise<ExtractedSource> {
  if (ref.type === 'presentation') {
    const r = await inTab(tabId, () =>
      browser.scripting.executeScript({ target: { tabId }, func: slidesInPage, args: [ref.path] }),
    );
    if (r.text === undefined) throw exportError(r.status);
    if (!r.text.trim()) throw new Error(t('errors:gdocs.emptyDoc'));
    const intro = r.sheets
      ? `A slide deck with ${r.sheets} slides. Each "## Slide n" section is one slide, with its speaker notes when there are any. Refer to slides by number.\n\n`
      : '';
    return { kind: 'markdown', title: r.title || 'Google Slides', origin: url, content: intro + r.text };
  }
  if (ref.type === 'drive') {
    const r = await inTab(tabId, () =>
      browser.scripting.executeScript({
        target: { tabId },
        func: driveInPage,
        args: [ref.id!, ref.authuser ?? null, MAX_DRIVE_PDF],
      }),
    );
    if (r.notPdf) throw new Error(t('errors:gdocs.drivePdfOnly'));
    if (r.tooBig) throw new Error(t('errors:gdocs.driveTooBig', { size: MAX_DRIVE_PDF / 1024 / 1024 }));
    if (r.text === undefined) throw exportError(r.status);
    const content = await extractPdf(base64ToBuffer(r.text));
    if (!content.replace(/--- Page \d+ ---/g, '').trim()) throw new Error(t('errors:gdocs.scannedPdf'));
    return { kind: 'pdf', title: r.title || 'Google Drive', origin: url, content };
  }
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
