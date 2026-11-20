/**
 * Runs inside the original page (browser.scripting.executeScript), so it must stay
 * self-contained: no imports, no outer variables.
 *
 * Finds quotes in the page's visible text, even when they run across links, bold text or other
 * inline elements, and highlights exactly those passages (not the whole blocks around them),
 * then scrolls the first one to the middle of the screen. Returns how many were found.
 *
 * - One quote (a string): a brief yellow highlight that fades after a few seconds, for "Show in
 *   page". If the passage is not in the text, the browser's own find is tried as a last resort.
 * - Several quotes (an array): all of them in the reader's highlighter `color`, kept until
 *   clearHighlights(), for "Highlight on page".
 *
 * `root` limits the search: the extension's own source text pane uses it, so the quote is found
 * in the source and not in the summary that cites it. Null means the whole page (arguments to an
 * injected script cannot be undefined).
 */
export function highlightQuote(needles: string | string[], root: Element | null = null, color = '#a6f0e6'): number {
  const ONE = 'siftlume-quote';
  const ALL = 'siftlume-passages';
  const base = root ?? document.body;
  const many = Array.isArray(needles);
  const list = (many ? needles : [needles]).filter((n) => n && n.trim());
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
  const walker = document.createTreeWalker(base, NodeFilter.SHOW_TEXT, {
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

  /** The range of one quote: the full quote, then the longest prefix of at least 4 words in the
   * page (models sometimes paraphrase the end; quotes are short, so trying each length is cheap). */
  const find = (needle: string): Range | null => {
    const words = norm(needle).split(' ');
    for (let n = words.length; n >= Math.min(4, words.length); n--) {
      const c = words.slice(0, n).join(' ');
      const start = flat.indexOf(c);
      if (start === -1) continue;
      const end = start + c.length - 1;
      const range = document.createRange();
      range.setStart(nodes[at[start]!]!, offs[start]!);
      range.setEnd(nodes[at[end]!]!, offs[end]! + 1);
      return range;
    }
    return null;
  };

  const ranges = list.map(find).filter((r): r is Range => r !== null);
  if (!ranges.length) {
    // Last resort for one quote in a web page: the browser's own find, which selects what it matches.
    if (many || root) return 0;
    return (window as unknown as { find?: (s: string) => boolean }).find?.(list[0]!.slice(0, 80)) ? 1 : 0;
  }

  // Scroll: the first passage itself to the middle, not the middle of a long block that holds it (a
  // PDF's text is one <pre>). The block first, then each scrolling box around it, then the window.
  const first = ranges.reduce((a, b) => (a.compareBoundaryPoints(Range.START_TO_START, b) <= 0 ? a : b));
  const el = (first.startContainer as Text).parentElement!;
  el.scrollIntoView({ block: 'center' });
  for (let box: Element | null = el; box && box !== document.documentElement; box = box.parentElement) {
    const { overflowY } = getComputedStyle(box);
    if (!/(auto|scroll)/.test(overflowY) || box.scrollHeight <= box.clientHeight) continue;
    const r = first.getBoundingClientRect();
    const b = box.getBoundingClientRect();
    box.scrollTop += r.top - b.top - (box.clientHeight - r.height) / 2;
  }
  const rect = first.getBoundingClientRect();
  if (rect.top < 0 || rect.bottom > innerHeight) {
    window.scrollBy({ top: rect.top - innerHeight / 2 + rect.height / 2 });
  }

  // CSS Custom Highlight API: marks the exact characters without touching the page's DOM.
  const registry = (CSS as unknown as { highlights?: Map<string, unknown> }).highlights;
  const HighlightCtor = (window as unknown as { Highlight?: new (...r: Range[]) => { priority: number } }).Highlight;
  if (registry && HighlightCtor) {
    let style = document.getElementById(ONE);
    if (!style) {
      style = document.createElement('style');
      style.id = ONE;
      document.head.append(style);
    }
    // The page's own text colour stays: the highlighter colour is light, like a real marker's.
    const safe = /^#[0-9a-f]{3,8}$/i.test(color) ? color : '#a6f0e6';
    style.textContent = `::highlight(${ONE}){background-color:#fde047;color:#111}::highlight(${ALL}){background-color:${safe};color:#111}`;
    if (many) {
      registry.set(ALL, new HighlightCtor(...ranges));
    } else {
      // Above the passages, if both are on.
      const one = new HighlightCtor(ranges[0]!);
      one.priority = 1;
      registry.set(ONE, one);
      const w = window as unknown as { __siftlumeQuoteTimer?: number };
      clearTimeout(w.__siftlumeQuoteTimer);
      w.__siftlumeQuoteTimer = window.setTimeout(() => registry.delete(ONE), 8000);
    }
  } else if (!many) {
    const selection = getSelection();
    selection?.removeAllRanges();
    selection?.addRange(ranges[0]!);
  } else {
    // No highlight API: nothing can mark several passages without changing the page.
    return 0;
  }
  return ranges.length;
}

/** Removes the passages highlightQuote marked with an array. Self-contained, like it. */
export function clearHighlights(): void {
  (CSS as unknown as { highlights?: Map<string, unknown> }).highlights?.delete('siftlume-passages');
}
