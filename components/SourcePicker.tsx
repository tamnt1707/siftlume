import { useEffect, useRef, useState } from 'react';
import * as Tabs from '@radix-ui/react-tabs';
import { useTranslation } from 'react-i18next';
import { Edit02Icon, FileUploadIcon, Layers01Icon, SparklesIcon, WebDesign01Icon } from '@hugeicons/core-free-icons';
import { Icon } from './Icon';
import type { SessionController } from './useSession';
import type { Settings } from '@/lib/settings';
import type { ModeId } from '@/lib/modes';
import { AnalysisChoice, runLabel } from './ModePicker';
import { useVideoProbe } from './useVideoProbe';
import { TabsPicker } from './TabsPicker';

const ACCEPT = '.pdf,.csv,.tsv,.md,.markdown,.mdx,.txt,.json,.html,.htm,.log,.xml,.yaml,.yml';

type Source = 'page' | 'tabs' | 'text' | 'file';

const SOURCE_ICONS = {
  page: WebDesign01Icon,
  tabs: Layers01Icon,
  text: Edit02Icon,
  file: FileUploadIcon,
} as const;

export interface PageTarget {
  id: number;
  title?: string;
  url?: string;
  /** False for pages the browser does not let extensions read (chrome://, the Web Store…). */
  readable: boolean;
}

/**
 * Start screen: the analysis choice, then one tab per kind of source (this page, several tabs,
 * pasted text, a file), so only one set of controls shows at a time. In a tab's side panel it
 * opens on "This page"; on the full page, web pages are summarized from the popup or the context
 * menu, so it opens on pasted text.
 */
export function SourcePicker({
  ctrl,
  page,
  settings,
  startTabs,
}: {
  ctrl: SessionController;
  page?: PageTarget;
  settings: Settings;
  /** Opened from the popup's "Combine tabs": list the open tabs right away. */
  startTabs?: boolean;
}) {
  const { t } = useTranslation('picker');
  const [text, setText] = useState('');
  const [dragging, setDragging] = useState(false);
  // Every visit starts as a summary; another mode applies to the next run only.
  const [mode, setMode] = useState<ModeId>('summary');
  const fileInput = useRef<HTMLInputElement>(null);
  const busy = ctrl.phase !== 'idle';
  const video = useVideoProbe(page?.readable ? page.id : undefined, page?.url);
  // One source at a time. Until the user picks one, it is this page whenever there is one (the
  // side panel learns its tab a moment after the first render), otherwise pasted text.
  const sources: Source[] = page ? ['page', 'tabs', 'text', 'file'] : ['text', 'file', 'tabs'];
  const [chosen, setSource] = useState<Source | null>(startTabs ? 'tabs' : null);
  const source: Source = chosen && sources.includes(chosen) ? chosen : page ? 'page' : 'text';
  useEffect(() => {
    if (startTabs) setSource('tabs');
  }, [startTabs]);

  // A file dropped anywhere on the start screen is read, whatever source is selected.
  const onFiles = (files: FileList | null) => {
    const file = files?.[0];
    if (file) void ctrl.fromFile(file, mode);
  };

  return (
    <section
      className={`picker ${dragging ? 'picker--drag' : ''}`}
      onDragOver={(e) => {
        e.preventDefault();
        setDragging(true);
      }}
      onDragLeave={(e) => {
        if (e.currentTarget === e.target) setDragging(false);
      }}
      onDrop={(e) => {
        e.preventDefault();
        setDragging(false);
        onFiles(e.dataTransfer.files);
      }}
    >
      {!page && <h1 className="picker__title">{t('title')}</h1>}
      <AnalysisChoice settings={settings} mode={mode} onModeChange={setMode} disabled={busy} compact={Boolean(page)} />
      <Tabs.Root value={source} onValueChange={(v) => setSource(v as Source)} className="source-tabs">
        <Tabs.List className="source-tabs__list" aria-label={t('sources.label')}>
          {sources.map((id) => (
            <Tabs.Trigger key={id} value={id} className="source-tabs__tab">
              <Icon icon={SOURCE_ICONS[id]} size={16} />
              <span>{t(`sources.${id === 'page' && video.isVideo ? 'video' : id}`)}</span>
            </Tabs.Trigger>
          ))}
        </Tabs.List>

        {page && (
          <Tabs.Content value="page" className="source-tabs__panel">
            <button
              className="btn btn--primary btn--hero"
              disabled={busy || !page.readable || Boolean(video.blocked)}
              onClick={() => void ctrl.fromTab(page.id, mode)}
            >
              <span className="btn__label">
                <Icon icon={SparklesIcon} />
                {ctrl.phase === 'extracting'
                  ? t('reading')
                  : runLabel(video.isVideo ? 'runVideo' : 'run', mode, settings.customModes)}
              </span>
              {page.title && <span className="btn__sub">{page.readable ? page.title : t('cannotRead')}</span>}
              {(video.blocked || video.note) && <span className="btn__sub">{video.blocked ?? video.note}</span>}
            </button>
          </Tabs.Content>
        )}

        <Tabs.Content value="tabs" className="source-tabs__panel">
          <TabsPicker ctrl={ctrl} mode={mode} currentTabId={page?.id} startOpen={startTabs} />
        </Tabs.Content>

        <Tabs.Content value="text" className="source-tabs__panel">
          <div className="paste">
            <textarea
              className="textarea"
              rows={text ? 12 : 6}
              placeholder={t('pastePlaceholder')}
              value={text}
              disabled={busy}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && (e.metaKey || e.ctrlKey) && text.trim()) ctrl.fromText(text, { mode });
              }}
            />
            <button
              className="btn btn--primary btn--block"
              disabled={busy || !text.trim()}
              onClick={() => ctrl.fromText(text, { mode })}
            >
              {runLabel('runText', mode, settings.customModes)} <kbd>⌘/Ctrl ↵</kbd>
            </button>
          </div>
        </Tabs.Content>

        <Tabs.Content value="file" className="source-tabs__panel">
          <button className="dropzone" disabled={busy} onClick={() => fileInput.current?.click()}>
            <Icon icon={FileUploadIcon} size={22} />
            <strong>{t('dropTitle')}</strong>
            <span className="muted">{t('dropFormats')}</span>
          </button>
        </Tabs.Content>
      </Tabs.Root>
      <input
        ref={fileInput}
        type="file"
        accept={ACCEPT}
        hidden
        onChange={(e) => {
          onFiles(e.target.files);
          e.target.value = '';
        }}
      />

      {ctrl.phase === 'extracting' && <p className="muted center">{t('reading')}</p>}
      {!page && source !== 'tabs' && <p className="hint">{t('pageHint')}</p>}
    </section>
  );
}
