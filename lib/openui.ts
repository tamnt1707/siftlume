import { createParser, mergeStatements, type PromptOptions } from '@openuidev/react-lang';
import { diagramError } from './diagram';
import { openuiChatPromptOptions } from '@openuidev/react-ui';
import { library, ROOT } from './library';
import { CSV_TOOL_EXAMPLES, CSV_TOOL_SPECS } from './csv-tools';
import { VISUAL_SUMMARY_EXAMPLE } from './summary-example';
import { STYLE_RULES } from './refine';
import { CHART_SUMMARY_EXAMPLE } from './chart-example';
import { DIAGRAM_SUMMARY_EXAMPLE } from './diagram-example';
import { NEWS_ACTORS_EXAMPLE, REVIEW_SUMMARY_EXAMPLE } from './review-example';
import { PRODUCT_COMPARE_EXAMPLE, RELEASE_NOTES_EXAMPLE, RESEARCH_PAPER_EXAMPLE } from './domain-example';
import { ACTION_EXAMPLE, CRITIQUE_EXAMPLE, EXPLAIN_EXAMPLE } from './mode-example';
import { CODE_TUTORIAL_EXAMPLE, DECISION_EXAMPLE, POLICY_DEBATE_EXAMPLE } from './analysis-example';
import { customModeRule, MODE_QA_RULES, MODE_RULES, resolveMode, type AnalysisMode } from './modes';
import type { ExtractedSource, SourceKind } from './extractors';
import type { StructuredType } from './structured';
import type { Settings, SummaryLength } from './settings';

const parser = createParser(library.toJSONSchema(), ROOT);

// ── System prompts ─────────────────────────────────────────────────────────────

/** Length sets how much, never which blocks: the structure comes from the mode and the source. */
const LENGTH_RULES: Record<SummaryLength, string> = {
  short: 'Length: minimal. SummaryHero plus 1-3 blocks. No folded details.',
  medium:
    'Length: medium. SummaryHero plus 3-6 blocks; add a folded SectionBlock only if important detail would otherwise be lost.',
  detailed:
    'Length: detailed, but still visual. SummaryHero plus 5-9 blocks, then a folded SectionBlock covering the remaining important topics. Depth goes into folded sections, never into long paragraphs at the top.',
  full: 'Length: full report. This overrides the minimal-text limits above (block counts, 12-word takeaways, 2-sentence paragraphs) but not the choice of blocks. The reader wants everything important without reading the source: cover every main topic and section of the source, in its order. After SummaryHero and the visual blocks that fit (numbers, charts, timeline…), add SectionBlock([...], false) (not foldable: everything shown open) with one SectionItem per topic of the source; each holds MarkDownRenderer text of 2-5 short paragraphs or bullet lists keeping every important fact, number, name, example and argument of that topic. Takeaway details may be 1-2 full sentences. Completeness wins over brevity; still never pad or repeat.',
};

/**
 * Layout by source type, so different pages get different shapes instead of one template.
 * Only SummaryHero (first) and FollowUpBlock (last) are fixed.
 */
const STRUCTURE_RULES = [
  'STRUCTURE: choose the structure from the source and the mode, not from a template. Two different kinds of source should rarely produce the same sequence of blocks. Only SummaryHero (first) and FollowUpBlock with 2-3 short questions (last) are fixed.',
  "After SummaryHero, lead with the block that answers the reader's first question for this kind of source: news → what happened (Timeline or Takeaways) or why (CauseEffect), then People or Perspectives, ClaimCheck if contested; policy or law → BeforeAfter, then Perspectives and Scenarios; product or review → Verdict, FactSheet or Comparison, then ProsCons or PricingPlans; buying guide or decision → DecisionMatrix, then Calculation for the cost; how-to, tutorial or recipe → FactSheet (time, level, what you need), then Steps; research or study → ResearchBrief, then a chart; opinion or essay → ArgumentMap, then ClaimCheck; documentation or tutorial → Tree for the structure, CodeWalkthrough or Steps, then Glossary; business or strategy → Matrix2x2 (SWOT) and Scenarios; data, report or finance → KeyNumbers and charts; release notes or policy changes → ChangeList, then RiskList; project or status update → StatusBoard; story, biography or history → Timeline and People.",
  'Use KeyNumbers only for real headline figures and Takeaways only for separate points; neither is required. Mix block types: avoid two text lists in a row, and use a domain block (FactSheet, Comparison, RiskList…) when the source fits one.',
];

