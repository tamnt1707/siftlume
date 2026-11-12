import { Readability } from '@mozilla/readability';
import { t } from '@/lib/i18n';
import TurndownService from 'turndown';
import { gfm } from '@joplin/turndown-plugin-gfm';
import Papa from 'papaparse';
import { csvColumnNames, parseNumber, type CsvDataset, type CsvRow } from './csv-tools';
import type { StructuredType } from './structured';

export type SourceKind = 'webpage' | 'text' | 'pdf' | 'csv' | 'markdown' | 'video' | 'pr' | 'meeting' | 'multi';

export interface ExtractedSource {
  kind: SourceKind;
  title: string;
  /** Page URL or file name. */
  origin?: string;
  content: string;
  /** Set when kind = "csv": parsed data for in-browser Query tools. */
  csv?: CsvDataset;
  /** Set when kind = "multi": the tabs combined into this source, in document order. */
  parts?: { title: string; origin: string; tabId?: number; kind: SourceKind }[];
  /** Set when kind = "multi": titles of chosen tabs that could not be read. */
  skipped?: string[];
  /** Deep read: document 1 is the page being read, the others pages it links to. */
  deep?: boolean;
  /** A long source: notes taken on it part by part (lib/longread.ts), read instead of it. */
  digest?: string;
  /** Web pages: schema.org items found in the page (lib/structured.ts), placed before its text. */
  structured?: StructuredType[];
}

/** Max CSV rows kept for tools (and stored in history). */
export const MAX_CSV_ROWS = 5000;

const turndown = new TurndownService({ headingStyle: 'atx', codeBlockStyle: 'fenced' });
// GFM keeps <table> as Markdown tables: the main source of numbers for charts.
turndown.use(gfm);
turndown.remove(['script', 'style', 'noscript', 'iframe', 'form', 'nav', 'footer']);

/** An inline event handler attribute (onclick="…", onerror=…) inside a tag. */
const HANDLER_ATTR = /\s+on[a-z]+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi;

/**
 * Removes inline event handlers from page HTML. They carry no text, and parsing them in an
 * extension page makes Chrome log a Content Security Policy violation for each one (nothing runs,
 * but the console fills with errors). Only tags are touched, never the text between them.
 */
export const stripInlineHandlers = (html: string) =>
  html.replace(/<[a-z][^<>]*>/gi, (tag) => tag.replace(HANDLER_ATTR, ''));

/** Tab HTML → Markdown of the main content. Runs in the side panel with DOMParser. */
export function htmlToMarkdown(html: string, url: string): { title: string; content: string } {
  const doc = new DOMParser().parseFromString(stripInlineHandlers(html), 'text/html');
  // Base URL so Readability resolves relative links.
  const base = doc.createElement('base');
  base.href = url;
  doc.head.prepend(base);

  const article = new Readability(doc).parse();
  if (article?.content) {
    return { title: article.title || doc.title, content: turndown.turndown(article.content).trim() };
  }
  return { title: doc.title, content: (doc.body?.innerText || doc.body?.textContent || '').trim() };
}

export async function extractPdf(data: ArrayBuffer): Promise<string> {
  // Dynamic import: load pdf.js only when needed.
  const pdfjs = await import('pdfjs-dist');
  const workerUrl = (await import('pdfjs-dist/build/pdf.worker.min.mjs?url')).default;
  pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;

  const task = pdfjs.getDocument({ data });
  const pdf = await task.promise;
  const pages: string[] = [];
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const tc = await page.getTextContent();
    let text = '';
    for (const item of tc.items) {
      if ('str' in item) text += item.str + (item.hasEOL ? '\n' : ' ');
    }
    pages.push(`--- Page ${i} ---\n${text.trim()}`);
  }
  await task.destroy();
  return pages.join('\n\n');
}

