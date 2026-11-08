import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { HugeiconsIcon } from '@hugeicons/react';
import { Copy01Icon, HighlighterIcon } from '@hugeicons/core-free-icons';
import {
  defineAction,
  defineComponent,
  useIsStreaming,
  useStateField,
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

// ── More visual blocks ─────────────────────────────────────────────────────────

const ProsCons = defineComponent({
  name: 'ProsCons',
  description:
    'Advantages and drawbacks side by side, for reviews, opinions and decisions. 2-5 short items per side (max 10 words each).',
  props: z.object({
    pros: z.array(z.string()),
    cons: z.array(z.string()),
    heading: z.string().optional(),
  }),
  component: ({ props }) => {
    const { t } = useTranslation('session');
    return (
      <section className="g-proscons">
        {props.heading && <h2 className="g-heading">{props.heading}</h2>}
        <div className="g-proscons__cols">
          <div className="g-proscons__col g-proscons__col--pro">
            <h3>{t('genui.pros')}</h3>
            <ul>
              {props.pros.map((x, i) => (
                <li key={i}>{x}</li>
              ))}
            </ul>
          </div>
          <div className="g-proscons__col g-proscons__col--con">
            <h3>{t('genui.cons')}</h3>
            <ul>
              {props.cons.map((x, i) => (
                <li key={i}>{x}</li>
              ))}
            </ul>
          </div>
        </div>
      </section>
    );
  },
});

const Verdict = defineComponent({
  name: 'Verdict',
  description:
    'A rating stated in the source (e.g. a review score), with a one-sentence bottom line. Only when the source gives a score; never invent one.',
  props: z.object({
    score: z.number(),
    max: z.number(),
    summary: z.string(),
    label: z.string().optional(),
  }),
  component: ({ props }) => {
    const pct = props.max > 0 ? Math.max(0, Math.min(1, props.score / props.max)) : 0;
    return (
      <section className="g-verdict">
        <div className="g-verdict__score">
          <span className="g-verdict__value">{props.score}</span>
          <span className="g-verdict__max">/{props.max}</span>
        </div>
        <div className="g-verdict__body">
          {props.label && <span className="g-verdict__label">{props.label}</span>}
          <div className="g-verdict__bar" role="img" aria-label={`${props.score} / ${props.max}`}>
            <span style={{ width: `${pct * 100}%` }} />
          </div>
          <p className="g-verdict__summary">{props.summary}</p>
        </div>
      </section>
    );
  },
});

const BarItem = defineComponent({
  name: 'BarItem',
  description: 'One bar: label, numeric value from the source, and optional display text (e.g. "38%", "$1.2B").',
  props: z.object({
    label: z.string(),
    value: z.number(),
    display: z.string().optional(),
  }),
  // Rendered by BarList, which needs every value to scale the bars.
  component: () => null,
});

const BarList = defineComponent({
  name: 'BarList',
  description:
    'Compact horizontal bars for 2-8 comparable values (shares, rankings, scores). Lighter than a chart and good in narrow spaces. Sorted largest first.',
  props: z.object({
    items: z.array(BarItem.ref),
    heading: z.string().optional(),
  }),
  component: ({ props }) => {
    const items = (props.items as unknown as { props?: { label: string; value: number; display?: string } }[])
      .map((n) => n?.props)
      .filter((p): p is { label: string; value: number; display?: string } => Boolean(p));
    const max = Math.max(...items.map((p) => Math.abs(p.value)), 0) || 1;
    return (
      <section className="g-bars">
        {props.heading && <h2 className="g-heading">{props.heading}</h2>}
        <ul>
          {items.map((p, i) => (
            <li key={i} className="g-bar">
              <span className="g-bar__label">{p.label}</span>
              <span className="g-bar__track">
                <span className="g-bar__fill" style={{ width: `${(Math.abs(p.value) / max) * 100}%` }} />
              </span>
              <span className="g-bar__value">{p.display ?? p.value}</span>
            </li>
          ))}
        </ul>
      </section>
    );
  },
});

/** Stable key for a checklist's saved state (persisted with the message through onStateUpdate). */
const checklistKey = (items: string[]) => {
  let h = 0;
  for (const c of items.join('\u0001')) h = (h * 31 + c.charCodeAt(0)) | 0;
  return `checklist_${Math.abs(h).toString(36)}`;
};

const Checklist = defineComponent({
  name: 'Checklist',
  description:
    'Concrete actions the reader can take, as tickable items (max 12 words each). Use for action items instead of Takeaways.',
  props: z.object({
    items: z.array(z.string()),
    heading: z.string().optional(),
  }),
  component: ({ props }) => {
    const { t } = useTranslation('session');
    // useStateField stores the ticks in the Renderer's form state, so they survive reloads.
    const field = useStateField(checklistKey(props.items));
    const done = (Array.isArray(field.value) ? field.value : []) as number[];
    const toggle = (i: number) => field.setValue(done.includes(i) ? done.filter((x) => x !== i) : [...done, i]);
    return (
      <section className="g-checklist">
        <div className="g-checklist__head">
          {props.heading && <h2 className="g-heading">{props.heading}</h2>}
          <span className="g-checklist__progress">
            {t('genui.checklistProgress', { done: done.length, total: props.items.length })}
          </span>
        </div>
        <ul>
          {props.items.map((x, i) => (
            <li key={i}>
              <label className={done.includes(i) ? 'is-done' : ''}>
                <input type="checkbox" checked={done.includes(i)} onChange={() => toggle(i)} />
                <span>{x}</span>
              </label>
            </li>
          ))}
        </ul>
      </section>
    );
  },
});

const Person = defineComponent({
  name: 'Person',
  description:
    'A person or organization in the source: name, role (max 6 words), optional stance or quote gist (max 12 words).',
  props: z.object({
    name: z.string(),
    role: z.string(),
    stance: z.string().optional(),
  }),
  component: ({ props }) => {
    const initials = props.name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((w) => w[0]!.toUpperCase())
      .join('');
    return (
      <li className="g-person">
        <span className="g-person__avatar" aria-hidden="true">
          {initials}
        </span>
        <span className="g-person__text">
          <strong>{props.name}</strong>
          <span className="g-person__role">{props.role}</span>
          {props.stance && <span className="g-person__stance">{props.stance}</span>}
        </span>
      </li>
    );
  },
});

const People = defineComponent({
  name: 'People',
  description:
    'Who is who: the key people or organizations in the source (2-6), for news and stories with several actors.',
  props: z.object({
    items: z.array(Person.ref),
    heading: z.string().optional(),
  }),
  component: ({ props, renderNode }) => (
    <section className="g-people">
      {props.heading && <h2 className="g-heading">{props.heading}</h2>}
      <ul>{renderNode(props.items)}</ul>
    </section>
  ),
});

const Term = defineComponent({
  name: 'Term',
  description: 'A technical term and a plain-language meaning (max 15 words).',
  props: z.object({
    term: z.string(),
    meaning: z.string(),
  }),
  component: ({ props }) => (
    <div className="g-term">
      <dt>{props.term}</dt>
      <dd>{props.meaning}</dd>
    </div>
  ),
});

const Glossary = defineComponent({
  name: 'Glossary',
  description: 'Jargon explained: 2-6 technical terms from the source with plain meanings. Put it after the takeaways.',
  props: z.object({
    terms: z.array(Term.ref),
    heading: z.string().optional(),
  }),
  component: ({ props, renderNode }) => (
    <section className="g-glossary">
      {props.heading && <h2 className="g-heading">{props.heading}</h2>}
      <dl>{renderNode(props.terms)}</dl>
    </section>
  ),
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

export const ROOT = 'Card';
