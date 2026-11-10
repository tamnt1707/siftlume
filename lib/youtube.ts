import { browser } from '#imports';
import { t } from '@/lib/i18n';
import type { ExtractedSource } from './extractors';

/**
 * YouTube videos are summarized from their captions. Everything runs inside the watch page (the
 * MAIN world), so requests carry the user's own YouTube session, exactly as the page's own
 * "Show transcript" button does. Nothing goes through a third-party server.
 */

/** Video id of a YouTube watch, Shorts or live URL, or null for any other page. */
export function youTubeVideoId(url?: string): string | null {
  if (!url) return null;
  try {
    const u = new URL(url);
    if (!/(^|\.)youtube\.com$/.test(u.hostname)) return null;
    if (u.pathname === '/watch') return u.searchParams.get('v');
    return u.pathname.match(/^\/(?:shorts|live|embed)\/([\w-]{11})/)?.[1] ?? null;
  } catch {
    return null;
  }
}

export interface CaptionInfo {
  /** Language of the track the transcript comes from, as YouTube names it ("English (auto-generated)"). */
  label: string;
  auto: boolean;
}

/** What the page reports before reading: captions available or not. */
export type VideoProbe = { captions: CaptionInfo | null; live: boolean };

interface Segment {
  /** Start, in seconds. */
  start: number;
  text: string;
}

interface PageResult {
  videoId: string;
  title?: string;
  channel?: string;
  seconds?: number;
  live?: boolean;
  captions: CaptionInfo | null;
  /** Unset when only probing. */
  segments?: Segment[];
  /** Which method produced the segments, for debugging. */
  via?: string;
}

/**
 * Runs in the YouTube page (MAIN world). Must be self-contained: it is serialized by
 * chrome.scripting. Reads the player's own data, then fetches the transcript three ways, each a
 * fallback for the one before, so one YouTube change does not break the feature:
 * 1. the caption track URL, 2. the endpoint behind "Show transcript", 3. that panel's DOM.
 */
