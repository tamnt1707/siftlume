/**
 * Analysis modes: what the reader wants from the source. Each mode has its own goal, layout and
 * favourite blocks, so a summary, an explanation, a critique and an action list look different.
 * Instructions are for the model, so they stay in English; labels live in the locales.
 */

export type AnalysisMode = 'summary' | 'explain' | 'critique' | 'action';
export const ANALYSIS_MODES: AnalysisMode[] = ['summary', 'explain', 'critique', 'action'];

/** The user turn that asks for the analysis (also replayed before follow-up questions). */
export const MODE_TASK: Record<AnalysisMode, string> = {
  summary: 'Summarize this source.',
  explain: 'Explain this source so I really understand it.',
  critique: 'Critically assess this source: how far can I trust it?',
  action: 'Tell me what I need to do, decide or remember based on this source.',
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
};

/** Shorter guidance for follow-up answers in each mode. */
export const MODE_QA_RULES: Record<AnalysisMode, string> = {
  summary: 'Answer directly and briefly.',
  explain:
    'The reader is learning: answer so a beginner understands, with an example, a Diagram or an Analogy when it helps.',
  critique:
    'The reader is evaluating the source: say what evidence the source gives for the answer and what is missing.',
  action: 'The reader wants to act: answer with the concrete steps, dates or requirements from the source.',
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

/** A built-in mode, or "custom:<id>" for one of the user's. */
export type ModeId = AnalysisMode | `custom:${string}`;

export const MAX_CUSTOM_MODES = 8;
export const customModeId = (m: CustomMode): ModeId => `custom:${m.id}`;

/** Custom modes that can run: named and with instructions. */
export const usableCustomModes = (modes: CustomMode[] = []) =>
  modes.filter((m) => m.name.trim() && m.instruction.trim());

/** The built-in mode to build on and, for a custom mode, its definition. Unknown ids fall back to a summary. */
export function resolveMode(
  id: ModeId | undefined,
  custom: CustomMode[] = [],
): { base: AnalysisMode; custom?: CustomMode } {
  if (id && ANALYSIS_MODES.includes(id as AnalysisMode)) return { base: id as AnalysisMode };
  const found = id?.startsWith('custom:') ? usableCustomModes(custom).find((m) => customModeId(m) === id) : undefined;
  return found ? { base: found.base, custom: found } : { base: 'summary' };
}

/** Prompt rule for a custom mode, added after the built-in mode's rules. */
export const customModeRule = (m: CustomMode) =>
  `CUSTOM READING MODE "${m.name.trim()}", written by the reader. Follow it; where it conflicts with the mode goal above, it wins, but every other rule (OpenUI syntax, use only the source, length) still applies: ${m.instruction.trim()}`;
