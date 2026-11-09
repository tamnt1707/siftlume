/** Explaining: an everyday comparison, and misconceptions set straight. */
import { useTranslation } from 'react-i18next';
import { defineComponent } from '@openuidev/react-lang';
import { z } from 'zod/v4';

export const Analogy = defineComponent({
  name: 'Analogy',
  description:
    'An everyday comparison that makes the core idea click: "like" names the familiar thing (2-6 words, e.g. "a library catalog"), "because" says how it maps onto the subject (max 20 words). Your own illustration; keep the facts from the source.',
  props: z.object({
    like: z.string(),
    because: z.string(),
  }),
  component: ({ props }) => {
    const { t } = useTranslation('session');
    return (
      <aside className="g-analogy">
        <span className="g-analogy__mark" aria-hidden="true">
          ≈
        </span>
        <p>
          <span className="g-analogy__label">{t('genui.analogy')}</span>
          <strong>{props.like}</strong>
          <span className="g-analogy__because">{props.because}</span>
        </p>
      </aside>
    );
  },
});

export const Misconception = defineComponent({
  name: 'Misconception',
  description:
    'One misconception: what people wrongly believe (max 12 words) and what is actually true (max 20 words).',
  props: z.object({
    myth: z.string(),
    fact: z.string(),
  }),
  component: ({ props }) => {
    const { t } = useTranslation('session');
    return (
      <li className="g-myth">
        <p className="g-myth__myth">
          <span className="g-myth__label">{t('genui.myth')}</span>
          <s>{props.myth}</s>
        </p>
        <p className="g-myth__fact">
          <span className="g-myth__label">{t('genui.fact')}</span>
          {props.fact}
        </p>
      </li>
    );
  },
});

export const Misconceptions = defineComponent({
  name: 'Misconceptions',
  description:
    'Common misunderstandings set straight (2-4), for explanations, health, science and how-things-work topics. The facts must come from the source.',
  props: z.object({
    items: z.array(Misconception.ref),
    heading: z.string().optional(),
  }),
  component: ({ props, renderNode }) => (
    <section className="g-myths">
      {props.heading && <h2 className="g-heading">{props.heading}</h2>}
      <ul>{renderNode(props.items)}</ul>
    </section>
  ),
});
