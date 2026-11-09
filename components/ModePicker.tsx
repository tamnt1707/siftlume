import { useTranslation } from 'react-i18next';
import { Idea01Icon, JusticeScale01Icon, TaskDone01Icon, TextAlignLeftIcon } from '@hugeicons/core-free-icons';
import { ANALYSIS_MODES, type AnalysisMode } from '@/lib/modes';
import { settingsItem, type Settings } from '@/lib/settings';
import { Icon } from './Icon';

export const MODE_ICONS = {
  summary: TextAlignLeftIcon,
  explain: Idea01Icon,
  critique: JusticeScale01Icon,
  action: TaskDone01Icon,
} as const;

/** Saves the mode right away (no Save button): the last choice is the default for the next analysis. */
export const saveMode = (settings: Settings, mode: AnalysisMode) => void settingsItem.setValue({ ...settings, mode });

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
