# Proposed release gates and accountability

No gate is approved or passed. Role names below require named people before pilot. An owner may authorize a synthetic prototype without authorizing real-user data, minor access or deployment.

| Gate | Accountable owner | Required evidence before real pilot |
|---|---|---|
| G-01 Scope and budget | Founder/product owner | Accepted MVP/market/stack decisions, funded capacity, explicit launch authorization |
| G-02 Local privacy/legal readiness | Privacy owner + qualified local adviser | Purpose/lawful-basis map, country scope, notices, contracts, residency/subprocessors, rights/retention rules |
| G-03 Safeguarding and minors | Safeguarding lead | Named staff, funded support hours, escalation and coercion handling rehearsal; minor gate tested, personalization off unless separately approved |
| G-04 Partner supply | Local operations lead | Signed pilot terms, verified scoped programs, independent reviews, freshness owners, suspension procedure |
| G-05 Security | Technical owner + reviewer | Authorization/storage/export deny tests, MFA, secrets review, rate limits and critical findings resolved |
| G-06 AI | AI safety/product owners | Versioned grounding/adversarial evaluations, provider data review, fallback/disable test; or AI remains off |
| G-07 Accessibility/language | UX/localization owner | Thai/English critical translations reviewed, keyboard/screen-reader/mobile tests and severe barriers resolved |
| G-08 Operational recovery | Operations + technical owners | Alert ownership, incident simulation, actual backup/restore drill and approved recovery targets |
| G-09 Impact and commercial honesty | Impact + finance owners | Baseline/cohorts/thresholds, aggregate privacy checks, contract revenue/cost model, no unverified outcome claims |

Record gate status, approver/date, evidence and remaining scope limits in the release PR. Critical unresolved harm, tenant isolation failures, unstaffed safety escalation or unsupported legal/data processing blocks real launch. Owner approval cannot substitute for missing technical evidence. Country expansion and minor enablement require new scope-specific review. This is a proposed governance plan, not a statement of statutory requirements.