/** Examples shown to the model, the mode's own first (models lean on the first example). */
const MODE_EXAMPLES: Record<AnalysisMode, string[]> = {
  summary: [
    NEWS_ACTORS_EXAMPLE,
    PRODUCT_COMPARE_EXAMPLE,
    POLICY_DEBATE_EXAMPLE,
    RESEARCH_PAPER_EXAMPLE,
    CHART_SUMMARY_EXAMPLE,
    CODE_TUTORIAL_EXAMPLE,
    REVIEW_SUMMARY_EXAMPLE,
    RELEASE_NOTES_EXAMPLE,
    DIAGRAM_SUMMARY_EXAMPLE,
    VISUAL_SUMMARY_EXAMPLE,
  ],
  explain: [EXPLAIN_EXAMPLE, CODE_TUTORIAL_EXAMPLE, DIAGRAM_SUMMARY_EXAMPLE, CHART_SUMMARY_EXAMPLE],
  critique: [CRITIQUE_EXAMPLE, POLICY_DEBATE_EXAMPLE, RESEARCH_PAPER_EXAMPLE, NEWS_ACTORS_EXAMPLE],
  action: [ACTION_EXAMPLE, DECISION_EXAMPLE, RELEASE_NOTES_EXAMPLE, PRODUCT_COMPARE_EXAMPLE],
};

/**
 * Visual-first rules: the reader should get the gist in a few seconds without reading paragraphs.
 */
const VISUAL_RULES = [
  'VISUAL FIRST, MINIMAL TEXT. The reader must understand the source in 5 seconds. Prefer components over sentences.',
  'Always start with SummaryHero(title, tldr, source, readMinutes). For web pages omit source (the app already shows the site); for files pass the file name. The TL;DR is exactly one sentence, max 20 words. Do not add a separate CardHeader or TL;DR Callout.',
  'Headline numbers → KeyNumbers([KeyNumber(value, label, change)]) with 2-4 items. Never bury numbers in prose. Use a chart instead when there are 3+ comparable values of the same kind.',
  'Separate key points → Takeaways([Takeaway(text, detail)]): 3-6 statements of max 12 words, most important first. Use detail only when essential.',
  'Explaining a concept → Analogy (an everyday comparison) and Misconceptions (myth vs fact), next to a Diagram or Steps for how it works.',
  'Dated events or ordered stages → Timeline([TimelineEvent(when, what)]). Only for real sequences.',
  'Reviews, opinions and decisions → ProsCons. A score stated in the source (e.g. 8/10, 4.5 stars) → Verdict; never invent a score.',
  '2-8 comparable numbers (shares, rankings, test results) → BarList, which is lighter than a chart and works in narrow spaces. Use a chart instead for trends over time or more than 8 values.',
  'Things the reader can do → Checklist (not Takeaways). Several named people or organizations → People (max 6). Technical terms the reader may not know → Glossary (max 6).',
  'Label/value details (specs, recipe times and servings, event date and venue, job terms, company profile) → FactSheet, not prose or a Table. How-to instructions and recipes → Steps.',
  '2-4 products, plans or tools compared on several attributes → Comparison (mark best only when the source says so). Price tiers → PricingPlans. Prices and features exactly as written in the source.',
  'Risks, side effects, vulnerabilities or red flags → RiskList graded high/medium/low, instead of several warning Callouts.',
  'News, opinion, health, science or marketing claims → ClaimCheck for the 2-5 main claims, judged only by the evidence the source itself gives.',
  'Project updates and roadmaps grouped by status → StatusBoard. Release notes, changelogs and amended laws, policies or terms → ChangeList.',
  'Persuasive sources (op-eds, essays, proposals, rulings) → ArgumentMap: the thesis with arguments for and against and their evidence. Why something happened and what follows → CauseEffect. Several parties with different views on one issue → Perspectives.',
  'Choosing between options the source judges → DecisionMatrix (scores 1-5 grounded in the source, weights for what matters most). Possible futures (forecasts, outlooks) → Scenarios. SWOT or impact/effort analyses → Matrix2x2.',
  'A new law, policy, price or redesign → BeforeAfter, aspect by aspect. A figure worked out from parts (total cost, tax, savings, dosage) → Calculation; use only numbers from the source.',
  'A hierarchy (topic breakdown, taxonomy, org chart, folder structure, course outline) → Tree. Code the source explains → CodeWalkthrough with notes on line ranges. A link the reader will open on a phone (download, sign-up, tickets, map) → QrCode, only with a URL written in the source.',
  'Research papers, studies, trials and surveys → ResearchBrief (question, findings, method, sample, limitations) right after SummaryHero, instead of Takeaways for the findings.',
  'Topics, entities, keywords → TagBlock. Comparing options across several attributes → a small Table. Warnings or caveats → Callout("warning", ...).',
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
  phone:
    'The UI is shown on a phone screen (~380px wide). Single column: KeyNumbers with max 2 items, tables max 3 columns, short labels, charts simple (≤6 points).',
} as const;

