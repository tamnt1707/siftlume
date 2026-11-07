import { createParser, mergeStatements, type PromptOptions } from '@openuidev/react-lang';
import { diagramError } from './diagram';
import { openuiChatPromptOptions } from '@openuidev/react-ui';
import { library, ROOT } from './library';
import { CSV_TOOL_EXAMPLES, CSV_TOOL_SPECS } from './csv-tools';
import { VISUAL_SUMMARY_EXAMPLE } from './summary-example';
import { STYLE_RULES } from './refine';
import { CHART_SUMMARY_EXAMPLE } from './chart-example';
import { DIAGRAM_SUMMARY_EXAMPLE } from './diagram-example';
import type { ExtractedSource, SourceKind } from './extractors';
import type { Settings, SummaryLength } from './settings';

const parser = createParser(library.toJSONSchema(), ROOT);

// ── System prompts ─────────────────────────────────────────────────────────────

const LENGTH_RULES: Record<SummaryLength, string> = {
  short: 'Length: minimal. TL;DR + at most 3 key points (+ metrics if the source has numbers). No details section.',
  medium:
    'Length: medium. TL;DR, metrics/visuals, 3-6 key points, then a folded SectionBlock with 2-4 detail sections.',
  detailed:
    'Length: detailed, but still visual. TL;DR, metrics/visuals, key points, then a folded SectionBlock covering every important topic. Depth goes into folded sections, never into long paragraphs at the top.',
};

/**
 * Visual-first rules: the reader should get the gist in a few seconds without reading paragraphs.
 */
const VISUAL_RULES = [
  'VISUAL FIRST, MINIMAL TEXT. The reader must understand the source in 5 seconds. Prefer components over sentences.',
  'Always start with SummaryHero(title, tldr, source, readMinutes). For web pages omit source (the app already shows the site); for files pass the file name. The TL;DR is exactly one sentence, max 20 words. Do not add a separate CardHeader or TL;DR Callout.',
  'Headline numbers → KeyNumbers([KeyNumber(value, label, change)]) with 2-4 items. Never bury numbers in prose. Use a chart instead when there are 3+ comparable values of the same kind.',
  'Key points → Takeaways([Takeaway(text, detail)]): 3-6 statements of max 12 words, most important first. Use detail only when essential.',
  'Dated events or ordered stages → Timeline([TimelineEvent(when, what)]). Only for real sequences.',
  'Topics, entities, keywords → TagBlock. Pros vs cons or comparisons → a small Table. Warnings or caveats → Callout("warning", ...).',
  'No paragraphs longer than 2 short sentences. Avoid MarkDownRenderer at the top level; put longer explanations inside a folded SectionBlock.',
  'Skip any block that would be empty or filler. Do not repeat the same fact in several places.',
];

/** Chart selection by data shape. Applied whenever the source contains numbers. */
const CHART_RULES = [
  'CHARTS: when the source has 3+ comparable numbers (tables, statistics, prices, results, survey data, timelines), visualize them. One chart per insight, each preceded by TextContent(insight, "small-heavy") that states the takeaway in max 8 words.',
  'Pick the chart by data shape: values over time (years, months, quarters) → LineChart (AreaChart for cumulative/volume); comparing categories → BarChart (≤8 bars) or HorizontalBarChart for long labels and rankings; parts of a whole/percent shares → PieChart "donut" (≤6 slices) or SingleStackedBarChart; several series over the same categories → BarChart "grouped" or LineChart with multiple Series; a single score/progress out of 100 → RadialChart; 2-4 items compared on 3-6 attributes → RadarChart; relationship between two numeric variables → ScatterChart.',
  'Chart data must come from the source, never estimated. Keep units in the Series name or axis label (e.g. "Revenue ($B)"). Max 12 data points; with fewer than 3 values use KeyNumbers instead.',
  'Do not chart the same numbers twice, and do not add a chart when there is no real numeric comparison.',
];

