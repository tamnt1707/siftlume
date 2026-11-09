/** Risk and credibility: risks graded by severity, and claims checked against the source's evidence. */
import { useTranslation } from 'react-i18next';
import { defineComponent } from '@openuidev/react-lang';
import { z } from 'zod/v4';

export const RISK_LEVELS = ['high', 'medium', 'low'] as const;

export const Risk = defineComponent({
  name: 'Risk',
  description:
    'One risk or caution: level ("high" | "medium" | "low", as the source implies), a short title (max 8 words), optional detail or mitigation (max 15 words).',
  props: z.object({
    level: z.enum(RISK_LEVELS),
    title: z.string(),
    detail: z.string().optional(),
  }),
  component: ({ props }) => {
    const { t } = useTranslation('session');
    const level = RISK_LEVELS.includes(props.level) ? props.level : 'medium';
    return (
      <li className={`g-risk g-risk--${level}`}>
        <span className="g-risk__level">{t(`genui.risk.${level}`)}</span>
        <span className="g-risk__text">
          <strong>{props.title}</strong>
          {props.detail && <span>{props.detail}</span>}
        </span>
      </li>
    );
  },
});

export const RiskList = defineComponent({
  name: 'RiskList',
  description:
    'Risks, side effects, vulnerabilities or red flags graded by severity (2-6, highest first): security advisories, medicines, contracts, investments, travel warnings. Use instead of several warning Callouts.',
  props: z.object({
    risks: z.array(Risk.ref),
    heading: z.string().optional(),
  }),
  component: ({ props, renderNode }) => (
    <section className="g-risks">
      {props.heading && <h2 className="g-heading">{props.heading}</h2>}
      <ul>{renderNode(props.risks)}</ul>
    </section>
  ),
});

export const CLAIM_STATUSES = ['supported', 'opinion', 'disputed', 'unsupported'] as const;

export const Claim = defineComponent({
  name: 'Claim',
  description:
    'One claim made in the source and how the source itself backs it: "supported" (data, studies or sources are given), "opinion" (stated as a view), "disputed" (the source reports disagreement), "unsupported" (asserted without evidence). Optional evidence: what the source offers, max 15 words.',
  props: z.object({
    claim: z.string(),
    status: z.enum(CLAIM_STATUSES),
    evidence: z.string().optional(),
  }),
  component: ({ props }) => {
    const { t } = useTranslation('session');
    const status = CLAIM_STATUSES.includes(props.status) ? props.status : 'unsupported';
    return (
      <li className={`g-claim g-claim--${status}`}>
        <span className="g-claim__status">{t(`genui.claim.${status}`)}</span>
        <span className="g-claim__text">{props.claim}</span>
        {props.evidence && <span className="g-claim__evidence">{props.evidence}</span>}
      </li>
    );
  },
});

export const ClaimCheck = defineComponent({
  name: 'ClaimCheck',
  description:
    'The main claims of the source (2-5) with how well the source backs each one, for news, opinion pieces, health and science articles, marketing and political statements. Judge only from what the source provides, never from outside knowledge.',
  props: z.object({
    claims: z.array(Claim.ref),
    heading: z.string().optional(),
  }),
  component: ({ props, renderNode }) => (
    <section className="g-claims">
      {props.heading && <h2 className="g-heading">{props.heading}</h2>}
      <ul>{renderNode(props.claims)}</ul>
    </section>
  ),
});
