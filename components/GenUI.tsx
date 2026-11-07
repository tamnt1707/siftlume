import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Renderer, type LibraryActionEvent, type OpenUIError } from '@openuidev/react-lang';
import { library } from '@/lib/library';

export type GenUIAction = LibraryActionEvent<typeof library>;
export type ToolProvider = Record<string, (args: Record<string, unknown>) => Promise<unknown>>;

interface Props {
  /** OpenUI Lang program or a stored message (buildMessage). */
  response: string | null;
  isStreaming?: boolean;
  onAction: (event: GenUIAction) => void;
  toolProvider?: ToolProvider | null;
  initialState?: Record<string, unknown>;
  onStateUpdate?: (state: Record<string, unknown>) => void;
}

/** Renderer bound to the app library; shows runtime/tool errors once streaming is done. */
export function GenUI({ response, isStreaming, onAction, toolProvider, initialState, onStateUpdate }: Props) {
  const { t } = useTranslation('session');
  const [errors, setErrors] = useState<OpenUIError[]>([]);
  // Skip warnings (still renders) and parser errors (already handled by the repair loop).
  const visible = isStreaming ? [] : errors.filter((e) => e.severity !== 'warning' && e.source !== 'parser');

  return (
    <div className="genui">
      <Renderer
        library={library}
        response={response}
        isStreaming={isStreaming}
        onAction={onAction}
        toolProvider={toolProvider ?? null}
        initialState={initialState}
        onStateUpdate={onStateUpdate}
        onError={setErrors}
      />
      {visible.length > 0 && (
        <details className="genui__errors">
          <summary>{t('genui.errors', { count: visible.length })}</summary>
          <ul>
            {visible.map((e, i) => (
              <li key={i}>
                <code>{e.code}</code> {e.statementId && <b>{e.statementId}: </b>}
                {e.message}
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}
