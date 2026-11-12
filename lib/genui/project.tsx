/** Projects and software: kanban-style status boards, typed changelogs and owned action items. */
import { useTranslation } from 'react-i18next';
import { defineComponent, useStateField } from '@openuidev/react-lang';
import { z } from 'zod/v4';
import { childProps } from './shared';

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

export const ACTION_STATUSES = ['todo', 'doing', 'done', 'blocked'] as const;

export const ActionItem = defineComponent({
  name: 'ActionItem',
  description:
    'One action: task (max 12 words), optional owner as the source names them ("@ana", "Design team"), optional due as written ("Fri 14 Nov", "before merge"), optional status "todo" | "doing" | "done" | "blocked" only when the source says it.',
  props: z.object({
    task: z.string(),
    owner: z.string().optional(),
    due: z.string().optional(),
    status: z.enum(ACTION_STATUSES).optional(),
  }),
  component: () => null,
});

type ActionProps = { task?: string; owner?: string; due?: string; status?: string };

/** Stable key for the ticks of one list (saved with the message, like Checklist). */
const actionsKey = (items: ActionProps[]) => {
  let h = 0;
  for (const c of items.map((x) => x.task ?? '').join('\u0001')) h = (h * 31 + c.charCodeAt(0)) | 0;
  return `actions_${Math.abs(h).toString(36)}`;
};

const initials = (name: string) =>
  name
    .replace(/^@/, '')
    .split(/[\s._-]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join('');

export const ActionItems = defineComponent({
  name: 'ActionItems',
  description:
    'Action items with who does them and by when (2-10): meeting outcomes, a merge checklist, project next steps. Use instead of Checklist when the source names owners, dates or states; tickable.',
  props: z.object({
    items: z.array(ActionItem.ref),
    heading: z.string().optional(),
  }),
  component: ({ props }) => {
    const { t } = useTranslation('session');
    const items = childProps<ActionProps>(props.items).filter((x) => x.task);
    const field = useStateField(actionsKey(items));
    const ticked = (Array.isArray(field.value) ? field.value : []) as number[];
    const isDone = (x: ActionProps, i: number) => ticked.includes(i) !== (x.status === 'done');
    const toggle = (i: number) => field.setValue(ticked.includes(i) ? ticked.filter((x) => x !== i) : [...ticked, i]);
    const done = items.filter(isDone).length;
    return (
      <section className="g-actions">
        <div className="g-checklist__head">
          {props.heading && <h2 className="g-heading">{props.heading}</h2>}
          <span className="g-checklist__progress">{t('genui.checklistProgress', { done, total: items.length })}</span>
        </div>
        <ul>
          {items.map((x, i) => {
            const status = (ACTION_STATUSES as readonly string[]).includes(x.status ?? '')
              ? (x.status as (typeof ACTION_STATUSES)[number])
              : null;
            return (
              <li key={i} className={`g-action ${isDone(x, i) ? 'is-done' : ''}`}>
                <label>
                  <input type="checkbox" checked={isDone(x, i)} onChange={() => toggle(i)} />
                  <span className="g-action__task">{x.task}</span>
                </label>
                <span className="g-action__meta">
                  {x.owner && (
                    <span className="g-action__owner" title={t('genui.action.owner')}>
                      <span className="g-action__avatar" aria-hidden="true">
                        {initials(x.owner)}
                      </span>
                      {x.owner}
                    </span>
                  )}
                  {x.due && (
                    <span className="g-action__due" title={t('genui.action.due')}>
                      {x.due}
                    </span>
                  )}
                  {status && status !== 'todo' && (
                    <span className={`g-action__status g-action__status--${status}`}>
                      {t(`genui.action.status.${status}`)}
                    </span>
                  )}
                </span>
              </li>
            );
          })}
        </ul>
      </section>
    );
  },
});
