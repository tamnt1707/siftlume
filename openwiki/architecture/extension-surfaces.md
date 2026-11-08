---
type: Architecture
title: Extension Surfaces and Routing
description: How a trigger becomes a rendered summary across the background service worker, context menus, toolbar action vs popup, full-page app tab, per-tab side panel and the options page — pending-request handoff, display-mode routing, side-panel lifecycle, URL routes, and the user-gesture invariant.
tags: [architecture, extension, routing, side-panel, background]
verified:
  - by: openwiki/0.8.0
    at: 2026-11-07T09:34:41.642Z
sources:
  - id: openwiki-source-7e3355f17b1feb4de5b7b2ce
    resource: repo://.output/chrome-mv3/manifest.json
  - id: openwiki-source-73b5356d2812920c745c9bc0
    resource: repo://components/SettingsForm.tsx
  - id: openwiki-source-f387604c5df6a923aa92fdd3
    resource: repo://components/SourcePicker.tsx
  - id: openwiki-source-bcf387a6a8a097456632fc07
    resource: repo://entrypoints/app/App.tsx
  - id: openwiki-source-c9a09d033d33f35c7f77404e
    resource: repo://entrypoints/app/main.tsx
  - id: openwiki-source-f7a24281a6b5103146379f37
    resource: repo://entrypoints/background.ts
  - id: openwiki-source-6d0cd898c8e6e2f9e9bab0ef
    resource: repo://entrypoints/options/OptionsApp.tsx
  - id: openwiki-source-cc2647d919da6467bbd4e6cb
    resource: repo://entrypoints/popup/Popup.tsx
  - id: openwiki-source-7ca0dfda383943bae04e75f3
    resource: repo://entrypoints/sidepanel/main.tsx
  - id: openwiki-source-3044b6aba8672ca1bfcf69c6
    resource: repo://lib/context-menus.ts
  - id: openwiki-source-8fc820fe296baa60761c2279
    resource: repo://lib/openui.ts
  - id: openwiki-source-ee01d5b2d861717def31ac4c
    resource: repo://lib/pending.ts
  - id: openwiki-source-3823e904eb7ad607af5f3f70
    resource: repo://lib/settings.ts
  - id: openwiki-source-43b2056f6f0deea7bca50189
    resource: repo://public/_locales/en/messages.json
  - id: openwiki-source-49ce5f922c6d8903f5e7d073
    resource: repo://wxt.config.ts
generated: { by: "openwiki/0.8.0", at: "2026-11-07T09:34:41.642Z" }
---

# Extension Surfaces and Routing

The extension has six browser-facing surfaces. A trigger never summarizes anything itself: it
records a *pending request* and picks the surface that will run it. The `display` setting
(`sidepanel` | `tab`) decides which surface that is, and the pending request itself is the only
thing that crosses the process boundary between the trigger and the surface.

## The surfaces

| Surface | Entry file | Role |
| --- | --- | --- |
| Background service worker | `entrypoints/background.ts` | Owns triggers, context-menu sync, side-panel lifecycle. Never renders or summarizes. |
| Context menus | `lib/context-menus.ts` | Two items whose ids encode the display mode. |
| Toolbar action / popup | `entrypoints/popup/Popup.tsx` | Launcher shown only in `tab` mode. |
| Full-page app tab | `entrypoints/app/App.tsx` (`surface="page"`) | The result view. |
| Per-tab side panel | `entrypoints/sidepanel/main.tsx` → `entrypoints/app/App.tsx` (`surface="panel"`) | The same result view, mounted in the panel. |
| Options page | `entrypoints/options/OptionsApp.tsx` | Settings; `browser.runtime.openOptionsPage()`. |

The app and the side panel share one React component. `App` takes a `surface` prop
(`'page' | 'panel'`) and branches on `isPanel`; `entrypoints/app/main.tsx` renders
`<App />` and `entrypoints/sidepanel/main.tsx` renders `<App surface="panel" />`.

