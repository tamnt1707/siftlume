import { useTranslation } from 'react-i18next';
import { isHex, PRESETS, type Appearance, type ColorMode } from '@/lib/appearance';

interface Props {
  appearance: Appearance;
  mode: ColorMode;
  onChange: (patch: Partial<Appearance>) => void;
  onModeChange: (mode: ColorMode) => void;
}

const MODES: ColorMode[] = ['system', 'light', 'dark'];

/** Settings → Appearance: pick the pen and highlighter of the Inkmark design system. */
export function AppearancePanel({ appearance, mode, onChange, onModeChange }: Props) {
  const { t } = useTranslation('settings');
  const custom = appearance.preset === 'custom';

  return (
    <section className="panel">
      <div className="field">
        <label>{t('appearance.colors')}</label>
        <div className="swatches" role="radiogroup" aria-label={t('appearance.colorPreset')}>
          {PRESETS.map((p) => (
            <button
              key={p.id}
              role="radio"
              aria-checked={appearance.preset === p.id}
              className={`swatch ${appearance.preset === p.id ? 'swatch--active' : ''}`}
              onClick={() => onChange({ preset: p.id, accent: p.accent, marker: p.marker })}
            >
              <span className="swatch__ink" style={{ background: p.accent }} />
              <span className="swatch__mark" style={{ background: p.marker }} />
              <span className="swatch__name">{p.name}</span>
            </button>
          ))}
          <button
            role="radio"
            aria-checked={custom}
            className={`swatch ${custom ? 'swatch--active' : ''}`}
            onClick={() => onChange({ preset: 'custom' })}
          >
            <span className="swatch__ink" style={{ background: appearance.accent }} />
            <span className="swatch__mark" style={{ background: appearance.marker }} />
            <span className="swatch__name">{t('appearance.custom')}</span>
          </button>
        </div>
      </div>

      {custom && (
        <div className="row row--wrap">
          <ColorField
            label={t('appearance.pen')}
            value={appearance.accent}
            onChange={(accent) => onChange({ accent })}
          />
          <ColorField
            label={t('appearance.highlighter')}
            value={appearance.marker}
            onChange={(marker) => onChange({ marker })}
          />
        </div>
      )}

      <div className="row row--wrap">
        <div className="field field--grow">
          <label>{t('appearance.mode')}</label>
          <div className="segmented">
            {MODES.map((value) => (
              <button key={value} className={mode === value ? 'active' : ''} onClick={() => onModeChange(value)}>
                {t(`appearance.modes.${value}`)}
              </button>
            ))}
          </div>
        </div>
        <div className="field field--grow">
          <label>{t('appearance.corners')}</label>
          <div className="segmented">
            {(['soft', 'square'] as const).map((c) => (
              <button
                key={c}
                className={appearance.corners === c ? 'active' : ''}
                onClick={() => onChange({ corners: c })}
              >
                {t(`appearance.cornerStyles.${c}`)}
              </button>
            ))}
          </div>
        </div>
        <div className="field field--grow">
          <label>{t('appearance.readingFont')}</label>
          <div className="segmented">
            {(['serif', 'sans'] as const).map((f) => (
              <button
                key={f}
                className={appearance.readingFont === f ? 'active' : ''}
                onClick={() => onChange({ readingFont: f })}
              >
                {t(`appearance.fonts.${f}`)}
              </button>
            ))}
          </div>
        </div>
      </div>

      <AppearancePreview />
    </section>
  );
}

function ColorField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div className="field field--grow">
      <label>{label}</label>
      <div className="color-field">
        <input type="color" value={isHex(value) ? value : '#000000'} onChange={(e) => onChange(e.target.value)} />
        <input
          className="input"
          spellCheck={false}
          value={value}
          onChange={(e) => onChange(e.target.value.startsWith('#') ? e.target.value : `#${e.target.value}`)}
          aria-invalid={!isHex(value)}
        />
      </div>
    </div>
  );
}

/** A small summary drawn with the real summary classes, so changes show up as they will in results. */
function AppearancePreview() {
  const { t } = useTranslation(['settings', 'session']);
  return (
    <div className="appearance-preview" aria-label={t('appearance.preview')}>
      <div className="g-hero">
        <p className="g-hero__meta">
          <span>{t('appearance.preview')}</span>
        </p>
        <h1 className="g-hero__title">{t('appearance.previewTitle')}</h1>
        <p className="g-hero__tldr">
          <mark className="is-drawn">{t('appearance.previewTldr')}</mark>
        </p>
      </div>
      <div className="g-nums">
        <div className="g-num">
          <span className="g-num__value">4°C</span>
          <span className="g-num__label">{t('appearance.previewNum1')}</span>
        </div>
        <div className="g-num">
          <span className="g-num__value">12%</span>
          <span className="g-num__label">{t('appearance.previewNum2')}</span>
          <span className="g-num__change g-num__change--down">-12%</span>
        </div>
      </div>
      <div className="appearance-preview__actions">
        <span className="chip">{t('session:refine.shorter')}</span>
        <span className="chip">{t('session:refine.timeline')}</span>
        <span className="btn btn--primary btn--sm">{t('session:ask')}</span>
      </div>
    </div>
  );
}
