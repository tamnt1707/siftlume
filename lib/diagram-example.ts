/**
 * Prompt example for process-heavy sources: a Mermaid flowchart inside a Diagram, kept small,
 * with short labels and no styling. Validated with the OpenUI parser and with Pele.
 */
export const DIAGRAM_SUMMARY_EXAMPLE = `root = Card([hero, flow, takeaways, followUps])
hero = SummaryHero("How OAuth login works", "The app never sees your password; it gets a short-lived token instead.")
flow = Diagram("flowchart LR\\n  U([User]) --> A[App]\\n  A -->|redirect| P[Login provider]\\n  P --> C{Consent?}\\n  C -->|yes| T[Issue code]\\n  C -->|no| X([Cancelled])\\n  T --> A2[App swaps code for token]\\n  A2 --> D([Signed in])", "Password stays with the provider")
takeaways = Takeaways([t1, t2])
t1 = Takeaway("Tokens expire, passwords do not")
t2 = Takeaway("Consent screen lists requested access")
followUps = FollowUpBlock([FollowUpItem("What is a refresh token?"), FollowUpItem("Is OAuth the same as SSO?")])`;
