import { useEffect, useState } from 'react';
import * as Popover from '@radix-ui/react-popover';
import { useTranslation } from 'react-i18next';
import {
  ArrowDown01Icon,
  Copy01Icon,
  Download04Icon,
  FileViewIcon,
  PrinterIcon,
  StopIcon,
  VolumeHighIcon,
} from '@hugeicons/core-free-icons';
import type { Session } from '@/lib/history';
import { OUTPUT_LANGUAGES, speechTagFor } from '@/lib/languages';
import { markdownToSpeech, programToMarkdown } from '@/lib/markdown';
import { summaryHtml } from '@/lib/export-html';
import i18n from '@/lib/i18n';
import type { Settings, SummaryLength } from '@/lib/settings';
import { Icon } from './Icon';
import { Select } from './Select';
import { resolveMode } from '@/lib/modes';
import { modeOptions } from './ModePicker';
import type { SessionController } from './useSession';
import { usePortalContainer } from './portal';

const LENGTHS: SummaryLength[] = ['short', 'medium', 'detailed', 'full'];
/** Average adult reading speed, words per minute. */
const WPM = 230;

/** Reading time of the original, in minutes (0 when too short to matter). */
export function readingMinutes(text: string) {
  const words = text.trim() ? text.trim().split(/\s+/).length : 0;
  return { words, minutes: Math.round(words / WPM) };
}

const fileName = (title: string, ext: 'md' | 'html') =>
  `${
    title
      .normalize('NFKD')
      .replace(/[^\w\s-]/g, '')
      .trim()
      .replace(/\s+/g, '-')
      .toLowerCase()
      .slice(0, 60) || 'summary'
  }.${ext}`;

/**
 * Result screen tools: re-summarize at another length or in another language (this session only),
 * copy or download as Markdown, read aloud, print or save as PDF, and show the extracted source.
 */
