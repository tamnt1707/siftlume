/** Everyday pages: a recipe's ingredients that rescale, an event at a glance, a rating breakdown. */
import { useTranslation } from 'react-i18next';
import { defineComponent, useStateField } from '@openuidev/react-lang';
import { z } from 'zod/v4';
import { childProps } from './shared';

// ── Ingredients ────────────────────────────────────────────────────────────────

export const Ingredient = defineComponent({
  name: 'Ingredient',
  description:
    'One ingredient: name (with preparation, e.g. "onion, finely chopped"); qty as a number when the source gives one (2, 0.5, 250), omitted for "to taste"; unit as written ("g", "tbsp", "cup", "large"); optional note ("optional", "or butter").',
  props: z.object({
    name: z.string(),
    qty: z.number().optional(),
    unit: z.string().optional(),
    note: z.string().optional(),
  }),
  component: () => null,
});

type IngredientProps = { name?: string; qty?: number; unit?: string; note?: string };

const FRACTIONS: [number, string][] = [
  [1 / 8, '⅛'],
  [1 / 4, '¼'],
  [1 / 3, '⅓'],
  [1 / 2, '½'],
  [2 / 3, '⅔'],
  [3 / 4, '¾'],
];

/** Units measured in decimals; everything else (cups, spoons, pieces) reads better as fractions. */
const METRIC = /^(m?g|kg|grams?|kilograms?|ml|cl|dl|l|litres?|liters?|oz|lb|°c|°f)$/i;

/** A rescaled quantity, the way a cook writes it: "1 ½", "250", "0.75". */
export function formatQty(value: number, unit = ''): string {
  if (!Number.isFinite(value) || value <= 0) return '';
  if (METRIC.test(unit.trim()) || value >= 20) {
    const rounded =
      value >= 100 ? Math.round(value / 5) * 5 : value >= 10 ? Math.round(value) : Math.round(value * 10) / 10;
    return String(rounded);
  }
  const whole = Math.floor(value);
  const rest = value - whole;
  const near = FRACTIONS.find(([f]) => Math.abs(rest - f) < 0.04);
  if (rest < 0.04) return String(whole || value.toFixed(2));
  if (rest > 0.96) return String(whole + 1);
  if (near) return whole ? `${whole} ${near[1]}` : near[1];
  return String(Math.round(value * 100) / 100);
}

const stateKey = (prefix: string, parts: string[]) => {
  let h = 0;
  for (const c of parts.join('\u0001')) h = (h * 31 + c.charCodeAt(0)) | 0;
  return `${prefix}_${Math.abs(h).toString(36)}`;
};

export const Ingredients = defineComponent({
  name: 'Ingredients',
  description:
    'A recipe\'s ingredients with a servings stepper that rescales every qty in the browser, tickable while shopping or cooking. servings = the yield as a number (4 for "Serves 4", 12 for "Makes 12"). Use one per group the recipe has (heading = its group name).',
  props: z.object({
    servings: z.number(),
    items: z.array(Ingredient.ref),
    heading: z.string().optional(),
  }),
  component: ({ props }) => {
    const { t } = useTranslation('session');
    const items = childProps<IngredientProps>(props.items).filter((x) => x.name);
    const base = props.servings > 0 ? props.servings : 1;
    const key = stateKey(
      'ingredients',
      items.map((x) => x.name!),
    );
    const servingsField = useStateField(`${key}_servings`);
    const ticksField = useStateField(`${key}_ticks`);
    const servings = typeof servingsField.value === 'number' && servingsField.value > 0 ? servingsField.value : base;
    const ticked = (Array.isArray(ticksField.value) ? ticksField.value : []) as number[];
    const step = (by: number) => servingsField.setValue(Math.max(1, servings + by));
    const factor = servings / base;
    return (
      <section className="g-ingredients">
        <div className="g-checklist__head">
          {props.heading && <h2 className="g-heading">{props.heading}</h2>}
          <span className="g-ingredients__servings">
            <button
              type="button"
              onClick={() => step(-1)}
              disabled={servings <= 1}
              aria-label={t('genui.ingredients.fewer')}
            >
              −
            </button>
            <span>{t('genui.ingredients.servings', { count: servings })}</span>
            <button type="button" onClick={() => step(1)} aria-label={t('genui.ingredients.more')}>
              +
            </button>
            {servings !== base && (
              <button type="button" className="g-ingredients__reset" onClick={() => servingsField.setValue(base)}>
                {t('genui.ingredients.reset')}
              </button>
            )}
          </span>
        </div>
        <ul>
          {items.map((x, i) => {
            const done = ticked.includes(i);
            const qty = typeof x.qty === 'number' ? formatQty(x.qty * factor, x.unit) : '';
            return (
              <li key={i}>
                <label className={done ? 'is-done' : ''}>
                  <input
                    type="checkbox"
                    checked={done}
                    onChange={() => ticksField.setValue(done ? ticked.filter((n) => n !== i) : [...ticked, i])}
                  />
                  <span className="g-ingredient__qty">{[qty, x.unit].filter(Boolean).join(' ')}</span>
                  <span className="g-ingredient__name">
                    {x.name}
                    {x.note && <span className="g-ingredient__note"> · {x.note}</span>}
                  </span>
                </label>
              </li>
            );
          })}
        </ul>
      </section>
    );
  },
});

// ── Event ──────────────────────────────────────────────────────────────────────

export const EVENT_STATUSES = ['scheduled', 'cancelled', 'postponed', 'rescheduled', 'online'] as const;