/** When and how to draw Mermaid diagrams (rendered by Pele). */
const DIAGRAM_RULES = [
  'DIAGRAMS: use Diagram(mermaid, caption) only when structure is easier to see than to read: a process or workflow with 4+ steps or branches (flowchart), decision logic (flowchart with {decision} nodes), messages between 2+ actors over time (sequenceDiagram), a lifecycle (stateDiagram-v2), a concept map (mindmap), a data model (erDiagram). At most one diagram per summary unless the source is mainly about processes.',
  'Mermaid rules: 4-12 nodes, labels of 1-5 words, ids without spaces (A, B, step1), wrap labels containing punctuation in double quotes, no style/classDef/click/linkStyle, no HTML, no icons or images. Use "flowchart TD" by default; "flowchart LR" only for linear flows of at most 5 nodes (the app flips wide flows to top-down on narrow screens). Inside the openui-lang string, write line breaks as \\n and escape inner double quotes as \\".',
  'Never use a diagram for plain lists or for numbers (use Takeaways or charts), and do not repeat the same steps in both a Diagram and a Timeline.',
];

const LAYOUT_RULES = {
  tab: 'The UI is shown full page (~800px wide). KeyNumbers with up to 4 items, tables up to 5 columns, charts welcome.',
  sidepanel:
    'The UI is shown in a narrow side panel (~400px wide). Single column: KeyNumbers with max 3 items, tables max 3 columns, charts are fine but keep them simple (≤8 points).',
} as const;

const KIND_RULES: Record<SourceKind, string> = {
  webpage:
    'The source is a web page converted to Markdown. Ignore navigation, ads and boilerplate. Pass the page as the only item of Card sources and cite it as [1]. Use SourceQuote (or a Button with @HighlightInPage) for 1-3 verbatim quotes that back key claims.',
  text: 'The source is text pasted by the user. Do not use @HighlightInPage.',
  pdf: 'The source is text extracted from a PDF; ignore broken line breaks and repeated headers/footers. Mention page numbers when useful. Do not use @HighlightInPage.',
  markdown: 'The source is a Markdown document. Do not use @HighlightInPage.',
  csv: 'The source is a CSV dataset. Describe what it contains, important columns, ranges, trends and outliers. Use Query("csv_group", ...) and Query("csv_rows", ...) for charts and tables instead of hard-coding numbers, and add a filter Form with a Select bound to a $variable when a text column has few distinct values. Do not use @HighlightInPage.',
};

const SHARED_RULES = [
  'Only use information present in the source. Never invent facts, numbers or quotes. SourceQuote and @HighlightInPage text must be copied verbatim from the source.',
  'Use @CopyText for things the user may want to copy (e.g. a ready-to-paste summary paragraph, commands, emails).',
  'Use @OpenUrl only with links that appear in the source.',
];

function basePromptOptions(): PromptOptions {
  return {
    ...openuiChatPromptOptions,
    additionalRules: [...(openuiChatPromptOptions.additionalRules ?? []), ...SHARED_RULES],
  };
}

/** Layout depends on where the result is shown (Settings → Display). */
function layoutRule(settings: Settings) {
  return LAYOUT_RULES[settings.display] ?? LAYOUT_RULES.tab;
}

function userRules(settings: Settings) {
  const lang = settings.language.trim();
  return [
    !lang || lang === 'auto'
      ? 'Write ALL user-facing text in the same language as the source.'
      : `Write ALL user-facing text in ${lang}, even if the source is in another language.`,
    settings.customInstructions.trim() && `User's own instructions: ${settings.customInstructions.trim()}`,
  ].filter(Boolean) as string[];
}

function toolOptions(source: ExtractedSource): Partial<PromptOptions> {
  // Enable Query/$bindings only when there is data to query; keeps the prompt lean otherwise.
  if (source.kind !== 'csv' || !source.csv) return {};
  return { tools: CSV_TOOL_SPECS, toolExamples: CSV_TOOL_EXAMPLES, toolCalls: true, bindings: true };
}

const promptCache = new Map<string, string>();