const KIND_RULES: Record<SourceKind, string> = {
  webpage:
    'The source is a web page converted to Markdown. Ignore navigation, ads and boilerplate. Pass the page as the only item of Card sources and cite it as [1]. Use SourceQuote (or a Button with @HighlightInPage) for 1-3 verbatim quotes that back key claims.',
  text: 'The source is text pasted by the user. Do not use @HighlightInPage.',
  pdf: 'The source is text extracted from a PDF; ignore broken line breaks and repeated headers/footers. Mention page numbers when useful. Do not use @HighlightInPage.',
  markdown: 'The source is a Markdown document. Do not use @HighlightInPage.',
  video:
    'The source is the transcript of a YouTube video: paragraphs led by [m:ss] timestamps. Summarize what is said, not the transcript format; automatic captions may misspell names and terms, so fix obvious slips silently. Give key moments with their timestamps (Timeline with when set to the timestamp, e.g. "12:34"). Pass the video as the only item of Card sources and cite it as [1]. For SourceQuote and @HighlightInPage, copy a short phrase verbatim from the transcript without the timestamp: clicking it plays the video from that moment.',
  pr: [
    'The source is a GitHub pull request in Markdown: metadata (state, branches, size, review decisions, CI checks), the description, reviews, the conversation, review threads on code (each with the diff lines it is about), commits, then the diff file by file (unified diff; lockfiles and generated files are left out and only listed).',
    'Explain what the change does and why, grouped by area (API, UI, data and migrations, config, tests, docs) rather than file by file. Give the review state: who approved, who requested changes, which review threads look unanswered or unresolved and who they wait for, and failing CI checks. Flag risks visible in the diff: breaking changes, security, performance, data migrations, missing or changed tests.',
    'Refer to code as `path:line`, with line numbers of the new file read from the hunk headers (@@ -a,b +c,d @@). Use @OpenUrl with the file and thread links given in the source so the reader can jump there.',
    'In CRITIQUE mode, review the code like a careful senior reviewer: concrete problems in the diff (bugs, unhandled edge cases and errors, races, security issues, breaking changes, missing tests), each with `path:line`, why it matters and a suggested fix, most severe first; then what is solid. Reason about the code itself, but only about code shown in the diff; say when a concern depends on code not shown. Do not repeat points reviewers already raised unless they are still open. In ACTION mode, lead with a checklist of what must happen before merging (open review threads, requested changes, failing checks, missing tests or docs) and who owns each item. In EXPLAIN mode, explain the change for someone new to the codebase.',
    'Pass the pull request as the only item of Card sources and cite it as [1]. For SourceQuote and @HighlightInPage copy a short phrase verbatim from the description or a comment, never from the diff: clicking it highlights it in the pull request page.',
  ].join(' '),
  multi:
    'The source is several documents (browser tabs, or a page and pages it links to), each wrapped in <document index title url type>. When the user says document 1 is the page they are reading, summarize document 1 and use the others to complete it: add what they say that document 1 only points to, and cite them. Otherwise combine and compare them: lead with what they agree on, then where they differ or contradict (Comparison for products, plans or options; Perspectives for viewpoints; ClaimCheck when they disagree on facts), then what only one of them covers. Say which document a point comes from (its site or a short title). List every document as Card sources in index order and cite them as [1], [2]… Documents with type="video" are YouTube transcripts led by [m:ss] timestamps: give the timestamp with points taken from them (e.g. "[2] at 12:34"). Omit SummaryHero source. For SourceQuote and @HighlightInPage copy a short phrase verbatim from one document: clicking it opens that tab.',
  csv: 'The source is a CSV dataset. Describe what it contains, important columns, ranges, trends and outliers. Use Query("csv_group", ...) and Query("csv_rows", ...) for charts and tables instead of hard-coding numbers, and add a filter Form with a Select bound to a $variable when a text column has few distinct values. Do not use @HighlightInPage.',
};

/**
 * Layout for pages with schema.org data (lib/structured.ts): the block at the top of the source
 * holds the page's own facts for that kind of page.
 */
