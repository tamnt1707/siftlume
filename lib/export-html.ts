/**
 * Saves a rendered summary as one self-contained HTML file: the summary's DOM as it looks now
 * (charts and diagrams are SVG), the page's CSS inlined, and the theme's colors. Interactive parts
 * (filters, follow-up buttons) become static. Fonts fall back to system fonts outside the
 * extension.
 */

const escapeHtml = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** All CSS rules of the page, except web fonts (their files only load inside the extension). */
function pageCss() {
  const out: string[] = [];
  for (const sheet of Array.from(document.styleSheets)) {
    let rules: CSSRuleList;
    try {
      rules = sheet.cssRules;
    } catch {
      continue;
    }
    for (const rule of Array.from(rules)) {
      if (rule instanceof CSSFontFaceRule) continue;
      out.push(rule.cssText);
    }
  }
  return out.join('\n');
}

/** Copies of the summary's themed ancestors (theme class, CSS variables), outermost first. */
function themeWrappers(el: HTMLElement) {
  const wrappers: string[] = [];
  for (let node = el.parentElement; node && node !== document.body; node = node.parentElement) {
    const style = node.getAttribute('style');
    const cls = node.getAttribute('class') ?? '';
    // Keep what carries the theme; drop layout containers (grids, columns, scroll areas).
    if (style || /(^|\s)(app|openui-[\w-]+)(\s|$)/.test(cls)) {
      const keep = cls
        .split(/\s+/)
        .filter((c) => /^(app|app--(dark|light)|corners--\w+|openui-[\w-]+)$/.test(c))
        .join(' ');
      wrappers.unshift(`<div class="${escapeHtml(keep)}"${style ? ` style="${escapeHtml(style)}"` : ''}>`);
    }
  }
  return wrappers;
}

/** Interactive leftovers that mean nothing in a saved file. */
const DROP = ['.sift-loader', 'script', 'button.link', '[data-export-skip]'];

export function summaryHtml(
  el: HTMLElement,
  meta: { title: string; origin?: string; sourceLabel: string; lang: string; generator: string },
) {
  const clone = el.cloneNode(true) as HTMLElement;
  clone.classList.remove('is-reworking');
  for (const sel of DROP) clone.querySelectorAll(sel).forEach((n) => n.remove());
  // Keep form values the reader set (filters, checklists) visible in the copy.
  const live = el.querySelectorAll<HTMLInputElement>('input, select, textarea');
  clone.querySelectorAll<HTMLInputElement>('input, select, textarea').forEach((input, i) => {
    const source = live[i];
    if (!source) return;
    if (input.type === 'checkbox' || input.type === 'radio') {
      if (source.checked) input.setAttribute('checked', '');
    } else input.setAttribute('value', source.value);
  });

  const wrappers = themeWrappers(el);
  const background = getComputedStyle(document.body).backgroundColor;
  const source = meta.origin?.startsWith('http')
    ? `<a href="${escapeHtml(meta.origin)}">${escapeHtml(meta.title)}</a>`
    : escapeHtml(meta.title);
  const date = new Date().toLocaleString(meta.lang);

  return `<!doctype html>
<html lang="${escapeHtml(meta.lang)}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="generator" content="${escapeHtml(meta.generator)}">
<title>${escapeHtml(meta.title)}</title>
<style>
${pageCss()}
html, body { margin: 0; background: ${background}; }
.export-page { max-width: 880px; margin: 0 auto; padding: 32px 20px 48px; }
.export-head { margin-bottom: 20px; color: var(--ink-2); font-size: 13px; }
.export-head p { margin: 0; }
.export-head a { color: var(--accent); }
.export-foot { margin-top: 32px; color: var(--ink-2); font-size: 12px; }
</style>
</head>
<body>
${wrappers.join('')}
<main class="export-page">
<header class="export-head"><p>${escapeHtml(meta.sourceLabel)}: ${source} · ${escapeHtml(date)}</p></header>
${clone.outerHTML}
<footer class="export-foot">${escapeHtml(meta.generator)}</footer>
</main>
${'</div>'.repeat(wrappers.length)}
</body>
</html>
`;
}
