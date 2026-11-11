import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Clock01Icon, FileUploadIcon, Layers01Icon, Settings02Icon, SparklesIcon } from '@hugeicons/core-free-icons';
import { Icon } from '@/components/Icon';
import { Themed } from '@/components/Themed';
import { ThemeToggle } from '@/components/ThemeToggle';
import { browser, type Browser } from '#imports';
import { HistoryList } from '@/components/HistoryList';
import { ModelSwitcher } from '@/components/ModelSwitcher';
import { AnalysisChoice, runLabel } from '@/components/ModePicker';
import type { ModeId } from '@/lib/modes';
import { useSettings } from '@/components/useSettings';
import { pullRequestRef } from '@/lib/github';
import { useVideoProbe } from '@/components/useVideoProbe';
import { DeepToggle } from '@/components/DeepRead';
import { getActiveTab, isReadableUrl } from '@/lib/page';
import { openApp, queueRequest, type AppRoute, type PendingRequest } from '@/lib/pending';
import { configProblem } from '@/lib/settings';

const openSettings = () => void browser.runtime.openOptionsPage();

/**
 * Quick launcher. Opening the popup grants activeTab on the current tab, so the result view can
 * read it without a permission prompt. The popup never streams itself (it closes on blur); it hands
 * the request to a new tab. In side panel mode the icon opens the panel instead (no popup).
 */
export default function Popup() {
  const { t } = useTranslation(['popup', 'common', 'picker']);
  const { settings, loaded } = useSettings();
  const [tab, setTab] = useState<Browser.tabs.Tab | null>(null);
  const [text, setText] = useState('');
  // Every popup starts as a summary; another mode applies to this request only.
  const [mode, setMode] = useState<ModeId>('summary');

  useEffect(() => {
    void getActiveTab().then((t) => setTab(t ?? null));
  }, []);

  const problem = loaded ? configProblem(settings) : null;
  // Nothing can run without a provider: send a first run straight to Settings.
  useEffect(() => {
    if (problem) void browser.runtime.openOptionsPage().then(() => window.close());
  }, [problem]);
  const canReadTab = Boolean(tab?.id) && isReadableUrl(tab?.url);
  const video = useVideoProbe(canReadTab ? tab?.id : undefined, tab?.url);
  const isPr = Boolean(pullRequestRef(tab?.url));
  const canDeep = canReadTab && !video.isVideo && !isPr;
  const [deep, setDeep] = useState(false);

  /** History, uploads and past sessions always open as a full page. */
  const show = (route: AppRoute) => void openApp(route, tab ?? undefined).then(() => window.close());

  const submit = (req: PendingRequest) => {
    void queueRequest({ ...req, mode })
      .then((id) => openApp({ request: id }, tab ?? undefined))
      .then(() => window.close());
  };

  return (
    <Themed settings={settings} className={'popup'}>
      <header className="topbar">
        <span className="brand">{t('common:appName')}</span>
        <ModelSwitcher settings={settings} onManage={openSettings} />
        <nav>
          <button
            className="icon-btn"
            title={t('common:actions.history')}
            aria-label={t('common:actions.history')}
            onClick={() => show({ view: 'history' })}
          >
            <Icon icon={Clock01Icon} />
          </button>
          <ThemeToggle settings={settings} />
          <button
            className="icon-btn"
            title={t('common:actions.settings')}
            aria-label={t('common:actions.settings')}
            onClick={openSettings}
          >
            <Icon icon={Settings02Icon} />
          </button>
        </nav>
      </header>

      <main className="popup__body">
        {problem && (
          <div className="banner" role="status">
            {problem}{' '}
            <button className="link" onClick={openSettings}>
              {t('common:actions.openSettings')}
            </button>
          </div>
        )}

        <AnalysisChoice settings={settings} mode={mode} onModeChange={setMode} compact />

        {canDeep && <DeepToggle checked={deep} onChange={setDeep} />}
        <button
          className="btn btn--primary btn--hero"
          disabled={!canReadTab || Boolean(problem) || Boolean(video.blocked)}
          onClick={() => tab?.id && submit({ type: 'tab', tabId: tab.id, deep: deep && canDeep })}
        >
          <span className="btn__label">
            <Icon icon={SparklesIcon} />
            {runLabel(video.isVideo ? 'runVideo' : isPr ? 'runPr' : 'run', mode, settings.customModes)}
          </span>
          {tab?.title && <span className="btn__sub">{canReadTab ? tab.title : t('picker:cannotRead')}</span>}
          {(video.blocked || video.note) && <span className="btn__sub">{video.blocked ?? video.note}</span>}
        </button>

        <div className="paste">
          <textarea
            className="textarea"
            rows={text ? 6 : 2}
            placeholder={t('pastePlaceholder')}
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && (e.metaKey || e.ctrlKey) && text.trim() && !problem)
                submit({ type: 'text', text, tabId: tab?.id });
            }}
          />
          {text.trim() && (
            <button
              className="btn btn--primary btn--block"
              disabled={Boolean(problem)}
              onClick={() => submit({ type: 'text', text, tabId: tab?.id })}
            >
              {runLabel('runText', mode, settings.customModes)} <kbd>⌘/Ctrl ↵</kbd>
            </button>
          )}
        </div>

        {/* Permission prompts and file pickers close the popup, so both happen on the full page. */}
        <button className="btn btn--block" onClick={() => show({ view: 'tabs' })}>
          <Icon icon={Layers01Icon} size={16} />
          {t('picker:tabs.open')}
        </button>
        <button className="btn btn--block" onClick={() => show({ view: 'new' })}>
          <Icon icon={FileUploadIcon} size={16} />
          {t('upload')}
        </button>

        <p className="hint">{t('resultsHint')}</p>

        <HistoryList compact limit={4} onOpen={(s) => show({ session: s.id })} />
      </main>
    </Themed>
  );
}