## Flow: trigger → pending request → surface

```mermaid
flowchart TD
  CM["Context menu click"] --> D{"Display mode from menu id"}
  TC["Toolbar click in sidepanel mode"] --> SP0["openSidePanelForTab for the tab"]
  TB["Toolbar click in tab mode"] --> PU["Popup launcher"]
  PU --> Q["queueRequest in storage.session"]
  D -->|"tab"| Q
  D -->|"sidepanel"| SP["openSidePanelForTab in the gesture"]
  SP --> PS["sendToSidePanel: request and panelRequests entry"]
  Q --> OT["openApp: tabs.create app.html?request=id"]
  OT --> APP["App surface page: takeRequest once"]
  PS --> PAN["App surface panel: takePanelRequest and watch"]
  APP --> RUN["useSession: fromTab or fromText"]
  PAN --> RUN
```

Caption: how each trigger becomes a `PendingRequest` in `storage.session` and which surface
consumes it — the full-page tab or that tab's side panel.

## Pending requests

`lib/pending.ts` defines the handoff type:

```ts
export type PendingRequest =
  { type: 'tab'; tabId: number } |
  { type: 'text'; text: string; title?: string; url?: string; tabId?: number };
```

Requests live in `storage.session` under `session:requests` (memory only, cleared when the
browser closes) so that large pasted or selected text never has to travel in a URL.
`queueRequest()` returns a `crypto.randomUUID()` id and opportunistically drops entries older
than 10 minutes. `takeRequest(id)` returns the request **once** and removes it, so reloading the
result page does not re-run the summary (a missing id surfaces as the `requestExpired` error).

For side panels there is a second, tab-indexed map `session:panelRequests`
(`{ [tabId]: { id, at } }`) that points at a request id. `takePanelRequest(tabId)` consumes the
entry and only honours it for 60 seconds; `watchPanelRequests(tabId, cb)` notifies the panel when
a new request is addressed to its tab.

The 60-second window is the tighter of the two expiry rules, and it exists because a panel
request can be lost: `sendToSidePanel` writes the `session:panelRequests` entry *after* the
panel document has already been opened by `openSidePanelForTab`, so the panel may mount and
look for a request before the entry exists. The panel therefore polls once on mount and then
watches the storage item, and the short window stops a stale entry from being executed much
later. The 10-minute window applies to the request bodies themselves, which are only dropped
opportunistically — the next `queueRequest()` call garbage-collects entries older than
10 minutes.

## Trigger: the toolbar action versus the popup

The toolbar button is mode-dependent, and the mode is pushed to the browser at runtime:

- `tab` mode → `browser.action.setPopup({ popup: 'popup.html' })`; the icon opens the launcher.
- `sidepanel` mode → the popup is cleared (`popup: ''`), so clicking the icon fires
  `browser.action.onClicked` instead.

`syncAction()` is re-run whenever the display setting changes (`settingsItem.watch` compares
`next.display` to `prev.display`), so switching modes in Settings takes effect without a
browser restart. The popup is a pure launcher: it never streams a summary, because it closes on
blur. It offers "Summarize this page" (the active tab), a paste box, an upload button, and a
compact history list; each of those hands a request to a new tab and then closes itself.

### The manifest's `default_popup` versus the runtime behaviour

The **built** manifest (`.output/chrome-mv3/manifest.json`) ships `"action": { "default_popup":
"popup.html" }` — it is a static artefact and cannot know the user's display mode. The
mode-dependent behaviour is therefore produced at **runtime**: `entrypoints/background.ts` calls
`browser.action.setPopup({ popup: '' })` in `sidepanel` mode, which clears the manifest default
and makes the toolbar click fall through to `browser.action.onClicked`. Anyone reading only the
manifest would wrongly conclude the icon always opens the popup; the manifest value is the
`tab`-mode fallback until the background worker has run its first sync.

