/**
 * Prompt example for numeric sources: one chart per insight, each with a short caption,
 * using only values stated in the source. Validated against the library with the parser.
 */
export const CHART_SUMMARY_EXAMPLE = `root = Card([hero, numbers, trendCap, trend, mixCap, mix, rankCap, rank, takeaways, followUps])
hero = SummaryHero("Acme Q3 earnings", "Cloud drove 18% revenue growth while hardware kept shrinking.", "Acme investor report")
numbers = KeyNumbers([r, m, c])
r = KeyNumber("$4.2B", "revenue", "+18%")
m = KeyNumber("31%", "operating margin")
c = KeyNumber("1.2M", "active customers", "+9%")
trendCap = TextContent("Revenue grew every quarter", "small-heavy")
trend = LineChart(["Q4 24", "Q1 25", "Q2 25", "Q3 25"], [Series("Revenue ($B)", [3.4, 3.6, 3.9, 4.2])], "natural", null, "$B")
mixCap = TextContent("Cloud is now most of revenue", "small-heavy")
mix = PieChart(["Cloud", "Software", "Hardware"], [58, 27, 15], "donut")
rankCap = TextContent("Asia grows fastest", "small-heavy")
rank = HorizontalBarChart(["Asia", "Europe", "Americas"], [Series("Growth %", [26, 15, 11])])
takeaways = Takeaways([t1, t2])
t1 = Takeaway("Cloud margin offsets hardware decline")
t2 = Takeaway("Guidance raised for Q4")
followUps = FollowUpBlock([FollowUpItem("Why is hardware shrinking?"), FollowUpItem("What is the Q4 outlook?")])`;
