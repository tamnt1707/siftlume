import { parseProgram } from './markdown';

/**
 * A summary as an image to post: the title, the TL;DR and up to three key figures (or takeaways
 * when there are none), with the source and Siftlume's name. Drawn on a canvas in the browser, so
 * nothing leaves the computer until the reader posts it.
 */

export interface ShareFigure {
  value: string;
  label: string;
  change?: string;
}

export interface ShareContent {
  title: string;
  tldr: string;
  /** Where the summary comes from: the site's domain, or the source the model named. */
  source: string;
  readMinutes?: number;
  figures: ShareFigure[];
  /** Shown in place of figures when there are fewer than two. */
  points: string[];
}

type Node = { type?: string; typeName?: string; props?: Record<string, unknown> };

const isNode = (v: unknown): v is Node => Boolean(v && typeof v === 'object' && (v as Node).type === 'element');
const str = (v: unknown) => (v === null || v === undefined ? '' : String(v).trim());

/** Every component in the tree, depth first, in reading order. */
function* walk(v: unknown): Generator<Node> {
  if (Array.isArray(v)) {
    for (const x of v) yield* walk(x);
  } else if (isNode(v)) {
    yield v;
    for (const p of Object.values(v.props ?? {})) yield* walk(p);
  }
}

const domainOf = (origin?: string) => {
  try {
    return origin?.startsWith('http') ? new URL(origin).hostname.replace(/^www\./, '') : '';
  } catch {
    return '';
  }
};

const MAX_FIGURES = 3;

/** What the card shows, from the summary's program; null when it has no title or TL;DR. */
export function shareContent(program: string, source?: { title?: string; origin?: string }): ShareContent | null {
  let hero: Record<string, unknown> | undefined;
  const figures: ShareFigure[] = [];
  const points: string[] = [];
  for (const node of walk(parseProgram(program))) {
    const p = node.props ?? {};
    if (node.typeName === 'SummaryHero' && !hero) hero = p;
    else if (node.typeName === 'KeyNumber' && figures.length < MAX_FIGURES && str(p.value)) {
      figures.push({ value: str(p.value), label: str(p.label), change: str(p.change) || undefined });
    } else if (node.typeName === 'Takeaway' && points.length < 3 && str(p.text)) points.push(str(p.text));
  }
  const title = str(hero?.title) || str(source?.title);
  const tldr = str(hero?.tldr);
  if (!title || !tldr) return null;
  return {
    title,
    tldr,
    source: domainOf(source?.origin) || str(hero?.source),
    readMinutes: Number(hero?.readMinutes) || undefined,
    figures: figures.length >= 2 ? figures : [],
    points: figures.length >= 2 ? [] : points,
  };
}

// ── Drawing ────────────────────────────────────────────────────────────────────

/** Open Graph size: what X, LinkedIn, Facebook and chat apps show without cropping. */
export const CARD_WIDTH = 1200;
export const CARD_HEIGHT = 630;

const SANS = '"Bricolage Grotesque Variable", ui-sans-serif, system-ui, sans-serif';
const SERIF = '"Source Serif 4 Variable", Georgia, "Times New Roman", serif';

export interface CardStyle {
  accent: string;
  /** Background tint around the card (the pen color mixed with white). */
  accentSoft: string;
  marker: string;
  serif: boolean;
  /** Localized "N min read", or empty. */
  readLabel: string;
  /** Siftlume's icon, already loaded. */
  icon?: CanvasImageSource;
  /** Where people get Siftlume, shown in the corner. */
  site: string;
}

const INK = '#141821';
const INK_2 = '#4A5163';
const MUTED = '#7A8194';
const LINE = '#E3E6EC';

/**
 * Breaks text into lines that fit `width`, at spaces, or anywhere in a word too long for a line
 * (Chinese, Japanese and Thai have no spaces). The last line gets an ellipsis when text is left.
 * The first line can be narrower (`firstWidth`), to start after a label.
 */
const NO_LINE_START = /^[,.;:!?)\]}、。，．：；！？）」』】〉》…ー々]$/u;

