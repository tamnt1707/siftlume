# Chrome Web Store submission kit

Everything to paste into the [Chrome Developer Dashboard](https://chrome.google.com/webstore/devconsole) for Siftlume. Images are in this folder; regenerate them with `pnpm screenshots`. The package is `.output/siftlume-<version>-chrome.zip` from `pnpm zip`.

## Package

- Build: `pnpm check && pnpm zip`
- Upload `.output/siftlume-<version>-chrome.zip` (0.5.0 now; 0.4.0 is the last published)
- Before each update, bump `version` in `package.json`.

## Store listing tab

**Name**: Siftlume (from the manifest, localized through `public/_locales`)

**Summary** (from the manifest, max 132 characters):

> Summarize web pages, text and files into interactive visual summaries. Bring your own LLM key.

The summary comes from the manifest, so it is not edited here.

**Description** (keep it free of long lists of brand names or file types; the store rejected an earlier version for "keyword spam"):

```
Siftlume turns long pages into summaries you can scan in seconds.

Open an article, report or documentation page and click the Siftlume icon. You get a one-line TL;DR, the key figures and short takeaways, plus charts, timelines and diagrams when the content calls for them. Then ask follow-up questions, answered only from the source.

WHAT YOU CAN SUMMARIZE
• The page you are reading, or just a selection (right-click, then Summarize selection)
• YouTube videos, from their captions; quotes jump to that moment in the video
• Google Docs, Sheets and Slides you can open, including private ones, and PDFs in Google Drive; sheets get charts and filters, slides keep the speaker notes
• Recipes, products, job postings and events laid out for what you need: ingredients and steps, price and what reviewers say, salary and requirements, date and tickets
• Google Meet calls, from Meet's live captions with who said what: decisions, action items with owners, open questions
• GitHub pull requests: what changed and why, review status, risks, and a code review of the diff
• Several open tabs at once, compared side by side
• A page together with the pages it links to (Deep read)
• Text you paste
• Documents and spreadsheets you open from your computer
• Long reports and books: read part by part, so nothing after the first pages is cut

MADE FOR THE CONTENT
• Numbers become charts, chosen from the shape of the data
• Reviews get a verdict with pros and cons
• Action items become a checklist you can tick
• Processes and decisions become diagrams
• Spreadsheet data gets filters that update instantly

TOOLS
• Four lengths, from a quick look to a full report that covers every topic in order
• Refine in one click: shorter, more detail, action items, timeline, simpler
• Change the length or language of a single summary
• Write your own reading modes next to Summary, Explain, Critique and Action
• Copy, download as HTML or Markdown, listen, or print
• Jump to a quoted passage in the original page
• Search every past summary, or ask a question answered from what you have read

YOUR AI, YOUR KEY
Connect the AI provider you already use with your own API key, or run a model locally on your computer. Requests go straight from your browser to that provider. There is no Siftlume server.

No key? Download a small AI model once from Settings and it runs inside the browser, on your computer's graphics chip: free, offline after the download, and nothing you read leaves your device. You can delete it any time.

PRIVATE BY DESIGN
• No account, no analytics, no tracking
• Keys, settings, history and downloaded models stay in your browser
• A page is read only when you ask for a summary

Side panel or full-page tab, light or dark mode, your own colors, and an interface in 12 languages.

Free and open source (MIT): https://github.com/tamnt1707/siftlume
```

**Category**: Productivity → Tools (alternative: Workflow & Planning)

**Language**: English (add localized listings later if wanted; the extension itself is localized)

**Graphics**:

| Field                         | File                                    |
| ----------------------------- | --------------------------------------- |
| Store icon (128×128)          | `public/icon/128.png`                   |
| Screenshots (1280×800)        | `screenshot-1.png` … `screenshot-5.png` |
| Small promo tile (440×280)    | `promo-small-440x280.png`               |
| Marquee promo tile (1400×560) | `promo-marquee-1400x560.png`            |

**Official URL**: none (no verified site). **Homepage URL**: `https://github.com/tamnt1707/siftlume`. **Support URL**: `https://github.com/tamnt1707/siftlume/issues`.

## Privacy practices tab

**Single purpose**:

> Summarize the page the user is reading, text they paste, or a file they choose into a visual summary, using an AI provider the user configures with their own API key, or an AI model the user downloads to run in the browser.

**Permission justifications**:

| Permission                                | Justification                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| ----------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `activeTab`                               | Read the text of the tab where the user clicked the extension icon or used its context menu, so it can be summarized. No page is read without that user action.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| `scripting`                               | Run a one-time script in that tab to get its text for the summary, and to scroll to and highlight a quoted passage when the user clicks "Show in page".                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| `sidePanel`                               | Show the summary in the side panel next to the page the user is reading. The panel is enabled only for the tab that was summarized.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| `contextMenus`                            | Add "Summarize this page" and "Summarize selection" to the right-click menu.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| `storage`                                 | Save the user's settings (provider, API key, preferences) and summary history locally in the browser. Never synced.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| `unlimitedStorage`                        | Summary history can include data from CSV files the user summarized (up to thousands of rows), which can exceed the default local storage quota.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| `declarativeNetRequestWithHostAccess`     | Let the extension's own requests reach a local AI server the user configured (such as Ollama on localhost), which rejects requests with a chrome-extension origin. The rule only matches requests initiated by this extension, to hosts the user granted.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| `favicon`                                 | Show the website's icon next to its summary.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| `clipboardWrite`                          | Copy a summary (as Markdown) or a quote when the user clicks Copy.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| `tabs` (optional)                         | Declared as optional and never granted at install. Requested only when the user opens the "Several tabs" source on the start screen, to list the titles and addresses of the tabs in the current window so the user can pick 2–6 of them to summarize and compare together.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| Host permissions (optional, `<all_urls>`) | Declared as optional and never granted at install. When the user saves Settings, the extension requests access to the single domain of the AI provider they configured (for example api.openai.com or localhost for Ollama), so it can call that API. Users can configure any OpenAI-compatible endpoint, so the domain is not known in advance. When the user combines tabs, it requests access to the sites of the tabs they picked, to read them. When the user turns on Deep read, it requests access to all sites once, because the linked pages worth reading are only known after the page is read and the AI has picked them; if refused, it asks for just the picked sites each time. Linked pages are read only during a summary the user started. |

**Remote code**: No, I am not using remote code. (All code, including PDF and diagram renderers, is bundled. The OpenUI development widget, which loads from a CDN, is disabled.) Since 0.5.0 the in-browser AI models run compiled WebAssembly that is also bundled (`webllm/` and `ort/` in the package); only the model weights, which are data, are downloaded from Hugging Face when the user clicks Download in Settings.

**Content security policy** (new in 0.5.0, no field in the dashboard; for a reviewer who asks): `extension_pages` adds `'wasm-unsafe-eval'`, which only allows running the bundled WebAssembly of the in-browser models. It allows no `eval` and no remote scripts.

> The extension can run a small AI model on the user's device. Its runtime is WebAssembly bundled in the package, which Manifest V3 runs only with 'wasm-unsafe-eval'. No code is downloaded at runtime; model weights (data) are downloaded from Hugging Face only when the user clicks Download in Settings, and can be deleted there.

**Data usage**: check what the extension handles. Content goes only to the AI provider the user configured, at the user's request:

- [x] **Website content**: the text of the page, selection, pasted text or file the user asks to summarize, sent to the user's chosen AI provider (or processed on the device by an in-browser model, sent nowhere).
- [x] **Authentication information**: the user's own API key, stored locally and sent only to their chosen provider as authentication.
- [ ] Everything else (personally identifiable information, health, financial, personal communications, location, web history, user activity): not collected.

Certify all three statements:

- I do not sell or transfer user data to third parties, apart from the approved use cases
- I do not use or transfer user data for purposes that are unrelated to my item's single purpose
- I do not use or transfer user data to determine creditworthiness or for lending purposes

Content sent to the provider the user configured is the item's single purpose (summarizing at the user's request), which the limited-use policy allows. Describe this in the policy, as done in the privacy policy below.

