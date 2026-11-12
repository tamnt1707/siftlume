/**
 * schema.org data (JSON-LD) that many sites embed for search engines: recipes, products, job
 * postings and events, on thousands of sites at once. Read from the page HTML Siftlume already
 * has, turned into a short Markdown block placed before the page text, and announced to the prompt
 * (lib/openui.ts STRUCTURED_RULES) so the summary is laid out for that kind of page.
 *
 * Pure (DOMParser only), so it can be tested in a plain browser page.
 */

import { stripInlineHandlers } from './inline-handlers';

export type StructuredType = 'Recipe' | 'Product' | 'JobPosting' | 'Event';
export const STRUCTURED_TYPES: StructuredType[] = ['Recipe', 'Product', 'JobPosting', 'Event'];

type Node = Record<string, unknown>;

/** Items of one type kept: the first in full; more are usually "related" items. */
const MAX_PER_TYPE = 3;
const MAX_TEXT = 1_500;
const MAX_REVIEWS = 8;

// ── Reading ────────────────────────────────────────────────────────────────────

function parseJson(text: string): unknown {
  const cleaned = text
    .replace(/^\s*<!--|-->\s*$/g, '')
    .replace(/^\s*\/\/\s*<!\[CDATA\[|\/\/\s*\]\]>\s*$/g, '')
    .trim();
  try {
    return JSON.parse(cleaned);
  } catch {
    // Raw control characters inside strings are a common mistake: try once without them.
    try {
      return JSON.parse(cleaned.replace(/[\u0000-\u001f]+/g, ' '));
    } catch {
      return null;
    }
  }
}

const types = (node: Node): string[] => {
  const t = node['@type'];
  return (Array.isArray(t) ? t : [t]).filter((x): x is string => typeof x === 'string').map((x) => x.split('/').pop()!);
};

function familyOf(node: Node): StructuredType | null {
  for (const t of types(node)) {
    if (t === 'Recipe') return 'Recipe';
    if (t === 'JobPosting') return 'JobPosting';
    if (t === 'Product' || t === 'ProductGroup' || t === 'IndividualProduct' || t === 'ProductModel') return 'Product';
    if (t === 'Event' || /.+Event$/.test(t)) return 'Event';
  }
  return null;
}

/** Every object in the JSON-LD (arrays, @graph, mainEntity, …), outermost first. */
function walk(value: unknown, out: Node[], depth = 0) {
  if (depth > 6 || !value || typeof value !== 'object') return;
  if (Array.isArray(value)) {
    for (const v of value) walk(v, out, depth + 1);
    return;
  }
  const node = value as Node;
  out.push(node);
  for (const key of ['@graph', 'mainEntity', 'mainEntityOfPage', 'itemListElement', 'item', 'about']) {
    if (key in node) walk(node[key], out, depth + 1);
  }
}

// ── Values ─────────────────────────────────────────────────────────────────────

/** Plain text of a value that may hold HTML or entities. */
function plain(text: string) {
  if (!/[<&]/.test(text)) return text.replace(/\s+/g, ' ').trim();
  const doc = new DOMParser().parseFromString(
    `<body>${stripInlineHandlers(text).replace(/<(br|\/p|\/li|\/h\d)\b[^>]*>/gi, '\n$&')}`,
    'text/html',
  );
  return (doc.body.textContent ?? '')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n\s*\n+/g, '\n')
    .trim();
}

const cut = (text: string, max = MAX_TEXT) => (text.length > max ? `${text.slice(0, max)}…` : text);

/** A readable string from a schema.org value: text, number, {name}, {@value}, or a list of them. */
function str(value: unknown): string {
  if (value == null) return '';
  if (typeof value === 'string') return plain(value);
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  if (Array.isArray(value)) return [...new Set(value.map(str).filter(Boolean))].join(', ');
  if (typeof value === 'object') {
    const v = value as Node;
    return str(v.name ?? v['@value'] ?? v.text ?? v.value ?? '');
  }
  return '';
}

/** "https://schema.org/InStock" → "In stock"; "FULL_TIME" → "Full time"; lists stay lists. */
const enumLabel = (value: unknown): string =>
  Array.isArray(value)
    ? value.map(enumLabel).join(', ')
    : str(value)
        .split('/')
        .pop()!
        .replace(/_/g, ' ')
        .replace(/([a-z])([A-Z])/g, '$1 $2')
        .toLowerCase()
        .replace(/^./, (c) => c.toUpperCase());