async function readVideoInPage(read: boolean): Promise<PageResult | null> {
  type Track = {
    baseUrl: string;
    languageCode: string;
    kind?: string;
    name?: { simpleText?: string; runs?: { text: string }[] };
  };
  type PlayerResponse = {
    videoDetails?: {
      videoId?: string;
      title?: string;
      author?: string;
      lengthSeconds?: string;
      isLive?: boolean;
      isLiveContent?: boolean;
    };
    captions?: { playerCaptionsTracklistRenderer?: { captionTracks?: Track[] } };
  };
  const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
  const parseTime = (s: string) => s.split(':').reduce((acc, p) => acc * 60 + Number(p), 0);

  const url = new URL(location.href);
  const videoId =
    url.pathname === '/watch'
      ? url.searchParams.get('v')
      : url.pathname.match(/^\/(?:shorts|live|embed)\/([\w-]{11})/)?.[1];
  if (!videoId) return null;

  // YouTube navigates without reloading: the player knows the current video, the inline
  // ytInitialPlayerResponse may still describe the first one.
  const players = document.querySelectorAll<HTMLElement & { getPlayerResponse?: () => PlayerResponse }>(
    '#movie_player, #shorts-player, .html5-video-player',
  );
  let pr: PlayerResponse | undefined;
  for (const p of players) {
    const r = p.getPlayerResponse?.();
    if (r?.videoDetails?.videoId === videoId) pr = r;
  }
  const initial = (window as unknown as { ytInitialPlayerResponse?: PlayerResponse }).ytInitialPlayerResponse;
  if (!pr && initial?.videoDetails?.videoId === videoId) pr = initial;

  const tracks = pr?.captions?.playerCaptionsTracklistRenderer?.captionTracks ?? [];
  // Prefer captions written by people over automatic ones, in the order YouTube lists them.
  const track = tracks.find((tr) => tr.kind !== 'asr') ?? tracks[0];
  const name = track?.name?.simpleText ?? track?.name?.runs?.map((r) => r.text).join('') ?? track?.languageCode ?? '';
  const details = pr?.videoDetails;
  const result: PageResult = {
    videoId,
    title: details?.title,
    channel: details?.author,
    seconds: details?.lengthSeconds ? Number(details.lengthSeconds) : undefined,
    live: Boolean(details?.isLive),
    // Without player data (some Shorts) captions are unknown: try reading anyway.
    captions: track ? { label: name, auto: track.kind === 'asr' } : pr ? null : { label: '', auto: true },
  };
  if (!read || !result.captions) return result;

  const clean = (s: string) => s.replace(/\s+/g, ' ').trim();

  // 1. The caption track itself. Often empty now unless the player adds its own token.
  if (track) {
    try {
      const res = await fetch(`${track.baseUrl}&fmt=json3`);
      const body = res.ok ? await res.text() : '';
      if (body) {
        const data = JSON.parse(body) as { events?: { tStartMs?: number; segs?: { utf8?: string }[] }[] };
        const segments = (data.events ?? [])
          .filter((e) => e.segs)
          .map((e) => ({ start: (e.tStartMs ?? 0) / 1000, text: clean(e.segs!.map((s) => s.utf8 ?? '').join('')) }))
          .filter((s) => s.text);
        if (segments.length) return { ...result, segments, via: 'timedtext' };
      }
    } catch {
      /* next method */
    }
  }

  // 2. The endpoint the "Show transcript" panel calls (params: protobuf { 1: videoId, 3: 2 }).
  const cfg = (window as unknown as { ytcfg?: { get: (k: string) => unknown } }).ytcfg;
  if (cfg) {
    try {
      const id = new TextEncoder().encode(videoId);
      const inner = [0x0a, id.length, ...id, 0x18, 0x02];
      const params = btoa(String.fromCharCode(0xaa, 0x09, inner.length, ...inner));
      const res = await fetch('/youtubei/v1/get_panel?prettyPrint=false', {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          'X-Youtube-Client-Name': '1',
          'X-Youtube-Client-Version': String(cfg.get('INNERTUBE_CLIENT_VERSION') ?? ''),
          'X-Goog-Visitor-Id': String(cfg.get('VISITOR_DATA') ?? ''),
        },
        body: JSON.stringify({ context: cfg.get('INNERTUBE_CONTEXT'), panelId: 'PAmodern_transcript_view', params }),
      });
      if (res.ok) {
        const segments: Segment[] = [];
        const walk = (o: unknown) => {
          if (!o || typeof o !== 'object') return;
          const seg = (o as { transcriptSegmentViewModel?: { timestamp?: string; simpleText?: string } })
            .transcriptSegmentViewModel;
          if (seg?.timestamp && seg.simpleText)
            segments.push({ start: parseTime(seg.timestamp), text: clean(seg.simpleText) });
          else for (const v of Object.values(o)) walk(v);
        };
        walk(await res.json());
        if (segments.length) return { ...result, segments, via: 'panel-api' };
      }
    } catch {
      /* next method */
    }
  }

  // 3. Open the transcript panel the way a person would and read it.
  try {
    const panel = () =>
      document.querySelector<HTMLElement>('ytd-engagement-panel-section-list-renderer[target-id*="transcript"]');
    const rows = () => [
      ...(panel()?.querySelectorAll<HTMLElement>('transcript-segment-view-model, ytd-transcript-segment-renderer') ??
        []),
    ];
    const wasOpen = panel()?.getAttribute('visibility') === 'ENGAGEMENT_PANEL_VISIBILITY_EXPANDED';
    if (!rows().length) {
      document.querySelector<HTMLElement>('#description-inline-expander #expand')?.click();
      await sleep(300);
      document.querySelector<HTMLElement>('ytd-video-description-transcript-section-renderer button')?.click();
      for (let i = 0; i < 25 && !rows().length; i++) await sleep(200);
    }
    const segments = rows()
      .map((row) => {
        const lines = row.innerText.split('\n').map(clean).filter(Boolean);
        const stamp = lines.find((l) => /^\d+(:\d\d)+$/.test(l));
        // The rest are the spoken text and an accessibility label ("18 seconds").
        const text = lines.filter((l) => l !== stamp).at(-1) ?? '';
        return stamp ? { start: parseTime(stamp), text } : null;
      })
      .filter((s): s is Segment => Boolean(s?.text));
    if (!wasOpen)
      panel()?.querySelector<HTMLElement>('#visibility-button button, button[aria-label="Close transcript"]')?.click();
    if (segments.length) return { ...result, segments, via: 'panel-dom' };
  } catch {
    /* fall through */
  }
  return { ...result, segments: [] };
}

async function runInPage(tabId: number, read: boolean) {
  const [injection] = await browser.scripting.executeScript({
    target: { tabId },
    world: 'MAIN',
    args: [read],
    func: readVideoInPage,
  });
  return (injection?.result ?? null) as PageResult | null;
}

