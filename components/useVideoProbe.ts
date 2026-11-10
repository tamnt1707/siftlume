import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { probeVideo, youTubeVideoId, type VideoProbe } from '@/lib/youtube';

/**
 * For a YouTube tab, checks before running whether the video has captions, so the start button
 * can say which captions it will read, or why it cannot summarize this video.
 * `blocked` is a reason not to run; `note` describes the captions. Both are unset for other pages.
 */
export function useVideoProbe(tabId?: number, url?: string) {
  const { t } = useTranslation('picker');
  const videoId = youTubeVideoId(url);
  const [probe, setProbe] = useState<VideoProbe | null>(null);

  useEffect(() => {
    setProbe(null);
    if (!tabId || !videoId) return;
    let live = true;
    void probeVideo(tabId).then((p) => live && setProbe(p));
    return () => {
      live = false;
    };
  }, [tabId, videoId]);

  if (!videoId || !probe) return { isVideo: Boolean(videoId) };
  if (probe.live) return { isVideo: true, blocked: t('video.live') };
  if (!probe.captions) return { isVideo: true, blocked: t('video.noCaptions') };
  const { label, auto } = probe.captions;
  return {
    isVideo: true,
    note: label
      ? t(auto ? 'video.autoCaptions' : 'video.captions', { label: label.replace(/\s*\(.*\)$/, '') })
      : undefined,
  };
}
