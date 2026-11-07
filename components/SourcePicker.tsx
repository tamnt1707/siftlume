import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { FileUploadIcon, SparklesIcon } from '@hugeicons/core-free-icons';
import { Icon } from './Icon';
import type { SessionController } from './useSession';

const ACCEPT = '.pdf,.csv,.tsv,.md,.markdown,.mdx,.txt,.json,.html,.htm,.log,.xml,.yaml,.yml';

export interface PageTarget {
  id: number;
  title?: string;
  /** False for pages the browser does not let extensions read (chrome://, the Web Store…). */
  readable: boolean;
}

/**
 * Start screen. In a tab's side panel it also offers "Summarize this page" for that tab;
 * on the full page, web pages are summarized from the popup or the context menu.
 */
export function SourcePicker({ ctrl, page }: { ctrl: SessionController; page?: PageTarget }) {
  const { t } = useTranslation('picker');
  const [text, setText] = useState('');
  const [dragging, setDragging] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const busy = ctrl.phase !== 'idle';

  const onFiles = (files: FileList | null) => {
    const file = files?.[0];
    if (file) void ctrl.fromFile(file);
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
      {page ? (
        <>
          <button
            className="btn btn--primary btn--hero"
            disabled={busy || !page.readable}
            onClick={() => void ctrl.fromTab(page.id)}
          >
            <span className="btn__label">
              <Icon icon={SparklesIcon} />
              {ctrl.phase === 'extracting' ? t('reading') : t('summarizePage')}
            </span>
            {page.title && <span className="btn__sub">{page.readable ? page.title : t('cannotRead')}</span>}
          </button>
          <div className="divider">
            <span>{t('or')}</span>
          </div>
        </>
      ) : (
        <h1 className="picker__title">{t('title')}</h1>
      )}

      <div className="paste">
        <textarea
          className="textarea"
          rows={text ? 12 : 5}
          placeholder={t('pastePlaceholder')}
          value={text}
          disabled={busy}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && (e.metaKey || e.ctrlKey) && text.trim()) ctrl.fromText(text);
          }}
        />
        {text.trim() && (
          <button className="btn btn--primary btn--block" disabled={busy} onClick={() => ctrl.fromText(text)}>
            {t('summarizeText')} <kbd>⌘/Ctrl ↵</kbd>
          </button>
        )}
      </div>

      <button className="dropzone" disabled={busy} onClick={() => fileInput.current?.click()}>
        <Icon icon={FileUploadIcon} size={22} />
        <strong>{t('dropTitle')}</strong>
        <span className="muted">{t('dropFormats')}</span>
      </button>
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
      {!page && <p className="hint">{t('pageHint')}</p>}
    </section>
  );
}
