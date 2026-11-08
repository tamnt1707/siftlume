import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { HugeiconsIcon } from '@hugeicons/react';
import { Copy01Icon, HighlighterIcon } from '@hugeicons/core-free-icons';
import {
  defineAction,
  defineComponent,
  useIsStreaming,
  useTriggerAction,
  type ActionPlan,
} from '@openuidev/react-lang';
import { openuiChatLibrary } from '@openuidev/react-ui';
import { z } from 'zod/v4';
import { renderDiagram } from './diagram';

// ── Custom actions ─────────────────────────────────────────────────────────────
// The Renderer does not run custom actions itself: it emits an event to onAction and the app handles it.

export const highlightInPage = defineAction({
  name: 'HighlightInPage',
  description:
    'Scrolls the original web page to the given exact quote and highlights it. Only usable when the source is a web page.',
  params: z.object({
    text: z.string().describe('An exact, verbatim phrase copied from the source (5-25 words).'),
  }),
});

export const copyText = defineAction({
  name: 'CopyText',
  description: 'Copies text to the user clipboard.',
  params: z.object({
    text: z.string(),
  }),
});

/**
 * Fires a library action from our own component. It must be an ActionPlan step: the legacy
 * `{ type, params }` form is silently dropped by the Renderer when `type` names a registered
 * custom action, so the click would never reach onAction.
 */
const customAction = (name: string, params: Record<string, unknown>): ActionPlan => ({
  steps: [{ type: 'custom_action', name, params }],
});

// ── Custom components ──────────────────────────────────────────────────────────
// Purpose-built blocks for a glanceable, editorial summary. They carry the visual identity of the
// app (see assets/genui.css); the built-in components stay available for everything else.

const SummaryHero = defineComponent({
  name: 'SummaryHero',
  description:
    'Opening block of every summary: the source title and a one-sentence TL;DR (max 20 words) shown with a highlighter mark. Optional: where it comes from (site or file name) and estimated reading time of the original in minutes.',
  props: z.object({
    title: z.string(),
    tldr: z.string(),
    source: z.string().optional(),
    readMinutes: z.number().optional(),
  }),
  component: ({ props }) => {
    const streaming = useIsStreaming();
    const { t } = useTranslation('session');
    return (
      <header className="g-hero">
        {(props.source || props.readMinutes) && (
          <p className="g-hero__meta">
            {props.source && <span>{props.source}</span>}
            {props.readMinutes ? <span>{t('genui.minRead', { count: props.readMinutes })}</span> : null}
          </p>
        )}
        <h1 className="g-hero__title">{props.title}</h1>
        <p className="g-hero__tldr">
          <mark className={streaming ? '' : 'is-drawn'}>{props.tldr}</mark>
        </p>
      </header>
    );
  },
});

const KeyNumber = defineComponent({
  name: 'KeyNumber',
  description:
    'One headline figure from the source: value as written (e.g. "17M", "$4.2B", "35%"), a 1-4 word label, and an optional signed change (e.g. "+35%", "-12%").',
  props: z.object({
    value: z.string(),
    label: z.string(),
    change: z.string().optional(),
  }),
  component: ({ props }) => {
    const dir = props.change?.trim().startsWith('-') ? 'down' : props.change ? 'up' : undefined;
    return (
      <div className="g-num">
        <span className="g-num__value">{props.value}</span>
        <span className="g-num__label">{props.label}</span>
        {props.change && <span className={`g-num__change g-num__change--${dir}`}>{props.change}</span>}
      </div>
    );
  },
});

const KeyNumbers = defineComponent({
  name: 'KeyNumbers',
  description: 'A strip of 2-4 headline figures. Use instead of writing numbers in sentences.',
  props: z.object({ items: z.array(KeyNumber.ref) }),
  component: ({ props, renderNode }) => <div className="g-nums">{renderNode(props.items)}</div>,
});

const Takeaway = defineComponent({
  name: 'Takeaway',
  description: 'One key point: a short statement (max 12 words), optional one-line detail.',
  props: z.object({
    text: z.string(),
    detail: z.string().optional(),
  }),
  component: ({ props }) => (
    <li className="g-take">
      <span className="g-take__text">{props.text}</span>
      {props.detail && <span className="g-take__detail">{props.detail}</span>}
    </li>
  ),
});

const Takeaways = defineComponent({
  name: 'Takeaways',
  description:
    'The key points of the source, most important first (3-6 items). Prefer this over ListBlock for summaries.',
  props: z.object({
    items: z.array(Takeaway.ref),
    heading: z.string().optional(),
  }),
  component: ({ props, renderNode }) => (
    <section className="g-takes">
      {props.heading && <h2 className="g-heading">{props.heading}</h2>}
      <ul>{renderNode(props.items)}</ul>
    </section>
  ),
});

const TimelineEvent = defineComponent({
  name: 'TimelineEvent',
  description: 'One dated event: when (date, year or stage) and what happened (max 10 words).',
  props: z.object({
    when: z.string(),
    what: z.string(),
  }),
  component: ({ props }) => (
    <li className="g-event">
      <span className="g-event__when">{props.when}</span>
      <span className="g-event__what">{props.what}</span>
    </li>
  ),
});

