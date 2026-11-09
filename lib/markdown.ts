import { createParser } from '@openuidev/react-lang';
import {
  CALC_OPS,
  CHANGE_TYPES,
  CLAIM_STATUSES,
  library,
  qrSafe,
  RISK_LEVELS,
  ROOT,
  SCENARIO_KINDS,
  STANCES,
  weightedScores,
} from './library';
import { t } from './i18n';

/**
 * Converts a rendered summary (OpenUI Lang program) to Markdown for copy, download and
 * text-to-speech. Charts become data tables, diagrams become ```mermaid blocks, checklists become
 * task lists. Follow-up suggestions and empty or unknown blocks are skipped.
 */

const parser = createParser(library.toJSONSchema(), ROOT);

type Node = { type?: string; typeName?: string; props?: Record<string, unknown> };

const isNode = (v: unknown): v is Node => Boolean(v && typeof v === 'object' && (v as Node).type === 'element');
const str = (v: unknown) => (v === null || v === undefined ? '' : String(v));
const list = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);
const props = (n: unknown) => (isNode(n) ? (n.props ?? {}) : {});
const cell = (v: unknown) => str(v).replace(/\|/g, '\\|').replace(/\n/g, ' ');

function table(headers: string[], rows: unknown[][]) {
  if (!headers.length || !rows.length) return '';
  return [
    `| ${headers.map(cell).join(' | ')} |`,
    `| ${headers.map(() => '---').join(' | ')} |`,
    ...rows.map((r) => `| ${r.map(cell).join(' | ')} |`),
  ].join('\n');
}

/** A known enum value, or the fallback (keeps translation keys valid for odd model output). */
const pick = <T extends string>(v: unknown, all: readonly T[], fallback: T): T =>
  (all as readonly string[]).includes(str(v)) ? (str(v) as T) : fallback;

const heading = (h: unknown, level = 3) => (str(h) ? `${'#'.repeat(level)} ${str(h)}\n\n` : '');

/** Chart with labels and one or more series → table: label column + one column per series. */
function seriesChart(p: Record<string, unknown>) {
  const labels = list(p.labels);
  const series = list(p.series).map(props);
  if (!labels.length || !series.length) return '';
  return table(
    ['', ...series.map((s) => str(s.category))],
    labels.map((l, i) => [l, ...series.map((s) => list(s.values)[i])]),
  );
}

