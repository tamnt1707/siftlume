/**
 * Analysis modes: what the reader wants from the source. Each mode has its own goal, layout and
 * favourite blocks, so a summary, an explanation, a critique and an action list look different.
 * Instructions are for the model, so they stay in English; labels live in the locales.
 */

export type AnalysisMode = 'summary' | 'explain' | 'critique' | 'action' | 'guide';
export const ANALYSIS_MODES: AnalysisMode[] = ['summary', 'explain', 'critique', 'action', 'guide'];

/** "auto": the mode is picked from the source when the analysis starts (autoMode). The default. */
export const AUTO = 'auto';

/** The user turn that asks for the analysis (also replayed before follow-up questions). */
export const MODE_TASK: Record<AnalysisMode, string> = {
  summary: 'Summarize this source.',
  explain: 'Explain this source so I really understand it.',
  critique: 'Critically assess this source: how far can I trust it?',
  action: 'Tell me what I need to do, decide or remember based on this source.',
  guide: 'Turn this source into a step-by-step guide I can follow.',
};

/** Rules for the first analysis and its refinements. */
export const MODE_RULES: Record<AnalysisMode, string[]> = {
  summary: [
    'MODE: SUMMARY. Goal: the reader grasps the whole source in seconds: what it is about and its most important facts.',
  ],
  explain: [
    'MODE: EXPLAIN. Goal: the reader understands the subject, even as a beginner. Do not just list what the source says; teach it.',
    'SummaryHero tldr: the core idea in one plain sentence.',
    'Build understanding in order: what it is → why it matters → how it works (Diagram for processes and relationships, Steps for procedures) → causes and effects (CauseEffect) or how the parts fit together (Tree) when the topic has them → an Analogy from everyday life → Misconceptions the source corrects or that beginners often have → a Glossary of the terms used. Add a worked example from the source when it has one: a Calculation for numbers, a CodeWalkthrough for code.',
    'Plain words, short sentences, every term defined on first use. Numbers only when they help understanding. The Analogy is your own illustration; every fact must still come from the source.',
  ],
  critique: [
    'MODE: CRITIQUE. Goal: help the reader judge how far to trust the source. Be neutral and fair: credit what is solid, flag what is weak.',
    'SummaryHero tldr: the main claim and how well the source supports it, in one sentence.',
    'Cover: the main claims and how the source backs them (ClaimCheck) → how the argument is built, for and against (ArgumentMap; ProsCons for non-persuasive sources) → who disagrees and why (Perspectives) when the source reports other views → missing context, one-sided sourcing, loaded wording or conflicts of interest visible in the source (RiskList) → what a careful reader should check next (Checklist). Back key claims with SourceQuote.',
    'Judge only what is in the source: the evidence it gives, what it leaves out, who it quotes. Never use outside knowledge to declare a claim true or false; say what evidence is missing instead.',
  ],
  action: [
    'MODE: ACTION. Goal: what the reader should do, decide or remember. Skip background unless it is needed to act.',
    'SummaryHero tldr: the single most important thing to do or decide.',
    'Lead with a Checklist of concrete actions, most urgent first (ActionItems instead when the source names owners, due dates or states). Then, as the source supports: deadlines and dates (Timeline), requirements, costs, contacts or eligibility (FactSheet), decisions with their options (DecisionMatrix when the source judges them, Comparison or ProsCons otherwise), costs worked out (Calculation), what changes for the reader (BeforeAfter), how-to steps (Steps), links to open on a phone (QrCode), and the risks of not acting (RiskList).',
    'If the source has nothing actionable, say so in the tldr and give the closest practical takeaways.',
  ],
  guide: [
    'MODE: GUIDE. Goal: the reader can follow it and get the task done, step by step. Write instructions to the reader (imperative: "Open", "Run", "Set"), not a description of the document.',
    'SummaryHero tldr: what the reader will have done at the end, and how long or how hard it is when the source says.',
    'Order: before you start (FactSheet: time, level, what you need; a Checklist of prerequisites such as accounts, permissions, versions or backups) → the steps in order (Steps: one action per StepsItem, its title a short imperative, its details what to do and what you should see after, with the exact commands, settings, values and file names; for a long procedure one Steps block per phase the source names, each after a TextContent heading) → a Callout("warning", ...) right before a step that can lose data or break something → how to check it worked (Checklist) → common problems and their fixes from the source (Findings or Takeaways) → what to do next.',
    'Commands are the point of a guide: copy every command, config line and value the source gives for a step, exactly, into that step. A step that is one command: StepsItem(title, CodeBlock(language, command)). Text and a command: Markdown details with the command in a fenced block, line breaks written as \\n ("Run:\\n```bash\\nkubectl get pods\\n```"). Several commands in a row stay in one block, in order. Never leave a phase heading without its Steps.',
    "Never invent a step, command or value the source does not give; when the source skips one or is ambiguous, say so at that step. Keep the source's own order unless it is clearly wrong, and then say why.",
  ],
};

