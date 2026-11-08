/**
 * Showcase content: a fictional news article and the summary program Siftlume renders for it.
 * The publication is made up; the numbers match between the article and the summary.
 */
export const ARTICLE = {
  site: 'The Daily Current',
  url: 'dailycurrent.example/energy/ev-sales-record',
  section: 'Energy & Transport',
  title: 'Electric car sales hit a record as battery prices keep falling',
  dek: 'A price war, cheaper cells and new models pushed global sales to 17 million last year. Charging remains the sticking point.',
  byline: 'By Mara Okafor · 14 min read',
  paragraphs: [
    'Global sales of electric cars reached a record 17 million in 2025, according to figures compiled by industry analysts and published this week, as falling battery costs and an intensifying price war among manufacturers drew in buyers who had long been put off by price.',
    'The total means sales grew 35 percent year over year, and electric models now account for roughly 22 percent of all new cars sold worldwide. Analysts say the pace surprised even the most optimistic forecasts made at the start of the year.',
    'China remained the engine of the market. Buyers there accounted for about six in every ten electric cars sold, helped by a crowded field of domestic brands competing aggressively on price. Several manufacturers cut prices more than once during the year.',
    'The single biggest driver, analysts say, is the battery. The average price of a battery pack fell below $100 per kilowatt-hour in 2024 and dropped to around $90 in 2025, a 12 percent decline in a single year. That has brought the sticker price of many electric models level with comparable petrol cars for the first time.',
    '“Once the purchase price matches, the conversation changes completely,” said one senior analyst. “People stop asking whether they can afford an electric car and start asking where they will charge it.”',
    'That question is now the main barrier. Surveys of potential buyers consistently rank access to charging, especially for people without a driveway, above range or price. Public charging networks are expanding, but unevenly, and reliability remains a complaint.',
    'Policy is another uncertainty. Several European governments have reduced or ended purchase subsidies, and analysts warn that growth in the region could slow in the year ahead even as prices continue to fall.',
    'The story of the past three years has been one of rapid change. A price war began in China in 2023, battery costs crossed the $100 mark in 2024, and 2025 delivered the record. Whether 2026 keeps that pace will depend on charging and on policy as much as on technology.',
  ],
};

export const SUMMARY = `root = Card([hero, numbers, takeaways, timeline, quote, details, followUps], [{title: "Electric car sales hit a record", sourceName: "The Daily Current", url: "https://dailycurrent.example/energy/ev-sales-record"}])
hero = SummaryHero("Electric car sales hit a record", "Cheaper batteries pushed EV sales up 35% to a record 17 million in 2025.", null, 14)
numbers = KeyNumbers([n1, n2, n3])
n1 = KeyNumber("17M", "cars sold", "+35%")
n2 = KeyNumber("22%", "of new cars")
n3 = KeyNumber("$90", "per kWh battery", "-12%")
takeaways = Takeaways([t1, t2, t3])
t1 = Takeaway("China buys 6 in 10 EVs", "Local brands compete hard on price")
t2 = Takeaway("EVs now cost the same as petrol cars")
t3 = Takeaway("Charging access is the main barrier")
timeline = Timeline([e1, e2, e3], "How we got here")
e1 = TimelineEvent("2023", "Price war starts in China")
e2 = TimelineEvent("2024", "Batteries fall below $100/kWh")
e3 = TimelineEvent("2025", "Record 17M sales")
quote = SourceQuote("sales grew 35 percent year over year", "The headline figure")
details = SectionBlock([SectionItem("risks", "Risks", [d1])], true)
d1 = TextContent("Subsidy cuts in Europe could slow growth in 2026.")
followUps = FollowUpBlock([FollowUpItem("Why is charging the main barrier?"), FollowUpItem("What happens in 2026?")])`;