export function wrapText(
  measure: (s: string) => number,
  text: string,
  width: number,
  maxLines: number,
  firstWidth = width,
): string[] {
  const lines: string[] = [];
  let line = '';
  const room = () => (lines.length ? width : firstWidth);
  const tokens = text
    .replace(/\s+/g, ' ')
    .trim()
    .split(/(?<= )/);
  const pushChars = (token: string) => {
    for (const ch of Array.from(token)) {
      // Closing punctuation never starts a line (Chinese and Japanese rule): it may overhang.
      if (line && measure(line + ch) > room() && !NO_LINE_START.test(ch)) {
        lines.push(line);
        line = ch.trimStart();
      } else line += ch;
    }
  };
  for (const token of tokens) {
    if (measure(line + token) <= room()) line += token;
    else if (measure(token) > room()) pushChars(token);
    else {
      lines.push(line);
      line = token;
    }
  }
  if (line.trim()) lines.push(line);
  const out = lines.map((l) => l.trim());
  if (out.length <= maxLines) return out;
  const kept = out.slice(0, maxLines);
  let last = kept[maxLines - 1]!;
  while (last && measure(`${last}…`) > (maxLines === 1 ? firstWidth : width))
    last = Array.from(last).slice(0, -1).join('');
  kept[maxLines - 1] = `${last.replace(/[\s,.;:–—-]+$/, '')}…`;
  return kept;
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
}

/** Loads the fonts the card uses; the reader's page may not have needed every weight yet. */
export async function loadCardFonts() {
  if (typeof document === 'undefined' || !document.fonts) return;
  await Promise.allSettled([
    document.fonts.load(`700 46px ${SERIF}`),
    document.fonts.load(`800 17px ${SANS}`),
    document.fonts.load(`400 27px ${SERIF}`),
    document.fonts.load(`700 46px ${SANS}`),
    document.fonts.load(`500 21px ${SANS}`),
  ]);
}