/** Shorter guidance for follow-up answers in each mode. */
export const MODE_QA_RULES: Record<AnalysisMode, string> = {
  summary: 'Answer directly and briefly.',
  explain:
    'The reader is learning: answer so a beginner understands, with an example, a Diagram or an Analogy when it helps.',
  critique:
    'The reader is evaluating the source: say what evidence the source gives for the answer and what is missing.',
  action: 'The reader wants to act: answer with the concrete steps, dates or requirements from the source.',
  guide:
    'The reader is following the guide: answer with the exact steps, commands or settings from the source, in order, and say which step the answer belongs to.',
};

// ── Custom reading modes ───────────────────────────────────────────────────────

/** A reading mode the user wrote: a name, what they want, and the built-in mode it builds on. */
export interface CustomMode {
  id: string;
  name: string;
  /** The reader's own instructions, in any language. */
  instruction: string;
  /** Built-in mode whose layout and examples it starts from. */
  base: AnalysisMode;
}

/** A built-in mode, "auto", or "custom:<id>" for one of the user's. */
export type ModeId = AnalysisMode | typeof AUTO | `custom:${string}`;

export const MAX_CUSTOM_MODES = 8;
export const customModeId = (m: CustomMode): ModeId => `custom:${m.id}`;

/** Custom modes that can run: named and with instructions. */
export const usableCustomModes = (modes: CustomMode[] = []) =>
  modes.filter((m) => m.name.trim() && m.instruction.trim());

/** What autoMode needs to know about the source. */
export interface ModeSource {
  kind: string;
  title?: string;
  content?: string;
  structured?: readonly string[];
}

/** Titles of how-to pages, in the interface's languages. */
const GUIDE_TITLE =
  /\b(how[ -]to|tutorial|guide|getting started|step[ -]by[ -]step|walkthrough|quick ?start|set ?up|setting up|install(ing|ation)?|configur(e|ing|ation)|deploy(ing|ment)?|migrat(e|ing|ion)|runbook|playbook|cómo|guía|instalación|anleitung|installation|einrichten|comment|tutoriel|como|guia|instalação)\b|hướng dẫn|cách |cài đặt|thiết lập|triển khai|từng bước|手順|使い方|入門|導入|設定方法|教程|指南|如何|怎么|設定|안내|방법|가이드|설치|руководство|инструкция|как |установка|วิธี|คู่มือ|ติดตั้ง/iu;

/** Guides to choosing or buying something read better as a summary (verdicts, comparisons). */
const CHOICE_TITLE = /\b(buying|gift|price|shopping|style) guide\b|hướng dẫn (mua|chọn)/iu;

/** Titles of pages that are mostly things to do by a date. */
const ACTION_TITLE = /\b(checklist|deadline|to-?do|how to apply)\b|hạn chót|hạn nộp|việc cần làm|締め切り|截止|마감/iu;

/** Numbered steps in the text ("1." "2)" "Step 3" "Bước 4" "手順5"…). */
const STEP_LINE =
  /^\s*(?:\d{1,2}[.)]\s|(?:step|bước|paso|étape|schritt|passo|шаг|ขั้นตอน(?:ที่)?)\s*\d|(?:手順|ステップ|第)\s*\d)/gimu;

/**
 * The mode "auto" picks from the source, without a request to the model: a guide for how-to
 * pages, recipes and step-by-step instructions; action for job postings, events and checklists;
 * a summary for everything else (and for pull requests, sheets and several sources, whose
 * summaries already follow their own layout).
 */
export function autoMode(source?: ModeSource | null): AnalysisMode {
  if (!source || ['pr', 'csv', 'multi'].includes(source.kind)) return 'summary';
  const structured = source.structured ?? [];
  if (structured.includes('Recipe')) return 'guide';
  if (structured.includes('JobPosting') || structured.includes('Event')) return 'action';
  const title = source.title ?? '';
  if (GUIDE_TITLE.test(title) && !CHOICE_TITLE.test(title)) return 'guide';
  if (ACTION_TITLE.test(title)) return 'action';
  // A page that is mostly numbered steps is a guide whatever its title.
  const steps = (source.content ?? '').slice(0, 20_000).match(STEP_LINE)?.length ?? 0;
  if (steps >= 5) return 'guide';
  return 'summary';
}

/**
 * The built-in mode to build on and, for a custom mode, its definition. "auto" picks one from the
 * source (a summary when there is none yet). Unknown ids fall back to a summary.
 */
export function resolveMode(
  id: ModeId | undefined,
  custom: CustomMode[] = [],
  source?: ModeSource | null,
): { base: AnalysisMode; custom?: CustomMode; auto?: boolean } {
  if (id === AUTO) return { base: autoMode(source), auto: true };
  if (id && ANALYSIS_MODES.includes(id as AnalysisMode)) return { base: id as AnalysisMode };
  const found = id?.startsWith('custom:') ? usableCustomModes(custom).find((m) => customModeId(m) === id) : undefined;
  return found ? { base: found.base, custom: found } : { base: 'summary' };
}

/** Prompt rule for a custom mode, added after the built-in mode's rules. */
export const customModeRule = (m: CustomMode) =>
  `CUSTOM READING MODE "${m.name.trim()}", written by the reader. Follow it; where it conflicts with the mode goal above, it wins, but every other rule (OpenUI syntax, use only the source, length) still applies: ${m.instruction.trim()}`;