**Privacy policy URL**: `https://tamnt1707.github.io/siftlume/privacy.html`

## Distribution tab

- **Visibility**: start with **Unlisted** to test with a few people, then switch to **Public**.
- **Regions**: All regions.
- Consider unchecking "Publish automatically after review" to choose the release time (you then have 30 days).

## Test instructions (for the reviewer)

```
Siftlume needs an AI provider. Any of these works:

Option A, API key: open the extension's Settings (gear icon), choose OpenAI (or Anthropic / Google Gemini / OpenRouter), paste an API key, click "Load models", pick a model, then Save.

Option B, local model, no key: install Ollama (https://ollama.com), run `ollama pull llama3.2` and `ollama serve`, choose "Ollama (local)" in Settings, click Save, then pick the model.

Option C, model in the browser, no key and nothing to install (needs a computer with a recent GPU): choose "In-browser (Gemma, LFM)" in Settings, click Download next to LFM3 1.7B (about 1.1 GB, a few minutes), then Save. A summary takes about 20 seconds. Delete removes the model.

Then open any article (for example a Wikipedia page), click the Siftlume icon and "Summarize this page". Try the refine buttons (Shorter, Timeline…), ask a question in the box at the bottom, and the toolbar (Copy, Listen, Print). To summarize a file, click "Upload a file" in the popup or drop a PDF/CSV on the start screen.

Settings → Summary → "Show results in" switches between the side panel and a full-page tab.
```

If you provide a test API key, set a low spending limit on it and revoke it after review.
