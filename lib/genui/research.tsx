/** Research: a structured brief of a study, paper, trial or survey. */
import { useTranslation } from 'react-i18next';
import { defineComponent } from '@openuidev/react-lang';
import { z } from 'zod/v4';

export const ResearchBrief = defineComponent({
  name: 'ResearchBrief',
  description:
    'Structured digest of a study, paper, trial or survey: the research question (one sentence), 2-4 findings (max 15 words each), optional method (one line), sample (e.g. "1,204 adults, 12 weeks") and 1-3 limitations stated or evident in the source.',
  props: z.object({
    question: z.string(),
    findings: z.array(z.string()),
    method: z.string().optional(),
    sample: z.string().optional(),
    limitations: z.array(z.string()).optional(),
  }),
  component: ({ props }) => {
    const { t } = useTranslation('session');
    return (
      <section className="g-research">
        <div className="g-research__question">
          <span className="g-research__label">{t('genui.research.question')}</span>
          <p>{props.question}</p>
        </div>
        {(props.method || props.sample) && (
          <dl className="g-research__meta">
            {props.method && (
              <div>
                <dt>{t('genui.research.method')}</dt>
                <dd>{props.method}</dd>
              </div>
            )}
            {props.sample && (
              <div>
                <dt>{t('genui.research.sample')}</dt>
                <dd>{props.sample}</dd>
              </div>
            )}
          </dl>
        )}
        <div className="g-research__block">
          <span className="g-research__label">{t('genui.research.findings')}</span>
          <ol>
            {(props.findings ?? []).map((x, i) => (
              <li key={i}>{x}</li>
            ))}
          </ol>
        </div>
        {props.limitations?.length ? (
          <div className="g-research__block g-research__block--limits">
            <span className="g-research__label">{t('genui.research.limitations')}</span>
            <ul>
              {props.limitations.map((x, i) => (
                <li key={i}>{x}</li>
              ))}
            </ul>
          </div>
        ) : null}
      </section>
    );
  },
});
