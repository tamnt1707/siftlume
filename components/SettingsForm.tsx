import { useEffect, useMemo, useRef, useState } from 'react';
import * as Tabs from '@radix-ui/react-tabs';
import {
  AiBrain01Icon,
  InformationCircleIcon,
  PaintBoardIcon,
  SlidersHorizontalIcon,
  TextAlignLeftIcon,
} from '@hugeicons/core-free-icons';
import { AboutPanel } from '@/components/AboutPanel';
import { Icon } from '@/components/Icon';
import { useTranslation } from 'react-i18next';
import { AppearancePanel } from '@/components/AppearancePanel';
import { LanguagePicker } from '@/components/LanguagePicker';
import { Select } from '@/components/Select';
import { SUMMARY_STYLES } from '@/lib/refine';
import { OUTPUT_LANGUAGES } from '@/lib/languages';
import { Themed } from '@/components/Themed';
import { fetchModels, isProviderConnected, modelCacheItem, type ModelCache, type ModelOption } from '@/lib/models';
import { HAS_SIDE_PANEL } from '@/lib/platform';
import {
  DEFAULT_SETTINGS,
  getProviderConfig,
  getSettings,
  originPattern,
  PROVIDERS,
  requestOriginPermission,
  settingsItem,
  type ProviderConfig,
  type ProviderId,
  type Settings,
  type SummaryLength,
} from '@/lib/settings';

const LENGTHS: SummaryLength[] = ['short', 'medium', 'detailed'];

/** Vertical tabs (horizontal on narrow screens such as the side panel). */
const TABS = [
  { id: 'ai', icon: AiBrain01Icon },
  { id: 'summary', icon: TextAlignLeftIcon },
  { id: 'appearance', icon: PaintBoardIcon },
  { id: 'advanced', icon: SlidersHorizontalIcon },
  { id: 'about', icon: InformationCircleIcon },
] as const;
type SettingsTab = (typeof TABS)[number]['id'];

type LoadState = { status: 'idle' | 'loading' | 'ok' | 'error'; message?: string };

interface SettingsFormProps {
  /** Rendered inside the side panel / result tab instead of the standalone options page. */
  embedded?: boolean;
  /** Embedded only: return to the summary. */
  onClose?: () => void;
  /** Tab shown first (default: AI model). */
  initialTab?: SettingsTab;
}

/**
 * All settings: provider, key, model, summary preferences, appearance.
 * Used by the options page and, embedded, by the side panel and result tab (gear button).
 * Edits are a draft until Save; the appearance preview follows the draft live.
 */
