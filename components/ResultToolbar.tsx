import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
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
import type { Settings, SummaryLength } from '@/lib/settings';
import { Icon } from './Icon';
import { Select } from './Select';
import { resolveMode } from '@/lib/modes';
import { modeOptions } from './ModePicker';
import type { SessionController } from './useSession';

const LENGTHS: SummaryLength[] = ['short', 'medium', 'detailed'];
/** Average adult reading speed, words per minute. */
const WPM = 230;

/** Reading time of the original, in minutes (0 when too short to matter). */
export function readingMinutes(text: string) {
  const words = text.trim() ? text.trim().split(/\s+/).length : 0;
  return { words, minutes: Math.round(words / WPM) };
}

const fileName = (title: string) =>
  `${
    title
      .normalize('NFKD')
      .replace(/[^\w\s-]/g, '')
      .trim()
      .replace(/\s+/g, '-')
      .toLowerCase()
      .slice(0, 60) || 'summary'
  }.md`;

/**
 * Result screen tools: re-summarize at another length or in another language (this session only),
 * copy or download as Markdown, read aloud, print or save as PDF, and show the extracted source.
 */
export function ResultToolbar({
  ctrl,
  session,
  settings,
  program,
  notify,
  sourceOpen,
  onToggleSource,
  onPrint,
}: {
  ctrl: SessionController;
  session: Session;
  settings: Settings;
  program: string;
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

  const markdown = () => programToMarkdown(program, session.source);

  const copy = async () => {
    await navigator.clipboard.writeText(markdown());
    notify(t('toolbar.copied'));
  };

  const download = () => {
    const url = URL.createObjectURL(new Blob([markdown()], { type: 'text/markdown;charset=utf-8' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName(session.source.title);
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
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
        <button className="tool-btn" disabled={!program} onClick={download} title={t('toolbar.download')}>
          <Icon icon={Download04Icon} size={16} />
          <span>.md</span>
        </button>
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
