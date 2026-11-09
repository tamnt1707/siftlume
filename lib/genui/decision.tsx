/** Decisions: weighted scoring of options, future scenarios and 2×2 matrices (SWOT, impact/effort). */
import { useTranslation } from 'react-i18next';
import { defineComponent } from '@openuidev/react-lang';
import { z } from 'zod/v4';
import { childProps } from './shared';
import { RISK_LEVELS } from './trust';

export const Criterion = defineComponent({
  name: 'Criterion',
  description: 'One decision criterion: a 1-3 word name and an optional weight 1-3 (3 = matters most; default 1).',
  props: z.object({
    name: z.string(),
    weight: z.number().optional(),
  }),
  // Rendered by DecisionMatrix.
  component: () => null,
});

export const Choice = defineComponent({
  name: 'Choice',
  description:
    'One option being decided on: its name, one score 1-5 per criterion (same order as the criteria, 5 = best), and an optional short note.',
  props: z.object({
    name: z.string(),
    scores: z.array(z.number()),
    note: z.string().optional(),
  }),
  // Rendered by DecisionMatrix.
  component: () => null,
});

type CriterionProps = { name?: string; weight?: number };
type ChoiceProps = { name?: string; scores?: number[]; note?: string };

const clampScore = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? Math.min(5, Math.max(0, v)) : null);
const clampWeight = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? Math.min(3, Math.max(1, v)) : 1);

/** Weighted average score (0-5, one decimal) per choice, and which choices share the top score. */
export function weightedScores(criteria: CriterionProps[], choices: ChoiceProps[]) {
  const totals = choices.map((c) => {
    let sum = 0;
    let weights = 0;
    criteria.forEach((cr, i) => {
      const s = clampScore(c.scores?.[i]);
      if (s === null) return;
      const w = clampWeight(cr.weight);
      sum += s * w;
      weights += w;
    });
    return weights ? Math.round((sum / weights) * 10) / 10 : null;
  });
  const top = Math.max(...totals.map((x) => x ?? -1));
  return { totals, best: totals.map((x) => x !== null && x === top && choices.length > 1) };
}

