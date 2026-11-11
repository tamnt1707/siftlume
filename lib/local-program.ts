/**
 * An in-browser model's structured answer (lib/local-model.ts) turned into an openui-lang program of the app's
 * own blocks. No runtime imports, so pnpm check:examples validates its output.
 */

export interface LocalSummary {
  title: string;
  tldr: string;
  keyNumbers?: { value: string; label: string }[];
  takeaways: { text: string; detail?: string }[];
  steps?: string[];
  sections?: { heading: string; points: string[] }[];
  followUps?: string[];
}

const q = (s: unknown) => JSON.stringify(String(s ?? '').trim());

/** Turns the JSON answer into an openui-lang program of the app's own blocks. */
export function localProgram(
  data: LocalSummary,
  source: { title: string; origin?: string },
  readMinutes: number,
  /** Folded sections (false: shown open, for the full length). */
  foldable = true,
) {
  const lines: string[] = [];
  const blocks: string[] = ['hero'];
  const web = source.origin?.startsWith('http');
  lines.push(
    `hero = SummaryHero(${q(data.title || source.title)}, ${q(data.tldr)}, ${web ? 'null' : q(source.title)}, ${readMinutes})`,
  );

  const numbers = (data.keyNumbers ?? []).filter((n) => n.value?.trim() && n.label?.trim()).slice(0, 4);
  if (numbers.length >= 2) {
    blocks.push('numbers');
    lines.push(`numbers = KeyNumbers([${numbers.map((_, i) => `n${i + 1}`).join(', ')}])`);
    numbers.forEach((n, i) => lines.push(`n${i + 1} = KeyNumber(${q(n.value)}, ${q(n.label)})`));
  }

  const takeaways = (data.takeaways ?? []).filter((x) => x.text?.trim());
  if (takeaways.length) {
    blocks.push('takeaways');
    lines.push(`takeaways = Takeaways([${takeaways.map((_, i) => `t${i + 1}`).join(', ')}])`);
    takeaways.forEach((x, i) =>
      lines.push(`t${i + 1} = Takeaway(${q(x.text)}${x.detail?.trim() ? `, ${q(x.detail)}` : ''})`),
    );
  }

  const steps = (data.steps ?? []).filter((s) => s.trim());
  if (steps.length) {
    blocks.push('todo');
    lines.push(`todo = Checklist([${steps.map(q).join(', ')}])`);
  }

  const sections = (data.sections ?? []).filter((s) => s.heading?.trim() && s.points?.some((p) => p.trim()));
  if (sections.length) {
    blocks.push('details');
    const items = sections.map((s, i) => `SectionItem("s${i + 1}", ${q(s.heading)}, [d${i + 1}])`);
    lines.push(`details = SectionBlock([${items.join(', ')}], ${foldable})`);
    sections.forEach((s, i) =>
      lines.push(
        `d${i + 1} = MarkDownRenderer(${q(
          s.points
            .filter((p) => p.trim())
            .map((p) => `- ${p.trim()}`)
            .join('\n'),
        )})`,
      ),
    );
  }

  const followUps = (data.followUps ?? []).filter((f) => f.trim()).slice(0, 3);
  if (followUps.length) {
    blocks.push('followUps');
    lines.push(`followUps = FollowUpBlock([${followUps.map((f) => `FollowUpItem(${q(f)})`).join(', ')}])`);
  }

  const sources = web
    ? `, [{title: ${q(source.title)}, sourceName: ${q(hostOf(source.origin!))}, url: ${q(source.origin)}}]`
    : '';
  return [`root = Card([${blocks.join(', ')}]${sources})`, ...lines].join('\n');
}

const hostOf = (url: string) => {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
};

/**
 * Parses JSON that is still streaming: closes the open string, arrays and objects, and drops a
 * trailing comma or a key still waiting for its value. Null while nothing usable has arrived.
 */
export function parsePartialJson(text: string): LocalSummary | null {
  const stack: string[] = [];
  let inString = false;
  let escaped = false;
  for (const ch of text) {
    if (inString) {
      if (escaped) escaped = false;
      else if (ch === '\\') escaped = true;
      else if (ch === '"') inString = false;
    } else if (ch === '"') inString = true;
    else if (ch === '{') stack.push('}');
    else if (ch === '[') stack.push(']');
    else if (ch === '}' || ch === ']') stack.pop();
  }
  let body = escaped ? text.slice(0, -1) : text;
  if (inString) body += '"';
  body = body.replace(/[,:\s]+$/, (m) => (m.includes(':') ? ':' : ''));
  const close = stack.reverse().join('');
  const candidates = [
    body + close,
    // A key without its value yet: `, "detail"` or `, "detail":`.
    body.replace(/,?\s*"(?:[^"\\]|\\.)*"\s*:?$/, '') + close,
  ];
  for (const candidate of candidates) {
    try {
      return JSON.parse(candidate) as LocalSummary;
    } catch {
      /* try the next cut */
    }
  }
  return null;
}