export function SettingsForm({ embedded = false, onClose, initialTab = 'ai' }: SettingsFormProps) {
  const { t } = useTranslation(['settings', 'common']);
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [loaded, setLoaded] = useState(false);
  const [models, setModels] = useState<ModelOption[]>([]);
  // Model lists of every provider, for the "connected" dots.
  const [modelCache, setModelCache] = useState<ModelCache>({});
  useEffect(() => {
    void modelCacheItem.getValue().then(setModelCache);
    return modelCacheItem.watch((v) => setModelCache(v ?? {}));
  }, []);
  const [load, setLoad] = useState<LoadState>({ status: 'idle' });
  const [showKey, setShowKey] = useState(false);
  const [saved, setSaved] = useState(false);
  const [tab, setTab] = useState<SettingsTab>(initialTab);
  const abortRef = useRef<AbortController | null>(null);

  const id = settings.provider;
  const preset = PROVIDERS[id];
  const cfg = getProviderConfig(settings);
  const baseUrl = cfg.baseUrl || preset.defaultBaseUrl;

  useEffect(() => {
    void getSettings().then((s) => {
      setSettings(s);
      setLoaded(true);
    });
  }, []);

  // Show the cached list for this provider immediately, then refresh it in the background.
  useEffect(() => {
    if (!loaded) return;
    void modelCacheItem.getValue().then((c) => setModels(c[id] ?? []));
    setLoad({ status: 'idle' });
  }, [id, loaded]);

  // Auto-load models shortly after the key or URL changes. This may fail without host permission;
  // the "Load models" button requests it.
  useEffect(() => {
    if (!loaded || (preset.needsKey && !cfg.apiKey.trim()) || !baseUrl) return;
    const t = setTimeout(() => void loadModels(), 600);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, cfg.apiKey, cfg.baseUrl, loaded]);

  const update = (patch: Partial<Settings>) => {
    setSaved(false);
    setSettings((s) => ({ ...s, ...patch }));
  };

  const updateProvider = (patch: Partial<ProviderConfig>) =>
    update({ providers: { ...settings.providers, [id]: { ...cfg, ...patch } } });

  async function loadModels() {
    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    setLoad({ status: 'loading' });
    try {
      const list = await fetchModels(id, cfg, ctrl.signal);
      if (ctrl.signal.aborted) return;
      setModels(list);
      setLoad({ status: 'ok', message: t('model.available', { count: list.length }) });
      const cache = await modelCacheItem.getValue();
      await modelCacheItem.setValue({ ...cache, [id]: list });
      // Pick a sensible model if the current one is not offered.
      if (list.length && !list.some((m) => m.id === cfg.model)) {
        const preferred = list.find((m) => m.id === preset.defaultModel) ?? list[0]!;
        updateProvider({ model: preferred.id });
      }
    } catch (e) {
      if (!ctrl.signal.aborted) setLoad({ status: 'error', message: e instanceof Error ? e.message : String(e) });
    }
  }

  const onLoadClick = () => {
    // Request the API origin synchronously (user gesture), then load.
    const granted = requestOriginPermission(baseUrl);
    void granted.then((ok) => (ok ? loadModels() : setLoad({ status: 'error', message: t('permissionDenied') })));
  };

  const onSave = () => {
    const granted = baseUrl && originPattern(baseUrl) ? requestOriginPermission(baseUrl) : Promise.resolve(true);
    void granted.then(async (ok) => {
      await settingsItem.setValue(settings);
      setSaved(true);
      if (!ok)
        setLoad({
          status: 'error',
          message: t('savedNoPermission'),
        });
    });
  };

  const modelLabel = useMemo(() => models.find((m) => m.id === cfg.model)?.label, [models, cfg.model]);

  if (!loaded) return null;

  return (
    <Themed settings={settings} root={!embedded} className={embedded ? 'options options--embedded' : 'options'}>
      <header className="options__header">
        <div className="options__title-row">
          <h1>{embedded ? t('title') : t('common:appName')}</h1>
          <LanguagePicker
            value={settings.uiLanguage}
            onChange={(uiLanguage) => setSettings((s) => ({ ...s, uiLanguage }))}
          />
        </div>
        <p className="muted">{t('intro')}</p>
      </header>

      <Tabs.Root
        value={tab}
        onValueChange={(v) => setTab(v as SettingsTab)}
        orientation="vertical"
        className="settings-tabs"
      >
        <Tabs.List className="settings-tabs__list" aria-label={t('title')}>
          {TABS.map((x) => (
            <Tabs.Trigger key={x.id} value={x.id} className="settings-tabs__tab" title={t(`tabs.${x.id}`)}>
              <Icon icon={x.icon} size={18} />
              <span>{t(`tabs.${x.id}`)}</span>
            </Tabs.Trigger>
          ))}
        </Tabs.List>

        <Tabs.Content value="ai" className="settings-tabs__panel">
          <section className="panel">
            <h2>{t('provider.heading')}</h2>
            <div className="provider-grid">
              {(Object.keys(PROVIDERS) as ProviderId[]).map((pid) => (
                <button
                  key={pid}
                  className={`provider ${pid === id ? 'provider--active' : ''}`}
                  onClick={() => update({ provider: pid })}
                >
                  {PROVIDERS[pid].label}
                  {isProviderConnected(settings, pid, modelCache) && (
                    <span className="provider__dot" title={t('provider.connected')} />
                  )}
                </button>
              ))}
            </div>
          </section>

          <section className="panel">
            <h2>{t('connect.heading')}</h2>
            {(preset.needsKey || id === 'custom') && (
              <div className="field">
                <label htmlFor="key">
                  {t('connect.apiKey')} {!preset.needsKey && <span className="muted">{t('connect.optional')}</span>}
                </label>
                <div className="row">
                  <input
                    id="key"
                    className="input"
                    type={showKey ? 'text' : 'password'}
                    autoComplete="off"
                    spellCheck={false}
                    placeholder={
                      preset.needsKey
                        ? t('connect.keyPlaceholder', { provider: preset.label })
                        : t('connect.keyOptionalPlaceholder')
                    }
                    value={cfg.apiKey}
                    onChange={(e) => updateProvider({ apiKey: e.target.value.trim() })}
                  />
                  <button className="btn" onClick={() => setShowKey(!showKey)}>
                    {showKey ? t('connect.hide') : t('connect.show')}
                  </button>
                </div>
                {preset.keyUrl && (
                  <a className="hint" href={preset.keyUrl} target="_blank" rel="noreferrer">
                    {t('connect.getKey', { provider: preset.label })} ↗
                  </a>
                )}
              </div>
            )}

            <details className="field" open={id === 'custom' || preset.local}>
              <summary>{t('connect.baseUrl')}</summary>
              <input
                className="input"
                spellCheck={false}
                placeholder={preset.defaultBaseUrl || 'https://your-server/v1'}
                value={cfg.baseUrl}
                onChange={(e) => updateProvider({ baseUrl: e.target.value.trim() })}
              />
              {preset.local && (
                <p className="hint">{id === 'ollama' ? t('connect.ollamaHint') : t('connect.lmstudioHint')}</p>
              )}
            </details>
          </section>

          <section className="panel">
            <h2>{t('model.heading')}</h2>
            <div className="row">
              <input
                className="input"
                list="model-list"
                spellCheck={false}
                placeholder={models.length ? t('model.searchPlaceholder') : t('model.idPlaceholder')}
                value={cfg.model}
                onChange={(e) => updateProvider({ model: e.target.value })}
              />
              <button className="btn" onClick={onLoadClick} disabled={load.status === 'loading'}>
                {load.status === 'loading' ? t('model.loading') : models.length ? t('model.refresh') : t('model.load')}
              </button>
            </div>
            <datalist id="model-list">
              {models.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.label}
                </option>
              ))}
            </datalist>
            {modelLabel && <p className="hint">{modelLabel}</p>}
            {load.message && (
              <p className={`hint ${load.status === 'error' ? 'hint--error' : 'hint--ok'}`}>{load.message}</p>
            )}

            {models.length > 0 && (
              <div className="model-list">
                {models.slice(0, 60).map((m) => (
                  <button
                    key={m.id}
                    className={`chip ${m.id === cfg.model ? 'chip--active' : ''}`}
                    onClick={() => updateProvider({ model: m.id })}
                    title={m.label}
                  >
                    {m.id}
                  </button>
                ))}
              </div>
            )}
          </section>
        </Tabs.Content>

        <Tabs.Content value="summary" className="settings-tabs__panel">
          <section className="panel">
            {HAS_SIDE_PANEL && (
              <div className="field">
                <label>{t('summary.showIn')}</label>
                <div className="segmented">
                  {(
                    [
                      ['sidepanel', t('summary.displaySidepanel')],
                      ['tab', t('summary.displayTab')],
                    ] as const
                  ).map(([value, label]) => (
                    <button
                      key={value}
                      className={settings.display === value ? 'active' : ''}
                      onClick={() => update({ display: value })}
                    >
                      {label}
                    </button>
                  ))}
                </div>
                <p className="hint">
                  {settings.display === 'tab' ? t('summary.displayTabHint') : t('summary.displaySidepanelHint')}
                </p>
              </div>
            )}
            <div className="field">
              <label htmlFor="lang">{t('summary.outputLanguage')}</label>
              <Select
                id="lang"
                value={settings.language}
                onChange={(language) => update({ language })}
                options={[
                  { value: 'auto', label: t('summary.sameAsSource') },
                  ...OUTPUT_LANGUAGES.map((l) => ({ value: l.name, label: l.label })),
                  ...(settings.language !== 'auto' && !OUTPUT_LANGUAGES.some((l) => l.name === settings.language)
                    ? [{ value: settings.language, label: settings.language }]
                    : []),
                ]}
              />
            </div>
            <div className="field">
              <label>{t('summary.length')}</label>
              <div className="segmented">
                {LENGTHS.map((value) => (
                  <button
                    key={value}
                    className={settings.length === value ? 'active' : ''}
                    onClick={() => update({ length: value })}
                  >
                    {t(`summary.lengths.${value}`)}
                  </button>
                ))}
              </div>
              <p className="hint">{t(`summary.lengthHints.${settings.length}`)}</p>
            </div>
            <div className="field">
              <label id="always-include">{t('summary.alwaysInclude')}</label>
              <div className="style-cards" role="group" aria-labelledby="always-include">
                {SUMMARY_STYLES.map((style) => {
                  const on = settings.styles.includes(style);
                  return (
                    <button
                      key={style}
                      type="button"
                      role="switch"
                      aria-checked={on}
                      className={`style-card ${on ? 'style-card--on' : ''}`}
                      onClick={() =>
                        update({
                          styles: on ? settings.styles.filter((x) => x !== style) : [...settings.styles, style],
                        })
                      }
                    >
                      <span className="style-card__switch" aria-hidden="true" />
                      <span className="style-card__text">
                        <strong>{t(`summary.styles.${style}.title`)}</strong>
                        <span>{t(`summary.styles.${style}.desc`)}</span>
                      </span>
                    </button>
                  );
                })}
              </div>
              <p className="hint">{t('summary.alwaysIncludeHint')}</p>
            </div>
            <div className="field">
              <label htmlFor="instr">{t('summary.customInstructions')}</label>
              <textarea
                id="instr"
                className="textarea"
                rows={3}
                placeholder={t('summary.customPlaceholder')}
                value={settings.customInstructions}
                onChange={(e) => update({ customInstructions: e.target.value })}
              />
            </div>
          </section>
        </Tabs.Content>

        <Tabs.Content value="appearance" className="settings-tabs__panel">
          <AppearancePanel
            appearance={settings.appearance}
            mode={settings.theme}
            onChange={(patch) => update({ appearance: { ...settings.appearance, ...patch } })}
            onModeChange={(theme) => update({ theme })}
          />
        </Tabs.Content>

        <Tabs.Content value="advanced" className="settings-tabs__panel">
          <section className="panel">
            <div className="field">
              <label htmlFor="max">{t('advanced.maxChars')}</label>
              <input
                id="max"
                className="input"
                type="number"
                min={2000}
                step={1000}
                value={settings.maxChars}
                onChange={(e) =>
                  update({ maxChars: Math.max(2000, Number(e.target.value) || DEFAULT_SETTINGS.maxChars) })
                }
              />
            </div>
            <p className="hint">{t('advanced.privacy')}</p>
          </section>
        </Tabs.Content>

        <Tabs.Content value="about" className="settings-tabs__panel">
          <AboutPanel />
        </Tabs.Content>
      </Tabs.Root>

      <footer className="options__footer">
        {embedded && onClose && (
          <button className="btn" onClick={onClose}>
            {saved ? t('footer.done') : t('footer.cancel')}
          </button>
        )}
        <button className="btn btn--primary" onClick={onSave}>
          {saved ? t('footer.saved') : t('footer.save')}
        </button>
      </footer>
    </Themed>
  );
}
