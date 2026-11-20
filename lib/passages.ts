import { evidenceStatus } from './evidence';
import { parseProgram, programNodes } from './markdown';

/**
 * The source passages a summary points to: every `quote` of its blocks (key figures, bars,
 * charted values, source quotes, and any block that cites a passage), and the quotes of the
 * figures a derived value was worked out from. Only passages found word for word in the source,
 * once each, in the order of the summary. These are what "Highlight on page" marks.
 */
export function summaryPassages(program: string, content: string): string[] {
  let root: unknown;
  try {
    root = parseProgram(program);
  } catch {
    return [];
  }
  const seen = new Set<string>();
  const out: string[] = [];
  const add = (quote: unknown) => {
    if (typeof quote !== 'string') return;
    const q = quote.trim();
    const key = q.toLowerCase();
    if (!q || seen.has(key) || evidenceStatus(content, q) !== 'ok') return;
    seen.add(key);
    out.push(q);
  };
  for (const node of programNodes(root)) {
    const props = node.props ?? {};
    add(props.quote);
    if (Array.isArray(props.inputs)) for (const input of props.inputs) add((input as { quote?: unknown })?.quote);
  }
  return out;
}
