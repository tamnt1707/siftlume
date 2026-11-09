/** Mermaid diagrams, laid out for the width they get and rendered to SVG with Pele. */
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { defineComponent, useIsStreaming } from '@openuidev/react-lang';
import { z } from 'zod/v4';
import { renderDiagram } from '../diagram';

type DiagramState = { status: 'idle' | 'ready' | 'error'; svg?: string; error?: string };

export const Diagram = defineComponent({
  name: 'Diagram',
  description:
    'A diagram written in Mermaid syntax, rendered as SVG. Use it when relationships are easier to see than to read: processes and workflows (flowchart), decision logic (flowchart with {decisions}), interactions between actors over time (sequenceDiagram), lifecycles and states (stateDiagram-v2), concept maps (mindmap), data models (erDiagram). Caption states the takeaway in max 8 words.',
  props: z.object({
    mermaid: z.string(),
    caption: z.string().optional(),
  }),
  component: ({ props }) => {
    const streaming = useIsStreaming();
    const { t } = useTranslation('session');
    const [state, setState] = useState<DiagramState>({ status: 'idle' });
    const boxRef = useRef<HTMLElement>(null);
    const [width, setWidth] = useState(0);

    // Lay the diagram out for the space it actually has (side panel vs full page).
    useEffect(() => {
      const el = boxRef.current;
      if (!el) return;
      const ro = new ResizeObserver(([entry]) => {
        // Round to 40px steps so small resizes do not re-layout the diagram.
        const w = Math.floor((entry?.contentRect.width ?? 0) / 40) * 40;
        if (w > 0) setWidth(w);
      });
      ro.observe(el);
      return () => ro.disconnect();
    }, []);

    useEffect(() => {
      // Partial Mermaid is almost always invalid: wait for the stream to finish.
      if (streaming || !props.mermaid?.trim() || !width) return;
      let cancelled = false;
      // Wide left-to-right flows flip to top-down when they do not fit below the breakpoint.
      renderDiagram(props.mermaid, { maxWidth: width, directionBreakpoint: 760 }).then(
        ({ svg }) => !cancelled && setState({ status: 'ready', svg }),
        (e: unknown) => !cancelled && setState({ status: 'error', error: e instanceof Error ? e.message : String(e) }),
      );
      return () => {
        cancelled = true;
      };
    }, [props.mermaid, streaming, width]);

    return (
      <figure className="g-diagram" ref={boxRef}>
        {props.caption && <figcaption className="g-diagram__caption">{props.caption}</figcaption>}
        {state.status === 'ready' ? (
          // Pele output, rendered with links and images disabled.
          <div className="g-diagram__svg" dangerouslySetInnerHTML={{ __html: state.svg! }} />
        ) : state.status === 'error' ? (
          <details className="g-diagram__error">
            <summary>{t('genui.diagramFailed')}</summary>
            {/* Shown as text: the message can contain diagram source. */}
            <pre>{state.error}</pre>
          </details>
        ) : (
          <div className="g-diagram__pending" aria-busy="true">
            {t('genui.drawing')}
          </div>
        )}
      </figure>
    );
  },
});
