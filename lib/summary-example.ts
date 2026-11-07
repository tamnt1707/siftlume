/**
 * A valid, visual-first summary used as a prompt example: hero with a one-line TL;DR, headline
 * figures, short takeaways, a real timeline, one quote, folded details and follow-ups.
 * Validated against the library with the parser.
 */
export const VISUAL_SUMMARY_EXAMPLE = `root = Card([hero, numbers, takeaways, tags, timeline, quote, details, followUps], [{title: "EV sales hit a record", sourceName: "example.com", url: "https://example.com/ev-sales"}])
hero = SummaryHero("EV sales hit a record", "Cheaper batteries pushed EV sales up 35% in 2025.", "example.com", 6)
numbers = KeyNumbers([n1, n2, n3])
n1 = KeyNumber("17M", "cars sold", "+35%")
n2 = KeyNumber("22%", "of new cars")
n3 = KeyNumber("$90", "per kWh battery", "-12%")
takeaways = Takeaways([t1, t2, t3])
t1 = Takeaway("China buys 6 in 10 EVs", "Local brands dominate on price")
t2 = Takeaway("EVs now cost the same as petrol cars")
t3 = Takeaway("Charging is still the main barrier")
tags = TagBlock(["Electric vehicles", "Batteries", "China"])
timeline = Timeline([e1, e2, e3], "How we got here")
e1 = TimelineEvent("2023", "Price war starts in China")
e2 = TimelineEvent("2024", "Battery costs fall below $100/kWh")
e3 = TimelineEvent("2025", "Record 17M sales")
quote = SourceQuote("sales grew 35 percent year over year", "The headline claim")
details = SectionBlock([SectionItem("why", "Why it matters", [d1]), SectionItem("risks", "Risks", [d2])], true)
d1 = TextContent("Cheaper EVs speed up the end of petrol car sales.")
d2 = TextContent("Subsidy cuts in Europe could slow growth.")
followUps = FollowUpBlock([FollowUpItem("Which brands lead?"), FollowUpItem("What is expected for 2026?")])`;
