/**
 * Core summary blocks: hero with the TL;DR, headline figures, takeaways, timeline and source quotes.
 * Purpose-built for a glanceable, editorial summary; they carry the visual identity of the app
 * (see assets/genui.css). The built-in components stay available for everything else.
 */
import { useTranslation } from 'react-i18next';
import { HugeiconsIcon } from '@hugeicons/react';
import { Copy01Icon, HighlighterIcon } from '@hugeicons/core-free-icons';
import { defineComponent, useIsStreaming, useTriggerAction } from '@openuidev/react-lang';
import { z } from 'zod/v4';
import { copyText, customAction, highlightInPage } from './actions';

export const SummaryHero = defineComponent({
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

export const KeyNumber = defineComponent({
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

export const KeyNumbers = defineComponent({
  name: 'KeyNumbers',
  description: 'A strip of 2-4 headline figures. Use instead of writing numbers in sentences.',
  props: z.object({ items: z.array(KeyNumber.ref) }),
  component: ({ props, renderNode }) => <div className="g-nums">{renderNode(props.items)}</div>,
});

export const Takeaway = defineComponent({
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

export const Takeaways = defineComponent({
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

export const TimelineEvent = defineComponent({
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

export const Timeline = defineComponent({
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

export const SourceQuote = defineComponent({
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