function cachedPrompt(key: string, build: () => string) {
  let p = promptCache.get(key);
  if (!p) promptCache.set(key, (p = build()));
  return p;
}

/**
 * Summary prompt. editMode: refinement turns return only changed statements (merged with
 * mergeStatements). inlineMode: the model may add a short sentence outside the code fence.
 */
export function buildSummaryPrompt(settings: Settings, source: ExtractedSource) {
  const base = cachedPrompt(`summary:${source.kind}:${!!source.csv}`, () =>
    library.prompt({
      ...basePromptOptions(),
      // A visual-first example (validated with the parser) next to the library's own examples.
      examples: [
        ...(openuiChatPromptOptions.examples ?? []),
        VISUAL_SUMMARY_EXAMPLE,
        CHART_SUMMARY_EXAMPLE,
        DIAGRAM_SUMMARY_EXAMPLE,
      ],
      ...toolOptions(source),
      preamble:
        'You are a visual summarization assistant. You turn the source content the user provides into a glanceable summary UI written in openui-lang (metrics, short lists, tags, timelines; as little prose as possible), and you refine that UI when asked.',
      editMode: true,
      inlineMode: true,
    }),
  );
  const rules = [
    ...VISUAL_RULES,
    ...CHART_RULES,
    ...DIAGRAM_RULES,
    LENGTH_RULES[settings.length],
    ...settings.styles.map((s) => STYLE_RULES[s]),
    layoutRule(settings),
    KIND_RULES[source.kind],
    'Order: SummaryHero → KeyNumbers / charts / Diagram → Takeaways → TagBlock / Timeline → SourceQuote → folded SectionBlock details → FollowUpBlock with 2-3 short questions.',
    'First turn: output the complete program in one ```openui-lang fence. Refinement turns: output only the changed statements, with at most one short sentence outside the fence describing the change.',
    ...userRules(settings),
  ];
  return `${base}\n\n## Summarization task\n${rules.map((r) => `- ${r}`).join('\n')}`;
}

/** Q&A prompt. inlineMode: simple questions get plain text, structured answers get a UI. */
export function buildQaPrompt(settings: Settings, source: ExtractedSource) {
  const base = cachedPrompt(`qa:${source.kind}:${!!source.csv}`, () =>
    library.prompt({
      ...basePromptOptions(),
      ...toolOptions(source),
      preamble:
        'You answer follow-up questions about a source document the user is reading. Each answer is a new, self-contained response.',
      inlineMode: true,
    }),
  );
  const rules = [
    ...CHART_RULES,
    ...DIAGRAM_RULES,
    'Questions about how something works, a process or a flow: answer with a Diagram plus 1-2 lines.',
    'Short factual answers: 1-3 plain sentences. Answers with structure (comparisons, steps, lists, numbers): a compact openui-lang Card in a fence, visual first with minimal text.',
    layoutRule(settings),
    'If the source does not contain the answer, say so plainly instead of guessing.',
    KIND_RULES[source.kind],
    ...userRules(settings),
  ];
  return `${base}\n\n## Q&A task\n${rules.map((r) => `- ${r}`).join('\n')}`;
}

export function buildSourceMessage(source: ExtractedSource, truncated: boolean) {
  return [
    `Source type: ${source.kind}`,
    `Title: ${source.title}`,
    source.origin ? `Origin: ${source.origin}` : '',
    truncated ? 'Note: the source was truncated to fit the context window.' : '',
    '',
    '<source>',
    source.content,
    '</source>',
  ]
    .filter((l) => l !== '')
    .join('\n');
}

// ── Inline-mode response handling ──────────────────────────────────────────────

