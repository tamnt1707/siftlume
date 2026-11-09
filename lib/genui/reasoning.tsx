/** Reasoning: how an argument is built, and what caused what. */
import { useTranslation } from 'react-i18next';
import { defineComponent } from '@openuidev/react-lang';
import { z } from 'zod/v4';
import { childProps } from './shared';

export const ARGUMENT_STANCES = ['for', 'against'] as const;

export const Argument = defineComponent({
  name: 'Argument',
  description:
    'One argument about the main claim: stance "for" (supports it) or "against" (challenges it, including counter-arguments the source raises or answers), the point (max 14 words), optional evidence the source gives for it (max 15 words).',
  props: z.object({
    stance: z.enum(ARGUMENT_STANCES),
    point: z.string(),
    evidence: z.string().optional(),
  }),
  // Rendered by ArgumentMap, which splits arguments by stance.
  component: () => null,
});

type ArgumentProps = { stance?: string; point?: string; evidence?: string };

export const ArgumentMap = defineComponent({
  name: 'ArgumentMap',
  description:
    'How the argument of an essay, op-ed, debate, proposal or legal ruling is built: the main claim (thesis, max 16 words), the arguments for and against it (2-6) with their evidence, and an optional one-line conclusion on which side the source makes stronger. Use for persuasive sources instead of ProsCons.',
  props: z.object({
    thesis: z.string(),
    arguments: z.array(Argument.ref),
    heading: z.string().optional(),
    conclusion: z.string().optional(),
  }),
  component: ({ props }) => {
    const { t } = useTranslation('session');
    const all = childProps<ArgumentProps>(props.arguments);
    const side = (stance: (typeof ARGUMENT_STANCES)[number]) => {
      const items = all.filter((a) => (a.stance === 'against' ? 'against' : 'for') === stance);
      if (!items.length) return null;
      return (
        <div className={`g-argmap__side g-argmap__side--${stance}`}>
          <span className="g-argmap__label">{t(`genui.argument.${stance}`)}</span>
          <ul>
            {items.map((a, i) => (
              <li key={i}>
                <span>{a.point}</span>
                {a.evidence && <span className="g-argmap__evidence">{a.evidence}</span>}
              </li>
            ))}
          </ul>
        </div>
      );
    };
    return (
      <section className="g-argmap">
        {props.heading && <h2 className="g-heading">{props.heading}</h2>}
        <div className="g-argmap__thesis">
          <span className="g-argmap__label">{t('genui.argument.thesis')}</span>
          <strong>{props.thesis}</strong>
        </div>
        <div className="g-argmap__sides">
          {side('for')}
          {side('against')}
        </div>
        {props.conclusion && <p className="g-argmap__conclusion">{props.conclusion}</p>}
      </section>
    );
  },
});

export const CauseEffect = defineComponent({
  name: 'CauseEffect',
  description:
    'Why something happened and what it leads to: 1-4 causes → the central event or change (max 10 words) → 1-4 effects or consequences. For news, history, economics, policy, incidents and science. Each cause and effect max 10 words, all from the source.',
  props: z.object({
    causes: z.array(z.string()),
    event: z.string(),
    effects: z.array(z.string()),
    heading: z.string().optional(),
  }),
  component: ({ props }) => {
    const { t } = useTranslation('session');
    const column = (kind: 'causes' | 'effects', items: string[] = []) => (
      <div className={`g-cause__col g-cause__col--${kind}`}>
        <span className="g-cause__label">{t(`genui.cause.${kind}`)}</span>
        <ul>
          {items.map((x, i) => (
            <li key={i}>{x}</li>
          ))}
        </ul>
      </div>
    );
    return (
      <section className="g-cause">
        {props.heading && <h2 className="g-heading">{props.heading}</h2>}
        <div className="g-cause__flow">
          {column('causes', props.causes)}
          <span className="g-cause__arrow" aria-hidden="true" />
          <div className="g-cause__event">
            <span className="g-cause__label">{t('genui.cause.event')}</span>
            <strong>{props.event}</strong>
          </div>
          <span className="g-cause__arrow" aria-hidden="true" />
          {column('effects', props.effects)}
        </div>
      </section>
    );
  },
});
