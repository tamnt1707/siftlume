import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { MarkDownRenderer } from '@openuidev/react-ui';
import { useTranslation } from 'react-i18next';
import { browser } from '#imports';
import { createCsvToolProvider } from '@/lib/csv-tools';
import { readStored, type QaTurn } from '@/lib/history';
import { splitInline } from '@/lib/openui';
import { highlightInTab } from '@/lib/page';
import { findMoment, formatTime, seekVideo, youTubeVideoId } from '@/lib/youtube';
import { partContent, partForQuote } from '@/lib/multi';
import {
  ArrowExpand01Icon,
  ArrowUp02Icon,
  FileSearchIcon,
  MagicWand01Icon,
  RefreshIcon,
  StopIcon,
} from '@hugeicons/core-free-icons';
import { canDeepRead, DeepRead } from './DeepRead';
import { REFINE_PROMPTS, type RefineId } from '@/lib/refine';
import { GenUI, type GenUIAction } from './GenUI';
import { ResultToolbar, readingMinutes } from './ResultToolbar';
import { PROVIDERS, type Settings } from '@/lib/settings';
import { Icon } from './Icon';
import { SiftLoader } from './SiftLoader';
import type { SessionController } from './useSession';
import { HAS_FAVICON_CACHE } from '@/lib/platform';

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
  onPrint,
  settings,
  toolbarSlot,
}: {
  ctrl: SessionController;
  notify: (msg: string) => void;
  /** "page": full-page tab, two columns on wide screens. "panel": side panel, single column. */
  layout?: 'page' | 'panel';
  /** Shown in the side panel: reopen this session in a full-page tab. */
  onExpand?: () => void;
  /** Shown in the side panel: Chrome cannot print from there, so print from a full-page tab. */
  onPrint?: () => void;
  /** Global settings; the result toolbar shows this session's overrides on top of them. */
  settings: Settings;
  /** Full page: the top bar's slot, where the result toolbar stays in view while reading. */
  toolbarSlot?: HTMLElement | null;
}) {
  const { t } = useTranslation(['session', 'common']);
  const session = ctrl.session!;
  const { source } = session;
  const [refineText, setRefineText] = useState('');
  const [question, setQuestion] = useState('');
  const [sourceOpen, setSourceOpen] = useState(false);
  const [deepOpen, setDeepOpen] = useState(false);
  const deepable = useMemo(() => canDeepRead(session), [session]);
  const reading = useMemo(() => readingMinutes(source.content), [source.content]);
  const bottomRef = useRef<HTMLDivElement>(null);

  const busy = ctrl.phase !== 'idle';
  const isWeb = Boolean(source.origin?.startsWith('http'));
  const summary = readStored(session.summary);
  // CSV data → toolProvider runs Query() calls in the browser.
  const toolProvider = useMemo(() => (source.csv ? createCsvToolProvider(source.csv) : null), [source.csv]);

  useEffect(() => {
    if (ctrl.phase === 'answering') bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [ctrl.phase, ctrl.streamRaw, session.qa.length]);

  /**
   * Shows a quote where it came from: highlighted in the web page, or the video played from that
   * moment. For several tabs, in the tab whose text contains it.
   */
  const showQuote = async (text: string) => {
    let target: { kind: string; tabId?: number; origin?: string; content: string } = source;
    if (source.kind === 'multi' && source.parts) {
      const i = partForQuote(source.content, text);
      const part = i === null ? undefined : source.parts[i];
      if (!part) return notify(t('toast.quoteNotFound'));
      target = { ...part, content: partContent(source.content, i!) };
    }
    const { tabId, origin } = target;
    // A linked page read without a tab (Deep read): open it, then highlight once it has loaded.
    if (!tabId && origin?.startsWith('http')) {
      const tab = await browser.tabs.create({ url: origin });
      if (target.kind !== 'webpage' || tab.id === undefined) return;
      const id = tab.id;
      const onUpdated = (changed: number, change: { status?: string }) => {
        if (changed !== id || change.status !== 'complete') return;
        browser.tabs.onUpdated.removeListener(onUpdated);
        void highlightInTab(id, text)
          .then((found) => notify(found ? t('toast.highlighted') : t('toast.quoteNotFound')))
          .catch(() => {});
      };
      browser.tabs.onUpdated.addListener(onUpdated);
      return;
    }

    if (target.kind === 'video' && tabId && origin) {
      // Videos: play from the moment the quote is said.
      const at = findMoment(target.content, text);
      if (at === null) return notify(t('toast.momentNotFound'));
      const played = t('toast.playingFrom', { time: formatTime(at) });
      // The tab moved on to another video (or was closed): open this one at that moment.
      const openAt = () => {
        const url = new URL(origin);
        url.searchParams.set('t', `${Math.floor(at)}s`);
        return url.href;
      };
      try {
        const current = await browser.tabs.get(tabId);
        if (youTubeVideoId(current.url) !== youTubeVideoId(origin)) {
          await browser.tabs.update(tabId, { url: openAt(), active: true });
          return notify(played);
        }
        const tab = await browser.tabs.update(tabId, { active: true });
        if (tab?.windowId !== undefined) await browser.windows.update(tab.windowId, { focused: true });
        return notify((await seekVideo(tabId, at)) ? played : t('toast.tabGone'));
      } catch {
        await browser.tabs.create({ url: openAt() });
        return notify(played);
      }
    }

    if (target.kind !== 'webpage' || !tabId) return notify(t('toast.highlightOnlyWeb'));
    try {
      // Bring the original tab to the front, then highlight.
      const tab = await browser.tabs.update(tabId, { active: true });
      if (tab?.windowId !== undefined) await browser.windows.update(tab.windowId, { focused: true });
      const found = await highlightInTab(tabId, text);
      notify(found ? t('toast.highlighted') : t('toast.quoteNotFound'));
    } catch {
      notify(t('toast.tabGone'));
    }
  };

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
      case 'HighlightInPage':
        await showQuote(event.params.text);
        break;
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
  // In-browser models run on this device: say up front that it takes a while.
  const local = PROVIDERS[settings.provider]?.builtin;

  /**
   * One loading state for every (re)analysis:
   * - nothing on screen yet → a full loader block;
   * - a summary is being redone (other length, language or model, refresh, refine, new page) →
   *   the old one stays dimmed under the loader until the new output arrives;
   * - output streaming in → a slim strip above it.
   */
  const reworking = ctrl.phase === 'refining' || ctrl.phase === 'extracting' || (summaryStreaming && !streamedCode);
  const loader =
    !busy || ctrl.phase === 'answering' ? null : streamedCode ? (
      <SiftLoader stage="drawing" title={t('common:loader.drawing')} variant="strip" onStop={ctrl.stop} />
    ) : (
      <SiftLoader
        stage={ctrl.phase === 'extracting' ? 'reading' : 'sifting'}
        title={t(
          ctrl.phase === 'extracting'
            ? 'common:loader.reading'
            : ctrl.phase === 'refining'
              ? 'common:loader.updating'
              : summary.content
                ? 'common:loader.reanalyzing'
                : 'common:loader.sifting',
        )}
        variant={summary.content ? 'overlay' : 'block'}
        onStop={ctrl.stop}
        note={local ? t('common:loader.localSlow') : undefined}
      />
    );
  const dimmed = reworking && Boolean(summary.content);
  const toolbar = summary.content ? (
    <ResultToolbar
      ctrl={ctrl}
      session={session}
      settings={settings}
      program={summary.content}
      notify={notify}
      sourceOpen={sourceOpen}
      onToggleSource={() => setSourceOpen((v) => !v)}
      onPrint={onPrint}
    />
  ) : null;

  return (
    <div className={`session session--${layout}`}>
      <header className="source">
        <div className="source__meta">
          {isWeb ? (
            HAS_FAVICON_CACHE && <img className="source__favicon" src={faviconUrl(source.origin!)} alt="" />
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
          {reading.minutes >= 2 && summary.content && (
            <span className="time-saved" title={t('toolbar.sourceWords', { count: reading.words })}>
              {t('toolbar.timeSaved', { count: reading.minutes })}
            </span>
          )}
        </div>
        <div className="source__actions">
          {deepable && summary.content && (
            <button
              className={`tool-btn ${deepOpen ? 'tool-btn--on' : ''}`}
              onClick={() => setDeepOpen((v) => !v)}
              disabled={busy}
              aria-expanded={deepOpen}
              title={t('deep.buttonTitle')}
            >
              <Icon icon={FileSearchIcon} size={16} />
              <span>{t('deep.button')}</span>
            </button>
          )}
          {session.summary !== null && (
            <button
              className="tool-btn"
              onClick={() => ctrl.resummarize()}
              disabled={busy}
              title={t('summarizeAgainTitle')}
            >
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
        {deepOpen && <DeepRead ctrl={ctrl} session={session} settings={settings} onClose={() => setDeepOpen(false)} />}
        {source.parts && (
          <ol className="source__parts">
            {source.parts.map((part, i) => (
              <li key={i}>
                <a href={part.origin} target="_blank" rel="noreferrer" title={part.title}>
                  <span className="source__part-index">{i + 1}</span>
                  {HAS_FAVICON_CACHE && <img className="source__favicon" src={faviconUrl(part.origin)} alt="" />}
                  <span className="source__part-title">{part.title}</span>
                </a>
              </li>
            ))}
          </ol>
        )}
        {source.skipped?.length ? (
          <p className="hint">{t('tabsSkipped', { titles: source.skipped.join(', ') })}</p>
        ) : null}
        {source.truncated && <p className="hint">{t('truncated')}</p>}
      </header>

      <div className="session__main">
        {toolbar && (toolbarSlot ? createPortal(toolbar, toolbarSlot) : toolbar)}
        {sourceOpen && (
          <section className="source-text">
            <header>
              <strong>{t('toolbar.sourceTitle')}</strong>
              <span className="muted">{t('toolbar.sourceWords', { count: reading.words })}</span>
            </header>
            <div className="source-text__body">
              {['pdf', 'text', 'video', 'multi'].includes(source.kind) ? (
                <pre>{source.content}</pre>
              ) : (
                <MarkDownRenderer textMarkdown={source.content} variant="clear" />
              )}
            </div>
          </section>
        )}
        <section className={`summary ${dimmed ? 'is-reworking' : ''}`} aria-busy={Boolean(loader)}>
          {loader}
          {summaryResponse && (
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