export function ResultToolbar({
  ctrl,
  session,
  settings,
  program,
  note,
  notify,
  sourceOpen,
  onToggleSource,
  onPrint,
}: {
  ctrl: SessionController;
  session: Session;
  settings: Settings;
  program: string;
  /** Text the model wrote outside the program (lib/history.ts StoredContext.note): exported too. */
  note?: string;
  notify: (msg: string) => void;
  sourceOpen: boolean;
  onToggleSource: () => void;
  /** Replaces window.print() where it does nothing (Chrome ignores it in the side panel). */
  onPrint?: () => void;
}) {
  const { t } = useTranslation(['session', 'settings', 'common']);
  const [speaking, setSpeaking] = useState(false);
  const busy = ctrl.phase !== 'idle';
  // A custom mode deleted since shows as the summary it falls back to.
  const chosen = session.options?.mode ?? settings.mode;
  const mode = resolveMode(chosen, settings.customModes).custom ? chosen : resolveMode(chosen).base;
  const length = session.options?.length ?? settings.length;
  const language = session.options?.language ?? settings.language;

  // Stop reading when the summary changes or the view goes away.
  useEffect(() => {
    return () => speechSynthesis.cancel();
  }, [session.id]);

  const markdown = () => [programToMarkdown(program, session.source), note?.trim()].filter(Boolean).join('\n\n');

  const copy = async () => {
    await navigator.clipboard.writeText(markdown());
    notify(t('toolbar.copied'));
  };

  const [saveOpen, setSaveOpen] = useState(false);
  const container = usePortalContainer();

  const save = (blob: Blob, name: string) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = name;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const download = (format: 'md' | 'html') => {
    setSaveOpen(false);
    const name = fileName(session.source.title, format);
    if (format === 'md') return save(new Blob([markdown()], { type: 'text/markdown;charset=utf-8' }), name);
    // HTML: the summary as it looks now, with the page's styles.
    const el = document.querySelector<HTMLElement>('.session .summary');
    if (!el) return;
    const html = summaryHtml(el, {
      title: session.source.title,
      origin: session.source.origin,
      sourceLabel: t('export.source'),
      lang: i18n.language,
      generator: t('toolbar.madeWith'),
    });
    save(new Blob([html], { type: 'text/html;charset=utf-8' }), name);
  };

  const listen = () => {
    if (speaking) {
      speechSynthesis.cancel();
      setSpeaking(false);
      return;
    }
    const utterance = new SpeechSynthesisUtterance(markdownToSpeech(markdown()));
    const tag = speechTagFor(language);
    if (tag) utterance.lang = tag;
    utterance.onend = utterance.onerror = () => setSpeaking(false);
    speechSynthesis.cancel();
    speechSynthesis.speak(utterance);
    setSpeaking(true);
  };

  return (
    <div className="result-toolbar" role="toolbar" aria-label={t('toolbar.label')}>
      <div className="result-toolbar__mode">
        <Select
          value={mode}
          disabled={busy}
          aria-label={t('common:modeLabel')}
          onChange={(value) => value !== mode && ctrl.resummarize({ mode: value as typeof mode })}
          options={modeOptions(settings.customModes)}
        />
      </div>
      <div className="segmented segmented--sm" role="group" aria-label={t('settings:summary.length')}>
        {LENGTHS.map((l) => (
          <button
            key={l}
            className={length === l ? 'active' : ''}
            disabled={busy}
            title={t(`settings:summary.lengthHints.${l}`)}
            onClick={() => l !== length && ctrl.resummarize({ length: l })}
          >
            {t(`settings:summary.lengths.${l}`)}
          </button>
        ))}
      </div>

      <div className="result-toolbar__lang">
        <Select
          value={language}
          disabled={busy}
          aria-label={t('settings:summary.outputLanguage')}
          onChange={(value) => value !== language && ctrl.resummarize({ language: value })}
          options={[
            { value: 'auto', label: t('settings:summary.sameAsSource') },
            ...OUTPUT_LANGUAGES.map((l) => ({ value: l.name, label: l.label })),
          ]}
        />
      </div>

      <div className="result-toolbar__actions">
        <button className="tool-btn" disabled={!program} onClick={() => void copy()} title={t('toolbar.copy')}>
          <Icon icon={Copy01Icon} size={16} />
          <span>{t('toolbar.copyShort')}</span>
        </button>
        <Popover.Root open={saveOpen} onOpenChange={setSaveOpen}>
          <Popover.Trigger className="tool-btn" disabled={!program} title={t('toolbar.download')}>
            <Icon icon={Download04Icon} size={16} />
            <span>{t('toolbar.downloadShort')}</span>
            <Icon icon={ArrowDown01Icon} size={12} />
          </Popover.Trigger>
          <Popover.Portal container={container}>
            <Popover.Content className="ui-menu" align="end" sideOffset={6} collisionPadding={8}>
              <div className="ui-menu__viewport" role="menu">
                {(['html', 'md'] as const).map((format) => (
                  <button
                    key={format}
                    type="button"
                    role="menuitem"
                    className="ui-menu__item"
                    onClick={() => download(format)}
                  >
                    <span className="ui-menu__label">{t(`toolbar.formats.${format}.title`)}</span>
                    <span className="ui-menu__hint">{t(`toolbar.formats.${format}.desc`)}</span>
                  </button>
                ))}
              </div>
            </Popover.Content>
          </Popover.Portal>
        </Popover.Root>
        <button
          className={`tool-btn ${speaking ? 'tool-btn--on' : ''}`}
          disabled={!program}
          onClick={listen}
          title={speaking ? t('toolbar.stopListening') : t('toolbar.listen')}
          aria-pressed={speaking}
        >
          <Icon icon={speaking ? StopIcon : VolumeHighIcon} size={16} />
          <span>{speaking ? t('toolbar.stopShort') : t('toolbar.listenShort')}</span>
        </button>
        <button
          className="tool-btn"
          disabled={!program}
          onClick={onPrint ?? (() => window.print())}
          title={t('toolbar.print')}
        >
          <Icon icon={PrinterIcon} size={16} />
        </button>
        <button
          className={`tool-btn ${sourceOpen ? 'tool-btn--on' : ''}`}
          onClick={onToggleSource}
          aria-pressed={sourceOpen}
          title={t('toolbar.source')}
        >
          <Icon icon={FileViewIcon} size={16} />
        </button>
      </div>
    </div>
  );
}
