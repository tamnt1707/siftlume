import { openuiChatLibrary } from '@openuidev/react-ui';
import { copyText, highlightInPage } from './genui/actions';
import { CONTENT_SLOTS } from './genui/shared';
import {
  KeyNumber,
  KeyNumbers,
  SourceQuote,
  SummaryHero,
  Takeaway,
  Takeaways,
  Timeline,
  TimelineEvent,
} from './genui/core';
import { Diagram } from './genui/diagram';
import { BarItem, BarList, Checklist, ProsCons, Verdict } from './genui/review';
import { Glossary, People, Person, Term } from './genui/entities';
import { CompareRow, Comparison, Fact, FactSheet, Plan, PricingPlans } from './genui/product';
import { Claim, ClaimCheck, Risk, RiskList } from './genui/trust';
import { ActionItem, ActionItems, Change, ChangeList, StatusBoard, StatusColumn } from './genui/project';
import { ResearchBrief } from './genui/research';
import { Analogy, Misconception, Misconceptions } from './genui/explain';
import { Argument, ArgumentMap, CauseEffect } from './genui/reasoning';
import { Choice, Criterion, DecisionMatrix, Matrix2x2, Quadrant, Scenario, Scenarios } from './genui/decision';
import { BeforeAfter, Perspective, Perspectives, Shift } from './genui/viewpoints';
import { CalcStep, Calculation, CodeNote, CodeWalkthrough, Finding, Findings } from './genui/technical';
import { EventCard, Ingredient, Ingredients, RatingBreakdown } from './genui/everyday';
import { Branch, QrCode, Tree } from './genui/structure';

/**
 * The component library the model writes against. Components live in lib/genui/, one file per
 * group; this file only registers them. Add a new component to its group file, then list it here.
 */

export { highlightInPage, copyText } from './genui/actions';
export { RISK_LEVELS, CLAIM_STATUSES } from './genui/trust';
export { ACTION_STATUSES, CHANGE_TYPES } from './genui/project';
export { ARGUMENT_STANCES } from './genui/reasoning';
export { SCENARIO_KINDS, weightedScores } from './genui/decision';
export { STANCES } from './genui/viewpoints';
export { CALC_OPS, FINDING_SEVERITIES, lineRange } from './genui/technical';
export { EVENT_STATUSES, formatQty } from './genui/everyday';
export { qrSafe } from './genui/structure';

/**
 * Form controls of openuiChatLibrary that a reading assistant never needs. Form, FormControl,
 * Label, Select and Buttons stay: the CSV filters use them (lib/csv-tools.ts).
 */
const UNUSED = [
  'Input',
  'TextArea',
  'DatePicker',
  'Slider',
  'CheckBoxGroup',
  'CheckBoxItem',
  'RadioGroup',
  'RadioItem',
  'SwitchGroup',
  'SwitchItem',
  'Chips',
  'ChipItem',
  'OptionCards',
  'OptionCard',
];

/**
 * Library shared by the summary and Q&A: openuiChatLibrary (root Card) + SourceQuote + custom
 * actions. Created at module scope because parsers memoize by library identity.
 */
export const library = openuiChatLibrary.extend({
  components: {
    add: [
      { component: SummaryHero, slots: ['Card.children'] },
      { component: KeyNumbers, slots: CONTENT_SLOTS },
      { component: Takeaways, slots: CONTENT_SLOTS },
      { component: Timeline, slots: CONTENT_SLOTS },
      { component: SourceQuote, slots: CONTENT_SLOTS },
      { component: Diagram, slots: CONTENT_SLOTS },
      { component: ProsCons, slots: CONTENT_SLOTS },
      { component: Verdict, slots: CONTENT_SLOTS },
      { component: BarList, slots: CONTENT_SLOTS },
      { component: Checklist, slots: CONTENT_SLOTS },
      { component: People, slots: CONTENT_SLOTS },
      { component: Glossary, slots: CONTENT_SLOTS },
      { component: FactSheet, slots: CONTENT_SLOTS },
      { component: Comparison, slots: CONTENT_SLOTS },
      { component: PricingPlans, slots: CONTENT_SLOTS },
      { component: RiskList, slots: CONTENT_SLOTS },
      { component: ClaimCheck, slots: CONTENT_SLOTS },
      { component: StatusBoard, slots: CONTENT_SLOTS },
      { component: ChangeList, slots: CONTENT_SLOTS },
      { component: ResearchBrief, slots: CONTENT_SLOTS },
      { component: Analogy, slots: CONTENT_SLOTS },
      { component: Misconceptions, slots: CONTENT_SLOTS },
      { component: ArgumentMap, slots: CONTENT_SLOTS },
      { component: CauseEffect, slots: CONTENT_SLOTS },
      { component: DecisionMatrix, slots: CONTENT_SLOTS },
      { component: Scenarios, slots: CONTENT_SLOTS },
      { component: Matrix2x2, slots: CONTENT_SLOTS },
      { component: Perspectives, slots: CONTENT_SLOTS },
      { component: BeforeAfter, slots: CONTENT_SLOTS },
      { component: Calculation, slots: CONTENT_SLOTS },
      { component: CodeWalkthrough, slots: CONTENT_SLOTS },
      { component: Tree, slots: CONTENT_SLOTS },
      { component: QrCode, slots: CONTENT_SLOTS },
      { component: ActionItems, slots: CONTENT_SLOTS },
      { component: Findings, slots: CONTENT_SLOTS },
      { component: Ingredients, slots: CONTENT_SLOTS },
      { component: EventCard, slots: CONTENT_SLOTS },
      { component: RatingBreakdown, slots: CONTENT_SLOTS },
      // Children of the blocks above; not placed directly in Card.
      KeyNumber,
      Takeaway,
      TimelineEvent,
      BarItem,
      Person,
      Term,
      Fact,
      CompareRow,
      Plan,
      Risk,
      Claim,
      StatusColumn,
      Change,
      Misconception,
      Argument,
      Criterion,
      Choice,
      Scenario,
      Quadrant,
      Perspective,
      Shift,
      CalcStep,
      CodeNote,
      Branch,
      ActionItem,
      Finding,
      Ingredient,
    ],
    remove: UNUSED,
  },
  actions: { add: [highlightInPage, copyText] },
});

export const ROOT = 'Card';
