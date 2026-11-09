import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

/** Where the work is: reading the source, picking what matters, drawing the summary UI. */
export type SiftStage = 'reading' | 'sifting' | 'drawing';

const STEPS: SiftStage[] = ['reading', 'sifting', 'drawing'];
const STEP_LABEL = {
  reading: 'loader.steps.read',
  sifting: 'loader.steps.sift',
  drawing: 'loader.steps.draw',
} as const;

/** Line widths of the little page; the highlighter picks lines 2 and 4, like the app icon. */
const LINES = [62, 88, 74, 92, 48];

/**
 * Siftlume's own loading state: the app icon brought to life. A page of lines is scanned, a
 * highlighter marks what matters, and three steps (read, sift, draw) show where the work is.
 *
 * - "block":   nothing to show yet (reading the page, first summary before any output).
 * - "overlay": a summary is already shown and is being redone; it sits dimmed underneath.
 * - "strip":   the summary is streaming in; a slim bar above it.
 */
export function SiftLoader({
  stage,
  title,
  variant = 'block',
  onStop,
}: {
  stage: SiftStage;
  title: string;
  variant?: 'block' | 'overlay' | 'strip';
  onStop?: () => void;
}) {
  const { t } = useTranslation('common');
  const active = STEPS.indexOf(stage);

  // Elapsed seconds, so a slow model still shows that something is happening.
  const [seconds, setSeconds] = useState(0);
  useEffect(() => {
    const started = Date.now();
    const id = setInterval(() => setSeconds(Math.floor((Date.now() - started) / 1000)), 1000);
    return () => clearInterval(id);
  }, []);

  return (
    <div className={`sift-loader sift-loader--${variant} sift-loader--${stage}`} role="status" aria-live="polite">
      <div className="sift-loader__paper" aria-hidden="true">
        {LINES.map((w, i) => (
          <span key={i} className="sift-loader__line" style={{ width: `${w}%`, animationDelay: `${i * 0.12}s` }} />
        ))}
      </div>
      <div className="sift-loader__body">
        <strong className="sift-loader__title">{title}</strong>
        <ol className="sift-loader__steps">
          {STEPS.map((s, i) => (
            <li key={s} className={i < active ? 'is-done' : i === active ? 'is-active' : undefined}>
              {t(STEP_LABEL[s])}
            </li>
          ))}
        </ol>
      </div>
      <span className="sift-loader__time">{seconds >= 2 ? t('loader.elapsed', { seconds }) : ''}</span>
      {onStop && (
        <button type="button" className="sift-loader__stop link" onClick={onStop}>
          {t('actions.stop')}
        </button>
      )}
    </div>
  );
}