const safeUrl = (url?: string) => (url && /^https:\/\//.test(url) ? url : null);

export const EventCard = defineComponent({
  name: 'EventCard',
  description:
    'One event at a glance: title; start as ISO 8601 when the source gives a date (with time and offset when known, e.g. "2026-12-01T18:00:00+07:00"); optional end the same way; place (venue and city, or "Online"); status "scheduled" | "cancelled" | "postponed" | "rescheduled" | "online"; price as written; ticketUrl and calendarUrl only when given in the source.',
  props: z.object({
    title: z.string(),
    start: z.string(),
    end: z.string().optional(),
    place: z.string().optional(),
    status: z.enum(EVENT_STATUSES).optional(),
    price: z.string().optional(),
    ticketUrl: z.string().optional(),
    calendarUrl: z.string().optional(),
  }),
  component: ({ props }) => {
    const { t, i18n } = useTranslation('session');
    const start = new Date(props.start);
    const valid = /^\d{4}-\d{2}-\d{2}/.test(props.start) && !Number.isNaN(start.getTime());
    const hasTime = /T\d{2}:\d{2}/.test(props.start);
    const lang = i18n.language;
    const status = EVENT_STATUSES.includes(props.status as never) ? props.status : null;
    const end = props.end ? new Date(props.end) : null;
    // Days from today (local calendar days), for "today", "in 3 days" or "ended".
    const days = valid
      ? Math.round(
          (new Date(start.getFullYear(), start.getMonth(), start.getDate()).getTime() -
            new Date(new Date().toDateString()).getTime()) /
            86_400_000,
        )
      : null;
    const over = (end && !Number.isNaN(end.getTime()) ? end : start).getTime() < Date.now();
    const when = valid
      ? [
          start.toLocaleDateString(lang, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }),
          hasTime ? start.toLocaleTimeString(lang, { hour: '2-digit', minute: '2-digit', timeZoneName: 'short' }) : '',
        ]
          .filter(Boolean)
          .join(' · ')
      : props.start;
    const tickets = safeUrl(props.ticketUrl);
    const calendar = safeUrl(props.calendarUrl);
    return (
      <section className={`g-eventcard ${status === 'cancelled' || status === 'postponed' ? 'is-off' : ''}`}>
        {valid && (
          <div className="g-eventcard__date" aria-hidden="true">
            <span>{start.toLocaleDateString(lang, { month: 'short' })}</span>
            <strong>{start.getDate()}</strong>
          </div>
        )}
        <div className="g-eventcard__body">
          <div className="g-eventcard__top">
            {status && status !== 'scheduled' && (
              <span className={`g-eventcard__status g-eventcard__status--${status}`}>{t(`genui.event.${status}`)}</span>
            )}
            {valid && days !== null && status !== 'cancelled' && (
              <span className="g-eventcard__when">
                {over
                  ? t('genui.event.ended')
                  : days <= 0
                    ? t('genui.event.today')
                    : t('genui.event.inDays', { count: days })}
              </span>
            )}
          </div>
          <h2 className="g-eventcard__title">{props.title}</h2>
          <p className="g-eventcard__line">{when}</p>
          {props.place && <p className="g-eventcard__line">{props.place}</p>}
          {props.price && <p className="g-eventcard__line g-eventcard__price">{props.price}</p>}
          {(tickets || calendar) && (
            <div className="g-eventcard__actions">
              {tickets && (
                <a className="btn btn--sm btn--primary" href={tickets} target="_blank" rel="noreferrer">
                  {t('genui.event.tickets')}
                </a>
              )}
              {calendar && (
                <a className="btn btn--sm" href={calendar} target="_blank" rel="noreferrer">
                  {t('genui.event.calendar')}
                </a>
              )}
            </div>
          )}
        </div>
      </section>
    );
  },
});

// ── Rating ─────────────────────────────────────────────────────────────────────

export const RatingBreakdown = defineComponent({
  name: 'RatingBreakdown',
  description:
    'A rating at a glance: average (e.g. 4.6), max (default 5), count of ratings, and bars = the number of ratings per star from the top star down (e.g. [120, 30, 8, 2, 5]) only when the source gives them. Products, apps, places, courses.',
  props: z.object({
    average: z.number(),
    max: z.number().optional(),
    count: z.number().optional(),
    bars: z.array(z.number()).optional(),
    label: z.string().optional(),
  }),
  component: ({ props }) => {
    const { t, i18n } = useTranslation('session');
    const max = props.max && props.max > 0 ? props.max : 5;
    const average = Math.min(Math.max(props.average, 0), max);
    const bars = (props.bars ?? []).slice(0, max).map((n) => (Number.isFinite(n) && n > 0 ? n : 0));
    const total = bars.reduce((a, b) => a + b, 0);
    const fmt = (n: number) => n.toLocaleString(i18n.language);
    return (
      <section className="g-rating">
        <div className="g-rating__score">
          <strong>{fmt(Math.round(average * 10) / 10)}</strong>
          <span className="g-rating__stars" role="img" aria-label={t('genui.rating.outOf', { value: average, max })}>
            <span className="g-rating__fill" style={{ width: `${(average / max) * 100}%` }} />
          </span>
          {props.count != null && (
            <span className="g-rating__count">
              {t('genui.rating.count', { count: props.count, formatted: fmt(props.count) })}
            </span>
          )}
          {props.label && <span className="g-rating__count">{props.label}</span>}
        </div>
        {total > 0 && (
          <ul className="g-rating__bars">
            {bars.map((n, i) => (
              <li key={i}>
                <span className="g-rating__star">{max - i}★</span>
                <span className="g-bar__track">
                  <span className="g-bar__fill" style={{ width: `${(n / total) * 100}%` }} />
                </span>
                <span className="g-rating__pct">{Math.round((n / total) * 100)}%</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    );
  },
});
