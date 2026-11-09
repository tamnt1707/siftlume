/**
 * One prompt example per non-summary analysis mode, each with its own shape, validated by
 * `pnpm check:examples`: explain (Analogy, Diagram, Misconceptions, Glossary), critique
 * (ClaimCheck, ArgumentMap, RiskList, Checklist) and action (Checklist, Timeline, FactSheet, RiskList).
 */
export const EXPLAIN_EXAMPLE = `root = Card([hero, analogy, why, how, myths, glossary, followUps])
hero = SummaryHero("How vaccines train the immune system", "A vaccine shows your immune system a harmless copy of a germ so it reacts fast later.")
analogy = Analogy("a wanted poster", "The vaccine shows the germ's face, so your guards recognise it before it does harm.")
why = Takeaways([w1, w2], "Why it matters")
w1 = Takeaway("Protection without getting sick first")
w2 = Takeaway("Fewer infections also protect people who cannot be vaccinated")
how = Diagram("flowchart TD\\n  A[Vaccine dose] --> B[Immune cells meet antigen]\\n  B --> C[Antibodies made]\\n  C --> D[Memory cells kept]\\n  D --> E[Fast response to real germ]", "Each dose leaves memory cells behind")
myths = Misconceptions([m1, m2])
m1 = Misconception("Vaccines give you the disease", "They hold a weakened, inactive or partial germ that cannot cause it")
m2 = Misconception("One dose always lasts for life", "Some vaccines need boosters as memory fades")
glossary = Glossary([g1, g2])
g1 = Term("Antigen", "The part of a germ the immune system recognises")
g2 = Term("Booster", "A later dose that refreshes immune memory")
followUps = FollowUpBlock([FollowUpItem("Why do some vaccines need boosters?"), FollowUpItem("How are mRNA vaccines different?")])`;

export const CRITIQUE_EXAMPLE = `root = Card([hero, claims, args, flags, quote, check, followUps])
hero = SummaryHero("Op-ed: Remote work is killing innovation", "The core claim rests on one survey and anecdotes, so the evidence is thin.")
claims = ClaimCheck([c1, c2, c3], "Main claims")
c1 = Claim("Remote teams file fewer patents", "supported", "Cites a 2024 survey of 300 firms")
c2 = Claim("Offices create chance encounters that spark ideas", "opinion", "Based on the author's own experience")
c3 = Claim("Productivity fell everywhere", "unsupported", "No data given")
args = ArgumentMap("Offices are needed for innovation", [a1, a2, a3, a4], "How the argument holds up", "The case rests on one survey and leaves the counter-arguments unanswered.")
a1 = Argument("for", "Remote teams file fewer patents", "A 2024 survey of 300 firms")
a2 = Argument("for", "Two companies saw ideas dry up after going remote", "Named examples")
a3 = Argument("against", "Hybrid teams can innovate too", "The author admits this in passing")
a4 = Argument("against", "Remote work widens the hiring pool", "Raised by critics, not answered")
flags = RiskList([r1, r2], "What to keep in mind")
r1 = Risk("medium", "Author runs an office-space company", "Disclosed only at the end")
r2 = Risk("low", "Only managers are quoted", "No remote employees interviewed")
quote = SourceQuote("innovation has quietly collapsed since 2020", "The headline claim, stated without figures")
check = Checklist(["Find the survey's sample and method", "Look for studies on hybrid teams"], "Check before you share")
followUps = FollowUpBlock([FollowUpItem("Which survey does it cite?"), FollowUpItem("What would change the conclusion?")])`;

export const ACTION_EXAMPLE = `root = Card([hero, todo, dates, facts, risks, followUps])
hero = SummaryHero("Filing your 2025 tax return", "Gather your income forms now and file by April 15.")
todo = Checklist(["Download W-2 forms from each employer", "Collect receipts for deductions", "File online or request an extension"], "To do")
dates = Timeline([e1, e2, e3], "Deadlines")
e1 = TimelineEvent("Jan 31", "Employers send W-2 forms")
e2 = TimelineEvent("Apr 15", "Filing and payment deadline")
e3 = TimelineEvent("Oct 15", "Deadline with an extension")
facts = FactSheet([f1, f2], "Good to know")
f1 = Fact("Extension", "6 months", "Payment is still due Apr 15")
f2 = Fact("Free filing", "Income under $84,000")
risks = RiskList([k1], "If you miss it")
k1 = Risk("high", "Late penalty of 5% a month", "Up to 25% of the tax owed")
followUps = FollowUpBlock([FollowUpItem("How do I request an extension?"), FollowUpItem("Which deductions can I claim?")])`;
