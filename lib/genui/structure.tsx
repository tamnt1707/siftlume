/** Structure and links: a topic broken into branches, and a QR code for a link from the source. */
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { defineComponent } from '@openuidev/react-lang';
import { renderSVG } from 'uqr';
import { z } from 'zod/v4';

export const Branch = defineComponent({
  name: 'Branch',
  description: 'One branch of a Tree: a label (max 6 words), 0-5 leaf items (max 8 words each), optional short note.',
  props: z.object({
    label: z.string(),
    items: z.array(z.string()).optional(),
    note: z.string().optional(),
  }),
  component: ({ props }) => (
    <li className="g-tree__branch">
      <span className="g-tree__node">
        <strong>{props.label}</strong>
        {props.note && <span className="g-tree__note">{props.note}</span>}
      </span>
      {Boolean(props.items?.length) && (
        <ul>
          {props.items!.map((x, i) => (
            <li key={i} className="g-tree__leaf">
              <span className="g-tree__node">{x}</span>
            </li>
          ))}
        </ul>
      )}
    </li>
  ),
});

export const Tree = defineComponent({
  name: 'Tree',
  description:
    'A hierarchy, root → 2-6 branches → leaves: topic breakdowns, taxonomies, org charts, product lines, file or folder structures, a course outline. Use Diagram instead when nodes link across branches or the flow has steps.',
  props: z.object({
    root: z.string(),
    branches: z.array(Branch.ref),
    heading: z.string().optional(),
  }),
  component: ({ props, renderNode }) => (
    <section className="g-tree">
      {props.heading && <h2 className="g-heading">{props.heading}</h2>}
      <div className="g-tree__root">
        <span className="g-tree__node">
          <strong>{props.root}</strong>
        </span>
        <ul>{renderNode(props.branches)}</ul>
      </div>
    </section>
  ),
});

/** Links a QR code may carry: web pages and the usual app schemes, nothing scriptable. */
export const qrSafe = (url: unknown) => /^(https?:\/\/|mailto:|tel:|sms:|geo:)\S+$/i.test(String(url ?? '').trim());

export const QrCode = defineComponent({
  name: 'QrCode',
  description:
    'A scannable QR code for one link that appears in the source and that the reader will open on a phone: download or app store page, sign-up or ticket page, event, map location, contact (mailto:, tel:). Label says what it opens (max 5 words). Never invent or guess a URL.',
  props: z.object({
    url: z.string(),
    label: z.string(),
    caption: z.string().optional(),
  }),
  component: ({ props }) => {
    const { t } = useTranslation('session');
    const url = String(props.url ?? '').trim();
    const ok = qrSafe(url);
    // The SVG holds only the QR modules (paths), never the URL text, so it is safe to inline.
    const svg = useMemo(() => (ok ? renderSVG(url, { border: 1 }) : ''), [ok, url]);
    if (!ok) return null;
    const web = /^https?:/i.test(url);
    return (
      <figure className="g-qr">
        <span className="g-qr__code" role="img" aria-label={props.label} dangerouslySetInnerHTML={{ __html: svg }} />
        <figcaption>
          <span className="g-qr__scan">{t('genui.qrScan')}</span>
          <strong>{props.label}</strong>
          {props.caption && <span>{props.caption}</span>}
          {web ? (
            <a href={url} target="_blank" rel="noreferrer" className="g-qr__url">
              {url.replace(/^https?:\/\/(www\.)?/i, '')}
            </a>
          ) : (
            <span className="g-qr__url">{url}</span>
          )}
        </figcaption>
      </figure>
    );
  },
});