The `_execute_action` keyboard command (`Alt+Shift+S` by default) invokes the same action as a
toolbar click, so it inherits the same mode-dependent behaviour.

## Trigger: context menus

`lib/context-menus.ts` creates two items whose **ids encode the display mode**:

- `summarize-page:<display>` — context `page`
- `summarize-selection:<display>` — context `selection`

The id is the routing channel. The click handler must open the side panel *synchronously* inside
the user gesture, so it cannot first await the settings to learn the display mode; the mode is
read out of the id instead by `parseMenuId()`, which maps any unknown suffix to `tab` and any
unknown prefix to `page`.

Menu titles come from `browser.i18n.getMessage` (`public/_locales/<lang>/messages.json`) with an
English fallback. `syncContextMenus(display)` removes all items and recreates them, and the
calls are serialized on a module-level promise chain: `onInstalled` and startup can both trigger
a sync, and two overlapping `removeAll()` → `create()` runs would otherwise create duplicate ids.
`browser.runtime.lastError` from a duplicate id is swallowed rather than left unchecked.

Because a context-menu click grants `activeTab` on that tab, the panel or result page can read
the page afterwards without a separate permission prompt.

The click handler turns the menu click into a `PendingRequest`: a *selection* menu item with
non-empty `info.selectionText` becomes `{ type: 'text', text, title, url, tabId }`, everything
else becomes `{ type: 'tab', tabId }`. In `sidepanel` mode the request is handed to the tab's
panel via `sendToSidePanel(tabId, req, tab.url)`; in `tab` mode it is queued and a new app tab
is opened next to the source tab.

## Trigger: the background service worker

`entrypoints/background.ts` is the router. At startup it:

1. `browser.sidePanel.setPanelBehavior({ openPanelOnActionClick: false })` — the browser must not
   open the panel on its own, because the extension wants the toolbar click to grant `activeTab`.
2. `browser.sidePanel.setOptions({ enabled: false })` — the panel is off globally by default and
   enabled per tab.

It then syncs the menus and the action on `runtime.onInstalled`, `runtime.onStartup`, and on any
change of the `display` setting. On a fresh install it also opens the options page.

## Surface: the full-page app tab

`openApp(route, opener?)` creates a tab at `app.html?<query>` positioned next to the opener tab
(`index + 1`, with `openerTabId` and `windowId` carried over), so the summary opens beside the
page it came from.

The route is a query string, and the app surface understands three shapes:

| Route | Meaning |
| --- | --- |
| `?request=<id>` | Run a pending request (one-shot via `takeRequest`). |
| `?session=<id>` | Reopen a stored session from history. |
| `?view=new` | Empty start screen (source picker). |
| `?view=history` | History list. |

`App` replaces the query string in place (`history.replaceState`) as the user navigates, so a
refresh reopens the same view: while a session is open the URL becomes `?session=<id>`, and the
tab title becomes `<source title> | <app name>`. The initial route is consumed exactly once
(`routed.current`), and only after settings have loaded — the request needs the provider
configuration before it can run.

## Surface: the per-tab side panel

The panel belongs to a single tab and is scoped to it:

- `openSidePanelForTab(tabId)` calls `browser.sidePanel.setOptions({ tabId, path:
  'sidepanel.html?tab=<id>', enabled: true })` and then `browser.sidePanel.open({ tabId })`.
- The tab id travels to the panel in the panel's own query string, so the panel knows which tab
  it belongs to and can offer "Summarize this page" for it (`browser.tabs.get(panelTabId)`).
- The panel is enabled only for that tab; other tabs do not show it.

### How the panel receives a request

The panel has no push channel from the service worker. Instead, `App` in panel mode reads its
own `?tab=<id>` parameter and, once settings have loaded, does two things:

1. pulls once — `takePanelRequest(panelTabId)` — to catch a request that was queued before the
   panel finished mounting;
2. subscribes — `watchPanelRequests(panelTabId, pull)` — to catch every later request addressed
   to that tab.

