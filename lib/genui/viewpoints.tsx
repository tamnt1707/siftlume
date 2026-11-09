/** Viewpoints and change: who thinks what about an issue, and what changes from before to after. */
import { useTranslation } from 'react-i18next';
import { defineComponent } from '@openuidev/react-lang';
import { z } from 'zod/v4';
import { childProps } from './shared';

export const STANCES = ['for', 'mixed', 'neutral', 'against'] as const;

export const Perspective = defineComponent({
  name: 'Perspective',
  description:
    'One party\'s view: who (person, group or organization, max 5 words), stance on the issue "for" | "against" | "mixed" | "neutral", their view (max 18 words), optional short verbatim quote from the source.',
  props: z.object({
    who: z.string(),
    stance: z.enum(STANCES),
    view: z.string(),
    quote: z.string().optional(),
  }),
  component: ({ props }) => {
    const { t } = useTranslation('session');
    const stance = STANCES.includes(props.stance) ? props.stance : 'neutral';
    return (
      <li className={`g-view g-view--${stance}`}>
        <span className="g-view__head">
          <strong>{props.who}</strong>
          <span className="g-view__stance">{t(`genui.stance.${stance}`)}</span>
        </span>
        <span className="g-view__text">{props.view}</span>
        {props.quote && <q className="g-view__quote">{props.quote}</q>}
      </li>
    );
  },
});

export const Perspectives = defineComponent({
  name: 'Perspectives',
  description:
    'How different parties see one issue (2-6): politicians, experts, companies, unions, residents, reviewers. For debates, policy news, controversies and reactions. Optional issue names what they disagree about (max 10 words). Stances only as the source reports them.',
  props: z.object({
    items: z.array(Perspective.ref),
    issue: z.string().optional(),
    heading: z.string().optional(),
  }),
  component: ({ props, renderNode }) => {
    const { t } = useTranslation('session');
    const stances = childProps<{ stance?: string }>(props.items).map((p) =>
      STANCES.includes(p.stance as (typeof STANCES)[number]) ? (p.stance as (typeof STANCES)[number]) : 'neutral',
    );
    const counts = STANCES.map((s) => [s, stances.filter((x) => x === s).length] as const).filter(([, n]) => n);
    return (
      <section className="g-views">
        {props.heading && <h2 className="g-heading">{props.heading}</h2>}
        {props.issue && <p className="g-views__issue">{props.issue}</p>}
        {stances.length >= 3 && (
          <div className="g-views__bar" role="img" aria-label={counts.map(([s, n]) => `${t(`genui.stance.${s}`)}: ${n}`).join(', ')}>
            {counts.map(([s, n]) => (
              <span key={s} className={`g-views__seg g-view--${s}`} style={{ flexGrow: n }}>
                {t(`genui.stance.${s}`)} · {n}
              </span>
            ))}
          </div>
        )}
        <ul>{renderNode(props.items)}</ul>
      </section>
    );
  },
});

export const Shift = defineComponent({
  name: 'Shift',
  description: 'One thing that changes: the aspect (1-4 words), how it was before and how it is after (max 12 words each).',
  props: z.object({
    aspect: z.string(),
    before: z.string(),
    after: z.string(),
  }),
  // Rendered by BeforeAfter, which lays the rows out as a table.
  component: () => null,
});

export const BeforeAfter = defineComponent({
  name: 'BeforeAfter',
  description:
    'Before vs after a change, aspect by aspect (2-6 rows): new laws, policies, prices, terms of service, product redesigns, reorganizations, treatments. Optional column labels (e.g. "2024", "2025") replace "Before"/"After". For software release notes use ChangeList instead.',
  props: z.object({
    items: z.array(Shift.ref),
    heading: z.string().optional(),
    beforeLabel: z.string().optional(),
    afterLabel: z.string().optional(),
  }),
  component: ({ props }) => {
    const { t } = useTranslation('session');
    const rows = childProps<{ aspect?: string; before?: string; after?: string }>(props.items);
    return (
      <section className="g-shift">
        {props.heading && <h2 className="g-heading">{props.heading}</h2>}
        <div className="g-shift__table" role="table">
          <div className="g-shift__row g-shift__row--head" role="row">
            <span role="columnheader" />
            <span role="columnheader">{props.beforeLabel || t('genui.before')}</span>
            <span role="columnheader">{props.afterLabel || t('genui.after')}</span>
          </div>
          {rows.map((r, i) => (
            <div className="g-shift__row" role="row" key={i}>
              <span role="rowheader" className="g-shift__aspect">
                {r.aspect}
              </span>
              <span role="cell" className="g-shift__before">
                {r.before}
              </span>
              <span role="cell" className="g-shift__after">
                {r.after}
              </span>
            </div>
          ))}
        </div>
      </section>
    );
  },
});
