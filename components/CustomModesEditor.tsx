import { useTranslation } from 'react-i18next';
import { Add01Icon, Delete02Icon } from '@hugeicons/core-free-icons';
import { ANALYSIS_MODES, MAX_CUSTOM_MODES, type CustomMode } from '@/lib/modes';
import { Icon } from './Icon';
import { Select } from './Select';

/**
 * Settings → Summary: the user's own reading modes. Each has a name, what the reader wants, and a
 * built-in mode it starts from (its layout and examples). Saved with the other settings.
 */
export function CustomModesEditor({
  modes,
  onChange,
}: {
  modes: CustomMode[];
  onChange: (modes: CustomMode[]) => void;
}) {
  const { t } = useTranslation(['settings', 'common']);
  const patch = (id: string, change: Partial<CustomMode>) =>
    onChange(modes.map((m) => (m.id === id ? { ...m, ...change } : m)));

  return (
    <div className="field">
      <label id="custom-modes">{t('customModes.title')}</label>
      <p className="hint">{t('customModes.hint')}</p>
      <div className="custom-modes" role="group" aria-labelledby="custom-modes">
        {modes.map((m) => (
          <div key={m.id} className="custom-mode">
            <div className="custom-mode__row">
              <input
                className="input"
                aria-label={t('customModes.name')}
                placeholder={t('customModes.namePlaceholder')}
                value={m.name}
                maxLength={40}
                onChange={(e) => patch(m.id, { name: e.target.value })}
              />
              <Select
                aria-label={t('customModes.base')}
                value={m.base}
                onChange={(base) => patch(m.id, { base: base as CustomMode['base'] })}
                options={ANALYSIS_MODES.map((b) => ({
                  value: b,
                  label: `${t('customModes.base')}: ${t(`common:modes.${b}.title`)}`,
                }))}
              />
              <button
                type="button"
                className="icon-btn"
                title={t('customModes.remove')}
                aria-label={t('customModes.remove')}
                onClick={() => onChange(modes.filter((x) => x.id !== m.id))}
              >
                <Icon icon={Delete02Icon} />
              </button>
            </div>
            <textarea
              className="textarea"
              rows={3}
              aria-label={t('customModes.instruction')}
              placeholder={t('customModes.instructionPlaceholder')}
              value={m.instruction}
              maxLength={1500}
              onChange={(e) => patch(m.id, { instruction: e.target.value })}
            />
            {(!m.name.trim() || !m.instruction.trim()) && <p className="hint">{t('customModes.incomplete')}</p>}
          </div>
        ))}
      </div>
      {modes.length < MAX_CUSTOM_MODES && (
        <button
          type="button"
          className="btn btn--sm"
          onClick={() =>
            onChange([...modes, { id: crypto.randomUUID().slice(0, 8), name: '', instruction: '', base: 'summary' }])
          }
        >
          <Icon icon={Add01Icon} size={16} />
          {t('customModes.add')}
        </button>
      )}
    </div>
  );
}