Both paths end in the same `run()` callback, which turns a `PendingRequest` into
`ctrl.fromTab(tabId)` or `ctrl.fromText(...)`. A `null` request means the id expired or was
already consumed, and the surface shows the `requestExpired` error instead of running anything.

### Invariant: `sidePanel.open()` must stay in the user gesture

`browser.sidePanel.open()` only works while a user gesture is active. Therefore
`openSidePanelForTab` must be called **synchronously inside the click or context-menu handler,
with no `await` before it**. The background code comments this at both call sites
(`browser.action.onClicked` and `browser.contextMenus.onClicked`):

```ts
// Must be called before any await to keep the user gesture.
void openSidePanelForTab(tab.id).catch(console.error);
```

This is why the display mode is baked into the context-menu id and the action popup instead of
being read from storage at click time — reading settings would require an `await` and would
break the gesture. `openSidePanelForTab` is deliberately not `async`: it fires `setOptions`
without awaiting and returns the `open()` promise directly.

### Lifecycle: enabling, remembering, closing

The panel's URL is remembered per tab in `storage.session` under `session:panelUrls`
(`panelUrlsItem`), so the extension can tell whether the tab still shows the same document:

- `rememberPanelUrl(tabId, url)` records the URL the panel was opened for.
- `sameDocument(a, b)` compares URLs **without the fragment**, so clicking an in-page anchor
  keeps the panel open.
- `browser.tabs.onUpdated` → if the tab has a remembered URL and the new URL is a different
  document, `closeSidePanelForTab(tabId)` runs.
- `browser.tabs.onRemoved` → `closeSidePanelForTab(tabId)` runs.
- `closeSidePanelForTab` disables the panel for that tab (`setOptions({ tabId, enabled: false })`,
  which also closes it) and forgets the remembered URL.

The panel also refreshes its "Summarize this page" target on `tabs.onUpdated` for its own tab,
so a title change or navigation updates the button label.

## Panel versus page behaviour inside the shared App

Both surfaces run the same `useSession` controller, but differ in a few deliberate ways:

- Routing is page-only. `setRoute` is a no-op in the panel (`!isPanel && setRoute(params)`), so
  the panel's URL stays `sidepanel.html?tab=<id>`.
- The panel ignores `?request`, `?session` and `?view`; it only reads `?tab`.
- The panel has its own start screen: `SourcePicker` receives the panel's tab as `page`, so the
  panel can summarize its own tab directly, whereas the full-page tab relies on the popup or
  context menu to supply a source.
- A panel shows **only** that tab's summaries. Opening a history entry whose
  `source.tabId` differs from the panel's tab opens a full-page tab instead
  (`openApp({ session: s.id })`).
- The panel offers an "expand" affordance (`onExpand`) that reopens the current session in a
  full-page tab.
- Layout differs: `SessionView` renders `layout="panel"` (single narrow column) or
  `layout="page"`, and the prompt layout rule in `lib/openui.ts` is chosen by
  `settings.display` (`LAYOUT_RULES.tab` vs `LAYOUT_RULES.sidepanel`), so the generated UI is
  shaped for the surface it will be shown in.

## Settings that change routing

`Settings.display` (`DisplayMode = 'sidepanel' | 'tab'`) is persisted in `local:settings` and
edited in Settings → Summary → "Show results in". `normalizeSettings()` falls back to the
default (`sidepanel`) for any unknown value. The same value drives three things at once:

1. which context-menu ids are created,
2. whether the toolbar icon opens the popup or the panel,
3. the layout rule sent to the model.

## Related pages

- [Architecture Overview](overview.md)
<!-- openwiki: broken internal link [storage-and-state.md] file "storage-and-state.md" does not exist. Fix the href or restore the target, then delete this comment. -->
- [Storage and Session State](storage-and-state.md)
- [Permissions and Privacy](../operations/permissions-and-privacy.md)
- [Summary Generation](../workflows/summary-generation.md)
