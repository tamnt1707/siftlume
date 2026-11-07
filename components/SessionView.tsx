import { useEffect, useMemo, useRef, useState } from 'react';
import { MarkDownRenderer } from '@openuidev/react-ui';
import { useTranslation } from 'react-i18next';
import { browser } from '#imports';
import { createCsvToolProvider } from '@/lib/csv-tools';
import { readStored, type QaTurn } from '@/lib/history';
import { splitInline } from '@/lib/openui';
import { highlightInTab } from '@/lib/page';
import { ArrowExpand01Icon, ArrowUp02Icon, MagicWand01Icon, RefreshIcon, StopIcon } from '@hugeicons/core-free-icons';
import { REFINE_PROMPTS, type RefineId } from '@/lib/refine';
import { GenUI, type GenUIAction } from './GenUI';
import { Icon } from './Icon';
import type { SessionController } from './useSession';

/** One-click refinements, applied with edit mode (the model only patches what changes). */
// Chip order; prompts live in lib/refine.ts (English, for the model), labels in locales.
const REFINE_PRESETS: RefineId[] = ['shorter', 'moreDetail', 'actionItems', 'timeline', 'simpler'];

/** Chrome's favicon cache for extension pages (requires the "favicon" permission). */
const faviconUrl = (pageUrl: string) =>
  `chrome-extension://${browser.runtime.id}/_favicon/?pageUrl=${encodeURIComponent(pageUrl)}&size=32`;

const hostOf = (url: string) => {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
};

