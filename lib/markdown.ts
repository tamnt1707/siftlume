import { createParser } from '@openuidev/react-lang';
import { library, ROOT } from './library';
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
