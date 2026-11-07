# AI Summarizer

A Chrome extension that summarizes the page you are reading, pasted text, or a file (PDF, CSV, Markdown, TXT, HTML, JSON) into an **interactive Generative UI** built with [OpenUI](https://www.openui.com).

Bring your own key: requests go straight from your browser to the LLM provider. There is no backend.

## Features

- **Two ways to work** (Settings → Show results in):
  - **Inline (side panel)**: the toolbar icon (`Alt+Shift+S`) opens the side panel of the current tab, and everything happens there. The panel belongs to that tab: other tabs do not show it, and it closes when the tab navigates to another URL.
  - **New tab**: the icon opens a small popup launcher, and results open in a full-page tab with a Questions column.
- **Inkmark design system**: you choose the pen (accent) and the highlighter (marker) from five presets or custom colors, plus soft or square corners, a serif or sans reading font, and light, dark, or system mode. The same tokens drive the app chrome, the OpenUI components, charts, and diagrams. Code: `lib/appearance.ts`.
- **Right-click**: "Summarize this page" / "Summarize selection".
- **Visual first**: one-line TL;DR, metric cards, short lists, tags, timelines, folded details. Pages with numbers get charts (line, bar, pie, radial, radar, scatter), chosen by the shape of the data. HTML tables are kept, so charts use the page's real numbers.
- **Diagrams with [Pele](https://pele.run)**: processes, decisions, and interactions between actors are drawn from Mermaid (flowchart, sequence, state, mindmap, ER). Rendering happens in the browser with no `eval`. Wide flows flip to top-down when space is narrow, invalid Mermaid goes back to the model with the line number, and colors follow the app theme.
- **Refine in one click** (Shorter, More detail, Action items, …): uses OpenUI **edit mode**, so the model sends only a patch and `mergeStatements` applies it.
- **Ask follow-up questions**: uses OpenUI **inline mode**, so answers are plain text or a compact UI.
- **Interactive CSV**: the model writes `Query("csv_group", …)` and `$state` filters. The queries run in the browser through `toolProvider`, so filtering and grouping never call the model again.
- **Source quotes**: a custom `SourceQuote` component plus `@HighlightInPage` / `@CopyText` custom actions.
- **Self-correction**: invalid OpenUI Lang is validated with the parser, and the errors go back to the model once.
- **History** is stored with the OpenUI **Message Protocol** (`buildMessage` / `parseMessage`), including form and `$state` values.
- **Providers**: OpenAI, Anthropic, Google Gemini, OpenRouter, Groq, DeepSeek, Mistral, xAI, Together, Ollama, LM Studio, or any OpenAI-compatible endpoint. The model list loads live from the provider.

## Languages

The interface follows the browser language and falls back to English. It is available in English, Tiếng Việt, 日本語, 简体中文, 繁體中文, 한국어, Español, Français, Deutsch, Português (Brasil), Русский, and ไทย. You can override it in Settings → Appearance. The summary language is a separate setting; by default it matches the source.

```
locales/<lang>/          one folder per language
  common.json            shared: actions, history, model picker
  picker.json            start screen
  popup.json             popup launcher
  session.json           summary, refine, Q&A, generated-UI labels
  settings.json          settings page
  errors.json            error messages
public/_locales/<lang>/  extension name, description, context menu (Chrome i18n)
```

English (`locales/en`) is the source of truth, and its keys are type-checked in code. To add or update a language, copy `locales/en`, translate the values, and run `pnpm check:i18n`. It verifies keys, CLDR plural forms (`_one`, `_few`, `_many`, `_other`), and `{{placeholders}}` against English.

## Development

```bash
pnpm install
pnpm dev          # opens Chrome with the extension loaded (hot reload)
pnpm compile      # type-check
pnpm build        # production build in .output/chrome-mv3
pnpm zip          # zip for the Chrome Web Store
```

Open the extension's **Settings** page, pick a provider, paste your key, and choose a model.

### Local models

- **Ollama**: works out of the box. The extension rewrites the `Origin` header for its own requests to localhost, so `OLLAMA_ORIGINS` is not needed. Pick a model that supports chat.
- **LM Studio**: start the local server and enable CORS.

## Project layout

```
entrypoints/
  background.ts       context menu (display mode encoded in the item id)
  popup/              launcher
  app/                result view (full-page tab; also mounted in the side panel)
  sidepanel/          side panel entry for the result view
  options/            settings (provider, key, model, summary preferences)
components/           React UI (GenUI renderer wrapper, session view, hooks)
lib/
  library.tsx         OpenUI library: openuiChatLibrary + SourceQuote + custom actions
  openui.ts           system prompts, inline-mode splitting, validation, edit-mode merge
  generate.ts         streaming + one-shot repair loop
  csv-tools.ts        in-browser Query tools for CSV data
  diagram.ts          Mermaid → SVG with Pele (Diagram component, validation)
  extractors.ts       HTML/PDF/CSV/Markdown → text
  llm.ts, models.ts   AI SDK providers, live model lists
  history.ts          sessions stored with the OpenUI Message Protocol
```

## Privacy

API keys are stored only in `chrome.storage.local` and are never synced. The extension asks for host permissions at runtime: the API domain when you save Settings, and page access the first time you summarize a page.

## License

MIT
