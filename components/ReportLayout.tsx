import { useTranslation } from 'react-i18next';
import { browser } from '#imports';
import type { Session } from '@/lib/history';
import { resolveMode } from '@/lib/modes';
import { reportUrl } from '@/lib/report';
import { getProviderConfig, type Settings } from '@/lib/settings';

/**
 * A quiet line under a result: when the blocks picked do not suit the page, report it on GitHub
 * with what shaped the layout filled in. Nothing from the page is sent.
 */
export function ReportLayout({
  session,
  settings,
  program,
}: {
  session: Session;
  settings: Settings;
  program: string;
}) {
  const { t } = useTranslation('session');
  const open = () => {
    const chosen = session.options?.mode ?? settings.mode;
    const { base, custom } = resolveMode(chosen, settings.customModes);
    const url = reportUrl({
      version: browser.runtime.getManifest().version,
      kind: session.source.kind,
      mode: base,
      custom: Boolean(custom),
      length: session.options?.length ?? settings.length,
      language: session.options?.language ?? settings.language,
      provider: settings.provider,
      model: getProviderConfig(settings).model,
      program,
      userAgent: navigator.userAgent,
    });
    window.open(url, '_blank', 'noopener');
  };
  return (
    <p className="report-layout">
      {t('report.question')}{' '}
      <button type="button" className="link" onClick={open} title={t('report.title')}>
        {t('report.action')}
      </button>
    </p>
  );
}
