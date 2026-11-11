import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Delete02Icon, Download04Icon, Tick02Icon } from '@hugeicons/core-free-icons';
import {
  cancelDownload,
  deleteModel,
  downloadModel,
  isDownloaded,
  LOCAL_MODELS,
  webGpuProblem,
} from '@/lib/local-model';
import { modelCacheItem } from '@/lib/models';
import { describeError } from '@/lib/llm';
import { Icon } from './Icon';

/**
 * Settings → AI for in-browser models: each model with its size, Download (with progress and
 * Cancel), Delete, and which one summaries use. The models list in the model switcher follows
 * what is downloaded.
 */
export function LocalModels({ model, onChoose }: { model: string; onChoose: (id: string) => void }) {
  const { t, i18n } = useTranslation('settings');
  const [problem, setProblem] = useState<string | null>(null);
  const [downloaded, setDownloaded] = useState<Record<string, boolean>>({});
  const [progress, setProgress] = useState<{ id: string; value: number } | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const cancelled = useRef(false);
  const chosen = LOCAL_MODELS.some((m) => m.id === model) ? model : LOCAL_MODELS[0]!.id;

  const refresh = useCallback(async () => {
    const entries = await Promise.all(LOCAL_MODELS.map(async (m) => [m.id, await isDownloaded(m.id)] as const));
    const state = Object.fromEntries(entries);
    setDownloaded(state);
    // The model switcher lists the downloaded ones.
    const cache = await modelCacheItem.getValue();
    await modelCacheItem.setValue({
      ...cache,
      browser: LOCAL_MODELS.filter((m) => state[m.id]).map((m) => ({ id: m.id, label: m.label })),
    });
  }, []);

  useEffect(() => {
    void webGpuProblem().then(setProblem);
    void refresh();
  }, [refresh]);

  const download = (id: string) => {
    setError(null);
    setProgress({ id, value: 0 });
    cancelled.current = false;
    onChoose(id);
    void downloadModel(id, (value) => setProgress({ id, value }))
      .catch((e) => !cancelled.current && setError(describeError(e)))
      .finally(() => {
        setProgress(null);
        void refresh();
      });
  };

  const remove = (id: string) => {
    setConfirmDelete(null);
    void deleteModel(id)
      .catch((e) => setError(describeError(e)))
      .finally(() => void refresh());
  };

  return (
    <div className="local-models">
      <p className="hint">{t('local.about')}</p>
      <p className="hint hint--warn">{t('local.slow')}</p>
      {problem && <p className="hint hint--error">{problem}</p>}

      <ul className="local-models__list">
        {LOCAL_MODELS.map((m) => {
          const have = downloaded[m.id];
          const loading = progress?.id === m.id;
          return (
            <li key={m.id} className={`local-model ${m.id === chosen ? 'is-chosen' : ''}`}>
              <label className="local-model__pick">
                <input
                  type="radio"
                  name="local-model"
                  checked={m.id === chosen}
                  onChange={() => onChoose(m.id)}
                  disabled={!have && !loading}
                />
                <span className="local-model__text">
                  <strong>
                    {m.label}
                    {have && (
                      <span className="local-model__ready">
                        <Icon icon={Tick02Icon} size={12} />
                        {t('local.downloaded')}
                      </span>
                    )}
                  </strong>
                  <span className="muted">
                    {t(`local.models.${m.hint}`)} · {t('local.size', { size: m.size.toLocaleString(i18n.language) })}
                  </span>
                </span>
              </label>

              <div className="local-model__actions">
                {loading ? (
                  <>
                    <progress max={1} value={progress.value} />
                    <span className="muted">{Math.round(progress.value * 100)}%</span>
                    <button
                      type="button"
                      className="btn btn--sm"
                      onClick={() => {
                        cancelled.current = true;
                        void cancelDownload();
                      }}
                    >
                      {t('local.cancel')}
                    </button>
                  </>
                ) : have ? (
                  confirmDelete === m.id ? (
                    <>
                      <button type="button" className="btn btn--sm btn--danger" onClick={() => remove(m.id)}>
                        {t('local.deleteYes', { size: m.size.toLocaleString(i18n.language) })}
                      </button>
                      <button type="button" className="btn btn--sm" onClick={() => setConfirmDelete(null)}>
                        {t('local.deleteNo')}
                      </button>
                    </>
                  ) : (
                    <button
                      type="button"
                      className="btn btn--sm"
                      onClick={() => setConfirmDelete(m.id)}
                      disabled={Boolean(progress)}
                    >
                      <Icon icon={Delete02Icon} size={14} />
                      {t('local.delete')}
                    </button>
                  )
                ) : (
                  <button
                    type="button"
                    className="btn btn--sm btn--primary"
                    onClick={() => download(m.id)}
                    disabled={Boolean(problem) || Boolean(progress)}
                  >
                    <Icon icon={Download04Icon} size={14} />
                    {t('local.download')}
                  </button>
                )}
              </div>
            </li>
          );
        })}
      </ul>
      {error && <p className="hint hint--error">{error}</p>}
      <p className="hint">{t('local.storage')}</p>
    </div>
  );
}
