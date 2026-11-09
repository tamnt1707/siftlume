import { openuiChatLibrary } from "@openuidev/react-ui";
import { copyText, highlightInPage } from "./genui/actions";
import { CONTENT_SLOTS } from "./genui/shared";
import {
  KeyNumber,
  KeyNumbers,
  SourceQuote,
  SummaryHero,
  Takeaway,
  Takeaways,
  Timeline,
  TimelineEvent,
} from "./genui/core";
import { Diagram } from "./genui/diagram";
import { BarItem, BarList, Checklist, ProsCons, Verdict } from "./genui/review";
import { Glossary, People, Person, Term } from "./genui/entities";

/**
 * The component library the model writes against. Components live in lib/genui/, one file per
 * group; this file only registers them. Add a new component to its group file, then list it here.
 */

export { highlightInPage, copyText } from "./genui/actions";

/**
 * Library shared by the summary and Q&A: openuiChatLibrary (root Card) + SourceQuote + custom
 * actions. Created at module scope because parsers memoize by library identity.
 */
export const library = openuiChatLibrary.extend({
  components: {
    add: [
      { component: SummaryHero, slots: ["Card.children"] },
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
      // Children of the blocks above; not placed directly in Card.
      KeyNumber,
      Takeaway,
      TimelineEvent,
      BarItem,
      Person,
      Term,
    ],
  },
  actions: { add: [highlightInPage, copyText] },
});

export const ROOT = "Card";
