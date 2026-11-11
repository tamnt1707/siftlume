import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { downloadNano, nanoStatus, type NanoStatus } from '@/lib/nano';
import { modelCacheItem } from '@/lib/models';
import { describeError } from '@/lib/llm';

/**
 * Settings → AI for Gemini Nano: whether this device can run it, a download button (Chrome only
 * downloads from a click) with progress, and what it can and cannot do.
 */
export function NanoSetup() {
  const { t } = useTranslation('settings');
  const [status, setStatus] = useState<NanoStatus | null>(null);
  const [progress, setProgress] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void nanoStatus().then(setStatus);
  }, []);

  // Ready: list it as connected (provider dot, model switcher).
  useEffect(() => {
    if (status !== 'available') return;
    void modelCacheItem
      .getValue()
      .then((c) => modelCacheItem.setValue({ ...c, chrome: [{ id: 'gemini-nano', label: 'Gemini Nano' }] }));
  }, [status]);

  const download = () => {
    setError(null);
    setProgress(0);
    // No await before create(): the download needs the click's user activation.
    void downloadNano((loaded) => setProgress(loaded))
      .then(() => setStatus('available'))
      .catch((e) => setError(describeError(e)))
      .finally(() => setProgress(null));
  };

  return (
    <div className="nano-setup">
      <p className="hint">{t('nano.about')}</p>
      <p className="hint hint--warn">{t('nano.slow')}</p>
      {status === null ? null : status === 'unsupported' ? (
        <p className="hint hint--error">{t('nano.unsupported')}</p>
      ) : status === 'unavailable' ? (
        <p className="hint hint--error">{t('nano.unavailable')}</p>
      ) : status === 'available' ? (
        <p className="hint hint--ok">{t('nano.ready')}</p>
      ) : progress !== null ? (
        <div className="nano-setup__progress">
          <progress max={1} value={progress} />
          <span className="muted">{t('nano.downloading', { percent: Math.round(progress * 100) })}</span>
        </div>
      ) : (
        <div className="nano-setup__download">
          <button className="btn btn--primary btn--sm" onClick={download}>
            {status === 'downloading' ? t('nano.resume') : t('nano.download')}
          </button>
          <span className="muted">{t('nano.downloadHint')}</span>
        </div>
      )}
      {error && <p className="hint hint--error">{error}</p>}
      <p className="hint">{t('nano.limits')}</p>
    </div>
  );
}