/** Whether the video in a tab has captions. Null when the tab is not a readable YouTube video. */
export async function probeVideo(tabId: number): Promise<VideoProbe | null> {
  const r = await runInPage(tabId, false).catch(() => null);
  return r ? { captions: r.captions, live: Boolean(r.live) } : null;
}

export const formatTime = (sec: number) => {
  const s = Math.floor(sec);
  const hms = [Math.floor(s / 3600), Math.floor((s % 3600) / 60), s % 60];
  const [h, m, ss] = hms.map((n) => String(n).padStart(2, '0'));
  return hms[0] ? `${hms[0]}:${m}:${ss}` : `${hms[1]}:${ss}`;
};

/**
 * Joins caption lines into paragraphs of about 30 seconds, each led by its timestamp. Fewer
 * timestamps keep the prompt short; 30 s is still precise enough to jump to a moment.
 */
export function transcriptToText(segments: Segment[], every = 30) {
  const out: string[] = [];
  let start = -Infinity;
  let words: string[] = [];
  const flush = () => words.length && out.push(`[${formatTime(start)}] ${words.join(' ')}`);
  for (const seg of segments) {
    if (seg.start - start >= every) {
      flush();
      start = seg.start;
      words = [];
    }
    words.push(seg.text);
  }
  flush();
  return out.join('\n');
}

/** Reads a YouTube tab's transcript into a source the summarizer understands. */
export async function extractVideo(tabId: number, url: string): Promise<ExtractedSource & { tabId: number }> {
  let r: PageResult | null;
  try {
    r = await runInPage(tabId, true);
  } catch {
    throw new Error(t('errors:page.noAccess'));
  }
  if (!r) throw new Error(t('errors:video.notVideo'));
  if (r.live) throw new Error(t('errors:video.live'));
  if (!r.captions) throw new Error(t('errors:video.noCaptions'));
  if (!r.segments?.length) throw new Error(t('errors:video.transcriptFailed'));

  const header = [
    r.channel ? `Channel: ${r.channel}` : '',
    r.seconds ? `Duration: ${formatTime(r.seconds)}` : '',
    r.captions.label ? `Captions: ${r.captions.label}${r.captions.auto ? ' (automatic speech recognition)' : ''}` : '',
  ].filter(Boolean);
  return {
    kind: 'video',
    title: r.title || url,
    origin: url,
    content: `${header.join('\n')}\n\nTranscript:\n${transcriptToText(r.segments)}`,
    tabId,
  };
}

/** Seconds of the timestamped transcript paragraph that contains `quote`, or of a "m:ss" text. */
export function findMoment(transcript: string, quote: string): number | null {
  const direct = quote.trim().match(/^\[?(\d+(?::\d\d){1,2})\]?$/);
  const toSec = (s: string) => s.split(':').reduce((a, p) => a * 60 + Number(p), 0);
  if (direct) return toSec(direct[1]!);
  const norm = (s: string) => s.replace(/\s+/g, ' ').trim().toLowerCase();
  const words = norm(quote).split(' ');
  // Full quote, then shorter openings (the model may stitch two caption lines or trim the end).
  const tries = [words.join(' '), words.slice(0, 8).join(' '), words.slice(0, 4).join(' ')].filter(Boolean);
  const lines = transcript.split('\n');
  for (const needle of tries) {
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]!;
      const stamp = line.match(/^\[(\d+(?::\d\d){1,2})\]/)?.[1];
      // A quote may run across two paragraphs: check this line joined with the next.
      const hay = norm(`${line} ${lines[i + 1]?.replace(/^\[[\d:]+\]\s*/, '') ?? ''}`);
      if (stamp && hay.includes(needle)) return toSec(stamp);
    }
  }
  return null;
}

/** Jumps the video in a tab to `seconds` and plays it. */
export async function seekVideo(tabId: number, seconds: number) {
  const [injection] = await browser.scripting.executeScript({
    target: { tabId },
    world: 'MAIN',
    args: [seconds],
    func: (s: number) => {
      const player = document.querySelector<
        HTMLElement & { seekTo?: (s: number, allow: boolean) => void; playVideo?: () => void }
      >('#movie_player, #shorts-player');
      if (player?.seekTo) {
        player.seekTo(s, true);
        player.playVideo?.();
        return true;
      }
      const video = document.querySelector('video');
      if (!video) return false;
      video.currentTime = s;
      void video.play().catch(() => {});
      return true;
    },
  });
  return Boolean(injection?.result);
}