export const DecisionMatrix = defineComponent({
  name: 'DecisionMatrix',
  description:
    'Weighted scoring of 2-4 options on 3-6 criteria, to help the reader decide (vendors, job offers, laptops, strategies, treatment options). Scores 1-5 must follow what the source says about each option; the app computes the weighted total and marks the winner. Optional bottom line (max 20 words). Use Comparison instead when the source gives values but no judgment.',
  props: z.object({
    criteria: z.array(Criterion.ref),
    choices: z.array(Choice.ref),
    heading: z.string().optional(),
    bottomLine: z.string().optional(),
  }),
  component: ({ props }) => {
    const { t } = useTranslation('session');
    const criteria = childProps<CriterionProps>(props.criteria);
    const choices = childProps<ChoiceProps>(props.choices);
    const { totals, best } = weightedScores(criteria, choices);
    return (
      <section className="g-decision">
        {props.heading && <h2 className="g-heading">{props.heading}</h2>}
        <div className="g-decision__scroll">
          <table>
            <thead>
              <tr>
                <th scope="col" />
                {criteria.map((c, i) => (
                  <th scope="col" key={i}>
                    {c.name}
                    {clampWeight(c.weight) > 1 && <span className="g-decision__weight">×{clampWeight(c.weight)}</span>}
                  </th>
                ))}
                <th scope="col" className="g-decision__total">
                  {t('genui.decision.total')}
                </th>
              </tr>
            </thead>
            <tbody>
              {choices.map((c, i) => (
                <tr key={i} className={best[i] ? 'is-best' : undefined}>
                  <th scope="row">
                    {c.name}
                    {c.note && <span className="g-decision__note">{c.note}</span>}
                  </th>
                  {criteria.map((_, j) => {
                    const s = clampScore(c.scores?.[j]);
                    return (
                      <td key={j}>
                        {s === null ? (
                          '–'
                        ) : (
                          <span className="g-dots" role="img" aria-label={`${s}/5`}>
                            {[1, 2, 3, 4, 5].map((d) => (
                              <span key={d} className={d <= Math.round(s) ? 'is-on' : undefined} />
                            ))}
                          </span>
                        )}
                      </td>
                    );
                  })}
                  <td className="g-decision__total">
                    <strong>{totals[i] ?? '–'}</strong>
                    {best[i] && <span className="g-compare__badge">{t('genui.best')}</span>}
                  </td>
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

export const SCENARIO_KINDS = ['best', 'base', 'worst'] as const;

export const Scenario = defineComponent({
  name: 'Scenario',
  description:
    'One possible future: kind "best" | "base" | "worst", a short title (max 6 words), the outcome (max 20 words), optional likelihood "high" | "medium" | "low" when the source implies it, optional signal to watch for (max 12 words).',
  props: z.object({
    kind: z.enum(SCENARIO_KINDS),
    title: z.string(),
    outcome: z.string(),
    likelihood: z.enum(RISK_LEVELS).optional(),
    signal: z.string().optional(),
  }),
  component: ({ props }) => {
    const { t } = useTranslation('session');
    const kind = SCENARIO_KINDS.includes(props.kind) ? props.kind : 'base';
    const likely = props.likelihood && RISK_LEVELS.includes(props.likelihood) ? props.likelihood : null;
    return (
      <li className={`g-scenario g-scenario--${kind}`}>
        <span className="g-scenario__kind">{t(`genui.scenario.${kind}`)}</span>
        <strong>{props.title}</strong>
        <p>{props.outcome}</p>
        {(likely || props.signal) && (
          <dl>
            {likely && (
              <div>
                <dt>{t('genui.scenario.likelihood')}</dt>
                <dd>{t(`genui.risk.${likely}`)}</dd>
              </div>
            )}
            {props.signal && (
              <div>
                <dt>{t('genui.scenario.signal')}</dt>
                <dd>{props.signal}</dd>
              </div>
            )}
          </dl>
        )}
      </li>
    );
  },
});

export const Scenarios = defineComponent({
  name: 'Scenarios',
  description:
    'Possible futures the source lays out (2-3: best, base, worst case), for forecasts, market outlooks, policy debates, project plans and personal finance. Only scenarios the source supports; never invent probabilities.',
  props: z.object({
    items: z.array(Scenario.ref),
    heading: z.string().optional(),
  }),
  component: ({ props, renderNode }) => (
    <section className="g-scenarios">
      {props.heading && <h2 className="g-heading">{props.heading}</h2>}
      <ul>{renderNode(props.items)}</ul>
    </section>
  ),
});

export const Quadrant = defineComponent({
  name: 'Quadrant',
  description: 'One cell of a 2×2 matrix: a 1-3 word title and 1-4 short items (max 8 words each).',
  props: z.object({
    title: z.string(),
    items: z.array(z.string()),
  }),
  component: ({ props }) => (
    <li className="g-quadrant">
      <strong>{props.title}</strong>
      <ul>
        {(props.items ?? []).map((x, i) => (
          <li key={i}>{x}</li>
        ))}
      </ul>
    </li>
  ),
});

export const Matrix2x2 = defineComponent({
  name: 'Matrix2x2',
  description:
    'A 2×2 matrix of exactly 4 Quadrants in reading order (top-left, top-right, bottom-left, bottom-right). SWOT: Strengths, Weaknesses, Opportunities, Threats. Priorities: impact vs effort, urgent vs important. Optional axis labels name what changes left→right (xAxis) and bottom→top (yAxis); omit them for SWOT.',
  props: z.object({
    quadrants: z.array(Quadrant.ref),
    heading: z.string().optional(),
    xAxis: z.string().optional(),
    yAxis: z.string().optional(),
  }),
  component: ({ props, renderNode }) => (
    <section className={`g-matrix ${props.yAxis ? 'has-y' : ''}`}>
      {props.heading && <h2 className="g-heading">{props.heading}</h2>}
      <div className="g-matrix__frame">
        {props.yAxis && <span className="g-matrix__y">{props.yAxis} →</span>}
        <ul>{renderNode(props.quadrants)}</ul>
        {props.xAxis && <span className="g-matrix__x">{props.xAxis} →</span>}
      </div>
    </section>
  ),
});
