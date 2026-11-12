import { useEffect, useMemo, useState } from 'react';
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
/**
 * OpenUI's FollowUpBlock and Sources write their headings in English with no prop to change them.
 * Relabel them in the interface language whenever they appear; React leaves static text alone
 * afterwards, and the HTML export copies the relabelled DOM.
 */
function useLibraryLabels(root: HTMLElement | null, labels: Record<string, string>) {
  useEffect(() => {
    if (!root) return;
    const apply = () => {
      for (const [selector, text] of Object.entries(labels)) {
        for (const el of root.querySelectorAll(selector)) if (el.textContent !== text) el.textContent = text;
      }
    };
    apply();
    const observer = new MutationObserver(apply);
    observer.observe(root, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, [root, labels]);
}

export function GenUI({ response, isStreaming, onAction, toolProvider, initialState, onStateUpdate }: Props) {
  const { t } = useTranslation('session');
  const [errors, setErrors] = useState<OpenUIError[]>([]);
  // Skip warnings (still renders) and parser errors (already handled by the repair loop).
  const visible = isStreaming ? [] : errors.filter((e) => e.severity !== 'warning' && e.source !== 'parser');
  const [root, setRoot] = useState<HTMLDivElement | null>(null);
  const related = t('genui.relatedQueries');
  const sources = t('genui.sources');
  const labels = useMemo(
    () => ({ '.openui-follow-up-block__header': related, '.openui-listed-sources-header__title': sources }),
    [related, sources],
  );
  useLibraryLabels(root, labels);

  return (
    <div className="genui" ref={setRoot}>
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
