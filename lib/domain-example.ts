/**
 * Prompt examples for the domain blocks, validated by `pnpm check:examples`:
 * a product page (FactSheet, Comparison, PricingPlans), release notes (ChangeList, StatusBoard,
 * RiskList) and a research article (ResearchBrief, ClaimCheck).
 */
export const PRODUCT_COMPARE_EXAMPLE = `root = Card([hero, facts, compare, plans, followUps])
hero = SummaryHero("NoteFlow pricing", "NoteFlow is free for one user; teams pay $8 per seat for sync and admin tools.")
facts = FactSheet([f1, f2, f3], "At a glance")
f1 = Fact("Platforms", "Web, macOS, Windows, iOS")
f2 = Fact("Free trial", "14 days", "No card needed")
f3 = Fact("Storage", "5 GB per seat")
compare = Comparison(["NoteFlow", "Rival Notes"], [r1, r2, r3], "Compared with Rival Notes", "NoteFlow is cheaper for small teams.")
r1 = CompareRow("Price per seat", ["$8", "$10"], "NoteFlow")
r2 = CompareRow("Offline mode", ["Yes", "Yes"])
r3 = CompareRow("Version history", ["30 days", "1 year"], "Rival Notes")
plans = PricingPlans([p1, p2], "Plans")
p1 = Plan("Free", "$0", ["1 user", "Unlimited notes"], "forever")
p2 = Plan("Team", "$8", ["Shared spaces", "Admin console", "Priority support"], "per seat / month", true, "For teams of 2-50")
followUps = FollowUpBlock([FollowUpItem("Is there a yearly discount?"), FollowUpItem("Can I import from Rival Notes?")])`;

export const RELEASE_NOTES_EXAMPLE = `root = Card([hero, changes, board, risks, followUps])
hero = SummaryHero("Orbit 3.0 release notes", "Orbit 3.0 adds plugins and drops Node 18, so check your runtime before upgrading.")
changes = ChangeList([c1, c2, c3, c4], "Version 3.0")
c1 = Change("added", "Plugin API for custom exporters")
c2 = Change("changed", "Config file renamed to orbit.config.ts")
c3 = Change("removed", "Support for Node 18")
c4 = Change("security", "Patched path traversal in the dev server")
board = StatusBoard([s1, s2], "Roadmap")
s1 = StatusColumn("In progress", ["Windows installer", "Faster cold start"], "active")
s2 = StatusColumn("Planned", ["Remote cache"], "planned")
risks = RiskList([k1, k2], "Before you upgrade")
k1 = Risk("high", "Builds fail on Node 18", "Upgrade to Node 20 first")
k2 = Risk("low", "Old config name still read once", "Rename it to silence the warning")
followUps = FollowUpBlock([FollowUpItem("How do I migrate my config?"), FollowUpItem("Which plugins exist already?")])`;

export const RESEARCH_PAPER_EXAMPLE = `root = Card([hero, brief, claims, followUps])
hero = SummaryHero("Walking after meals and blood sugar", "Ten minutes of walking after meals lowered blood sugar spikes in a small trial.", "study.pdf", 12)
brief = ResearchBrief("Does a short walk after meals lower blood sugar spikes?", ["Spikes fell 22% versus sitting", "Effect was largest after dinner"], "Randomized crossover trial", "48 adults with prediabetes, 4 weeks", ["Small sample", "Short follow-up"])
claims = ClaimCheck([cl1, cl2], "Claims in the press release")
cl1 = Claim("Walking cuts spikes by a fifth", "supported", "Trial data in table 2")
cl2 = Claim("Walking prevents diabetes", "unsupported", "The study did not measure diabetes")
followUps = FollowUpBlock([FollowUpItem("How fast did they walk?"), FollowUpItem("Who funded the study?")])`;
