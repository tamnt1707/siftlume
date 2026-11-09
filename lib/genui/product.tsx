/** Products and shopping: spec sheets, side-by-side comparisons and price tiers. */
import { useTranslation } from 'react-i18next';
import { defineComponent } from '@openuidev/react-lang';
import { z } from 'zod/v4';
import { childProps } from './shared';

export const Fact = defineComponent({
  name: 'Fact',
  description: 'One detail: a 1-3 word label and its value as written in the source, with an optional short note.',
  props: z.object({
    label: z.string(),
    value: z.string(),
    note: z.string().optional(),
  }),
  component: ({ props }) => (
    <div className="g-fact">
      <dt>{props.label}</dt>
      <dd>
        {props.value}
        {props.note && <span className="g-fact__note">{props.note}</span>}
      </dd>
    </div>
  ),
});

export const FactSheet = defineComponent({
  name: 'FactSheet',
  description:
    'Label/value details at a glance (3-10 facts): product specs, recipe times and servings, event date and venue, job salary and location, company profile, contract terms. Values may be text; use KeyNumbers for headline figures instead.',
  props: z.object({
    facts: z.array(Fact.ref),
    heading: z.string().optional(),
  }),
  component: ({ props, renderNode }) => (
    <section className="g-facts">
      {props.heading && <h2 className="g-heading">{props.heading}</h2>}
      <dl>{renderNode(props.facts)}</dl>
    </section>
  ),
});

export const CompareRow = defineComponent({
  name: 'CompareRow',
  description:
    'One attribute compared across the options: the attribute, one short value per option (same order as options), and optionally the name of the option that is best on it according to the source.',
  props: z.object({
    attribute: z.string(),
    values: z.array(z.string()),
    best: z.string().optional(),
  }),
  // Rendered by Comparison, which knows the options.
  component: () => null,
});

export const Comparison = defineComponent({
  name: 'Comparison',
  description:
    'Side-by-side comparison of 2-4 options (products, plans, tools, candidates) on 3-8 attributes, marking the best option per attribute when the source says so. Optional bottom line names the overall pick.',
  props: z.object({
    options: z.array(z.string()),
    rows: z.array(CompareRow.ref),
    heading: z.string().optional(),
    bottomLine: z.string().optional(),
  }),
  component: ({ props }) => {
    const { t } = useTranslation('session');
    const options = props.options ?? [];
    const rows = childProps<{ attribute: string; values?: string[]; best?: string }>(props.rows);
    const norm = (s?: string) => s?.trim().toLowerCase();
    return (
      <section className="g-compare">
        {props.heading && <h2 className="g-heading">{props.heading}</h2>}
        <div className="g-compare__scroll">
          <table>
            <thead>
              <tr>
                <th scope="col" />
                {options.map((o, i) => (
                  <th scope="col" key={i}>
                    {o}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={i}>
                  <th scope="row">{r.attribute}</th>
                  {options.map((o, j) => {
                    const best = Boolean(r.best) && norm(r.best) === norm(o);
                    return (
                      <td key={j} className={best ? 'is-best' : undefined}>
                        {r.values?.[j] ?? ''}
                        {best && <span className="g-compare__badge">{t('genui.best')}</span>}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {props.bottomLine && <p className="g-compare__bottom">{props.bottomLine}</p>}
      </section>
    );
  },
});

export const Plan = defineComponent({
  name: 'Plan',
  description:
    'One price tier: name, price as written (e.g. "$12", "Free"), 2-5 short features, optional period (e.g. "per month"), recommended=true for the plan the source highlights, optional one-line note (e.g. who it is for).',
  props: z.object({
    name: z.string(),
    price: z.string(),
    features: z.array(z.string()),
    period: z.string().optional(),
    recommended: z.boolean().optional(),
    note: z.string().optional(),
  }),
  component: ({ props }) => {
    const { t } = useTranslation('session');
    return (
      <li className={`g-plan ${props.recommended ? 'is-recommended' : ''}`}>
        {props.recommended && <span className="g-plan__flag">{t('genui.recommended')}</span>}
        <span className="g-plan__name">{props.name}</span>
        <span className="g-plan__price">
          <strong>{props.price}</strong>
          {props.period && <span>{props.period}</span>}
        </span>
        {props.note && <span className="g-plan__note">{props.note}</span>}
        <ul>
          {(props.features ?? []).map((f, i) => (
            <li key={i}>{f}</li>
          ))}
        </ul>
      </li>
    );
  },
});

export const PricingPlans = defineComponent({
  name: 'PricingPlans',
  description:
    'Price tiers side by side (2-4 plans): SaaS pricing, subscriptions, phone or internet plans, ticket classes. Prices and features only as stated in the source.',
  props: z.object({
    plans: z.array(Plan.ref),
    heading: z.string().optional(),
  }),
  component: ({ props, renderNode }) => (
    <section className="g-plans">
      {props.heading && <h2 className="g-heading">{props.heading}</h2>}
      <ul>{renderNode(props.plans)}</ul>
    </section>
  ),
});