const Timeline = defineComponent({
  name: 'Timeline',
  description:
    'Chronological events or ordered stages from the source (3-8 items, oldest first). Only for real sequences.',
  props: z.object({
    events: z.array(TimelineEvent.ref),
    heading: z.string().optional(),
  }),
  component: ({ props, renderNode }) => (
    <section className="g-timeline">
      {props.heading && <h2 className="g-heading">{props.heading}</h2>}
      <ol>{renderNode(props.events)}</ol>
    </section>
  ),
});

const SourceQuote = defineComponent({
  name: 'SourceQuote',
  description:
    'A verbatim quote from the source that backs up a claim, with an optional short note. Clicking it highlights the quote in the original page. Quote must be copied exactly from the source.',
  props: z.object({
    quote: z.string(),
    note: z.string().optional(),
  }),
  component: ({ props }) => {
    const triggerAction = useTriggerAction();
    const streaming = useIsStreaming();
    const { t } = useTranslation('session');
    return (
      <figure className="g-quote">
        <blockquote>{props.quote}</blockquote>
        <figcaption>
          {props.note && <span>{props.note}</span>}
          <span className="g-quote__actions">
            <button
              type="button"
              disabled={streaming}
              onClick={() => triggerAction('', undefined, customAction(highlightInPage.name, { text: props.quote }))}
            >
              <HugeiconsIcon icon={HighlighterIcon} size={14} strokeWidth={1.8} aria-hidden="true" />
              {t('genui.showInPage')}
            </button>
            <button
              type="button"
              disabled={streaming}
              onClick={() => triggerAction('', undefined, customAction(copyText.name, { text: props.quote }))}
            >
              <HugeiconsIcon icon={Copy01Icon} size={14} strokeWidth={1.8} aria-hidden="true" />
              {t('genui.copy')}
            </button>
          </span>
        </figcaption>
      </figure>
    );
  },
});

type DiagramState = { status: 'idle' | 'ready' | 'error'; svg?: string; error?: string };

const Diagram = defineComponent({
  name: 'Diagram',
  description:
    'A diagram written in Mermaid syntax, rendered as SVG. Use it when relationships are easier to see than to read: processes and workflows (flowchart), decision logic (flowchart with {decisions}), interactions between actors over time (sequenceDiagram), lifecycles and states (stateDiagram-v2), concept maps (mindmap), data models (erDiagram). Caption states the takeaway in max 8 words.',
  props: z.object({
    mermaid: z.string(),
    caption: z.string().optional(),
  }),
  component: ({ props }) => {
    const streaming = useIsStreaming();
    const { t } = useTranslation('session');
    const [state, setState] = useState<DiagramState>({ status: 'idle' });
    const boxRef = useRef<HTMLElement>(null);
    const [width, setWidth] = useState(0);

    // Lay the diagram out for the space it actually has (side panel vs full page).
    useEffect(() => {
      const el = boxRef.current;
      if (!el) return;
      const ro = new ResizeObserver(([entry]) => {
        // Round to 40px steps so small resizes do not re-layout the diagram.
        const w = Math.floor((entry?.contentRect.width ?? 0) / 40) * 40;
        if (w > 0) setWidth(w);
      });
      ro.observe(el);
      return () => ro.disconnect();
    }, []);

    useEffect(() => {
      // Partial Mermaid is almost always invalid: wait for the stream to finish.
      if (streaming || !props.mermaid?.trim() || !width) return;
      let cancelled = false;
      // Wide left-to-right flows flip to top-down when they do not fit below the breakpoint.
      renderDiagram(props.mermaid, { maxWidth: width, directionBreakpoint: 760 }).then(
        ({ svg }) => !cancelled && setState({ status: 'ready', svg }),
        (e: unknown) => !cancelled && setState({ status: 'error', error: e instanceof Error ? e.message : String(e) }),
      );
      return () => {
        cancelled = true;
      };
    }, [props.mermaid, streaming, width]);

    return (
      <figure className="g-diagram" ref={boxRef}>
        {props.caption && <figcaption className="g-diagram__caption">{props.caption}</figcaption>}
        {state.status === 'ready' ? (
          // Pele output, rendered with links and images disabled.
          <div className="g-diagram__svg" dangerouslySetInnerHTML={{ __html: state.svg! }} />
        ) : state.status === 'error' ? (
          <details className="g-diagram__error">
            <summary>{t('genui.diagramFailed')}</summary>
            {/* Shown as text: the message can contain diagram source. */}
            <pre>{state.error}</pre>
          </details>
        ) : (
          <div className="g-diagram__pending" aria-busy="true">
            {t('genui.drawing')}
          </div>
        )}
      </figure>
    );
  },
});

const CONTENT_SLOTS = ['Card.children', 'SectionItem.content', 'TabItem.content', 'AccordionItem.content'];

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
      // Children of the blocks above; not placed directly in Card.
      KeyNumber,
      Takeaway,
      TimelineEvent,
    ],
  },
  actions: { add: [highlightInPage, copyText] },
});

export const ROOT = 'Card';