/** ISO 8601 duration ("PT1H30M") → "1 h 30 min". */
export function duration(value: unknown): string {
  const text = str(value);
  const m = text.match(/^P(?:(\d+)D)?(?:T(?:(\d+(?:\.\d+)?)H)?(?:(\d+(?:\.\d+)?)M)?(?:(\d+)S)?)?$/i);
  if (!m) return text;
  let [, d, h, min] = m.map((x) => Number(x ?? 0));
  // "PT90M" reads better as 1 h 30 min.
  h! += Math.floor(min! / 60);
  min = min! % 60;
  return [d ? `${d} d` : '', h ? `${h} h` : '', min ? `${min} min` : ''].filter(Boolean).join(' ') || text;
}

/** One Markdown list line: line breaks inside the value (often <br> in specs) become " · ". */
const flat = (value: string) => value.replace(/\s*\n\s*/g, ' · ');
const line = (label: string, value: string) => (value ? `- ${label}: ${flat(value)}` : '');

function address(value: unknown): string {
  if (!value || typeof value !== 'object') return str(value);
  const a = value as Node;
  if (a.address) return [str(a.name), address(a.address)].filter(Boolean).join(', ');
  return [a.streetAddress, a.addressLocality, a.addressRegion, a.postalCode, a.addressCountry]
    .map(str)
    .filter(Boolean)
    .join(', ');
}

function rating(value: unknown): string {
  if (!value || typeof value !== 'object') return '';
  const r = value as Node;
  const v = str(r.ratingValue);
  if (!v) return '';
  const best = str(r.bestRating) || '5';
  const count = str(r.reviewCount) || str(r.ratingCount);
  return `${v}/${best}${count ? ` from ${count} ${r.reviewCount ? 'reviews' : 'ratings'}` : ''}`;
}

function offers(value: unknown): string[] {
  const list = (Array.isArray(value) ? value : [value]).filter((o): o is Node => Boolean(o) && typeof o === 'object');
  return list.slice(0, 5).map((o) => {
    const currency = str(o.priceCurrency);
    const price =
      o.lowPrice != null || o.highPrice != null
        ? `${str(o.lowPrice)}–${str(o.highPrice)}`
        : str(o.price ?? (o.priceSpecification as Node | undefined)?.price);
    return [
      price ? `${price}${currency ? ` ${currency}` : ''}` : '',
      o.availability ? enumLabel(o.availability) : '',
      o.priceValidUntil ? `price valid until ${str(o.priceValidUntil)}` : '',
      o.validFrom ? `on sale from ${str(o.validFrom)}` : '',
      str(o.seller) ? `sold by ${str(o.seller)}` : '',
      str(o.name),
      typeof o.url === 'string' ? o.url : '',
    ]
      .filter(Boolean)
      .join(' · ');
  });
}

// ── One block per type ─────────────────────────────────────────────────────────

function recipe(r: Node): string {
  const steps: string[] = [];
  const addSteps = (value: unknown, prefix = '') => {
    for (const s of Array.isArray(value) ? value : [value]) {
      if (!s) continue;
      if (typeof s === 'string') {
        // Some sites put every step in one string.
        for (const part of plain(s).split(/\n+/)) if (part.trim()) steps.push(`${prefix}${part.trim()}`);
      } else if (typeof s === 'object') {
        const n = s as Node;
        if (types(n).includes('HowToSection')) {
          steps.push(`Section: ${str(n.name)}`);
          addSteps(n.itemListElement, '  ');
        } else steps.push(`${prefix}${str(n.text) || str(n.name)}`);
      }
    }
  };
  addSteps(r.recipeInstructions);
  const nutrition = r.nutrition as Node | undefined;
  return [
    `### Recipe: ${str(r.name)}`,
    line('By', str(r.author)),
    line('Yield', str(r.recipeYield)),
    line('Prep time', duration(r.prepTime)),
    line('Cook time', duration(r.cookTime)),
    line('Total time', duration(r.totalTime)),
    line('Category', [str(r.recipeCategory), str(r.recipeCuisine)].filter(Boolean).join(', ')),
    line('Rating', rating(r.aggregateRating)),
    line(
      'Nutrition',
      nutrition
        ? Object.entries(nutrition)
            .filter(([k]) => !k.startsWith('@'))
            .map(([k, v]) => {
              // "61 calories", "2 grams fat" already name themselves; bare numbers get the key.
              const value = str(v);
              return /[a-z]/i.test(value.replace(/^[\d.,\s]+/, '')) ? value : `${k.replace(/Content$/, '')} ${value}`;
            })
            .join(', ')
        : '',
    ),
    line('Description', cut(str(r.description), 400)),
    Array.isArray(r.recipeIngredient) && r.recipeIngredient.length
      ? `Ingredients:\n${(r.recipeIngredient as unknown[]).map((i) => `  - ${str(i)}`).join('\n')}`
      : '',
    steps.length
      ? `Steps:\n${steps.map((s, i) => (s.startsWith('Section:') || s.startsWith('  ') ? `  ${s}` : `  ${i + 1}. ${s}`)).join('\n')}`
      : '',
  ]
    .filter(Boolean)
    .join('\n');
}

