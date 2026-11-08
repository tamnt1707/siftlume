/**
 * Prompt examples for the newer blocks, validated by `pnpm check:examples`:
 * a product review (Verdict, ProsCons, BarList, Checklist) and a news story with several actors
 * (People, Glossary).
 */
export const REVIEW_SUMMARY_EXAMPLE = `root = Card([hero, verdict, pc, bars, checklist, followUps])
hero = SummaryHero("Aero 14 laptop review", "Fast, quiet and light, but the screen is dim outdoors.", "techreviews.example", 9)
verdict = Verdict(8.5, 10, "The best thin laptop for travel under $1,500.", "Reviewer score")
pc = ProsCons(["14 hours of battery", "Silent under load", "1.2 kg"], ["Dim 300-nit screen", "Only two USB-C ports"])
bars = BarList([b1, b2, b3], "Battery life in the test")
b1 = BarItem("Aero 14", 14, "14 h")
b2 = BarItem("Rival X", 11, "11 h")
b3 = BarItem("Rival Y", 9, "9 h")
checklist = Checklist(["Check the screen in daylight", "Buy the 32 GB model if you edit video"], "Before you buy")
followUps = FollowUpBlock([FollowUpItem("How does it compare with Rival X?"), FollowUpItem("Is the 16 GB model enough?")])`;

export const NEWS_ACTORS_EXAMPLE = `root = Card([hero, takeaways, people, glossary, followUps])
hero = SummaryHero("City approves congestion charge", "Drivers will pay $9 to enter downtown from March, after a 7-2 council vote.")
takeaways = Takeaways([t1, t2])
t1 = Takeaway("Charge starts in March, weekdays only")
t2 = Takeaway("Revenue goes to buses and bike lanes")
people = People([p1, p2, p3], "Who is who")
p1 = Person("Lena Ortiz", "Mayor", "Says it will cut traffic by a fifth")
p2 = Person("Downtown Business Alliance", "Retail group", "Fears fewer shoppers")
p3 = Person("Sam Reid", "Transport analyst")
glossary = Glossary([g1, g2])
g1 = Term("Congestion charge", "A fee for driving into a busy area at busy times")
g2 = Term("Cordon", "The boundary of the charging zone")
followUps = FollowUpBlock([FollowUpItem("Who is exempt?"), FollowUpItem("What happened in other cities?")])`;