/** CSV → schema, basic stats and sample rows for the prompt (not the whole file), plus the dataset for tools. */
export function extractCsv(text: string, sampleRows = 30): { content: string; dataset: CsvDataset } {
  // Header row read here, not by Papa: its own renaming of duplicate headers logs a console
  // warning (shown on the extensions page), and empty headers lost their columns.
  const [header = [], ...body] = Papa.parse<string[]>(text, { skipEmptyLines: 'greedy' }).data;
  const names = csvColumnNames(header, body);
  const columns = names.filter((n): n is string => n !== null);
  const raw: Record<string, string>[] = body.map((cells) => {
    const record: Record<string, string> = {};
    names.forEach((name, i) => {
      if (name !== null) record[name] = cells[i] ?? '';
    });
    return record;
  });

  const numericColumns = columns.filter((col) => {
    const values = raw.map((r) => r[col]).filter((v) => v !== undefined && v !== '');
    const nums = values.filter((v) => parseNumber(v!) !== null);
    return values.length > 0 && nums.length / values.length > 0.9;
  });

  const rows: CsvRow[] = raw.slice(0, MAX_CSV_ROWS).map((r) => {
    const row: CsvRow = {};
    for (const c of columns) {
      const v = r[c];
      if (v === undefined || v === '') row[c] = null;
      else row[c] = numericColumns.includes(c) ? (parseNumber(v) ?? v) : v;
    }
    return row;
  });

  const stats = columns.map((col) => {
    const values = rows.map((r) => r[col]).filter((v) => v !== null);
    if (numericColumns.includes(col)) {
      const nums = values.filter((v): v is number => typeof v === 'number');
      const sum = nums.reduce((a, b) => a + b, 0);
      return `- ${col}: numeric, min=${Math.min(...nums)}, max=${Math.max(...nums)}, mean=${(sum / nums.length).toFixed(2)}, non-empty=${values.length}`;
    }
    const counts = new Map<string, number>();
    for (const v of values) counts.set(String(v), (counts.get(String(v)) ?? 0) + 1);
    const top = [...counts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([v, n]) => `${v} (${n})`)
      .join(', ');
    return `- ${col}: text, distinct=${counts.size}, non-empty=${values.length}, most common: ${top}`;
  });

  const esc = (v: unknown) =>
    String(v ?? '')
      .replace(/\|/g, '\\|')
      .replace(/\n/g, ' ');
  const sample = rows.slice(0, sampleRows);
  const table = [
    `| ${columns.map(esc).join(' | ')} |`,
    `| ${columns.map(() => '---').join(' | ')} |`,
    ...sample.map((r) => `| ${columns.map((c) => esc(r[c])).join(' | ')} |`),
  ].join('\n');

  const content = [
    `Total rows: ${raw.length}${raw.length > MAX_CSV_ROWS ? ` (tools only see the first ${MAX_CSV_ROWS})` : ''}. Columns (${columns.length}): ${columns.join(', ')}`,
    `Numeric columns: ${numericColumns.join(', ') || '(none)'}`,
    '',
    'Column statistics:',
    ...stats,
    '',
    `First ${sample.length} rows:`,
    table,
  ].join('\n');

  return { content, dataset: { columns, numericColumns, rows } };
}

export async function extractFile(file: File): Promise<ExtractedSource> {
  const name = file.name;
  const ext = name.split('.').pop()?.toLowerCase() ?? '';

  if (ext === 'pdf' || file.type === 'application/pdf') {
    return { kind: 'pdf', title: name, origin: name, content: await extractPdf(await file.arrayBuffer()) };
  }
  if (ext === 'csv' || ext === 'tsv' || file.type === 'text/csv') {
    const { content, dataset } = extractCsv(await file.text());
    return { kind: 'csv', title: name, origin: name, content, csv: dataset };
  }
  if (['md', 'markdown', 'mdx'].includes(ext)) {
    return { kind: 'markdown', title: name, origin: name, content: await file.text() };
  }
  if (['txt', 'json', 'log', 'html', 'htm', 'xml', 'yaml', 'yml'].includes(ext) || file.type.startsWith('text/')) {
    if (ext === 'html' || ext === 'htm') {
      const { title, content } = htmlToMarkdown(await file.text(), 'about:blank');
      return { kind: 'webpage', title: title || name, origin: name, content };
    }
    return { kind: 'text', title: name, origin: name, content: await file.text() };
  }
  throw new Error(t('errors:file.unsupported', { type: ext || file.type }));
}

/** Splits text at paragraph breaks into parts of at most `size` characters. */
export function splitParts(text: string, size: number) {
  const out: string[] = [];
  let current = '';
  for (const para of text.split(/\n{2,}/)) {
    if (current && current.length + para.length + 2 > size) {
      out.push(current);
      current = '';
    }
    if (para.length > size) {
      for (let i = 0; i < para.length; i += size) out.push(para.slice(i, i + size));
    } else current = current ? `${current}\n\n${para}` : para;
  }
  if (current) out.push(current);
  return out;
}

export function truncate(content: string, maxChars: number): { content: string; truncated: boolean } {
  if (content.length <= maxChars) return { content, truncated: false };
  return { content: content.slice(0, maxChars), truncated: true };
}
