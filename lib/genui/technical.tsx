/** Technical: how a number is worked out, and code explained part by part. */
import { useState } from 'react';
import { defineComponent } from '@openuidev/react-lang';
import { z } from 'zod/v4';
import { childProps } from './shared';

export const CALC_OPS = ['+', '-', '×', '÷'] as const;

export const CalcStep = defineComponent({
  name: 'CalcStep',
  description:
    'One line of a calculation: a short label (max 6 words), the value as written (e.g. "$1,200", "12%", "3 months"), and op "+" | "-" | "×" | "÷" for how it applies to the running total (omit on the first line).',
  props: z.object({
    label: z.string(),
    value: z.string(),
    op: z.enum(CALC_OPS).optional(),
  }),
  component: ({ props }) => (
    <li className="g-calc__step">
      <span className="g-calc__op" aria-hidden={!props.op}>
        {props.op && CALC_OPS.includes(props.op) ? props.op.replace('-', '−') : ''}
      </span>
      <span className="g-calc__label">{props.label}</span>
      <span className="g-calc__value">{props.value}</span>
    </li>
  ),
});

export const Calculation = defineComponent({
  name: 'Calculation',
  description:
    'How a figure is worked out, step by step like a receipt (2-6 steps), ending in the result: total cost, tax owed, loan payment, dosage, savings, ROI, a score. Use only numbers from the source (or simple arithmetic on them); the result label and value close the sum. Optional note for assumptions (max 15 words).',
  props: z.object({
    steps: z.array(CalcStep.ref),
    resultLabel: z.string(),
    result: z.string(),
    heading: z.string().optional(),
    note: z.string().optional(),
  }),
  component: ({ props, renderNode }) => (
    <section className="g-calc">
      {props.heading && <h2 className="g-heading">{props.heading}</h2>}
      <div className="g-calc__sheet">
        <ul>{renderNode(props.steps)}</ul>
        <div className="g-calc__result">
          <span className="g-calc__op" aria-hidden="true">
            =
          </span>
          <span className="g-calc__label">{props.resultLabel}</span>
          <strong className="g-calc__value">{props.result}</strong>
        </div>
      </div>
      {props.note && <p className="g-calc__note">{props.note}</p>}
    </section>
  ),
});

export const CodeNote = defineComponent({
  name: 'CodeNote',
  description:
    'A note on part of the code: lines as a number or range (e.g. "3" or "4-6", counting from 1) and what they do (max 18 words).',
  props: z.object({
    lines: z.string(),
    text: z.string(),
  }),
  // Rendered by CodeWalkthrough, which links notes to lines.
  component: () => null,
});

/** "4-6" / "4–6" / "4" → [4, 6]; null when not a line reference. */
export function lineRange(spec: unknown): [number, number] | null {
  const m = String(spec ?? '').match(/(\d+)\s*(?:[-–—]|to|\.\.)?\s*(\d+)?/);
  if (!m) return null;
  const a = Number(m[1]);
  const b = m[2] ? Number(m[2]) : a;
  return [Math.min(a, b), Math.max(a, b)];
}

export const CodeWalkthrough = defineComponent({
  name: 'CodeWalkthrough',
  description:
    'A short code sample from the source (max 25 lines) explained part by part with 2-6 numbered notes, for tutorials, documentation and code reviews. Hovering or tapping a note highlights its lines. Copy the code exactly; use CodeBlock instead when no explanation is needed.',
  props: z.object({
    code: z.string(),
    notes: z.array(CodeNote.ref),
    language: z.string().optional(),
    heading: z.string().optional(),
  }),
  component: ({ props }) => {
    const [active, setActive] = useState<number | null>(null);
    const lines = String(props.code ?? '')
      .replace(/\n+$/, '')
      .split('\n');
    const notes = childProps<{ lines?: string; text?: string }>(props.notes).map((n) => ({
      ...n,
      range: lineRange(n.lines),
    }));
    // Which note (1-based badge) each line belongs to: the first note that covers it.
    const noteOf = (line: number) => notes.findIndex((n) => n.range && line >= n.range[0] && line <= n.range[1]);
    return (
      <section className="g-walk">
        {props.heading && <h2 className="g-heading">{props.heading}</h2>}
        <div className="g-walk__body">
          <pre className="g-walk__code" data-language={props.language || undefined}>
            <code>
              {lines.map((l, i) => {
                const n = noteOf(i + 1);
                const cls = [n >= 0 ? 'is-noted' : '', n >= 0 && n === active ? 'is-active' : '']
                  .filter(Boolean)
                  .join(' ');
                return (
                  <span key={i} className={`g-walk__line ${cls}`}>
                    <span className="g-walk__num" aria-hidden="true">
                      {i + 1}
                    </span>
                    {l || ' '}
                    {'\n'}
                  </span>
                );
              })}
            </code>
          </pre>
          <ol className="g-walk__notes">
            {notes.map((n, i) => (
              <li
                key={i}
                className={active === i ? 'is-active' : undefined}
                tabIndex={0}
                onMouseEnter={() => setActive(i)}
                onMouseLeave={() => setActive(null)}
                onFocus={() => setActive(i)}
                onBlur={() => setActive(null)}
              >
                <span className="g-walk__badge">{n.lines}</span>
                <span>{n.text}</span>
              </li>
            ))}
          </ol>
        </div>
      </section>
    );
  },
});