const STRUCTURED_RULES: Record<StructuredType, string> = {
  Recipe:
    'The page is a recipe (see "Structured data" at the top of the source). Lead with what the dish is, then KeyNumbers for total time, yield and calories when given. Ingredients as a Checklist with quantities exactly as written, grouped as the recipe groups them; then the steps in order, numbered, under the recipe\'s own section names. Then the tips, substitutions, storage and make-ahead notes the page gives. Skip the life story before the recipe unless it holds a tip. Never invent or convert quantities unless asked.',
  Product:
    'The page is a product (see "Structured data" at the top of the source). Lead with a Verdict built only from the page\'s rating and reviews (who it suits, the main caveat). KeyNumbers: price with currency and availability, rating with the number of reviews. ProsCons from what reviews praise or complain about repeatedly (say how many mention it when countable). FactSheet for the key specs. Mention sale end dates and price ranges. Never invent ratings, prices or specs.',
  JobPosting:
    'The page is a job posting (see "Structured data" at the top of the source). Lead with role, company, location or remote, salary exactly as given (with currency and period) and the deadline. Then two Checklists: must-have and nice-to-have requirements. Then what the job involves day to day, benefits, and how to apply (Button with @OpenUrl to the apply link). Say what the posting leaves out (no salary, vague duties, unclear level).',
  Event:
    'The page is an event (see "Structured data" at the top of the source). Lead with what, when (date, time and time zone as given) and where (venue address, or online). A cancelled, postponed or moved-online status goes first. FactSheet for date, place, price and ticket availability; Buttons with @OpenUrl to the ticket link and to the "Add to Google Calendar" link given in the source. Then programme, speakers or performers.',
};

const STRUCTURED_SHARED =
  'The "Structured data" block comes from the page\'s own markup: prefer it for numbers (prices, times, salaries, dates); when it disagrees with the page text, say so.';

function structuredRules(source: ExtractedSource) {
  const found = source.structured ?? [];
  return found.length ? [...found.map((t) => STRUCTURED_RULES[t]), STRUCTURED_SHARED] : [];
}

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

/** Layout depends on where the result is shown (Settings → Display), or the phone screen it is on. */
function layoutRule(settings: Settings) {
  const phone = typeof window !== 'undefined' && window.innerWidth > 0 && window.innerWidth < 520;
  return phone ? LAYOUT_RULES.phone : (LAYOUT_RULES[settings.display] ?? LAYOUT_RULES.tab);
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
  const { base: mode, custom } = resolveMode(settings.mode, settings.customModes);
  const base = cachedPrompt(`summary:${mode}:${source.kind}:${!!source.csv}`, () =>
    library.prompt({
      ...basePromptOptions(),
      // Validated examples (pnpm check:examples), the mode's own first, after the library's own.
      examples: [...(openuiChatPromptOptions.examples ?? []), ...MODE_EXAMPLES[mode]],
      ...toolOptions(source),
      preamble:
        'You are a visual reading assistant. You turn the source content the user provides into a glanceable UI written in openui-lang (as little prose as possible), shaped by the analysis mode below, and you refine that UI when asked.',
      editMode: true,
      inlineMode: true,
    }),
  );
  const rules = [
    ...MODE_RULES[mode],
    ...(custom ? [customModeRule(custom)] : []),
    ...VISUAL_RULES,
    ...CHART_RULES,
    ...DIAGRAM_RULES,
    ...STRUCTURE_RULES,
    LENGTH_RULES[settings.length],
    ...settings.styles.map((s) => STYLE_RULES[s]),
    layoutRule(settings),
    KIND_RULES[source.kind],
    ...structuredRules(source),
    'First turn: output the complete program in one ```openui-lang fence. Refinement turns: output only the changed statements, with at most one short sentence outside the fence describing the change.',
    ...userRules(settings),
  ];
  return `${base}\n\n## Analysis task\n${rules.map((r) => `- ${r}`).join('\n')}`;
}

function qaModeRules(settings: Settings) {
  const { base, custom } = resolveMode(settings.mode, settings.customModes);
  return [MODE_QA_RULES[base], ...(custom ? [customModeRule(custom)] : [])];
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
    ...qaModeRules(settings),
    KIND_RULES[source.kind],
    ...(source.structured?.length ? [STRUCTURED_SHARED] : []),
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
    source.digest
      ? 'Note: the source is long, so it was read part by part; below are thorough notes on every part, in order. Cover all parts, not only the first. Quotes in quotation marks are verbatim from the source.'
      : '',
    '',
    '<source>',
    source.digest ?? source.content,
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
