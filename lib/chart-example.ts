/**
 * Prompt example for numeric sources: one chart per insight, each with a short caption,
 * using only values stated in the source, each figure with the passage it comes from, and one
 * figure worked out from two of them, with its inputs.
 * Validated against the library with the parser.
 */
export const CHART_SUMMARY_EXAMPLE = `root = Card([hero, numbers, trendCap, trend, trendSrc, mixCap, mix, mixSrc, rankCap, rank, rankSrc, takeaways, followUps])
hero = SummaryHero("Acme Q3 earnings", "Cloud drove 18% revenue growth while hardware kept shrinking.", "Acme investor report")
numbers = KeyNumbers([r, m, c, g])
r = KeyNumber("$4.2B", "revenue", "+18%", "Revenue reached $4.2B in the third quarter, up 18% from a year earlier")
g = KeyNumber("+$0.8B", "revenue added since Q4 24", null, null, [{label: "Q4 24", value: "$3.4B", quote: "fourth-quarter revenue of $3.4B"}, {label: "Q3 25", value: "$4.2B", quote: "Revenue reached $4.2B in the third quarter"}])
m = KeyNumber("31%", "operating margin", null, "operating margin improved to 31%")
c = KeyNumber("1.2M", "active customers", "+9%", "we now serve 1.2M active customers")
trendCap = TextContent("Revenue grew every quarter", "small-heavy")
trend = LineChart(["Q4 24", "Q1 25", "Q2 25", "Q3 25"], [Series("Revenue ($B)", [3.4, 3.6, 3.9, 4.2])], "natural", null, "$B")
trendSrc = ChartSources([ChartPoint("Q4 24", "$3.4B", "fourth-quarter revenue of $3.4B"), ChartPoint("Q1 25", "$3.6B", "first-quarter revenue rose to $3.6B"), ChartPoint("Q2 25", "$3.9B", "second-quarter revenue of $3.9B"), ChartPoint("Q3 25", "$4.2B", "Revenue reached $4.2B in the third quarter")])
mixCap = TextContent("Cloud is now most of revenue", "small-heavy")
mix = PieChart(["Cloud", "Software", "Hardware"], [58, 27, 15], "donut")
mixSrc = ChartSources([ChartPoint("Cloud", "58%", "cloud made up 58% of revenue"), ChartPoint("Software", "27%", "software contributed 27%"), ChartPoint("Hardware", "15%", "hardware fell to 15% of the total")])
rankCap = TextContent("Asia grows fastest", "small-heavy")
rank = HorizontalBarChart(["Asia", "Europe", "Americas"], [Series("Growth %", [26, 15, 11])])
rankSrc = ChartSources([ChartPoint("Asia", "26%", "sales in Asia grew 26%"), ChartPoint("Europe", "15%", "Europe was up 15%"), ChartPoint("Americas", "11%", "the Americas added 11%")])
takeaways = Takeaways([t1, t2])
t1 = Takeaway("Cloud margin offsets hardware decline")
t2 = Takeaway("Guidance raised for Q4")
followUps = FollowUpBlock([FollowUpItem("Why is hardware shrinking?"), FollowUpItem("What is the Q4 outlook?")])`;