function product(p: Node): string {
  const all = (Array.isArray(p.review) ? p.review : p.review ? [p.review] : []) as Node[];
  const stars = (r: Node) => str((r.reviewRating as Node | undefined)?.ratingValue);
  const body = (r: Node) => str(r.reviewBody ?? r.description);
  // Reviews without text only count as star ratings.
  const reviews = all.filter((r) => body(r));
  const bare = all.filter((r) => !body(r) && stars(r)).map(stars);
  const specs = (Array.isArray(p.additionalProperty) ? p.additionalProperty : []) as Node[];
  return [
    `### Product: ${str(p.name)}`,
    line('Brand', str(p.brand)),
    line('Model / SKU', [str(p.model), str(p.sku), str(p.mpn)].filter(Boolean).join(' · ')),
    line('Category', str(p.category)),
    ...offers(p.offers).map((o) => line('Offer', o)),
    line('Rating', rating(p.aggregateRating)),
    specs.length
      ? `Specs:\n${specs
          .slice(0, 25)
          .map((s) => `  - ${str(s.name)}: ${flat(str(s.value))}${str(s.unitText) ? ` ${str(s.unitText)}` : ''}`)
          .join('\n')}`
      : '',
    line('Description', cut(str(p.description))),
    reviews.length
      ? `Reviews (${reviews.length} with text in the page data, first ${Math.min(reviews.length, MAX_REVIEWS)}):\n${reviews
          .slice(0, MAX_REVIEWS)
          .map(
            (r) =>
              `  - ${stars(r) ? `${stars(r)}★ ` : ''}${str(r.author)}${r.datePublished ? ` (${str(r.datePublished)})` : ''}: ${flat(cut(body(r), 400))}`,
          )
          .join('\n')}`
      : '',
    line('Star ratings without text', bare.length ? `${bare.length} (${bare.map((x) => `${x}★`).join(', ')})` : ''),
  ]
    .filter(Boolean)
    .join('\n');
}

function salary(value: unknown): string {
  if (!value || typeof value !== 'object') return str(value);
  const s = value as Node;
  const v = (s.value ?? {}) as Node;
  const amount =
    typeof s.value === 'object'
      ? v.minValue != null || v.maxValue != null
        ? `${str(v.minValue)}–${str(v.maxValue)}`
        : str(v.value)
      : str(s.value);
  const unit = str(v.unitText) || str(s.unitText);
  return [amount, str(s.currency), unit ? `per ${unit.toLowerCase()}` : ''].filter(Boolean).join(' ');
}

function job(j: Node): string {
  const remote = str(j.jobLocationType).toUpperCase().includes('TELECOMMUTE');
  const locations = (Array.isArray(j.jobLocation) ? j.jobLocation : [j.jobLocation]).map(address).filter(Boolean);
  return [
    `### Job posting: ${str(j.title)}`,
    line('Company', str(j.hiringOrganization)),
    line('Location', [...(remote ? ['Remote'] : []), ...locations].join('; ')),
    line('Remote from', remote ? str(j.applicantLocationRequirements) : ''),
    line('Employment type', enumLabel(j.employmentType)),
    line('Salary', salary(j.baseSalary ?? j.estimatedSalary)),
    line('Posted', str(j.datePosted)),
    line('Apply by', str(j.validThrough)),
    line('Experience', str(j.experienceRequirements)),
    line('Education', str(j.educationRequirements)),
    line('Skills', cut(str(j.skills), 600)),
    line('Qualifications', cut(str(j.qualifications), 800)),
    line('Responsibilities', cut(str(j.responsibilities), 800)),
    line('Benefits', cut(str(j.jobBenefits), 600)),
    line('Apply', typeof j.url === 'string' ? j.url : ''),
    line('Description', cut(str(j.description), 4_000)),
  ]
    .filter(Boolean)
    .join('\n');
}

