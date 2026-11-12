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
/** A recording of scripts/meet-test/meeting.txt, about four minutes in. */
function meetRecording(state: string | null) {
  const turns: [string, string][] = [
    ['Ana', "Morning everyone. Let's review the launch plan for the new mobile app."],
    ['Bao', 'Morning. Before we start, the QA run on Android is not finished yet.'],
    ['Ana', 'How much is left?'],
    ['Bao', 'About forty test cases. I can finish them by Wednesday.'],
    ['Ana', "Okay. Then we can't ship on Friday as planned."],
    ['Bao', "I'd suggest Monday the twentieth instead. That gives us the weekend for fixes."],
  ];
  const now = Date.now();
  return {
    status: state === 'ended' ? 'ended' : 'recording',
    title: 'Mobile launch sync',
    url: 'https://meet.google.com/abc-defg-hij',
    startedAt: now - 252_000,
    updatedAt: now,
    blocks:
      state === 'nocaptions'
        ? []
        : turns.map(([speaker, text], i) => ({
            id: i,
            speaker,
            versions: [text],
            start: i * 38_000,
            end: i * 38_000 + 9_000,
          })),
    captions: state !== 'nocaptions',
    inCall: true,
  };
}
const memory: Record<string, unknown> = {
  'local:settings': {
    theme: q.has('dark') ? 'dark' : 'light',
    customModes: SHOWCASE_CUSTOM_MODES,
    // ?local: Settings with the in-browser models chosen.
    ...(q.has('local') ? { provider: 'browser' } : {}),
  },
  // ?view=meet: a meeting being recorded (&meet=ended: one that ended; &meet=nocaptions: captions off).
  ...(q.get('view') === 'meet' ? { 'local:meet:1': meetRecording(q.get('meet')) } : {}),
};
/** ?view=history: a few saved summaries for the search box. */
if (q.get('view') === 'history') {
  const day = 86_400_000;
  const now = Date.UTC(2026, 10, 11, 9);
  memory['local:historyIndex'] = [
    ['Học máy cơ bản cho người mới', 'webpage', 'Mạng nơ-ron học từ dữ liệu bằng đạo hàm và lan truyền ngược.', 0, 2],
    ['Acme Q3 earnings', 'pdf', 'Cloud drove 18% revenue growth while hardware kept shrinking.', 1, 0],
    [
      'How mRNA vaccines work (explainer)',
      'video',
      'The vaccine teaches cells to make a harmless spike protein.',
      2,
      1,
    ],
    ['Giá xe điện năm 2026', 'webpage', 'Pin rẻ hơn khiến xe điện có giá ngang xe xăng.', 4, 0],
  ].map(([title, kind, text, ago, qa], i) => ({
    id: `h${i}`,
    title,
    kind,
    text,
    qa,
    createdAt: now - (ago as number) * day,
    updatedAt: now - (ago as number) * day,
  }));
}
export const storage = {
  defineItem: (key: string, opts: { fallback: unknown }) => ({
    getValue: async () => memory[key] ?? opts.fallback,
    setValue: async (v: unknown) => void (memory[key] = v),
    removeValue: async () => void delete memory[key],
    watch: () => () => {},
  }),
};
export const browser: any = {
  runtime: { id: 'showcase', getManifest: () => ({ version: '0.1.0' }), getURL: (p: string) => location.origin + p },
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
