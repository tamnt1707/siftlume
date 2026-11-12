// Validates the OpenUI Lang examples embedded in the system prompts against the real library:
// no parser errors, no unresolved or orphaned statements, and every Mermaid diagram renders with
// Pele. A wrong example teaches the model wrong syntax, so keep this green.
// Usage: pnpm check:examples
import { createParser } from '@openuidev/react-lang';
import { render, PeleError } from 'pele';
import { library } from '../lib/library';
import { CSV_TOOL_EXAMPLES, parseNumber } from '../lib/csv-tools';
import { VISUAL_SUMMARY_EXAMPLE } from '../lib/summary-example';
import { CHART_SUMMARY_EXAMPLE } from '../lib/chart-example';
import { DIAGRAM_SUMMARY_EXAMPLE } from '../lib/diagram-example';
import { NEWS_ACTORS_EXAMPLE, REVIEW_SUMMARY_EXAMPLE } from '../lib/review-example';
import { PRODUCT_COMPARE_EXAMPLE, RELEASE_NOTES_EXAMPLE, RESEARCH_PAPER_EXAMPLE } from '../lib/domain-example';
import { ACTION_EXAMPLE, CRITIQUE_EXAMPLE, EXPLAIN_EXAMPLE } from '../lib/mode-example';
import { CODE_TUTORIAL_EXAMPLE, DECISION_EXAMPLE, POLICY_DEBATE_EXAMPLE } from '../lib/analysis-example';
import { localProgram, repairJson } from '../lib/local-program';

/** An in-browser model's answer with every field filled, for a web page and for a file. */
const LOCAL_ANSWER = {
  title: 'Acme "Q3" earnings',
  tldr: 'Cloud grew 18% while hardware shrank.',
  keyNumbers: [
    { value: '$4.2B', label: 'revenue' },
    { value: '31%', label: 'margin' },
  ],
  takeaways: [{ text: 'Cloud leads growth', detail: 'Subscriptions replace servers' }, { text: 'Hardware fell again' }],
  steps: ['Read the 10-Q', 'Check guidance'],
  sections: [{ heading: 'Risks', points: ['Chip supply', 'FX: \\ and "quotes"\nnew line'] }],
  followUps: ['What is the 2026 outlook?'],
};

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
  'explain-example': EXPLAIN_EXAMPLE,
  'critique-example': CRITIQUE_EXAMPLE,
  'action-example': ACTION_EXAMPLE,
  'policy-debate-example': POLICY_DEBATE_EXAMPLE,
  'decision-example': DECISION_EXAMPLE,
  'code-tutorial-example': CODE_TUTORIAL_EXAMPLE,
  'local-program-web': localProgram(LOCAL_ANSWER, { title: 'Acme', origin: 'https://ir.acme.example' }, 6),
  'local-program-file': localProgram(
    { title: '', tldr: 'Short.', takeaways: [{ text: 'One' }] },
    { title: 'a.pdf' },
    1,
  ),
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
// Brackets a model without enforced output got wrong (lib/local-model.ts reads its answers so).
for (const [broken, fixed] of [
  ['{"a": [1, 2}', '{"a":[1,2]}'],
  ['{"a": {"b": 1]}, "c": 2}', '{"a":{"b":1},"c":2}'],
  ['Here: {"t": "x", "y": [{"z": "q"]} more', '{"t":"x","y":[{"z":"q"}]}'],
  ['{"s": [{"h": "x", "p": ["a"]}]}]\n], "f": ["q"]}', '{"s":[{"h":"x","p":["a"]}]}'],
]) {
  let got = '';
  try {
    got = JSON.stringify(JSON.parse(repairJson(broken!)));
  } catch {
    got = 'invalid';
  }
  if (got === fixed) console.log(`✓ repairJson ${broken}`);
  else {
    failed++;
    console.error(`✗ repairJson ${broken}\n  - got ${got}`);
  }
}
// Numbers as spreadsheets export them (Google Sheets CSV keeps the display format).
for (const [text, want] of [
  ['1234', 1234],
  ['-3.5', -3.5],
  ['1,234,567.89', 1234567.89],
  ['$1,200', 1200],
  ['-$1,200.50', -1200.5],
  ['(450)', -450],
  ['12%', 12],
  ['€ 30', 30],
  ['30 ₫', 30],
  ['1,5', null],
  ['12,34', null],
  ['abc', null],
  ['', null],
] as const) {
  const got = parseNumber(text);
  if (got === want) console.log(`✓ parseNumber ${JSON.stringify(text)}`);
  else {
    failed++;
    console.error(`✗ parseNumber ${JSON.stringify(text)}\n  - got ${got}, want ${want}`);
  }
}
if (failed) process.exit(1);
