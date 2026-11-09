import { useId } from 'react';
import { useTranslation } from 'react-i18next';
import { Idea01Icon, JusticeScale01Icon, TaskDone01Icon, TextAlignLeftIcon } from '@hugeicons/core-free-icons';
import { ANALYSIS_MODES, type AnalysisMode } from '@/lib/modes';
import { settingsItem, type Settings, type SummaryLength } from '@/lib/settings';
import { Icon } from './Icon';

export const MODE_ICONS = {
  summary: TextAlignLeftIcon,
  explain: Idea01Icon,
  critique: JusticeScale01Icon,
  action: TaskDone01Icon,
} as const;

/** Saves the length right away (no Save button): the last length is kept for the next analysis. */
const saveLength = (settings: Settings, length: SummaryLength) => void settingsItem.setValue({ ...settings, length });

export const LENGTHS: SummaryLength[] = ['short', 'medium', 'detailed'];

/**
 * Everything to choose before the first analysis: what kind (mode) and how long. Picking both up
 * front avoids running once and then re-running at another length. The mode is for this run only
 * (the caller holds it and starts as a summary); the length is remembered. "compact" drops the
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
  mode: AnalysisMode;
  onModeChange: (mode: AnalysisMode) => void;
  disabled?: boolean;
  compact?: boolean;
}) {
  const { t } = useTranslation('settings');
  const labelId = useId();
  return (
    <div className={`analysis-choice ${compact ? 'analysis-choice--compact' : ''}`}>
      <ModePicker value={mode} onChange={onModeChange} disabled={disabled} descriptions={!compact} />
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
 * Choice of analysis: summary, explanation, critique or action items. Each shapes the result
 * differently (lib/modes.ts). "full" shows a one-line description under each option.
 */
export function ModePicker({
  value,
  onChange,
  disabled,
  descriptions = true,
}: {
  value: AnalysisMode;
  onChange: (mode: AnalysisMode) => void;
  disabled?: boolean;
  descriptions?: boolean;
}) {
  const { t } = useTranslation('common');
  return (
    <div
      className={`mode-picker ${descriptions ? '' : 'mode-picker--compact'}`}
      role="radiogroup"
      aria-label={t('modeLabel')}
    >
      {ANALYSIS_MODES.map((m) => (
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
    </div>
  );
}
