// Stand-in for WXT's '#imports' so extension components render in a plain page for screenshots.
// Stored settings follow the page's ?dark flag, so nested components (Settings reads storage)
// render in the same mode as the page instead of the headless browser's system theme.
const q = new URLSearchParams(location.search);
/** ?custom: two reading modes of the user's own, for the pickers and Settings → Summary. */
export const SHOWCASE_CUSTOM_MODES = q.has('custom')
  ? [
      {
        id: 'boss',
        name: 'Brief for my manager',
        instruction:
          'Three points a busy manager can read in 20 seconds, then the decision they need to make and by when.',
        base: 'action',
      },
      {
        id: 'vocab',
        name: 'Learn the vocabulary',
        instruction:
          'Pick the 8 most useful words and phrases, each with a plain meaning and the sentence it came from.',
        base: 'explain',
      },
    ]
  : [];
const memory: Record<string, unknown> = {
  'local:settings': { theme: q.has('dark') ? 'dark' : 'light', customModes: SHOWCASE_CUSTOM_MODES },
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
  permissions: { request: async () => true, remove: async () => true, contains: async () => true },
  /** ?tabs: open tabs for the "Combine open tabs" picker. */
  tabs: {
    query: async () => [
      { id: 1, title: 'How vaccines train the immune system', url: 'https://www.example-health.org/vaccines' },
      { id: 2, title: 'mRNA vaccines: a decade of research', url: 'https://science.example.com/mrna' },
      { id: 3, title: 'Vaccine myths, checked', url: 'https://factcheck.example.net/vaccine-myths' },
      { id: 4, title: 'WHO immunization schedule', url: 'https://www.who.int/immunization' },
      { id: 5, title: 'How mRNA vaccines work (explainer)', url: 'https://www.youtube.com/watch?v=aaaaaaaaaaa' },
      { id: 6, title: 'Lab B-roll, no narration', url: 'https://www.youtube.com/watch?v=bbbbbbbbbbb' },
    ],
  },
  /** Caption checks for the YouTube tabs above: tab 5 has automatic captions, tab 6 none. */
  scripting: {
    executeScript: async ({ target }: { target: { tabId: number } }) => [
      {
        result: {
          videoId: 'x',
          live: false,
          captions: target.tabId === 5 ? { label: 'English (auto-generated)', auto: true } : null,
        },
      },
    ],
  },
  declarativeNetRequest: { updateSessionRules: async () => {} },
};
export type Browser = any;