const FENCE = /^[ \t]*```[ \t]*([\w.+-]*)[ \t]*$/;
const STATEMENT = /^\s*\$?[A-Za-z_]\w*\s*=(?!=)/;

export interface SplitResponse {
  /** Text outside code fences (rendered as Markdown). */
  prose: string;
  /** OpenUI Lang program (empty for text-only answers). */
  code: string;
}

/**
 * Splits an inline-mode response into prose and code. The Renderer strips fences itself, but
 * the host must render the prose, and mergeStatements needs plain code.
 * Works while streaming (unclosed fence).
 */
export function splitInline(text: string): SplitResponse {
  const prose: string[] = [];
  const code: string[] = [];
  let inFence = false;
  let fenceIsCode = false;
  let sawFence = false;

  for (const line of text.split('\n')) {
    const fence = FENCE.exec(line);
    if (fence) {
      sawFence = true;
      if (inFence) {
        inFence = false;
      } else {
        inFence = true;
        const tag = (fence[1] ?? '').toLowerCase();
        fenceIsCode = tag === '' || tag.startsWith('openui');
      }
      continue;
    }
    if (inFence && fenceIsCode) code.push(line);
    else if (inFence)
      prose.push(line); // other code blocks (e.g. ```ts) stay in the prose
    else prose.push(line);
  }

  // The model forgot the fence but wrote a program: treat everything as code.
  if (!sawFence && STATEMENT.test(text.split('\n').find((l) => l.trim()) ?? '')) {
    return { prose: '', code: text.trim() };
  }
  // The fence holds prose, not a program: give it back to the prose.
  if (code.length && !code.some((l) => STATEMENT.test(l))) {
    return { prose: text.trim(), code: '' };
  }
  return { prose: prose.join('\n').trim(), code: code.join('\n').trim() };
}

// ── Validation & correction ────────────────────────────────────────────────────

export interface ValidationResult {
  ok: boolean;
  errors: string[];
}

/** Validates a finished program; errors are LLM-readable so they can be sent back for correction. */
export function validateProgram(program: string): ValidationResult {
  const result = parser.parse(program);
  const errors = (result.meta?.errors ?? []).map((e) => `${e.statementId ? `"${e.statementId}": ` : ''}${e.message}`);
  if (!result.root) errors.unshift(`No root component. The program must define \`root = ${ROOT}([...])\`.`);
  if (result.meta?.unresolved?.length)
    errors.push(`These references are used but never defined: ${result.meta.unresolved.join(', ')}`);
  return { ok: errors.length === 0, errors };
}

/** Every Diagram node in a parsed tree (props are already mapped to names by the parser). */
function collectDiagrams(node: unknown, out: { id?: string; mermaid: string }[] = []) {
  if (Array.isArray(node)) {
    for (const n of node) collectDiagrams(n, out);
  } else if (node && typeof node === 'object') {
    const el = node as { type?: string; typeName?: string; statementId?: string; props?: Record<string, unknown> };
    if (el.type === 'element' && el.typeName === 'Diagram' && typeof el.props?.mermaid === 'string') {
      out.push({ id: el.statementId, mermaid: el.props.mermaid });
    }
    if (el.props) for (const v of Object.values(el.props)) collectDiagrams(v, out);
  }
  return out;
}

/** Renders every Diagram with Pele and reports Mermaid errors, so the repair turn can fix them too. */
export async function validateDiagrams(program: string): Promise<string[]> {
  const root = parser.parse(program).root;
  const errors: string[] = [];
  for (const d of collectDiagrams(root)) {
    const err = await diagramError(d.mermaid);
    if (err) errors.push(`${d.id ? `"${d.id}": ` : ''}Diagram ${err}`);
  }
  return errors;
}

export function buildRepairMessage(errors: string[], editMode: boolean) {
  return [
    'Your openui-lang output has errors:',
    ...errors.map((e) => `- ${e}`),
    editMode
      ? 'Output only the corrected statements in one ```openui-lang fence. No explanation.'
      : 'Output the complete corrected program in one ```openui-lang fence. No explanation.',
  ].join('\n');
}

/** Applies an edit-mode patch. On the first turn (no program yet) the patch is the program. */
export function applyPatch(previous: string, patch: string) {
  if (!previous.trim()) return patch;
  if (!patch.trim()) return previous;
  return mergeStatements(previous, patch);
}
