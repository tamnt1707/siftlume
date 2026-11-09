/**
 * Examples for the analysis blocks, each a different kind of source, validated by
 * `pnpm check:examples`: a policy debate (CauseEffect, Perspectives, BeforeAfter, Scenarios),
 * a buying decision (DecisionMatrix, Calculation, Matrix2x2, QrCode) and a coding tutorial
 * (Tree, CodeWalkthrough).
 */
export const POLICY_DEBATE_EXAMPLE = `root = Card([hero, why, before, views, futures, followUps])
hero = SummaryHero("City votes on a downtown congestion charge", "A $9 daily charge for cars entering downtown starts in March, if the council approves it on Friday.")
why = CauseEffect(["Commute times up 30% since 2019", "Bus lanes blocked at rush hour", "Air quality below national limits"], "A $9 charge on cars entering downtown", ["Fewer cars at peak hours", "About $120M a year for transit", "Higher costs for delivery firms"], "Why now")
before = BeforeAfter([s1, s2, s3], "What changes for drivers")
s1 = Shift("Entering downtown", "Free", "$9 a day, 6am-8pm")
s2 = Shift("Bus frequency", "Every 15 minutes", "Every 8 minutes")
s3 = Shift("Residents", "No permit", "90% discount with a permit")
views = Perspectives([p1, p2, p3], "Who should pay to fix downtown traffic?", "Who says what")
p1 = Perspective("Mayor's office", "for", "The charge pays for faster buses and cleaner air")
p2 = Perspective("Retailers' association", "against", "Shoppers will drive to suburban malls instead", "It's a tax on our customers")
p3 = Perspective("Transit riders' union", "mixed", "Supports it only if bus upgrades come first")
futures = Scenarios([f1, f2], "What could happen")
f1 = Scenario("base", "Traffic eases", "Peak traffic falls about 15%, as in similar cities", "medium", "Bus ridership in the first 3 months")
f2 = Scenario("worst", "Shoppers stay away", "Downtown sales drop and the charge is cut back", "low", "Retail sales reports")
followUps = FollowUpBlock([FollowUpItem("Who is exempt from the charge?"), FollowUpItem("How did other cities' charges work out?")])`;

export const DECISION_EXAMPLE = `root = Card([hero, matrix, cost, swot, trial, followUps])
hero = SummaryHero("Picking a project tool for a 10-person team", "Taskflow fits small teams best: cheapest per seat and the easiest to learn.")
matrix = DecisionMatrix([c1, c2, c3, c4], [o1, o2, o3], "How they score", "Taskflow wins on price and ease; Boardly if you need reporting.")
c1 = Criterion("Price", 3)
c2 = Criterion("Ease of use", 2)
c3 = Criterion("Reporting")
c4 = Criterion("Integrations")
o1 = Choice("Taskflow", [5, 5, 3, 3])
o2 = Choice("Boardly", [3, 3, 5, 4], "Best dashboards")
o3 = Choice("PlanPro", [2, 3, 4, 5])
cost = Calculation([k1, k2, k3], "Taskflow, first year", "$816", "Yearly cost for 10 people", "Price as listed in March")
k1 = CalcStep("10 seats × $8 a month", "$960")
k2 = CalcStep("Annual billing discount", "$144", "-")
k3 = CalcStep("Setup fee", "$0", "+")
swot = Matrix2x2([q1, q2, q3, q4], "Taskflow at a glance")
q1 = Quadrant("Strengths", ["Lowest price per seat", "Set up in a day"])
q2 = Quadrant("Weaknesses", ["Basic reports only"])
q3 = Quadrant("Opportunities", ["Reporting add-on due this year"])
q4 = Quadrant("Threats", ["Price rise after 2025 promised freeze"])
trial = QrCode("https://taskflow.example/trial", "Start a 30-day free trial", "No card needed")
followUps = FollowUpBlock([FollowUpItem("Which tool works best with Slack?"), FollowUpItem("Can we switch tools later?")])`;

export const CODE_TUTORIAL_EXAMPLE = `root = Card([hero, files, walk, terms, followUps])
hero = SummaryHero("Build a REST API with Express in 10 minutes", "Create a server, add one route per action and return JSON.")
files = Tree("my-api/", [b1, b2, b3], "Project layout")
b1 = Branch("src/", ["server.js: starts the app", "routes/todos.js: the API routes"])
b2 = Branch("package.json", [], "Dependencies and the start script")
b3 = Branch("tests/", ["todos.test.js"])
walk = CodeWalkthrough("import express from 'express';\\nconst app = express();\\napp.use(express.json());\\n\\napp.get('/todos', (req, res) => {\\n  res.json(todos);\\n});\\n\\napp.listen(3000);", [n1, n2, n3, n4], "javascript", "The whole server")
n1 = CodeNote("1-2", "Create the Express app")
n2 = CodeNote("3", "Parse JSON request bodies")
n3 = CodeNote("5-7", "GET /todos returns the list as JSON")
n4 = CodeNote("9", "Listen for requests on port 3000")
terms = Glossary([g1, g2])
g1 = Term("Route", "A URL path plus the HTTP method it answers")
g2 = Term("Middleware", "A function that runs on every request before the route")
followUps = FollowUpBlock([FollowUpItem("How do I add a POST route?"), FollowUpItem("How do I test the API?")])`;