export function SessionView({
  ctrl,
  notify,
  layout = 'page',
  onExpand,
}: {
  ctrl: SessionController;
  notify: (msg: string) => void;
  /** "page": full-page tab, two columns on wide screens. "panel": side panel, single column. */
  layout?: 'page' | 'panel';
  /** Shown in the side panel: reopen this session in a full-page tab. */
  onExpand?: () => void;
}) {
  const { t } = useTranslation(['session', 'common']);
  const session = ctrl.session!;
  const { source } = session;
  const [refineText, setRefineText] = useState('');
  const [question, setQuestion] = useState('');
  const bottomRef = useRef<HTMLDivElement>(null);

  const busy = ctrl.phase !== 'idle';
  const isWeb = Boolean(source.origin?.startsWith('http'));
  const summary = readStored(session.summary);
  // CSV data → toolProvider runs Query() calls in the browser.
  const toolProvider = useMemo(() => (source.csv ? createCsvToolProvider(source.csv) : null), [source.csv]);

  useEffect(() => {
    if (ctrl.phase === 'answering') bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [ctrl.phase, ctrl.streamRaw, session.qa.length]);

  const onAction = async (event: GenUIAction) => {
    switch (event.type) {
      case 'continue_conversation': {
        // FollowUpItem / @ToAssistant → ask as a follow-up question.
        const ctx = event.params?.context;
        const msg =
          ctx === undefined || ctx === null
            ? event.humanFriendlyMessage
            : `${event.humanFriendlyMessage}\n\nContext: ${JSON.stringify(ctx)}`;
        void ctrl.ask(msg);
        break;
      }
      case 'open_url':
        if (typeof event.params.url === 'string') void browser.tabs.create({ url: event.params.url });
        break;
      case 'HighlightInPage': {
        if (source.kind !== 'webpage' || !source.tabId) return notify(t('toast.highlightOnlyWeb'));
        try {
          // Bring the original tab to the front, then highlight.
          const tab = await browser.tabs.update(source.tabId, { active: true });
          if (tab?.windowId !== undefined) await browser.windows.update(tab.windowId, { focused: true });
          const found = await highlightInTab(source.tabId, event.params.text);
          notify(found ? t('toast.highlighted') : t('toast.quoteNotFound'));
        } catch {
          notify(t('toast.tabGone'));
        }
        break;
      }
      case 'CopyText':
        await navigator.clipboard.writeText(event.params.text);
        notify(t('toast.copied'));
        break;
    }
  };

  // First summary: render the streaming code. Refinement: keep the old program until the patch is merged.
  // While a new summary streams in, keep showing the previous one until the first statements arrive.
  const streamedCode = ctrl.phase === 'summarizing' ? splitInline(ctrl.streamRaw).code : '';
  const summaryResponse = streamedCode || summary.content;
  const summaryStreaming = ctrl.phase === 'summarizing';

  return (
    <div className={`session session--${layout}`}>
      <header className="source">
        <div className="source__meta">
          {isWeb ? (
            <img className="source__favicon" src={faviconUrl(source.origin!)} alt="" />
          ) : (
            <span className="badge">{t(`common:kind.${source.kind}`)}</span>
          )}
          {isWeb ? (
            <a className="source__title" href={source.origin} target="_blank" rel="noreferrer" title={source.origin}>
              {hostOf(source.origin!)}
            </a>
          ) : (
            <span className="source__title">{source.title}</span>
          )}
        </div>
        <div className="source__actions">
          {session.summary !== null && (
            <button className="tool-btn" onClick={ctrl.resummarize} disabled={busy} title={t('summarizeAgainTitle')}>
              <Icon icon={RefreshIcon} size={16} />
              <span>{t('summarizeAgain')}</span>
            </button>
          )}
          {onExpand && summary.content && (
            <button className="tool-btn" onClick={onExpand} title={t('fullPageTitle')}>
              <Icon icon={ArrowExpand01Icon} size={16} />
              <span>{t('fullPage')}</span>
            </button>
          )}
        </div>
        {source.truncated && <p className="hint">{t('truncated')}</p>}
      </header>

      <div className="session__main">
        <section className="summary">
          {(summaryResponse || summaryStreaming) && (
            <GenUI
              // Keyed by session so the Renderer resets its state when switching sessions.
              key={session.id}
              response={summaryResponse || null}
              isStreaming={summaryStreaming}
              onAction={onAction}
              toolProvider={toolProvider}
              initialState={summary.context.formState}
              onStateUpdate={ctrl.updateSummaryState}
            />
          )}
          {summaryStreaming && (
            <Thinking label={t('summarizing')} stopLabel={t('common:actions.stop')} onStop={ctrl.stop} />
          )}
          {ctrl.phase === 'refining' && (
            <Thinking label={t('updating')} stopLabel={t('common:actions.stop')} onStop={ctrl.stop} />
          )}
          {!busy && summary.context.note && <p className="note">{summary.context.note}</p>}
          {!busy && !summary.content && !summary.context.note && <p className="muted">{t('noSummary')}</p>}
        </section>

        {summary.content && (
          <section className="refine">
            <div className="chips">
              {REFINE_PRESETS.map((id) => (
                <button
                  key={id}
                  className="chip"
                  disabled={busy}
                  title={t(`refineHint.${id}`)}
                  onClick={() => void ctrl.refine(REFINE_PROMPTS[id])}
                >
                  {t(`refine.${id}`)}
                </button>
              ))}
            </div>
            <form
              className="inline-form"
              onSubmit={(e) => {
                e.preventDefault();
                void ctrl.refine(refineText);
                setRefineText('');
              }}
            >
              <input
                className="input"
                placeholder={t('refinePlaceholder')}
                value={refineText}
                onChange={(e) => setRefineText(e.target.value)}
                disabled={busy}
              />
              <button className="btn" disabled={busy || !refineText.trim()}>
                <Icon icon={MagicWand01Icon} size={16} />
                {t('apply')}
              </button>
            </form>
          </section>
        )}
      </div>

      <aside className="session__side">
        {layout === 'page' && session.qa.length === 0 && !ctrl.pendingQuestion && summary.content && (
          <div className="qa-empty">
            <strong>{t('questions')}</strong>
            <span>{t('questionsEmpty')}</span>
          </div>
        )}
        {(session.qa.length > 0 || ctrl.pendingQuestion) && (
          <section className="qa">
            <h3 className="section-title">{t('questions')}</h3>
            {session.qa.map((turn) => (
              <QaItem
                key={turn.id}
                turn={turn}
                onAction={onAction}
                toolProvider={toolProvider}
                onStateUpdate={(s) => ctrl.updateAnswerState(turn.id, s)}
              />
            ))}
            {ctrl.pendingQuestion && (
              <div className="qa__turn">
                <div className="bubble">{ctrl.pendingQuestion}</div>
                <Answer raw={ctrl.streamRaw} isStreaming onAction={onAction} toolProvider={toolProvider} />
                {!ctrl.streamRaw && <Thinking label={t('thinking')} />}
              </div>
            )}
          </section>
        )}
        <div ref={bottomRef} />

        {summary.content && (
          <form
            className="ask"
            onSubmit={(e) => {
              e.preventDefault();
              void ctrl.ask(question);
              setQuestion('');
            }}
          >
            <input
              className="input"
              placeholder={t('askPlaceholder')}
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              disabled={busy}
            />
            {busy ? (
              <button
                type="button"
                className="btn btn--icon"
                onClick={ctrl.stop}
                aria-label={t('common:actions.stop')}
                title={t('common:actions.stop')}
              >
                <Icon icon={StopIcon} />
              </button>
            ) : (
              <button
                className="btn btn--primary btn--icon"
                disabled={!question.trim()}
                aria-label={t('ask')}
                title={t('ask')}
              >
                <Icon icon={ArrowUp02Icon} />
              </button>
            )}
          </form>
        )}
      </aside>
    </div>
  );
}

function QaItem({
  turn,
  onAction,
  toolProvider,
  onStateUpdate,
}: {
  turn: QaTurn;
  onAction: (e: GenUIAction) => void;
  toolProvider: ReturnType<typeof createCsvToolProvider> | null;
  onStateUpdate: (s: Record<string, unknown>) => void;
}) {
  const { content, context } = readStored(turn.answer);
  return (
    <div className="qa__turn">
      <div className="bubble">{turn.question}</div>
      <Answer
        raw={content}
        onAction={onAction}
        toolProvider={toolProvider}
        initialState={context.formState}
        onStateUpdate={onStateUpdate}
      />
    </div>
  );
}

/** Inline-mode answer: prose outside fences → Markdown, fenced code → Renderer. */
function Answer({
  raw,
  isStreaming,
  onAction,
  toolProvider,
  initialState,
  onStateUpdate,
}: {
  raw: string;
  isStreaming?: boolean;
  onAction: (e: GenUIAction) => void;
  toolProvider: ReturnType<typeof createCsvToolProvider> | null;
  initialState?: Record<string, unknown>;
  onStateUpdate?: (s: Record<string, unknown>) => void;
}) {
  const { prose, code } = splitInline(raw);
  return (
    <div className="answer">
      {prose && <MarkDownRenderer textMarkdown={prose} variant="clear" />}
      {code && (
        <GenUI
          response={code}
          isStreaming={isStreaming}
          onAction={onAction}
          toolProvider={toolProvider}
          initialState={initialState}
          onStateUpdate={onStateUpdate}
        />
      )}
    </div>
  );
}

function Thinking({ label, stopLabel, onStop }: { label: string; stopLabel?: string; onStop?: () => void }) {
  return (
    <div className="thinking">
      <span className="dot" />
      <span className="dot" />
      <span className="dot" />
      <span>{label}</span>
      {onStop && (
        <button className="link" onClick={onStop}>
          {stopLabel}
        </button>
      )}
    </div>
  );
}