/** "20261201T180000Z" for Google Calendar; all-day dates stay "20261201". */
function calendarDate(value: string, end = false): string {
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const d = new Date(`${value}T00:00:00Z`);
    if (end) d.setUTCDate(d.getUTCDate() + 1);
    return d.toISOString().slice(0, 10).replace(/-/g, '');
  }
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  // Without an offset the time is local to the event: keep it as written (no Z).
  if (!/(Z|[+-]\d{2}:?\d{2})$/.test(value)) return value.replace(/[-:]/g, '').slice(0, 15);
  return d
    .toISOString()
    .replace(/[-:]/g, '')
    .replace(/\.\d{3}/, '');
}

function event(e: Node): string {
  const start = str(e.startDate);
  const end = str(e.endDate);
  const place = (Array.isArray(e.location) ? e.location : [e.location]).filter(Boolean) as Node[];
  const venue = place
    .map((l) =>
      types(l).includes('VirtualLocation') ? `Online${typeof l.url === 'string' ? ` (${l.url})` : ''}` : address(l),
    )
    .join('; ');
  let calendar = '';
  const from = start && calendarDate(start);
  if (from) {
    const to = (end && calendarDate(end, true)) || (from.length === 8 ? calendarDate(start, true) : from);
    const q = new URLSearchParams({ action: 'TEMPLATE', text: str(e.name), dates: `${from}/${to}`, location: venue });
    calendar = `https://calendar.google.com/calendar/render?${q}`;
  }
  return [
    `### Event: ${str(e.name)}`,
    line('Starts', start),
    line('Ends', end),
    line('Status', e.eventStatus ? enumLabel(e.eventStatus) : ''),
    line('Attendance', e.eventAttendanceMode ? enumLabel(e.eventAttendanceMode) : ''),
    line('Where', venue),
    line('Organizer', str(e.organizer)),
    line('Performers / speakers', str(e.performer)),
    ...offers(e.offers).map((o) => line('Tickets', o)),
    line('Add to Google Calendar', calendar),
    line('Description', cut(str(e.description))),
  ]
    .filter(Boolean)
    .join('\n');
}

const FORMAT: Record<StructuredType, (n: Node) => string> = {
  Recipe: recipe,
  Product: product,
  JobPosting: job,
  Event: event,
};

/**
 * The page's schema.org recipes, products, job postings and events as Markdown, with the types
 * found; null when it has none.
 */
/** <script type="application/ld+json">…</script>, any attribute order and quoting. */
const LD_SCRIPT = /<script\b[^>]*\btype\s*=\s*["']?application\/ld\+json["']?[^>]*>([\s\S]*?)<\/script\s*>/gi;

export function readStructuredData(html: string): { types: StructuredType[]; markdown: string } | null {
  if (!html.includes('application/ld+json')) return null;
  // Only the JSON-LD scripts are needed: cut them out of the HTML rather than parse the whole page
  // (faster, and DOMParser would log a CSP violation for each inline handler on the page).
  const nodes: Node[] = [];
  for (const [, json] of html.matchAll(LD_SCRIPT)) walk(parseJson(json ?? ''), nodes);
  const found = new Map<StructuredType, Node[]>();
  for (const node of nodes) {
    const family = familyOf(node);
    if (!family) continue;
    const list = found.get(family) ?? [];
    // The same item is often embedded twice (as itself and as a WebPage's mainEntity).
    if (list.length < MAX_PER_TYPE && !list.some((n) => str(n.name ?? n.title) === str(node.name ?? node.title)))
      list.push(node);
    found.set(family, list);
  }
  if (!found.size) return null;
  const blocks = [...found].flatMap(([family, list]) => list.map((n) => FORMAT[family](n)));
  return {
    types: [...found.keys()],
    markdown: `## Structured data (the page's own schema.org markup)\n\n${blocks.join('\n\n')}`,
  };
}
