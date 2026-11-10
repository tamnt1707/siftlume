// Stand-in for WXT's '#imports' so extension components render in a plain page for screenshots.
// Stored settings follow the page's ?dark flag, so nested components (Settings reads storage)
// render in the same mode as the page instead of the headless browser's system theme.
const memory: Record<string, unknown> = {
  'local:settings': { theme: new URLSearchParams(location.search).has('dark') ? 'dark' : 'light' },
};
export const storage = {
  defineItem: (key: string, opts: { fallback: unknown }) => ({
    getValue: async () => memory[key] ?? opts.fallback,
    setValue: async (v: unknown) => void (memory[key] = v),
    watch: () => () => {},
  }),
};
export const browser: any = {
  runtime: { id: 'showcase', getManifest: () => ({ version: '0.1.0' }) },
  i18n: { getUILanguage: () => new URLSearchParams(location.search).get('lang') ?? 'en' },
  permissions: { request: async () => true },
  declarativeNetRequest: { updateSessionRules: async () => {} },
};
export type Browser = any;
