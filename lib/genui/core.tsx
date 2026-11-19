/**
 * Core summary blocks: hero with the TL;DR, headline figures, takeaways, timeline and source quotes.
 * Purpose-built for a glanceable, editorial summary; they carry the visual identity of the app
 * (see assets/genui.css). The built-in components stay available for everything else.
 */
import { useTranslation } from 'react-i18next';
import { HugeiconsIcon } from '@hugeicons/react';
import { Alert02Icon, Calculator01Icon, Copy01Icon, HighlighterIcon } from '@hugeicons/core-free-icons';
import { defineComponent, useIsStreaming, useTriggerAction } from '@openuidev/react-lang';
import { z } from 'zod/v4';
import { figureCheck, type FigureInput } from '@/lib/derived';
import { useEvidence } from '@/lib/evidence';
import { copyText, customAction, highlightInPage } from './actions';

/** A source figure a derived figure was worked out from (see lib/derived.ts). */
export const figureInputs = z
  .array(
    z.object({
      value: z.string(),
      quote: z.string().optional(),
      label: z.string().optional(),
    }),
  )
  .optional();

export const INPUTS_HINT =
  'For a figure you worked out yourself (a total, a difference, a percentage change, an average), give no quote and pass inputs instead: the 1-6 source figures it was computed from, each {label, value, quote} with the value as written in the source and its own verbatim quote. The app checks the arithmetic and shows it as derived with its inputs.';

/** "Show in page" (or "Show in source") for a passage verbatim in the source. */
function ShowButton({ quote }: { quote: string }) {
  const evidence = useEvidence();
  const triggerAction = useTriggerAction();
  const { t } = useTranslation('session');
  if (!evidence?.canShow) return null;
  return (
    <button
      type="button"
      className="g-evidence g-evidence--show"
      onClick={() => triggerAction('', undefined, customAction(highlightInPage.name, { text: quote }))}
    >
      <HugeiconsIcon icon={HighlighterIcon} size={13} strokeWidth={1.8} aria-hidden="true" />
      {t(evidence.inSource ? 'genui.showInSource' : 'genui.showInPage')}
    </button>
  );
}

/**
 * Where a figure comes from: a "Show in page" button when its passage is verbatim in the source;
 * "Derived" when it was worked out from figures that are (opens them, each with its own button);
 * an "Unverified" mark otherwise. Nothing outside a session (no source to check).
 * The button always has its label ("Show in page", or "Show in source" for PDFs and files), like
 * the one on source quotes: a bare icon was not read as one.
 */
export function EvidenceMark({
  quote,
  value,
  inputs,
}: {
  quote?: string | null;
  value?: string | number;
  inputs?: FigureInput[] | null;
}) {
  const evidence = useEvidence();
  const streaming = useIsStreaming();
  const { t } = useTranslation('session');
  // While streaming the passage may still be arriving: judge it once the program is complete.
  if (!evidence || streaming) return null;
  const given = Array.isArray(inputs) ? inputs.filter((i) => i && typeof i.value === 'string') : null;
  const { status, op } = figureCheck(evidence.content, quote, value, given);
  if (status === 'derived') {
    return (
      <details className="g-evidence g-derived">
        <summary title={t('genui.derivedWhy')}>
          <HugeiconsIcon icon={Calculator01Icon} size={12} strokeWidth={2} aria-hidden="true" />
          {t('genui.derived')}
          <span className="g-derived__op">· {t(`genui.derivedOp.${op!}`)}</span>
        </summary>
        <div className="g-derived__panel">
          <p>{t('genui.derivedFrom')}</p>
          <ul>
            {given!.map((i, k) => (
              <li key={k}>
                {i.label && <span className="g-derived__label">{i.label}</span>}
                <span className="g-derived__value">{i.value}</span>
                <ShowButton quote={i.quote!} />
              </li>
            ))}
          </ul>
        </div>
      </details>
    );
  }
  if (status !== 'ok') {
    // Why, with the passage the model gave: a figure it counted reads differently from a misquote.
    const why = t(`genui.unverifiedWhy.${status}`, {
      quote: quote?.trim() ?? '',
      inputs: given?.map((i) => i.value).join(', ') ?? '',
    });
    return (
      <span className="g-evidence g-evidence--unverified" title={why} aria-label={`${t('genui.unverified')}: ${why}`}>
        <HugeiconsIcon icon={Alert02Icon} size={12} strokeWidth={2} aria-hidden="true" />
        {t('genui.unverified')}
      </span>
    );
  }
  return <ShowButton quote={quote!} />;
}

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
    'One headline figure from the source: value as written (e.g. "17M", "$4.2B", "35%"), a 1-4 word label, an optional signed change (e.g. "+35%", "-12%"), and quote: the passage it comes from, 5-25 words copied verbatim from the source and containing the figure (pass null for change when there is none). A figure without a verbatim passage is marked unverified. ' +
    INPUTS_HINT,
  props: z.object({
    value: z.string(),
    label: z.string(),
    change: z.string().optional(),
    quote: z.string().optional(),
    inputs: figureInputs,
  }),
  component: ({ props }) => {
    const dir = props.change?.trim().startsWith('-') ? 'down' : props.change ? 'up' : undefined;
    return (
      <div className="g-num">
        <span className="g-num__value">{props.value}</span>
        <span className="g-num__label">{props.label}</span>
        <span className="g-num__foot">
          {props.change && <span className={`g-num__change g-num__change--${dir}`}>{props.change}</span>}
          <EvidenceMark quote={props.quote} value={props.value} inputs={props.inputs} />
        </span>
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
    const evidence = useEvidence();
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
              {t(evidence?.inSource ? 'genui.showInSource' : 'genui.showInPage')}
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
