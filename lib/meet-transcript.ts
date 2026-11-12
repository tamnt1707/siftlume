/**
 * Meeting transcripts from live captions (lib/meet.ts records them). Pure functions, checked by
 * scripts/check-examples.ts.
 *
 * Meet shows one caption block per turn (a speaker's name, then their words) and keeps rewriting
 * it: words are corrected as recognition improves, the block grows, and old words scroll out of
 * its top. The recorder keeps, per block, the distinct texts it saw (`versions`); these functions
 * fold them into what was said.
 */

export interface CaptionBlock {
  id: number;
  speaker: string;
  /** Texts seen for this block, in order: each a rewrite, a growth or the text after a scroll. */
  versions: string[];
  /** ms since the recording started. */
  start: number;
  end: number;
}

export interface TranscriptLine {
  speaker: string;
  text: string;
  start: number;
}

const norm = (s: string) => s.replace(/\s+/g, ' ').trim();

/** Longest k (≥ min) such that the end of `a` equals the start of `b`. */
function overlap(a: string, b: string, min = 12) {
  const max = Math.min(a.length, b.length);
  for (let k = max; k >= min; k--) if (a.endsWith(b.slice(0, k))) return k;
  return 0;
}

/**
 * Two consecutive texts of one block → the text so far.
 * - Growth or a correction near the end: the newer text wins.
 * - Old words scrolled out of the top: join on the overlap.
 * - Otherwise the block restarted with new words: keep both.
 */
export function mergeRolling(previous: string, next: string): string {
  const a = norm(previous);
  const b = norm(next);
  if (!a) return b;
  if (!b || a === b || a.includes(b)) return a;
  if (b.includes(a)) return b;
  const k = overlap(a, b);
  if (k) return a + b.slice(k);
  // A rewrite: same opening, different ending (recognition changed its mind).
  const head = Math.min(24, Math.floor(Math.min(a.length, b.length) / 2));
  if (head >= 6 && a.slice(0, head) === b.slice(0, head)) return b;
  // The tail of `a` reappears inside `b` after a rewrite of its first words.
  const tail = a.slice(-30);
  const at = tail.length >= 12 ? b.indexOf(tail) : -1;
  if (at >= 0) return a + b.slice(at + tail.length);
  return `${a} ${b}`;
}

export const blockText = (block: CaptionBlock) => block.versions.reduce(mergeRolling, '');

/**
 * Blocks → transcript lines. A block without a name continues the previous speaker (Meet only
 * shows the name once per turn), and consecutive blocks of one speaker are joined.
 */
export function transcript(blocks: CaptionBlock[]): TranscriptLine[] {
  const lines: TranscriptLine[] = [];
  for (const block of [...blocks].sort((x, y) => x.start - y.start)) {
    const text = blockText(block);
    if (!text) continue;
    const last = lines[lines.length - 1];
    const speaker = block.speaker || last?.speaker || '?';
    if (last && last.speaker === speaker) last.text = mergeRolling(last.text, text);
    else lines.push({ speaker, text, start: block.start });
  }
  return lines;
}

/** "12:05" from ms. */
export function clock(ms: number) {
  const s = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const pad = (n: number) => String(n).padStart(2, '0');
  return h ? `${h}:${pad(m)}:${pad(s % 60)}` : `${m}:${pad(s % 60)}`;
}

/** The transcript as the model reads it: "[m:ss] Name: words" per turn. */
export const transcriptText = (lines: TranscriptLine[]) =>
  lines.map((l) => `[${clock(l.start)}] ${l.speaker}: ${l.text}`).join('\n');

export const speakers = (lines: TranscriptLine[]) => [...new Set(lines.map((l) => l.speaker))];
