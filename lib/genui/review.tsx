/** Reviews and decisions: pros and cons, a stated score, compact bars and a tickable checklist. */
import { useTranslation } from 'react-i18next';
import { defineComponent, useStateField } from '@openuidev/react-lang';
import { z } from 'zod/v4';
import { HugeiconsIcon } from '@hugeicons/react';
import { Alert02Icon, ArrowDown01Icon, FileSearchIcon } from '@hugeicons/core-free-icons';
import { checkEvidence, figureRange, useEvidence } from '@/lib/evidence';
import { EvidenceMark } from './core';
import { childProps } from './shared';

export const ProsCons = defineComponent({
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

export const Verdict = defineComponent({
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

export const BarItem = defineComponent({
  name: 'BarItem',
  description:
    'One bar: label, numeric value from the source, optional display text (e.g. "38%", "$1.2B"), and quote: the passage it comes from, 5-25 words copied verbatim from the source and containing the figure. A bar without a verbatim passage is marked unverified.',
  props: z.object({
    label: z.string(),
    value: z.number(),
    display: z.string().optional(),
    quote: z.string().optional(),
  }),
  // Rendered by BarList, which needs every value to scale the bars.
  component: () => null,
});

export const BarList = defineComponent({
  name: 'BarList',
  description:
    'Compact horizontal bars for 2-8 comparable values (shares, rankings, scores). Lighter than a chart and good in narrow spaces. Sorted largest first.',
  props: z.object({
    items: z.array(BarItem.ref),
    heading: z.string().optional(),
  }),
  component: ({ props }) => {
    const items = childProps<{ label: string; value: number; display?: string; quote?: string }>(props.items);
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
              <EvidenceMark quote={p.quote} value={p.display ?? p.value} />
            </li>
          ))}
        </ul>
      </section>
    );
  },
});

export const ChartPoint = defineComponent({
  name: 'ChartPoint',
  description:
    'One charted value and where it comes from: its label (as on the chart), the value as written in the source (e.g. "$4.2B", "26%"), and quote: 5-25 words copied verbatim from the source that contain it.',
  props: z.object({
    label: z.string(),
    value: z.string(),
    quote: z.string().optional(),
  }),
  // Rendered by ChartSources, which counts the unverified ones.
  component: () => null,
});

/** The passage, with the charted figure marked in it (a passage often holds several numbers). */
function ChartQuote({ quote, value }: { quote: string; value: string }) {
  const at = figureRange(quote, value);
  return (
    <q className="g-chartsrc__quote">
      {at ? (
        <>
          {quote.slice(0, at[0])}
          <mark className="g-chartsrc__figure">{quote.slice(at[0], at[1])}</mark>
          {quote.slice(at[1])}
        </>
      ) : (
        quote
      )}
    </q>
  );
}

export const ChartSources = defineComponent({
  name: 'ChartSources',
  description:
    'Right after a chart: one ChartPoint per charted value, giving the passage each comes from, so the reader can check the numbers in the original. Values without a verbatim passage are marked unverified.',
  props: z.object({ points: z.array(ChartPoint.ref) }),
  component: ({ props }) => {
    const { t } = useTranslation('session');
    const evidence = useEvidence();
    const points = childProps<{ label: string; value: string; quote?: string }>(props.points);
    if (!points.length) return null;
    const unverified = evidence ? points.filter((p) => !checkEvidence(evidence.content, p.quote, p.value)).length : 0;
    return (
      <details className="g-chartsrc">
        <summary>
          <HugeiconsIcon icon={FileSearchIcon} size={15} strokeWidth={1.8} aria-hidden="true" />
          <span className="g-chartsrc__title">{t('genui.chartSources', { count: points.length })}</span>
          {unverified > 0 && (
            <span className="g-chartsrc__count">
              <HugeiconsIcon icon={Alert02Icon} size={12} strokeWidth={2} aria-hidden="true" />
              {t('genui.unverifiedCount', { count: unverified })}
            </span>
          )}
          <HugeiconsIcon
            className="g-chartsrc__chevron"
            icon={ArrowDown01Icon}
            size={16}
            strokeWidth={1.8}
            aria-hidden="true"
          />
        </summary>
        <ul>
          {points.map((p, i) => (
            <li key={i}>
              <span className="g-chartsrc__label">{p.label}</span>
              <span className="g-chartsrc__value">{p.value}</span>
              <EvidenceMark quote={p.quote} value={p.value} />
              {p.quote && <ChartQuote quote={p.quote} value={p.value} />}
            </li>
          ))}
        </ul>
      </details>
    );
  },
});

/** Stable key for a checklist's saved state (persisted with the message through onStateUpdate). */
const checklistKey = (items: string[]) => {
  let h = 0;
  for (const c of items.join('\u0001')) h = (h * 31 + c.charCodeAt(0)) | 0;
  return `checklist_${Math.abs(h).toString(36)}`;
};

export const Checklist = defineComponent({
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
