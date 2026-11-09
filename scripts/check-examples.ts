// Validates the OpenUI Lang examples embedded in the system prompts against the real library:
// no parser errors, no unresolved or orphaned statements, and every Mermaid diagram renders with
// Pele. A wrong example teaches the model wrong syntax, so keep this green.
// Usage: pnpm check:examples
import { createParser } from '@openuidev/react-lang';
import { render, PeleError } from 'pele';
import { library } from '../lib/library';
import { CSV_TOOL_EXAMPLES } from '../lib/csv-tools';
import { VISUAL_SUMMARY_EXAMPLE } from '../lib/summary-example';
import { CHART_SUMMARY_EXAMPLE } from '../lib/chart-example';
import { DIAGRAM_SUMMARY_EXAMPLE } from '../lib/diagram-example';
import { NEWS_ACTORS_EXAMPLE, REVIEW_SUMMARY_EXAMPLE } from '../lib/review-example';
import { PRODUCT_COMPARE_EXAMPLE, RELEASE_NOTES_EXAMPLE, RESEARCH_PAPER_EXAMPLE } from '../lib/domain-example';

const parser = createParser(library.toJSONSchema(), 'Card');
const examples: Record<string, string> = {
  'summary-example': VISUAL_SUMMARY_EXAMPLE,
  'chart-example': CHART_SUMMARY_EXAMPLE,
  'diagram-example': DIAGRAM_SUMMARY_EXAMPLE,
  'review-example': REVIEW_SUMMARY_EXAMPLE,
  'news-actors-example': NEWS_ACTORS_EXAMPLE,
  'product-compare-example': PRODUCT_COMPARE_EXAMPLE,
  'release-notes-example': RELEASE_NOTES_EXAMPLE,
  'research-paper-example': RESEARCH_PAPER_EXAMPLE,
  ...Object.fromEntries(CSV_TOOL_EXAMPLES.map((e, i) => [`csv-tools[${i}]`, e])),
};

/** Collects the `mermaid` prop of every Diagram node in a parsed tree. */
function diagrams(node: unknown, out: string[] = []): string[] {
  if (Array.isArray(node)) node.forEach((n) => diagrams(n, out));
  else if (node && typeof node === 'object') {
    const el = node as { typeName?: string; props?: Record<string, unknown> };
    if (el.typeName === 'Diagram' && typeof el.props?.mermaid === 'string') out.push(el.props.mermaid);
    if (el.props) Object.values(el.props).forEach((v) => diagrams(v, out));
  }
  return out;
}

let failed = 0;
for (const [name, program] of Object.entries(examples)) {
  const result = parser.parse(program);
  const problems = [
    ...(result.root ? [] : ['no root']),
    ...(result.meta.errors ?? []).map((e) => `${e.statementId ?? ''} ${e.message}`.trim()),
    ...(result.meta.unresolved?.length ? [`unresolved: ${result.meta.unresolved.join(', ')}`] : []),
    ...(result.meta.orphaned?.length ? [`orphaned: ${result.meta.orphaned.join(', ')}`] : []),
  ];
  for (const source of diagrams(result.root)) {
    try {
      render(source, { links: false, images: false });
    } catch (e) {
      problems.push(`mermaid: ${e instanceof PeleError ? `${e.code} line ${e.line}: ${e.message}` : String(e)}`);
    }
  }
  if (problems.length) {
    failed++;
    console.error(`✗ ${name}\n  - ${problems.join('\n  - ')}`);
  } else console.log(`✓ ${name}`);
}
if (failed) process.exit(1);
