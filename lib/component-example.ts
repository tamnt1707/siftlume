/**
 * Programs using the newer blocks (ActionItems, Findings, Ingredients, EventCard,
 * RatingBreakdown), validated by `pnpm check:examples` and shown in the showcase
 * (`?view=components&set=everyday`). PR_REVIEW_EXAMPLE is also the model's example for pull
 * request critiques and action lists (lib/openui.ts modeExamples); the others are not sent: the
 * component descriptions and the page-type rules teach them.
 */
export const PR_REVIEW_EXAMPLE = `root = Card([hero, findings, actions])
hero = SummaryHero("Retry failed uploads", "Adds retries with backoff to the uploader; one bug can retry forever.", "github.com", 3)
findings = Findings([f1, f2, f3], "Review")
f1 = Finding("blocker", "Retry loop never stops on 4xx", "src/upload.ts:42", "https://github.com/acme/app/pull/12/files#diff-1", "Client errors are retried like network errors, so a bad file loops forever.", "if (res.status < 500) throw err;")
f2 = Finding("major", "No test for the backoff timing", "src/upload.test.ts", "", "The delay doubling is untested; a regression would hammer the server.", "Add a fake-timer test for 1s, 2s, 4s.")
f3 = Finding("nit", "Magic number for max retries", "src/upload.ts:8", "", "Name it MAX_RETRIES.")
actions = ActionItems([a1, a2, a3], "Before merging")
a1 = ActionItem("Stop retrying on client errors", "@mina", "before merge", "doing")
a2 = ActionItem("Answer the review on backoff caps", "@lee", "", "todo")
a3 = ActionItem("Fix the failing Windows CI job", "@mina", "", "blocked")`;

export const RECIPE_EXAMPLE = `root = Card([hero, numbers, ingredients, steps])
hero = SummaryHero("Easy pancakes", "Thin crêpe-style pancakes from flour, eggs and milk in 30 minutes.", "bbcgoodfood.com", 2)
numbers = KeyNumbers([k1, k2, k3])
k1 = KeyNumber("30 min", "total time")
k2 = KeyNumber("12", "pancakes")
k3 = KeyNumber("61", "kcal each")
ingredients = Ingredients(12, [i1, i2, i3, i4, i5], "Ingredients")
i1 = Ingredient("plain flour", 100, "g")
i2 = Ingredient("eggs", 2, "large")
i3 = Ingredient("milk", 300, "ml")
i4 = Ingredient("sunflower oil, plus extra for frying", 1, "tbsp")
i5 = Ingredient("lemon wedges and caster sugar", null, null, "to serve")
steps = Steps([s1, s2, s3])
s1 = StepsItem("Whisk the batter", "Flour, eggs, milk, oil and a pinch of salt until smooth.")
s2 = StepsItem("Rest", "30 minutes if you have time.")
s3 = StepsItem("Cook", "1 minute per side in a hot oiled pan, half a ladle each.")`;

export const PRODUCT_EVENT_EXAMPLE = `root = Card([hero, rating, event])
hero = SummaryHero("iPhone 15 128GB", "21.49M VND, in stock; buyers rate it 4.9/5.", "cellphones.com.vn", 2)
rating = RatingBreakdown(4.9, 5, 102, [92, 7, 2, 0, 1], "Buyer ratings")
event = EventCard("Lean Global Connection 2026", "2026-11-12T14:00:00Z", "2026-11-13T14:00:00Z", "Online", "online", "Free – 108.55 USD", "https://www.eventbrite.com/e/lean-global-connection-2026-tickets-1992427899482", "https://calendar.google.com/calendar/render?action=TEMPLATE&text=Lean+Global+Connection+2026")`;
