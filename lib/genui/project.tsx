/** Projects and software: kanban-style status boards and typed changelogs. */
import { useTranslation } from 'react-i18next';
import { defineComponent } from '@openuidev/react-lang';
import { z } from 'zod/v4';

export const StatusColumn = defineComponent({
  name: 'StatusColumn',
  description:
    'One column of a status board: title in the user language (e.g. "Done"), 1-6 short items, optional status ("done" | "active" | "planned" | "blocked") that sets its color.',
  props: z.object({
    title: z.string(),
    items: z.array(z.string()),
    status: z.enum(['done', 'active', 'planned', 'blocked']).optional(),
  }),
  component: ({ props }) => (
    <li className={`g-column g-column--${props.status ?? 'planned'}`}>
      <span className="g-column__head">
        <span className="g-column__title">{props.title}</span>
        <span className="g-column__count">{props.items?.length ?? 0}</span>
      </span>
      <ul>
        {(props.items ?? []).map((x, i) => (
          <li key={i}>{x}</li>
        ))}
      </ul>
    </li>
  ),
});

export const StatusBoard = defineComponent({
  name: 'StatusBoard',
  description:
    'Kanban-style board of 2-4 columns for project updates, roadmaps, plans and progress reports (e.g. Done / In progress / Planned). Only for work grouped by status.',
  props: z.object({
    columns: z.array(StatusColumn.ref),
    heading: z.string().optional(),
  }),
  component: ({ props, renderNode }) => (
    <section className="g-board">
      {props.heading && <h2 className="g-heading">{props.heading}</h2>}
      <ul>{renderNode(props.columns)}</ul>
    </section>
  ),
});

export const CHANGE_TYPES = ['added', 'changed', 'fixed', 'removed', 'deprecated', 'security'] as const;

export const Change = defineComponent({
  name: 'Change',
  description:
    'One change: type ("added" | "changed" | "fixed" | "removed" | "deprecated" | "security") and what changed (max 14 words).',
  props: z.object({
    type: z.enum(CHANGE_TYPES),
    text: z.string(),
  }),
  component: ({ props }) => {
    const { t } = useTranslation('session');
    const type = CHANGE_TYPES.includes(props.type) ? props.type : 'changed';
    return (
      <li className={`g-change g-change--${type}`}>
        <span className="g-change__type">{t(`genui.change.${type}`)}</span>
        <span className="g-change__text">{props.text}</span>
      </li>
    );
  },
});

export const ChangeList = defineComponent({
  name: 'ChangeList',
  description:
    'What changed, tagged by type (3-10 items, most important first): release notes, changelogs, product updates, amended laws, policies or terms of service. Heading can carry the version or date.',
  props: z.object({
    changes: z.array(Change.ref),
    heading: z.string().optional(),
  }),
  component: ({ props, renderNode }) => (
    <section className="g-changes">
      {props.heading && <h2 className="g-heading">{props.heading}</h2>}
      <ul>{renderNode(props.changes)}</ul>
    </section>
  ),
});
