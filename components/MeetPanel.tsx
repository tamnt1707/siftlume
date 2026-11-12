import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Download04Icon, RecordIcon, SparklesIcon, StopIcon } from '@hugeicons/core-free-icons';
import { Icon } from './Icon';
import type { SessionController } from './useSession';
import type { ModeId } from '@/lib/modes';
import {
  meetingSource,
  recordingItem,
  recordingLogItem,
  startRecording,
  stopRecording,
  type MeetRecording,
} from '@/lib/meet';
import { clock, speakers, transcript } from '@/lib/meet-transcript';
import { describeError } from '@/lib/llm';

/**
 * Start screen on a Google Meet tab (side panel): record the meeting's live captions, watch the
 * transcript grow, and summarize it so far or when it ends. Recording lives in the tab
 * (lib/meet.ts), so closing the panel does not stop it.
 */
export function MeetPanel({ tabId, ctrl, mode }: { tabId: number; ctrl: SessionController; mode: ModeId }) {
  const { t } = useTranslation('picker');
  const [rec, setRec] = useState<MeetRecording | null>(null);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const autoSummarized = useRef<number | null>(null);
  const listRef = useRef<HTMLOListElement>(null);
  const busy = ctrl.phase !== 'idle';

  useEffect(() => {
    const item = recordingItem(tabId);
    void item.getValue().then(setRec);
    return item.watch(setRec);
  }, [tabId]);

  const lines = useMemo(() => (rec ? transcript(rec.blocks) : []), [rec]);
  const recording = rec?.status === 'recording';
  const hasPrevious = Boolean(rec) && !recording && lines.length > 0;

  // Follow the newest line while recording.
  useEffect(() => {
    if (recording) listRef.current?.lastElementChild?.scrollIntoView({ block: 'nearest' });
  }, [recording, lines.length, lines[lines.length - 1]?.text]);

  const summarize = (r: MeetRecording) => {
    if (!transcript(r.blocks).length) return setError(t('meet.empty'));
    void ctrl.fromSource(meetingSource(r, tabId), mode);
  };

  // The meeting ended while the panel was open: summarize it once.
  useEffect(() => {
    if (rec?.status !== 'ended' || autoSummarized.current === rec.startedAt || busy) return;
    autoSummarized.current = rec.startedAt;
    if (transcript(rec.blocks).length) summarize(rec);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rec?.status, rec?.startedAt]);

  const start = async () => {
    setError(null);
    setStarting(true);
    try {
      // A new recording replaces the previous one of this tab.
      if (rec && rec.status !== 'recording') await recordingItem(tabId).removeValue();
      await startRecording(tabId);
    } catch (e) {
      setError(describeError(e));
    } finally {
      setStarting(false);
    }
  };

  const stopAndSummarize = async () => {
    await stopRecording(tabId).catch(() => {});
    const latest = await recordingItem(tabId).getValue();
    if (latest) summarize(latest);
  };

  const exportLog = async () => {
    const log = await recordingLogItem(tabId).getValue();
    const blob = new Blob([JSON.stringify({ version: 1, recording: rec, log }, null, 1)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `siftlume-meet-log-${new Date().toISOString().slice(0, 16).replace(/[:T]/g, '-')}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1_000);
  };

  const elapsed = rec ? clock(rec.updatedAt - rec.startedAt) : '0:00';

  return (
    <div className="meet">
      {/* Nothing recorded yet: recording is the one thing to do. */}
      {!recording && !hasPrevious && (
        <>
          <p className="hint">{t('meet.intro')}</p>
          <button className="btn btn--primary btn--hero" disabled={starting || busy} onClick={() => void start()}>
            <span className="btn__label">
              <Icon icon={RecordIcon} />
              {starting ? t('meet.starting') : t('meet.start')}
            </span>
          </button>
        </>
      )}

      {recording && (
        <div className="meet__status" role="status">
          <span className="meet__dot" aria-hidden="true" />
          <strong>{t('meet.recording')}</strong>
          <span className="muted">
            {elapsed} · {t('meet.speakers', { count: speakers(lines).length })}
          </span>
        </div>
      )}
      {recording && !rec.captions && <p className="hint hint--warn">{t('meet.noCaptions')}</p>}
      {recording && rec.captions && !rec.inCall && <p className="hint hint--warn">{t('meet.notInCall')}</p>}

      {rec && lines.length > 0 && (
        <ol className="meet__lines" ref={listRef} aria-live="off">
          {lines.slice(-40).map((l, i) => (
            <li key={`${l.start}-${i}`}>
              <span className="meet__time">{clock(l.start)}</span>
              <strong>{l.speaker}</strong>
              <span>{l.text}</span>
            </li>
          ))}
        </ol>
      )}

      {recording && (
        <div className="meet__actions">
          <button className="btn" disabled={busy || !lines.length} onClick={() => summarize(rec)}>
            <Icon icon={SparklesIcon} size={16} />
            {t('meet.summarizeNow')}
          </button>
          <button className="btn btn--primary" disabled={busy} onClick={() => void stopAndSummarize()}>
            <Icon icon={StopIcon} size={16} />
            {t('meet.stopAndSummarize')}
          </button>
        </div>
      )}

      {hasPrevious && rec && (
        <div className="meet__previous">
          <p className="hint">
            {rec.status === 'ended' ? t('meet.ended') : t('meet.previous')} · {elapsed} ·{' '}
            {t('meet.speakers', { count: speakers(lines).length })}
          </p>
          <div className="meet__actions">
            <button className="btn btn--primary" disabled={busy} onClick={() => summarize(rec)}>
              <Icon icon={SparklesIcon} size={16} />
              {t('meet.summarize')}
            </button>
            <button className="btn" onClick={() => void recordingItem(tabId).removeValue()}>
              {t('meet.discard')}
            </button>
          </div>
          {/* A recording to summarize comes first; recording again is the secondary choice. */}
          <button className="btn meet__again" disabled={starting || busy} onClick={() => void start()}>
            <Icon icon={RecordIcon} size={16} />
            {starting ? t('meet.starting') : t('meet.start')}
          </button>
        </div>
      )}

      {rec && (
        <button className="link meet__log" onClick={() => void exportLog()}>
          <Icon icon={Download04Icon} size={14} />
          {t('meet.exportLog')}
        </button>
      )}
      {error && <p className="hint hint--error">{error}</p>}
      <p className="hint">{t('meet.privacy')}</p>
    </div>
  );
}
