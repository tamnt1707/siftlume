import { useEffect, useMemo, useState } from 'react';
import * as Popover from '@radix-ui/react-popover';
import { useTranslation } from 'react-i18next';
import { Copy01Icon, Download04Icon, Image01Icon, Share08Icon } from '@hugeicons/core-free-icons';
import { browser } from '#imports';
import { resolvePalette, type Appearance } from '@/lib/appearance';
import { canvasBlob, drawShareCard, loadCardFonts, shareContent } from '@/lib/share-card';
import type { Session } from '@/lib/history';
import { Icon } from './Icon';
import { usePortalContainer } from './portal';

const loadImage = (src: string) =>
  new Promise<HTMLImageElement | undefined>((resolve) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => resolve(undefined);
    img.src = src;
  });

/** White paper with the pen color: the card is always light, as feeds show it on any background. */
function cardStyle(appearance: Appearance) {
  const p = resolvePalette(appearance, false);
  return { accent: p.accent, accentSoft: p.accentSoft, marker: p.marker, serif: appearance.readingFont === 'serif' };
}

/**
 * "Share as image": the TL;DR and key figures as a 1200×630 PNG to copy into a post, download, or
 * hand to the system share sheet. Made in the browser; nothing is uploaded.
 */
export function ShareImage({
  session,
  program,
  appearance,
  disabled,
  notify,
  fileName,
}: {
  session: Session;
  program: string;
  appearance: Appearance;
  disabled: boolean;
  notify: (msg: string) => void;
  fileName: string;
}) {
  const { t } = useTranslation('session');
  const container = usePortalContainer();
  const [open, setOpen] = useState(false);
  const [image, setImage] = useState<{ blob: Blob; url: string } | null>(null);
  const [failed, setFailed] = useState(false);

  const content = useMemo(() => {
    try {
      return program ? shareContent(program, session.source) : null;
    } catch {
      return null;
    }
  }, [program, session.source]);

  // Draw when the menu opens; a new summary or theme draws again next time.
  useEffect(() => {
    if (!open || !content) return;
    let cancelled = false;
    let url = '';
    setFailed(false);
    void (async () => {
      try {
        await loadCardFonts();
        const icon = await loadImage(browser.runtime.getURL('/icon/128.png'));
        const canvas = drawShareCard(content, {
          ...cardStyle(appearance),
          readLabel: content.readMinutes ? t('genui.minRead', { count: content.readMinutes }) : '',
          icon,
        });
        const blob = await canvasBlob(canvas);
        if (cancelled) return;
        url = URL.createObjectURL(blob);
        setImage({ blob, url });
      } catch {
        if (!cancelled) setFailed(true);
      }
    })();
    return () => {
      cancelled = true;
      if (url) URL.revokeObjectURL(url);
      setImage(null);
    };
  }, [open, content, appearance, t]);

  const file = image ? new File([image.blob], fileName, { type: 'image/png' }) : null;
  const canShare = Boolean(file && navigator.canShare?.({ files: [file] }));

  const copy = async () => {
    if (!image) return;
    try {
      await navigator.clipboard.write([new ClipboardItem({ 'image/png': image.blob })]);
      notify(t('share.copied'));
      setOpen(false);
    } catch {
      notify(t('share.copyFailed'));
    }
  };

  const download = () => {
    if (!image) return;
    const a = document.createElement('a');
    a.href = image.url;
    a.download = fileName;
    a.click();
    setOpen(false);
  };

  const share = async () => {
    if (!file) return;
    try {
      await navigator.share({ files: [file], title: content?.title });
      setOpen(false);
    } catch {
      // Closed the share sheet: nothing to do.
    }
  };

  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger
        className="tool-btn"
        disabled={disabled || !content}
        title={content ? t('share.title') : t('share.unavailable')}
      >
        <Icon icon={Image01Icon} size={16} />
        <span>{t('share.short')}</span>
      </Popover.Trigger>
      <Popover.Portal container={container}>
        <Popover.Content className="ui-menu share-image" align="end" sideOffset={6} collisionPadding={8}>
          <div className="share-image__preview" aria-busy={!image && !failed}>
            {image ? (
              <img src={image.url} alt={t('share.alt', { title: content?.title ?? '' })} />
            ) : (
              <span>{failed ? t('share.failed') : t('share.making')}</span>
            )}
          </div>
          <p className="share-image__hint">{t('share.hint')}</p>
          <div className="share-image__actions">
            <button type="button" className="btn btn--primary" disabled={!image} onClick={() => void copy()}>
              <Icon icon={Copy01Icon} size={15} />
              {t('share.copy')}
            </button>
            <button type="button" className="btn" disabled={!image} onClick={download}>
              <Icon icon={Download04Icon} size={15} />
              {t('share.download')}
            </button>
            {canShare && (
              <button type="button" className="btn" onClick={() => void share()}>
                <Icon icon={Share08Icon} size={15} />
                {t('share.share')}
              </button>
            )}
          </div>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
