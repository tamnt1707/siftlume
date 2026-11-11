---
title: Siftlume privacy policy
permalink: /privacy.html
---

# Siftlume privacy policy

_Last updated: November 11, 2026_

Siftlume is a browser extension that summarizes the page you are reading, text you paste, or a file you choose, using an AI provider that **you** configure with **your own** API key. Siftlume has no server of its own. This page explains what data the extension handles and where it goes.

## Summary

- Siftlume does not collect, sell or share your data, and it has no analytics or tracking.
- Content is sent only to the AI provider you configured, and only when you ask for a summary or ask a question.
- Your API keys, settings and history stay in your browser.

## What Siftlume handles

| Data                                                                    | When                                                                                    | Where it goes                                                                                                                                                                  |
| ----------------------------------------------------------------------- | --------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Text of the page you summarize (or the selection, pasted text, or file) | Only when you click Summarize, use the context menu, refine a summary or ask a question | Sent directly from your browser to the AI provider you selected (for example OpenAI, Anthropic, Google, OpenRouter, or a local server such as Ollama). Not sent anywhere else. |
| Your questions about the content                                        | When you ask them                                                                       | Sent to the same AI provider, together with the content they refer to.                                                                                                         |
| API keys and settings                                                   | When you save Settings                                                                  | Stored only in your browser (`chrome.storage.local`). Never synced to your Google account and never sent anywhere except as authentication to the provider you selected.       |
| Summary history                                                         | After each summary                                                                      | Stored only in your browser (`chrome.storage.local`). You can delete items at any time; uninstalling the extension removes them.                                               |

Siftlume does not read pages in the background. It reads a page only after you click the extension icon or use its context menu on that page, or after you pick it in "Combine open tabs". For YouTube videos it reads the captions from the video page you are on. With "Deep read" it also reads the links you pick from a summarized page: each is downloaded without your cookies, and one that cannot be downloaded is opened in a background tab, read and closed.

## Third-party AI providers

When you summarize content, it is processed by the AI provider you chose, under that provider's own terms and privacy policy. Review your provider's policies to understand how they handle requests. If you use a local model (for example Ollama or LM Studio), the content never leaves your computer.

## Models that run in the browser

Siftlume can also run a small AI model (Gemma or Qwen) inside your browser, on your computer's graphics chip. You download it from Settings with a click: the model files come from Hugging Face (huggingface.co) and are kept in the browser's storage for the extension until you delete them in Settings or uninstall the extension. Downloading sends Hugging Face an ordinary file request, with no content you read. When you use these models, what you summarize and ask is processed on your computer and never sent anywhere.

## Permissions

| Permission                            | Why Siftlume needs it                                                                                                                                                                                                                                                                                                                                                                                 |
| ------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `activeTab`, `scripting`              | Read the text of the tab where you clicked the icon or used the context menu, and highlight a quoted passage in it when you ask.                                                                                                                                                                                                                                                                      |
| `sidePanel`                           | Show summaries in the side panel next to the page.                                                                                                                                                                                                                                                                                                                                                    |
| `contextMenus`                        | Add "Summarize this page" and "Summarize selection" to the right-click menu.                                                                                                                                                                                                                                                                                                                          |
| `storage`, `unlimitedStorage`         | Keep your settings and summary history in your browser, including data from CSV files you summarize.                                                                                                                                                                                                                                                                                                  |
| `declarativeNetRequestWithHostAccess` | Let requests from the extension reach a local AI server (such as Ollama) that would otherwise reject the extension's origin. It only applies to the extension's own requests to servers you granted.                                                                                                                                                                                                  |
| `favicon`                             | Show the website's icon next to a summary.                                                                                                                                                                                                                                                                                                                                                            |
| `clipboardWrite`                      | Copy a summary or a quote when you click Copy.                                                                                                                                                                                                                                                                                                                                                        |
| Optional `tabs`                       | Requested only when you choose "Combine open tabs", to list the tabs in the current window so you can pick which ones to summarize together.                                                                                                                                                                                                                                                          |
| Optional host access                  | Requested only when you save Settings, for the domain of the AI provider you configured, when you combine tabs, for the sites of the tabs you picked, and when you use Deep read: for the sites of the links you picked, or once for all sites when you turn on Deep read before summarizing (the links are only known after the page is read). Pages are still read only when you ask for a summary. |

## Children

Siftlume is not directed to children under 13 and does not knowingly collect information from them.

## Changes

If this policy changes, the new version will be published at this address with a new date.

## Contact

Questions or concerns: open an issue at [github.com/tamnt1707/siftlume/issues](https://github.com/tamnt1707/siftlume/issues).
