/**
 * Several sources side by side: where they agree, where they differ, and what only one of them
 * says, each side citing its own document with a verbatim passage. The passage is checked against
 * that document, not just the combined text: a quote taken from another source is flagged.
 */
import { useTranslation } from 'react-i18next';
import { defineComponent, useIsStreaming } from '@openuidev/react-lang';
import { z } from 'zod/v4';
import { evidenceStatus, useEvidence } from '@/lib/evidence';
import { documentName, partContent, partForQuote, sourceDocuments } from '@/lib/documents';
import { PointSource, UnverifiedMark } from './core';
import { childProps } from './shared';

export const VERDICTS = ['agree', 'differ', 'only'] as const;
export type Verdict = (typeof VERDICTS)[number];

/** Where a side's passage is: in its own document, in another one (which), or not in the source. */
export function sideCheck(content: string, source: number, quote: string): 'ok' | 'elsewhere' | 'other' {
  const status = evidenceStatus(content, quote);
  if (status !== 'ok') return 'other';
  const own = partContent(content, source - 1);
  return own && evidenceStatus(own, quote) === 'ok' ? 'ok' : 'elsewhere';
}

function SideSource({ source, quote }: { source: number; quote?: string | null }) {
  const evidence = useEvidence();
  const streaming = useIsStreaming();
  const { t } = useTranslation('session');
  if (!evidence || streaming || !quote?.trim()) return null;
  // Single sources have no documents to tell apart: the usual check.
  if (sideCheck(evidence.content, source, quote) !== 'elsewhere') return <PointSource quote={quote} />;
  const found = partForQuote(evidence.content, quote);
  return (
    <UnverifiedMark
      why={t('genui.agreement.elsewhere', { source, found: found === null ? '?' : found + 1, quote: quote.trim() })}
    />
  );
}

export const SourceSide = defineComponent({
  name: 'SourceSide',
  description:
    'What one document says on the point: source is its document index (1, 2, 3… as in <document index>), says is its position in max 15 words, quote is 5-25 words copied verbatim from that same document.',
  props: z.object({
    source: z.number(),
    says: z.string(),
    quote: z.string().optional(),
  }),
  // Rendered by SourcePoint.
  component: () => null,
});

export const SourcePoint = defineComponent({
  name: 'SourcePoint',
  description:
    'One point the documents address: the point (max 12 words), verdict "agree" (they say the same), "differ" (different figures, dates, claims or recommendations) or "only" (just one document covers it), and sides: one SourceSide per document that addresses it (one side for "only").',
  props: z.object({
    point: z.string(),
    verdict: z.enum(VERDICTS),
    sides: z.array(SourceSide.ref),
  }),
  component: ({ props }) => {
    const { t } = useTranslation('session');
    const evidence = useEvidence();
    const verdict = VERDICTS.includes(props.verdict) ? props.verdict : 'only';
    const docs = evidence ? sourceDocuments(evidence.content) : [];
    const sides = childProps<{ source?: number; says?: string; quote?: string }>(props.sides);
    return (
      <li className={`g-agree g-agree--${verdict}`}>
        <span className="g-agree__verdict">{t(`genui.agreement.${verdict}`)}</span>
        <span className="g-agree__point">{props.point}</span>
        <ul className="g-agree__sides">
          {sides.map((s, i) => {
            const n = Number(s.source) || 0;
            const doc = docs.find((d) => d.index === n);
            return (
              <li key={i}>
                <span className="g-agree__source" title={doc?.title}>
                  [{n || '?'}]{doc ? ` ${documentName(doc)}` : ''}
                </span>
                <span className="g-agree__says">{s.says}</span>
                <span className="g-point-source">
                  <SideSource source={n} quote={s.quote} />
                </span>
              </li>
            );
          })}
        </ul>
      </li>
    );
  },
});

export const SourceAgreement = defineComponent({
  name: 'SourceAgreement',
  description:
    'Only for a source made of several documents: what they agree on, where they differ or contradict, and what only one covers (3-8 points, agree first, then differ, then only). Each side cites its document. Use it for news from several outlets, reviews from several sites, research, or any tabs on one topic.',
  props: z.object({
    points: z.array(SourcePoint.ref),
    heading: z.string().optional(),
  }),
  component: ({ props, renderNode }) => {
    const { t } = useTranslation('session');
    const verdicts = childProps<{ verdict?: string }>(props.points).map((p) =>
      VERDICTS.includes(p.verdict as Verdict) ? (p.verdict as Verdict) : 'only',
    );
    const counts = VERDICTS.map((v) => [v, verdicts.filter((x) => x === v).length] as const).filter(([, n]) => n);
    return (
      <section className="g-agreement">
        <h2 className="g-heading">{props.heading || t('genui.agreement.heading')}</h2>
        {counts.length > 1 && (
          <p className="g-agreement__counts">
            {counts.map(([v, n]) => (
              <span key={v} className={`g-agree--${v}`}>
                {t(`genui.agreement.${v}`)} · {n}
              </span>
            ))}
          </p>
        )}
        <ul>{renderNode(props.points)}</ul>
      </section>
    );
  },
});
