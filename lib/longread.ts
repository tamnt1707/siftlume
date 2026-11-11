import { splitParts, type ExtractedSource } from './extractors';
import { streamCompletion } from './llm';
import { getActiveProvider, type Settings } from './settings';

/**
 * Long sources (books, long PDFs, hour-long transcripts): instead of cutting them at the
 * character limit, they are read in parts of that size, notes are taken on each part (in
 * parallel), and the summary and answers are written from the notes. The notes are kept with
 * the session, so refining and questions do not read the source again.
 */

/** Parts read at most: sources longer than this many times the limit are cut. */
export const MAX_PARTS = 6;
/** Parts read at the same time. */
const PARALLEL = 3;

/** How much of a source to keep when it is opened: Gemini Nano reads in parts on its own. */
export const keepChars = (settings: Settings) =>
  getActiveProvider(settings).preset.builtin ? settings.maxChars : settings.maxChars * MAX_PARTS;

/** The source is longer than one request and has no notes yet. */
export const needsDigest = (settings: Settings, source: ExtractedSource) =>
  !getActiveProvider(settings).preset.builtin &&
  source.kind !== 'csv' &&
  !source.digest &&
  source.content.length > settings.maxChars;

const NOTES_SYSTEM = [
  'You take thorough notes on one part of a long document, so it can be summarized and questioned later without the original.',
  'Write in the language of the document. Start with a heading naming what this part covers, then its sections as short headings with bullet points.',
  'Keep every important fact, number, name, date, argument, example and conclusion, with units and figures exactly as written. Keep tables as Markdown tables.',
  'Copy 1-3 sentences worth quoting verbatim, in quotation marks. No introduction, no commentary, nothing that is not in the text.',
].join(' ');

/** Notes on every part of a long source, joined in order. */
export async function digestSource(
  settings: Settings,
  source: ExtractedSource,
  signal?: AbortSignal,
  onPart?: (done: number, total: number) => void,
) {
  const parts = splitParts(source.content, settings.maxChars);
  const notes: string[] = new Array(parts.length);
  let next = 0;
  let done = 0;
  const worker = async () => {
    while (next < parts.length) {
      const i = next++;
      notes[i] = await streamCompletion({
        settings,
        signal,
        system: NOTES_SYSTEM,
        messages: [
          {
            role: 'user',
            content: `Part ${i + 1} of ${parts.length} of "${source.title}":\n\n<part>\n${parts[i]}\n</part>`,
          },
        ],
        onText: () => {},
      });
      onPart?.(++done, parts.length);
    }
  };
  await Promise.all(Array.from({ length: Math.min(PARALLEL, parts.length) }, worker));
  return notes.map((n, i) => `## Part ${i + 1} of ${parts.length}\n\n${n.trim()}`).join('\n\n');
}