function render(node: unknown, level: number): string {
  if (Array.isArray(node))
    return node
      .map((n) => render(n, level))
      .filter(Boolean)
      .join('\n\n');
  if (!isNode(node)) return '';
  const p = node.props ?? {};
  const kids = (v: unknown) => render(v, level + 1);

  switch (node.typeName) {
    case 'Card':
      return render(p.children, level);
    case 'SummaryHero': {
      const meta = [str(p.source), p.readMinutes ? t('session:genui.minRead', { count: Number(p.readMinutes) }) : '']
        .filter(Boolean)
        .join(', ');
      return [`# ${str(p.title)}`, meta && `_${meta}_`, `> **TL;DR** ${str(p.tldr)}`].filter(Boolean).join('\n\n');
    }
    case 'CardHeader':
      return [`## ${str(p.title)}`, str(p.subtitle)].filter(Boolean).join('\n\n');
    case 'KeyNumbers':
      return list(p.items)
        .map(props)
        .map((k) => `- **${str(k.value)}** ${str(k.label)}${k.change ? ` (${str(k.change)})` : ''}`)
        .join('\n');
    case 'Takeaways':
      return (
        heading(p.heading) +
        list(p.items)
          .map(props)
          .map((x) => `- ${str(x.text)}${x.detail ? ` — ${str(x.detail)}` : ''}`)
          .join('\n')
      );
    case 'Timeline':
      return (
        heading(p.heading) +
        list(p.events)
          .map(props)
          .map((e) => `- **${str(e.when)}**: ${str(e.what)}`)
          .join('\n')
      );
    case 'SourceQuote':
      return `> “${str(p.quote)}”${p.note ? `\n>\n> — ${str(p.note)}` : ''}`;
    case 'Diagram':
      return `${p.caption ? `**${str(p.caption)}**\n\n` : ''}\`\`\`mermaid\n${str(p.mermaid)}\n\`\`\``;
    case 'ProsCons':
      return (
        heading(p.heading) +
        [
          `**${t('session:genui.pros')}**`,
          ...list(p.pros).map((x) => `- ${str(x)}`),
          '',
          `**${t('session:genui.cons')}**`,
          ...list(p.cons).map((x) => `- ${str(x)}`),
        ].join('\n')
      );
    case 'Verdict':
      return `**${str(p.label) || t('session:export.verdict')}: ${str(p.score)}/${str(p.max)}** — ${str(p.summary)}`;
    case 'BarList':
      return (
        heading(p.heading) +
        table(
          ['', t('session:export.value')],
          list(p.items)
            .map(props)
            .map((b) => [b.label, b.display ?? b.value]),
        )
      );
    case 'Checklist':
      return (
        heading(p.heading) +
        list(p.items)
          .map((x) => `- [ ] ${str(x)}`)
          .join('\n')
      );
    case 'People':
      return (
        heading(p.heading) +
        list(p.items)
          .map(props)
          .map((x) => `- **${str(x.name)}**, ${str(x.role)}${x.stance ? `: ${str(x.stance)}` : ''}`)
          .join('\n')
      );
    case 'Glossary':
      return (
        heading(p.heading) +
        list(p.terms)
          .map(props)
          .map((x) => `- **${str(x.term)}**: ${str(x.meaning)}`)
          .join('\n')
      );
    case 'FactSheet':
      return (
        heading(p.heading) +
        list(p.facts)
          .map(props)
          .map((x) => `- **${str(x.label)}**: ${str(x.value)}${x.note ? ` (${str(x.note)})` : ''}`)
          .join('\n')
      );
    case 'Comparison': {
      const options = list(p.options).map(str);
      const norm = (s: unknown) => str(s).trim().toLowerCase();
      const rows = list(p.rows)
        .map(props)
        .map((r) => [
          r.attribute,
          ...options.map((o, i) => {
            const v = str(list(r.values)[i]);
            return r.best && norm(r.best) === norm(o) ? `**${v}** ✓` : v;
          }),
        ]);
      return [heading(p.heading) + table(['', ...options], rows), p.bottomLine ? `**${str(p.bottomLine)}**` : '']
        .filter(Boolean)
        .join('\n\n');
    }
    case 'PricingPlans':
      return (
        heading(p.heading) +
        list(p.plans)
          .map(props)
          .map((x) =>
            [
              `**${str(x.name)}**: ${str(x.price)}${x.period ? ` ${str(x.period)}` : ''}${x.recommended ? ` (${t('session:genui.recommended')})` : ''}`,
              x.note ? `  ${str(x.note)}` : '',
              ...list(x.features).map((f) => `  - ${str(f)}`),
            ]
              .filter(Boolean)
              .join('\n'),
          )
          .map((x) => `- ${x}`)
          .join('\n')
      );
    case 'RiskList':
      return (
        heading(p.heading) +
        list(p.risks)
          .map(props)
          .map(
            (x) =>
              `- **${t(`session:genui.risk.${pick(x.level, RISK_LEVELS, 'medium')}`)}**: ${str(x.title)}${x.detail ? ` — ${str(x.detail)}` : ''}`,
          )
          .join('\n')
      );
    case 'ClaimCheck':
      return (
        heading(p.heading) +
        list(p.claims)
          .map(props)
          .map(
            (x) =>
              `- ${str(x.claim)} — **${t(`session:genui.claim.${pick(x.status, CLAIM_STATUSES, 'unsupported')}`)}**${x.evidence ? `: ${str(x.evidence)}` : ''}`,
          )
          .join('\n')
      );
    case 'StatusBoard':
      return (
        heading(p.heading) +
        list(p.columns)
          .map(props)
          .map((c) => [`**${str(c.title)}**`, ...list(c.items).map((x) => `- ${str(x)}`)].join('\n'))
          .join('\n\n')
      );
    case 'ChangeList':
      return (
        heading(p.heading) +
        list(p.changes)
          .map(props)
          .map((x) => `- **${t(`session:genui.change.${pick(x.type, CHANGE_TYPES, 'changed')}`)}**: ${str(x.text)}`)
          .join('\n')
      );
    case 'ResearchBrief':
      return [
        `**${t('session:genui.research.question')}**: ${str(p.question)}`,
        p.method ? `**${t('session:genui.research.method')}**: ${str(p.method)}` : '',
        p.sample ? `**${t('session:genui.research.sample')}**: ${str(p.sample)}` : '',
        `**${t('session:genui.research.findings')}**\n${list(p.findings)
          .map((x, i) => `${i + 1}. ${str(x)}`)
          .join('\n')}`,
        list(p.limitations).length
          ? `**${t('session:genui.research.limitations')}**\n${list(p.limitations)
              .map((x) => `- ${str(x)}`)
              .join('\n')}`
          : '',
      ]
        .filter(Boolean)
        .join('\n\n');
    case 'Analogy':
      return `> **${t('session:genui.analogy')} ${str(p.like)}**: ${str(p.because)}`;
    case 'Misconceptions':
      return (
        heading(p.heading) +
        list(p.items)
          .map(props)
          .map((x) => `- ~~${str(x.myth)}~~ — **${t('session:genui.fact')}** ${str(x.fact)}`)
          .join('\n')
      );
    case 'ArgumentMap': {
      const args = list(p.arguments).map(props);
      const side = (stance: 'for' | 'against') => {
        const items = args.filter((a) => (str(a.stance) === 'against' ? 'against' : 'for') === stance);
        return items.length
          ? `**${t(`session:genui.argument.${stance}`)}**\n${items
              .map((a) => `- ${str(a.point)}${a.evidence ? ` — ${str(a.evidence)}` : ''}`)
              .join('\n')}`
          : '';
      };
      return [
        heading(p.heading) + `**${t('session:genui.argument.thesis')}**: ${str(p.thesis)}`,
        side('for'),
        side('against'),
        p.conclusion ? `_${str(p.conclusion)}_` : '',
      ]
        .filter(Boolean)
        .join('\n\n');
    }
    case 'CauseEffect':
      return [
        heading(p.heading) +
          `**${t('session:genui.cause.causes')}**\n${list(p.causes)
            .map((x) => `- ${str(x)}`)
            .join('\n')}`,
        `→ **${str(p.event)}**`,
        `**${t('session:genui.cause.effects')}**\n${list(p.effects)
          .map((x) => `- ${str(x)}`)
          .join('\n')}`,
      ].join('\n\n');
    case 'DecisionMatrix': {
      const criteria = list(p.criteria).map(props) as { name?: string; weight?: number }[];
      const choices = list(p.choices).map(props) as { name?: string; scores?: number[]; note?: string }[];
      const { totals, best } = weightedScores(criteria, choices);
      return (
        heading(p.heading) +
        table(
          [
            '',
            ...criteria.map((c) => `${str(c.name)}${Number(c.weight) > 1 ? ` (×${str(c.weight)})` : ''}`),
            t('session:genui.decision.total'),
          ],
          choices.map((c, i) => [
            str(c.name),
            ...criteria.map((_, j) => (c.scores?.[j] === undefined ? '' : `${str(c.scores[j])}/5`)),
            best[i] ? `**${str(totals[i])}** ✓` : str(totals[i] ?? ''),
          ]),
        ) +
        (p.bottomLine ? `\n\n${str(p.bottomLine)}` : '')
      );
    }
    case 'Scenarios':
      return (
        heading(p.heading) +
        list(p.items)
          .map(props)
          .map((x) => {
            const likely = x.likelihood
              ? ` (${t('session:genui.scenario.likelihood')}: ${t(`session:genui.risk.${pick(x.likelihood, RISK_LEVELS, 'medium')}`)})`
              : '';
            const signal = x.signal ? ` (${t('session:genui.scenario.signal')}: ${str(x.signal)})` : '';
            return `- **${t(`session:genui.scenario.${pick(x.kind, SCENARIO_KINDS, 'base')}`)}**${likely}: ${str(x.title)} — ${str(x.outcome)}${signal}`;
          })
          .join('\n')
      );
    case 'Matrix2x2':
      return (
        heading(p.heading) +
        list(p.quadrants)
          .map(props)
          .map((q) => [`**${str(q.title)}**`, ...list(q.items).map((x) => `- ${str(x)}`)].join('\n'))
          .join('\n\n')
      );
    case 'Perspectives':
      return (
        heading(p.heading) +
        (p.issue ? `${str(p.issue)}\n\n` : '') +
        list(p.items)
          .map(props)
          .map(
            (x) =>
              `- **${str(x.who)}** (${t(`session:genui.stance.${pick(x.stance, STANCES, 'neutral')}`)}): ${str(x.view)}${x.quote ? ` “${str(x.quote)}”` : ''}`,
          )
          .join('\n')
      );
    case 'BeforeAfter':
      return (
        heading(p.heading) +
        table(
          ['', str(p.beforeLabel) || t('session:genui.before'), str(p.afterLabel) || t('session:genui.after')],
          list(p.items)
            .map(props)
            .map((x) => [x.aspect, x.before, x.after]),
        )
      );
    case 'Calculation':
      return (
        heading(p.heading) +
        [
          ...list(p.steps)
            .map(props)
            .map((x) => {
              const op = pick(x.op, CALC_OPS, '+');
              return `- ${x.op ? `${op === '-' ? '−' : op} ` : ''}${str(x.label)}: ${str(x.value)}`;
            }),
          `- = **${str(p.resultLabel)}: ${str(p.result)}**`,
        ].join('\n') +
        (p.note ? `\n\n_${str(p.note)}_` : '')
      );
    case 'CodeWalkthrough':
      return (
        heading(p.heading) +
        `\`\`\`${str(p.language)}\n${str(p.code)}\n\`\`\`\n\n` +
        list(p.notes)
          .map(props)
          .map((x) => `- **L${str(x.lines)}**: ${str(x.text)}`)
          .join('\n')
      );
    case 'Tree':
      return (
        heading(p.heading) +
        [
          `- **${str(p.root)}**`,
          ...list(p.branches)
            .map(props)
            .flatMap((b) => [
              `  - ${str(b.label)}${b.note ? ` — ${str(b.note)}` : ''}`,
              ...list(b.items).map((x) => `    - ${str(x)}`),
            ]),
        ].join('\n')
      );
    case 'QrCode':
      return qrSafe(p.url) ? `[${str(p.label)}](${str(p.url).trim()})${p.caption ? ` — ${str(p.caption)}` : ''}` : '';
    case 'TextContent':
      return str(p.text);
    case 'MarkDownRenderer':
      return str(p.textMarkdown);
    case 'Callout':
    case 'TextCallout':
      return `> **${str(p.title)}** ${str(p.description)}`.trim();
    case 'CodeBlock':
      return `\`\`\`${str(p.language)}\n${str(p.codeString)}\n\`\`\``;
    case 'TagBlock':
      return list(p.tags)
        .map((x) => `\`${str(x)}\``)
        .join(' ');
    case 'ListBlock':
      return list(p.items)
        .map(props)
        .map((x) => `- ${str(x.title)}${x.subtitle ? ` — ${str(x.subtitle)}` : ''}`)
        .join('\n');
    case 'Steps':
      return list(p.items)
        .map(props)
        .map((x, i) => `${i + 1}. **${str(x.title)}** ${str(x.details)}`)
        .join('\n');
    case 'Table': {
      const cols = list(p.columns).map(props);
      const rows = Math.max(0, ...cols.map((c) => list(c.data).length));
      return table(
        cols.map((c) => str(c.label)),
        Array.from({ length: rows }, (_, i) => cols.map((c) => list(c.data)[i])),
      );
    }
    case 'BarChart':
    case 'LineChart':
    case 'AreaChart':
    case 'HorizontalBarChart':
    case 'RadarChart':
      return seriesChart(p);
    case 'PieChart':
    case 'RadialChart':
    case 'SingleStackedBarChart':
      return table(
        ['', t('session:export.value')],
        list(p.labels).map((l, i) => [l, list(p.values)[i]]),
      );
    case 'SectionBlock':
      return list(p.sections)
        .map(props)
        .map((s) => `${'#'.repeat(Math.min(level + 2, 6))} ${str(s.trigger)}\n\n${kids(s.content)}`)
        .join('\n\n');
    case 'Tabs':
    case 'Accordion':
      return list(p.items)
        .map(props)
        .map((s) => `${'#'.repeat(Math.min(level + 2, 6))} ${str(s.trigger)}\n\n${kids(s.content)}`)
        .join('\n\n');
    case 'Image':
    case 'ImageBlock':
      return p.src ? `![${str(p.alt)}](${str(p.src)})` : '';
    default:
      // FollowUpBlock, Buttons, forms and anything interactive have no static Markdown form.
      return '';
  }
}

export function programToMarkdown(program: string, source?: { title?: string; origin?: string }) {
  const root = parser.parse(program).root;
  const body = render(root, 1)
    .replace(/\n{3,}/g, '\n\n')
    .trim();
  const from = source?.origin?.startsWith('http')
    ? `\n\n---\n${t('session:export.source')}: [${source.title ?? source.origin}](${source.origin})`
    : '';
  return body + from + '\n';
}

/** Plain text for text-to-speech: Markdown syntax, tables and code removed. */
export function markdownToSpeech(md: string) {
  return md
    .replace(/```[\s\S]*?```/g, '')
    .replace(/^\|.*\|$/gm, '')
    .replace(/^---.*$/gm, '')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, '')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/[#>*_`]/g, '')
    .replace(/^\s*-\s*\[ \]\s*/gm, '')
    .replace(/^\s*[-\d.]+\s+/gm, '')
    .replace(/\n{2,}/g, '.\n')
    .trim();
}
