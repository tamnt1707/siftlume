import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { PortalContainerContext } from './portal';
import { ThemeProvider } from '@openuidev/react-ui';
import { I18nextProvider } from 'react-i18next';
import i18n, { setUiLanguage } from '@/lib/i18n';
import { appearanceVars, buildOpenUITheme, type ColorMode } from '@/lib/appearance';
import type { Settings } from '@/lib/settings';

const darkQuery = () => window.matchMedia('(prefers-color-scheme: dark)');

/** Resolves "system" to light/dark and follows OS changes. */
export function useIsDark(mode: ColorMode) {
  const [systemDark, setSystemDark] = useState(() => darkQuery().matches);
  useEffect(() => {
    const mq = darkQuery();
    const on = () => setSystemDark(mq.matches);
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, []);
  return mode === 'system' ? systemDark : mode === 'dark';
}

/**
 * Applies the Inkmark design system: CSS variables for the chrome and custom components,
 * and matching OpenUI ThemeProvider tokens for the generated UI.
 */
export function Themed({
  settings,
  className,
  children,
  root = true,
}: {
  settings: Settings;
  className: string;
  children: ReactNode;
  /** False for a nested Themed (embedded settings draft): leave the page background alone. */
  root?: boolean;
}) {
  const dark = useIsDark(settings.theme);
  const [rootEl, setRootEl] = useState<HTMLDivElement | null>(null);
  const openuiTheme = useMemo(() => buildOpenUITheme(settings.appearance), [settings.appearance]);
  const vars = useMemo(() => appearanceVars(settings.appearance, dark), [settings.appearance, dark]);

  // Interface language (root only: a settings draft must not switch the whole page until saved).
  useEffect(() => {
    if (root) setUiLanguage(settings.uiLanguage);
  }, [root, settings.uiLanguage]);

  useEffect(() => {
    if (!root) return;
    // The page background outside the app (overscroll, side panel edges) follows the mode too.
    const background = dark ? '#141821' : '#F5F7FB';
    document.documentElement.style.colorScheme = dark ? 'dark' : 'light';
    // Paint the root too: the reserved scrollbar gutter and any area the app does not cover show
    // the root's background, which is otherwise the system's (dark in dark mode) and flashes.
    document.documentElement.style.background = background;
    document.body.style.background = background;
  }, [dark, root]);

  return (
    <I18nextProvider i18n={i18n}>
      <ThemeProvider mode={dark ? 'dark' : 'light'} {...openuiTheme}>
        <div
          ref={setRootEl}
          className={`${className} app--${dark ? 'dark' : 'light'} corners--${settings.appearance.corners}`}
          style={vars as React.CSSProperties}
        >
          <PortalContainerContext.Provider value={rootEl}>{children}</PortalContainerContext.Provider>
        </div>
      </ThemeProvider>
    </I18nextProvider>
  );
}
