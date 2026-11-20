/**
 * Reading a combined source (several tabs, or a page and the pages it links to): the text is a list
 * of <document index title url type> blocks (built in lib/multi.ts). Pure, so summary blocks can
 * use it as well as the session.
 */

export interface SourceDocument {
  /** 1-based, as the model cites it. */
  index: number;
  title: string;
  url: string;
}

/** The documents of a combined source, in order; empty for a single source. */
export function sourceDocuments(content: string): SourceDocument[] {
  return Array.from(content.matchAll(/^<document index="(\d+)" title="([^"]*)" url="([^"]*)"/gm), (m) => ({
    index: Number(m[1]),
    title: m[2]!,
    url: m[3]!,
  }));
}

/** A short name for a document: its site, or its title when it has no address (a file). */
export function documentName(doc: SourceDocument): string {
  try {
    return new URL(doc.url).hostname.replace(/^www\./, '');
  } catch {
    return doc.title.length > 40 ? `${doc.title.slice(0, 39)}…` : doc.title;
  }
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
