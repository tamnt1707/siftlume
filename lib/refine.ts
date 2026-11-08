/**
 * Summary refinements. The one-click chips apply them to an existing summary (edit mode);
 * Settings → Summary → "Always include" applies the style ones to every new summary.
 * Instructions are for the model, so they stay in English; labels and descriptions are translated.
 */

export type RefineId = 'shorter' | 'moreDetail' | 'actionItems' | 'timeline' | 'simpler';

/** Styles that can be on by default (length has its own setting). */
export type SummaryStyle = 'actionItems' | 'timeline' | 'simpler';
export const SUMMARY_STYLES: SummaryStyle[] = ['actionItems', 'timeline', 'simpler'];

/** Sent as a refinement request (edit mode) when a chip is clicked. */
export const REFINE_PROMPTS: Record<RefineId, string> = {
  shorter: 'Make the summary shorter: keep only the most important points.',
  moreDetail: 'Add more detail: cover the important facts, numbers and arguments that are missing.',
  actionItems: 'Add a Checklist of concrete action items from the source.',
  timeline: 'Add a timeline (Timeline component) of the key events or stages, if the source has any.',
  simpler: 'Rewrite the text so a beginner can understand it, and add a Glossary of the technical terms.',
};

/** Standing rules added to the summary prompt for the styles enabled in Settings. */
export const STYLE_RULES: Record<SummaryStyle, string> = {
  actionItems:
    'Always include a Checklist of concrete things the reader can do or decide, based only on the source. Skip it only if the source has nothing actionable.',
  timeline:
    'Always include a Timeline of the key dates, events or stages when the source has any chronology. Skip it when there is no sequence.',
  simpler: 'Write for a beginner: plain words, short sentences, and a Glossary of the technical terms the source uses.',
};
