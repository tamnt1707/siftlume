import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Clock01Icon, FileUploadIcon, Settings02Icon, SparklesIcon } from '@hugeicons/core-free-icons';
import { Icon } from '@/components/Icon';
import { Themed } from '@/components/Themed';
import { browser, type Browser } from '#imports';
import { HistoryList } from '@/components/HistoryList';
import { ModelSwitcher } from '@/components/ModelSwitcher';
import { ModePicker, saveMode } from '@/components/ModePicker';
import { useSettings } from '@/components/useSettings';
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

  useEffect(() => {
    void getActiveTab().then((t) => setTab(t ?? null));
  }, []);

  const problem = loaded ? configProblem(settings) : null;
  const canReadTab = Boolean(tab?.id) && isReadableUrl(tab?.url);

  /** History, uploads and past sessions always open as a full page. */
  const show = (route: AppRoute) => void openApp(route, tab ?? undefined).then(() => window.close());

  const submit = (req: PendingRequest) => {
    void queueRequest(req)
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
          <div className="banner">
            {problem}{' '}
            <button className="link" onClick={openSettings}>
              {t('common:actions.openSettings')}
            </button>
          </div>
        )}

        <ModePicker value={settings.mode} onChange={(m) => saveMode(settings, m)} descriptions={false} />

        <button
          className="btn btn--primary btn--hero"
          disabled={!canReadTab || Boolean(problem)}
          onClick={() => tab?.id && submit({ type: 'tab', tabId: tab.id })}
        >
          <span className="btn__label">
            <Icon icon={SparklesIcon} />
            {t(`picker:run.${settings.mode}`)}
          </span>
          {tab?.title && <span className="btn__sub">{canReadTab ? tab.title : t('picker:cannotRead')}</span>}
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
              {t(`picker:runText.${settings.mode}`)} <kbd>⌘/Ctrl ↵</kbd>
            </button>
          )}
        </div>

        {/* File pickers can close the popup, so files are picked on the full page. */}
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
