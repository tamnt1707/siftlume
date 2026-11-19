import { useId } from 'react';
import { useTranslation } from 'react-i18next';
import {
  AiMagicIcon,
  Idea01Icon,
  JusticeScale01Icon,
  Route01Icon,
  TaskDone01Icon,
  TextAlignLeftIcon,
  UserEdit01Icon,
} from '@hugeicons/core-free-icons';
import { t } from '@/lib/i18n';
import {
  ANALYSIS_MODES,
  AUTO,
  customModeId,
  resolveMode,
  usableCustomModes,
  type CustomMode,
  type ModeId,
  type ModeSource,
} from '@/lib/modes';
import { settingsItem, type Settings, type SummaryLength } from '@/lib/settings';
import { Icon } from './Icon';

export const MODE_ICONS = {
  auto: AiMagicIcon,
  summary: TextAlignLeftIcon,
  explain: Idea01Icon,
  critique: JusticeScale01Icon,
  action: TaskDone01Icon,
  guide: Route01Icon,
} as const;

/** "auto" first (the default), then the built-in modes. */
const PICKER_MODES = [AUTO, ...ANALYSIS_MODES] as const;

/** Saves the length right away (no Save button): the last length is kept for the next analysis. */
const saveLength = (settings: Settings, length: SummaryLength) => void settingsItem.setValue({ ...settings, length });

export const LENGTHS: SummaryLength[] = ['short', 'medium', 'detailed', 'full'];

/**
 * Label of the start button: "Summarize this page", "Explain text"…, or the custom mode's name.
 * "auto" reads as a summary: what it picks depends on the source, read only once it starts.
 */
export function runLabel(
  kind: 'run' | 'runText' | 'runVideo' | 'runPr' | 'runDoc' | 'runSheet' | 'runSlides' | 'runDrive',
  mode: ModeId,
  custom: CustomMode[],
) {
  const resolved = resolveMode(mode, custom);
  return resolved.custom
    ? t('picker:runCustom', { name: resolved.custom.name.trim() })
    : t(`picker:${kind}.${resolved.base}`);
}

/**
 * Built-in and custom modes as Select options. With the source, "auto" names what it picked
 * ("Auto · Guide").
 */
export function modeOptions(custom: CustomMode[], source?: ModeSource) {
  const picked = source ? resolveMode(AUTO, custom, source).base : null;
  return [
    {
      value: AUTO as string,
      label: picked
        ? t('common:modes.auto.picked', { mode: t(`common:modes.${picked}.title`) })
        : (t('common:modes.auto.title') as string),
    },
    ...ANALYSIS_MODES.map((m) => ({ value: m as string, label: t(`common:modes.${m}.title`) as string })),
    ...usableCustomModes(custom).map((m) => ({ value: customModeId(m) as string, label: m.name.trim() })),
  ];
}

/**
 * Everything to choose before the first analysis: what kind (mode) and how long. Picking both up
 * front avoids running once and then re-running at another length. The mode is for this run only
 * (the caller holds it and starts on auto); the length is remembered. "compact" drops the
 * descriptions for narrow places (side panel, popup).
 */
export function AnalysisChoice({
  settings,
  mode,
  onModeChange,
  disabled,
  compact,
}: {
  settings: Settings;
  mode: ModeId;
  onModeChange: (mode: ModeId) => void;
  disabled?: boolean;
  compact?: boolean;
}) {
  const { t } = useTranslation('settings');
  const labelId = useId();
  return (
    <div className={`analysis-choice ${compact ? 'analysis-choice--compact' : ''}`}>
      <ModePicker
        value={mode}
        onChange={onModeChange}
        disabled={disabled}
        descriptions={!compact}
        custom={settings.customModes}
      />
      <div className="analysis-choice__length">
        <span className="analysis-choice__label" id={labelId}>
          {t('summary.length')}
        </span>
        <div className="segmented segmented--sm" role="radiogroup" aria-labelledby={labelId}>
          {LENGTHS.map((l) => (
            <button
              key={l}
              type="button"
              role="radio"
              aria-checked={settings.length === l}
              className={settings.length === l ? 'active' : ''}
              disabled={disabled}
              title={t(`summary.lengthHints.${l}`)}
              onClick={() => l !== settings.length && saveLength(settings, l)}
            >
              {t(`summary.lengths.${l}`)}
            </button>
          ))}
        </div>
        {!compact && <span className="analysis-choice__hint">{t(`summary.lengthHints.${settings.length}`)}</span>}
      </div>
    </div>
  );
}

/**
 * Choice of analysis: auto, summary, explanation, critique, action items or a guide. Each shapes the result
 * differently (lib/modes.ts). "full" shows a one-line description under each option.
 */
export function ModePicker({
  value,
  onChange,
  disabled,
  descriptions = true,
  custom,
}: {
  value: ModeId;
  onChange: (mode: ModeId) => void;
  disabled?: boolean;
  descriptions?: boolean;
  /** The user's own modes, shown after the built-in ones. */
  custom?: CustomMode[];
}) {
  const { t } = useTranslation('common');
  return (
    <div
      className={`mode-picker ${descriptions ? '' : 'mode-picker--compact'}`}
      role="radiogroup"
      aria-label={t('modeLabel')}
    >
      {PICKER_MODES.map((m) => (
        <button
          key={m}
          type="button"
          role="radio"
          aria-checked={value === m}
          className={`mode-option ${value === m ? 'is-on' : ''}`}
          disabled={disabled}
          title={t(`modes.${m}.desc`)}
          onClick={() => m !== value && onChange(m)}
        >
          <Icon icon={MODE_ICONS[m]} size={18} />
          <span className="mode-option__text">
            <strong>{t(`modes.${m}.title`)}</strong>
            {descriptions && <span>{t(`modes.${m}.desc`)}</span>}
          </span>
        </button>
      ))}
      {usableCustomModes(custom).map((c) => {
        const id = customModeId(c);
        return (
          <button
            key={id}
            type="button"
            role="radio"
            aria-checked={value === id}
            className={`mode-option mode-option--custom ${value === id ? 'is-on' : ''}`}
            disabled={disabled}
            title={c.instruction}
            onClick={() => id !== value && onChange(id)}
          >
            <Icon icon={UserEdit01Icon} size={18} />
            <span className="mode-option__text">
              <strong>{c.name}</strong>
              {descriptions && <span>{c.instruction}</span>}
            </span>
          </button>
        );
      })}
    </div>
  );
}