/** Draws the card at `scale` × 1200×630 (2 by default, sharp on high-density screens). */
export function drawShareCard(content: ShareContent, style: CardStyle, scale = 2): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = CARD_WIDTH * scale;
  canvas.height = CARD_HEIGHT * scale;
  const ctx = canvas.getContext('2d')!;
  ctx.scale(scale, scale);
  ctx.textBaseline = 'alphabetic';
  const reading = style.serif ? SERIF : SANS;
  const measure = (s: string) => ctx.measureText(s).width;

  // Tinted frame, white card.
  ctx.fillStyle = style.accentSoft;
  ctx.fillRect(0, 0, CARD_WIDTH, CARD_HEIGHT);
  const M = 32;
  roundRect(ctx, M, M, CARD_WIDTH - 2 * M, CARD_HEIGHT - 2 * M, 28);
  ctx.fillStyle = '#FFFFFF';
  ctx.fill();

  const left = M + 52;
  const right = CARD_WIDTH - M - 52;
  const width = right - left;

  // Footer: Siftlume's icon, name and site.
  const footerY = CARD_HEIGHT - M - 38;
  let fx = left;
  if (style.icon) {
    ctx.drawImage(style.icon, fx, footerY - 25, 32, 32);
    fx += 42;
  }
  ctx.font = `700 22px ${SANS}`;
  ctx.fillStyle = INK;
  ctx.fillText('Siftlume', fx, footerY);
  ctx.font = `500 19px ${SANS}`;
  ctx.fillStyle = MUTED;
  ctx.textAlign = 'right';
  ctx.fillText(style.site, right, footerY);
  ctx.textAlign = 'left';
  const footerTop = footerY - 25 - 22;

  // Figures (or takeaways) sit just above the footer.
  const tileH = 120;
  const hasTiles = content.figures.length > 0;
  ctx.font = `500 23px ${SANS}`;
  const pointLines = hasTiles ? [] : content.points.map((p) => wrapText(measure, p, width - 28, 1)[0]!);
  const blockH = hasTiles ? tileH : pointLines.length ? pointLines.length * 36 - 10 : 0;
  const blockTop = footerTop - blockH;

  // Header: the source and its reading time.
  ctx.font = `600 21px ${SANS}`;
  ctx.fillStyle = style.accent;
  const meta = [content.source, style.readLabel].filter(Boolean).join('  ·  ');
  const headerY = M + 58;
  ctx.fillText(wrapText(measure, meta, width, 1)[0] ?? '', left, headerY);

  // Title and TL;DR share the space between the header and the figures. A short pair gets a
  // bigger title; the TL;DR (the point of the card) gets every line that fits.
  const top = headerY + 22;
  const limit = blockTop - (blockH ? 26 : 0);
  const label = 'TL;DR';
  ctx.font = `800 17px ${SANS}`;
  const indent = measure(label) + 22;
  const tldrSize = 27;
  const tldrLH = 37;
  const layout = (titleSize: number) => {
    ctx.font = `700 ${titleSize}px ${reading}`;
    const titleLines = wrapText(measure, content.title, width, 2);
    const titleLH = Math.round(titleSize * 1.18);
    const titleH = titleLines.length * titleLH;
    ctx.font = `400 ${tldrSize}px ${reading}`;
    const room = Math.max(1, Math.floor((limit - top - titleH - 20) / tldrLH));
    // The first line starts after the TL;DR label.
    const tldrLines = wrapText(measure, content.tldr, width, Math.min(room, 4), width - indent);
    return { titleSize, titleLines, titleLH, titleH, tldrLines, height: titleH + 20 + tldrLines.length * tldrLH };
  };
  let text = layout(56);
  if (text.titleLines.length > 1 || text.height > limit - top) text = layout(46);
  if (text.height > limit - top) text = layout(40);

  // Centered in its space, leaning up.
  let y = top + Math.max(0, (limit - top - text.height) * 0.4);
  ctx.font = `700 ${text.titleSize}px ${reading}`;
  ctx.fillStyle = INK;
  for (const line of text.titleLines) {
    ctx.fillText(line, left, y + text.titleSize * 0.92);
    y += text.titleLH;
  }
  y += 20;
  ctx.font = `800 17px ${SANS}`;
  ctx.fillStyle = style.marker;
  roundRect(ctx, left - 6, y + 4, indent - 10, 27, 5);
  ctx.fill();
  ctx.fillStyle = INK;
  ctx.fillText(label, left, y + 24);
  ctx.font = `400 ${tldrSize}px ${reading}`;
  ctx.fillStyle = INK_2;
  text.tldrLines.forEach((line, i) => {
    ctx.fillText(line, i === 0 ? left + indent : left, y + 27);
    y += tldrLH;
  });

  if (hasTiles) {
    const gap = 18;
    const n = content.figures.length;
    const tileW = (width - gap * (n - 1)) / n;
    content.figures.forEach((f, i) => {
      const x = left + i * (tileW + gap);
      roundRect(ctx, x, blockTop, tileW, tileH, 18);
      ctx.lineWidth = 2;
      ctx.strokeStyle = LINE;
      ctx.stroke();
      // The value, shrunk to fit its tile.
      let size = 44;
      ctx.font = `700 ${size}px ${SANS}`;
      while (size > 24 && measure(f.value) > tileW - 40) ctx.font = `700 ${(size -= 2)}px ${SANS}`;
      ctx.fillStyle = style.accent;
      ctx.fillText(wrapText(measure, f.value, tileW - 40, 1)[0]!, x + 20, blockTop + 18 + size * 0.9);
      ctx.font = `500 20px ${SANS}`;
      ctx.fillStyle = INK_2;
      const text = f.change ? `${f.label} (${f.change})` : f.label;
      wrapText(measure, text, tileW - 40, 2).forEach((line, k) => {
        ctx.fillText(line, x + 20, blockTop + 84 + k * 23);
      });
    });
  } else {
    ctx.font = `500 23px ${SANS}`;
    pointLines.forEach((line, i) => {
      const ly = blockTop + 20 + i * 36;
      ctx.fillStyle = style.accent;
      ctx.beginPath();
      ctx.arc(left + 6, ly - 8, 5, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = INK;
      ctx.fillText(line, left + 28, ly);
    });
  }

  return canvas;
}

export const canvasBlob = (canvas: HTMLCanvasElement) =>
  new Promise<Blob>((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('toBlob failed'))), 'image/png'),
  );
