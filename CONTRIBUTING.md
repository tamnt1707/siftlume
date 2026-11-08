# Contributing to Siftlume

Thanks for helping. This guide covers the setup, the rules the code follows, and step-by-step recipes for the most common changes.

## Ways to help

- **Report a bug**: open an issue with the steps, the provider and model, and what you expected. Screenshots and the console output of the side panel or tab help a lot.
- **Improve a translation**: native speakers are very welcome. Every non-English locale was written without a native review.
- **Add a provider, a language, a component or a summary style**: see the recipes below.
- **Fix something**: issues labelled `good first issue` are a good start.

For larger changes, open an issue first so we can agree on the approach before you spend time on it.

## Setup

Requirements: Node.js 20 or newer and [pnpm](https://pnpm.io).

```bash
git clone https://github.com/tamnt1707/siftlume.git
cd siftlume
pnpm install
pnpm dev
```

`pnpm dev` opens a Chrome window with the extension loaded and reloads it when you save. Open Settings in the extension, pick a provider and add a key. A local model through Ollama works well for development and costs nothing.

To debug:

- **Side panel**: right-click inside the panel → Inspect.
- **Popup**: right-click the popup → Inspect.
- **Background**: `chrome://extensions` → Siftlume → "service worker".

## Before you open a pull request

```bash
pnpm check     # type-check + locale check + prompt example check
pnpm build     # make sure the production build succeeds
```

Then try your change in the browser. A quick manual pass:

- Summarize a web page, once with **Show results in → Inline (side panel)** and once with **New tab**.
- Summarize a PDF and a CSV (the CSV view has filters that should work without calling the model).
- Click a refine button and ask a follow-up question.
- Look at it in light and dark mode, and in a narrow side panel.

If your change affects what the screenshots show, run `pnpm screenshots` and commit the updated images in `docs/screenshots/`. The showcase pages live in `scripts/showcase/` (the sample article and summary are in `content.ts`).

## Conventions

- **Language**: code, comments, commit messages and docs are in English.
- **No hard-coded UI text**: every string shown to users goes through i18next (`t('…')`) with a key in `locales/en/*.json`. Keys are type-checked, so a missing English key fails `pnpm compile`.
- **Formatting**: Prettier (`.prettierrc`: single quotes, 120 columns). Run `npx prettier --write <files>` on what you touched.
- **Styling**: use the design tokens (`--accent`, `--ink`, `--paper`, `--r-md`, `--font-reading`…), not raw colors or radii, so presets, custom colors and dark mode keep working. App chrome styles live in `assets/app.css`; generated-summary styles live in `assets/genui.css` (classes prefixed `g-`).
- **Comments** explain why, not what. Keep them short.
- **Commits**: one logical change per commit, imperative subject line ("Add Groq provider", "Fix CSV filter reset").

### Chrome extension constraints (Manifest V3)

These are easy to break and hard to notice:

- **No remote code**: no scripts from CDNs, no `eval` or `new Function`. Bundle every dependency. Check new libraries for `eval` before adding them.
- **No inline event handlers or inline scripts** in HTML strings (`onclick="…"`). Use React handlers.
- **Untrusted content**: page HTML, model output and Mermaid source are untrusted. Never insert them as HTML into a live document except through a sanitizing renderer (the Pele diagram renderer runs with links and images disabled).
- **User gestures**: `chrome.sidePanel.open` and `chrome.permissions.request` must be called synchronously inside the click handler, before any `await`.
- **Privacy**: API keys stay in `chrome.storage.local`. Nothing is sent anywhere except the provider the user configured.

## How the code is organised

| Area                                            | Where                                                                                               |
| ----------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| Toolbar icon, context menus, per-tab side panel | `entrypoints/background.ts`, `lib/context-menus.ts`, `lib/pending.ts`                               |
| Result view (side panel and full-page tab)      | `entrypoints/app/App.tsx`, `components/SessionView.tsx`, `components/useSession.ts`                 |
| Settings                                        | `components/SettingsForm.tsx` (tabs), `components/AppearancePanel.tsx`, `components/AboutPanel.tsx` |
| Reading pages and files                         | `lib/page.ts`, `lib/extractors.ts`                                                                  |
| Prompts, validation, edit-mode merge            | `lib/openui.ts`, `lib/generate.ts`                                                                  |
| OpenUI components and actions                   | `lib/library.tsx`                                                                                   |
| Providers and models                            | `lib/settings.ts` (`PROVIDERS`), `lib/llm.ts`, `lib/models.ts`                                      |
| Design tokens                                   | `lib/appearance.ts`, `assets/app.css`, `assets/genui.css`                                           |
| Translations                                    | `lib/i18n/`, `locales/`, `public/_locales/`                                                         |

Generated, more detailed documentation is in [`openwiki/`](openwiki/index.md). It can lag behind the code; the code is the source of truth.

## Recipes

### Add an LLM provider

1. In `lib/settings.ts`, add an id to `ProviderId` and an entry to `PROVIDERS`:
   ```ts
   acme: {
     label: 'Acme AI',
     api: 'compatible',            // 'openai' | 'anthropic' | 'google' | 'compatible'
     defaultBaseUrl: 'https://api.acme.ai/v1',
     defaultModel: 'acme-large',
     needsKey: true,
     keyUrl: 'https://console.acme.ai/keys',
   },
   ```
2. Most providers expose an OpenAI-compatible API, and then nothing else is needed: chat goes through `lib/llm.ts` and the model list through `GET {baseUrl}/models` in `lib/models.ts`.
3. If the provider has its own API, add a case in `createModel` (`lib/llm.ts`) using its AI SDK package, and a branch in `fetchModels` (`lib/models.ts`) for its model list.
4. Test: Settings → pick the provider → paste a key → Load models → summarize a page.

### Add or improve a language

1. Copy `locales/en/` to `locales/<code>/` (for example `it`, `pt-PT`) and translate the values. Keep the keys and the `{{placeholders}}`.
2. Plurals use CLDR forms. Provide every form your language needs (`_one`, `_few`, `_many`, `_other`); `pnpm check:i18n` tells you which ones are missing.
3. Add the language to `UI_LANGUAGES` in `lib/i18n/index.ts`, using its native name.
4. Add `public/_locales/<code>/messages.json` (Chrome uses an underscore: `pt_BR`, `zh_CN`). The description must be 132 characters or fewer.
5. Run `pnpm check:i18n`, then switch to the language in Settings and look through every screen.

### Add a component the model can use

Summary components live in `lib/library.tsx`.

1. Define it with `defineComponent` and a Zod schema. The key order of `props` is the argument order the model writes, so put required props first.
   ```tsx
   const ProsCons = defineComponent({
     name: 'ProsCons',
     description: 'Advantages and drawbacks side by side. Max 4 items each.',
     props: z.object({ pros: z.array(z.string()), cons: z.array(z.string()) }),
     component: ({ props }) => <div className="g-proscons">…</div>,
   });
   ```
2. Register it in `library` (`openuiChatLibrary.extend`), with the slots where it may appear (`CONTENT_SLOTS`).
3. Style it in `assets/genui.css` with a `g-` class and the design tokens.
4. Tell the model when to use it: add a rule to `VISUAL_RULES` in `lib/openui.ts`. If it is easy to get wrong, add it to an example in `lib/summary-example.ts`.
5. Run `pnpm check:examples`. It parses every prompt example against the real library, so a typo in an example fails here instead of teaching the model wrong syntax.

To make a button in your component trigger an app action, define the action with `defineAction`, handle it in `onAction` in `components/SessionView.tsx`, and fire it with the `customAction()` helper in `lib/library.tsx`. The plain `{ type, params }` form is silently ignored for registered actions.

### Add a refine button or a default summary style

1. In `lib/refine.ts`, add the id to `RefineId`, the instruction to `REFINE_PROMPTS` (for the button) and, for a style that can be on by default, to `SummaryStyle`, `SUMMARY_STYLES` and `STYLE_RULES`.
2. Add the label and the description to `locales/*/session.json` (`refine`, `refineHint`) and, for a style, to `locales/*/settings.json` (`summary.styles`).
3. Add the id to `REFINE_PRESETS` in `components/SessionView.tsx` to show the button.

Instructions for the model stay in English; only what users see is translated.

## Reporting security issues

Please do not open a public issue for vulnerabilities such as a way to leak API keys or to run code from a web page. Contact the maintainer through GitHub ([@tamnt1707](https://github.com/tamnt1707)) first.

## License

By contributing, you agree that your contributions are licensed under the [MIT License](LICENSE).
