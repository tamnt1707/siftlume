import { browser, storage } from '#imports';
import { t } from '@/lib/i18n';
import type { ExtractedSource } from './extractors';
import { clock, speakers, transcript, transcriptText, type CaptionBlock } from './meet-transcript';

/**
 * Google Meet meetings, summarized from Meet's own live captions (speaker names, any language Meet
 * captions). Recording starts when the user clicks Start in the side panel: activeTab lets the
 * extension inject the recorder into that tab, so no permission is added.
 *
 * The recorder runs in the tab's isolated world and writes what it sees to storage (key
 * `meet:<tabId>`), so the transcript survives the side panel closing. A debug log of the caption
 * area's DOM changes (`meet:<tabId>:log`) can be exported to build test fixtures and to fix the
 * selectors when Meet changes its page.
 */

export const MEET_URL = /^https:\/\/meet\.google\.com\/[a-z]{3,4}-[a-z]{4}-[a-z]{3,4}(?:[/?#]|$)/;
export const isMeetUrl = (url?: string) => Boolean(url && MEET_URL.test(url));

export type MeetStatus = 'recording' | 'stopped' | 'ended';

export interface MeetRecording {
  status: MeetStatus;
  title: string;
  url: string;
  startedAt: number;
  updatedAt: number;
  blocks: CaptionBlock[];
  /** Whether the caption area was found (captions are on). */
  captions: boolean;
  /** Whether the call controls are on screen (joined, not in the lobby). */
  inCall: boolean;
}

export const recordingItem = (tabId: number) =>
  storage.defineItem<MeetRecording | null>(`local:meet:${tabId}`, { fallback: null });
export const recordingLogItem = (tabId: number) =>
  storage.defineItem<unknown[] | null>(`local:meet:${tabId}:log`, { fallback: null });

/**
 * Runs in the Meet tab (isolated world). Self-contained: chrome.scripting serializes it.
 * "start" installs the recorder (once per page), turns captions on if they are off, and resolves
 * after a short wait with whether captions were found. "stop" disconnects it.
 */
async function recorderInPage(key: string, command: 'start' | 'stop') {
  type Block = { id: number; speaker: string; versions: string[]; start: number; end: number };
  type Recorder = { stop: () => void; captions: () => boolean; inCall: () => boolean };
  const w = window as unknown as { __siftlumeMeet?: Recorder };
  const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

  if (command === 'stop') {
    w.__siftlumeMeet?.stop();
    delete w.__siftlumeMeet;
    return { captions: false, inCall: false };
  }
  if (w.__siftlumeMeet) return { captions: w.__siftlumeMeet.captions(), inCall: w.__siftlumeMeet.inCall() };

  const t0 = Date.now();
  const blocks: Block[] = [];
  const byElement = new WeakMap<Element, Block>();
  const log: unknown[] = [];
  const MAX_LOG = 6000;
  const CAPTION_LABEL = /caption|subtit|phụ đề|字幕|자막|untertitel|sous-titre|legenda|субтитр|คำบรรยาย|leyenda/i;
  const LEAVE_LABEL =
    /leave call|end call|rời khỏi cuộc gọi|kết thúc cuộc gọi|verlassen|quitter|salir|sair|покинуть|退出|나가기|ออกจากสาย/i;
  // Known homes of the captions; the labelled region is the most stable. The debug log shows
  // what matched (or what changed on the page when nothing did).
  const ROOT_SELECTORS = ['div[jsname="dsyhDe"]', '.a4cQT', 'div[jsname="YSxPC"]'];

  const describe = (el: Element | null, depth = 5) => {
    const parts: string[] = [];
    for (let e = el; e && e !== document.body && parts.length < depth; e = e.parentElement) {
      const attrs = ['role', 'aria-label', 'jsname', 'jscontroller']
        .map((a) => (e!.getAttribute(a) ? `[${a}="${e!.getAttribute(a)!.slice(0, 40)}"]` : ''))
        .join('');
      const cls = e.classList.length ? `.${[...e.classList].slice(0, 3).join('.')}` : '';
      parts.unshift(`${e.tagName.toLowerCase()}${cls}${attrs}`);
    }
    return parts.join(' > ');
  };
  const push = (entry: Record<string, unknown>) => {
    if (log.length < MAX_LOG) log.push({ t: Date.now() - t0, ...entry });
  };

  let rootSelector = '';
  const findRoot = (): Element | null => {
    for (const sel of ROOT_SELECTORS) {
      const el = document.querySelector(sel);
      if (el) return ((rootSelector = sel), el);
    }
    for (const el of document.querySelectorAll('[role="region"][aria-label]')) {
      if (CAPTION_LABEL.test(el.getAttribute('aria-label') ?? '')) return ((rootSelector = 'region'), el);
    }
    return null;
  };
  // Caption blocks: the deepest elements that read as two or more lines ("Name" then words).
  // A block that has only its name so far is skipped until words arrive.
  const lineCount = (e: Element) =>
    ((e as HTMLElement).innerText ?? '').split('\n').filter((s) => s.trim()).length;
  const blocksOf = (root: Element) => {
    const multi = [...root.querySelectorAll('*')].filter((e) => lineCount(e) >= 2);
    return multi.filter((e) => !multi.some((o) => o !== e && e.contains(o)));
  };
  // A block reads "Name\nwords"; a block without a name continues the last speaker.
  const read = (el: Element) => {
    const lines = ((el as HTMLElement).innerText ?? '')
      .split('\n')
      .map((s) => s.trim())
      .filter(Boolean);
    return lines.length >= 2
      ? { speaker: lines[0]!, text: lines.slice(1).join(' ') }
      : { speaker: '', text: lines[0] ?? '' };
  };
  const sameHead = (a: string, b: string) => {
    const n = Math.min(24, Math.floor(Math.min(a.length, b.length) / 2));
    return n >= 6 && a.slice(0, n) === b.slice(0, n);
  };

  let root: Element | null = null;
  let rootLogged = false;
  const scan = () => {
    root = findRoot();
    if (!root) return;
    if (!rootLogged) {
      rootLogged = true;
      push({ kind: 'root', selector: rootSelector, path: describe(root, 8), html: root.outerHTML.slice(0, 40_000) });
    }
    const now = Date.now() - t0;
    for (const el of blocksOf(root)) {
      const { speaker, text } = read(el);
      if (!text) continue;
      let block = byElement.get(el);
      if (!block) {
        block = { id: blocks.length, speaker, versions: [text], start: now, end: now };
        byElement.set(el, block);
        blocks.push(block);
        continue;
      }
      const last = block.versions[block.versions.length - 1]!;
      if (text !== last) {
        // Growth, a trimmed end or a rewrite replaces the last text; anything else (old words
        // scrolled out of the top) is kept as a new version to join later.
        if (text.startsWith(last) || last.startsWith(text) || sameHead(last, text))
          block.versions[block.versions.length - 1] = text;
        else block.versions.push(text);
      }
      if (speaker && !block.speaker) block.speaker = speaker;
      block.end = now;
    }
  };

  let wasInCall = false;
  let outSince = 0;
  let status: 'recording' | 'stopped' | 'ended' = 'recording';
  const inCall = () =>
    [...document.querySelectorAll('button')].some(
      (b) => LEAVE_LABEL.test(b.getAttribute('aria-label') ?? '') || (b.textContent ?? '').includes('call_end'),
    );

  const save = async (final = false) => {
    const state = {
      status,
      title: document.title.replace(/^Meet\s*[–-]\s*/i, '').trim() || 'Google Meet',
      url: location.href.split('?')[0],
      startedAt: t0,
      updatedAt: Date.now(),
      blocks,
      captions: Boolean(root),
      inCall: wasInCall && !outSince,
    };
    try {
      await chrome.storage.local.set(final ? { [key]: state, [`${key}:log`]: log } : { [key]: state });
    } catch {
      // The extension was reloaded: this recorder is orphaned.
      stop();
    }
  };

  let pending = 0;
  const observer = new MutationObserver((records) => {
    for (const r of records) {
      const target = r.target.nodeType === 1 ? (r.target as Element) : r.target.parentElement;
      if (!target) continue;
      const inside = root?.contains(target);
      // Inside the captions: every change. Before they are found: text changes anywhere, to
      // locate them from the log.
      if (!inside && root) continue;
      const text =
        r.type === 'characterData'
          ? (r.target.textContent ?? '')
          : [...r.addedNodes].map((n) => n.textContent ?? '').join(' ');
      if (!text.trim() || (!inside && text.length > 400)) continue;
      push({ kind: r.type, path: describe(target, inside ? 4 : 6), text: text.slice(0, 300) });
    }
    if (!pending) pending = window.setTimeout(() => ((pending = 0), scan()), 250);
  });
  observer.observe(document.body, { childList: true, characterData: true, subtree: true });

  const tick = window.setInterval(() => {
    scan();
    const now = inCall();
    if (now) {
      wasInCall = true;
      outSince = 0;
    } else if (wasInCall && !outSince) outSince = Date.now();
    // The call controls gone for 5 s after being there: the meeting ended for this user.
    if (outSince && Date.now() - outSince > 5_000 && status === 'recording') {
      status = 'ended';
      push({ kind: 'ended' });
      stop(false);
      void save(true);
      return;
    }
    void save();
  }, 1_500);
  const logTick = window.setInterval(
    () => void chrome.storage.local.set({ [`${key}:log`]: log }).catch(() => {}),
    5_000,
  );
  const onHide = () => {
    status = 'ended';
    void save(true);
  };
  window.addEventListener('pagehide', onHide);

  function stop(mark = true) {
    observer.disconnect();
    clearInterval(tick);
    clearInterval(logTick);
    window.removeEventListener('pagehide', onHide);
    if (mark && status === 'recording') {
      status = 'stopped';
      scan();
      void save(true);
    }
  }
  w.__siftlumeMeet = { stop: () => stop(), captions: () => Boolean(root), inCall };

  // Captions off: press the CC button (found by its label or its Material icon).
  scan();
  if (!root) {
    const cc = [...document.querySelectorAll('button')].find(
      (b) => CAPTION_LABEL.test(b.getAttribute('aria-label') ?? '') || /closed_caption/.test(b.textContent ?? ''),
    );
    if (cc && cc.getAttribute('aria-pressed') !== 'true') {
      cc.click();
      push({ kind: 'action', what: 'clicked captions button', path: describe(cc) });
    } else push({ kind: 'action', what: cc ? 'captions button already on' : 'no captions button found' });
    await sleep(2_500);
    scan();
  }
  wasInCall = inCall();
  await save();
  return { captions: Boolean(root), inCall: wasInCall };
}

async function run(tabId: number, command: 'start' | 'stop') {
  try {
    const [injection] = await browser.scripting.executeScript({
      target: { tabId },
      func: recorderInPage,
      args: [`meet:${tabId}`, command],
    });
    return injection?.result as { captions: boolean; inCall: boolean } | undefined;
  } catch {
    throw new Error(t('errors:page.noAccess'));
  }
}

export const startRecording = (tabId: number) => run(tabId, 'start');
export const stopRecording = (tabId: number) => run(tabId, 'stop');

/** A recording as a source to summarize: header, then "[m:ss] Name: words" per turn. */
export function meetingSource(rec: MeetRecording, tabId?: number): ExtractedSource & { tabId?: number } {
  const lines = transcript(rec.blocks);
  const date = new Date(rec.startedAt);
  const duration = clock(rec.updatedAt - rec.startedAt);
  const who = speakers(lines);
  const header = [
    `Meeting: ${rec.title}`,
    `Date: ${date.toLocaleString()} · Duration: ${duration} · Speakers (${who.length}): ${who.join(', ')}`,
    'Transcript from live captions: automatic, so words and names may be misheard.',
  ].join('\n');
  return {
    kind: 'meeting',
    title: `${rec.title} · ${date.toLocaleDateString()}`,
    origin: rec.url,
    content: `${header}\n\n${transcriptText(lines)}`,
    tabId,
  };
}
