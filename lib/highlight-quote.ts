/**
 * Runs inside the original page (browser.scripting.executeScript), so it must stay
 * self-contained: no imports, no outer variables.
 *
 * Finds a quote in the page's visible text, even when it runs across links, bold text or other
 * inline elements, and highlights exactly that passage (not the whole block around it), then
 * scrolls it to the middle of the screen. Returns whether it was found.
 */
export function highlightQuote(needle: string): boolean {
  const NAME = 'siftlume-quote';
  // Same spelling on both sides: curly quotes, dashes and non-breaking spaces vary between the
  // page and the model's copy of it.
  const fold = (ch: string) =>
    ch
      .replace(/[‘’‚′]/g, "'")
      .replace(/[“”„″]/g, '"')
      .replace(/[‐-―−]/g, '-')
      .toLowerCase();
  const isSpace = (ch: string) => /\s/.test(ch);
  const norm = (s: string) => Array.from(s.replace(/\s+/g, ' ').trim()).map(fold).join('');

  // The page's text as one string, with each character mapped back to its text node and offset.
  const SKIP = new Set(['SCRIPT', 'STYLE', 'NOSCRIPT', 'TEXTAREA', 'TEMPLATE']);
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, {
    acceptNode: (n) => {
      const el = n.parentElement;
      if (!el || SKIP.has(el.tagName) || el.closest('[hidden],[aria-hidden="true"]')) return NodeFilter.FILTER_REJECT;
      return NodeFilter.FILTER_ACCEPT;
    },
  });
  let flat = '';
  const nodes: Text[] = [];
  const at: number[] = []; // flat index → index in nodes
  const offs: number[] = []; // flat index → offset in that node
  let lastSpace = true;
  while (walker.nextNode()) {
    const node = walker.currentNode as Text;
    const n = nodes.push(node) - 1;
    const data = node.data;
    for (let i = 0; i < data.length; i++) {
      const ch = data[i]!;
      if (isSpace(ch)) {
        if (lastSpace) continue;
        flat += ' ';
        lastSpace = true;
      } else {
        const f = fold(ch);
        flat += f;
        lastSpace = false;
        // A character can lowercase to more than one; map them all to it.
        for (let k = 1; k < f.length; k++) {
          at.push(n);
          offs.push(i);
        }
      }
      at.push(n);
      offs.push(i);
    }
  }

  const target = norm(needle);
  const words = target.split(' ');
  // The full quote, then shorter prefixes (models sometimes paraphrase the end).
  const candidates = [target, words.slice(0, 8).join(' '), words.slice(0, 4).join(' ')].filter(
    (c, i, all) => c && all.indexOf(c) === i,
  );
  let start = -1;
  let length = 0;
  for (const c of candidates) {
    start = flat.indexOf(c);
    if (start !== -1) {
      length = c.length;
      break;
    }
  }
  if (start === -1) {
    // Last resort: the browser's own find, which selects what it matches.
    return (window as unknown as { find?: (s: string) => boolean }).find?.(needle.slice(0, 80)) ?? false;
  }

  const end = start + length - 1;
  const range = document.createRange();
  range.setStart(nodes[at[start]!]!, offs[start]!);
  range.setEnd(nodes[at[end]!]!, offs[end]! + 1);

  // Scroll: the passage itself to the middle, not the top of a long block that holds it.
  const el = nodes[at[start]!]!.parentElement!;
  el.scrollIntoView({ block: 'center' });
  const rect = range.getBoundingClientRect();
  if (rect.top < 0 || rect.bottom > innerHeight) {
    window.scrollBy({ top: rect.top - innerHeight / 2 + rect.height / 2 });
  }

  // CSS Custom Highlight API: marks the exact characters without touching the page's DOM.
  const registry = (CSS as unknown as { highlights?: Map<string, unknown> }).highlights;
  const HighlightCtor = (window as unknown as { Highlight?: new (r: Range) => unknown }).Highlight;
  if (registry && HighlightCtor) {
    if (!document.getElementById(NAME)) {
      const style = document.createElement('style');
      style.id = NAME;
      style.textContent = `::highlight(${NAME}){background-color:#fde047;color:#111}`;
      document.head.append(style);
    }
    registry.set(NAME, new HighlightCtor(range));
    const w = window as unknown as { __siftlumeQuoteTimer?: number };
    clearTimeout(w.__siftlumeQuoteTimer);
    w.__siftlumeQuoteTimer = window.setTimeout(() => registry.delete(NAME), 8000);
  } else {
    const selection = getSelection();
    selection?.removeAllRanges();
    selection?.addRange(range);
  }
  return true;
}
