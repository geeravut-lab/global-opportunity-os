# Decision and assumption register

Status at 4 November 2026. Only confirmed items below are explicit user decisions. Proposed safety gates are included as engineering recommendations, not a claim that a policy has been legally approved.

## Confirmed

| ID | Decision | Evidence |
|---|---|---|
| C-01 | Build a social web application with a worldwide long-term mission. | Initial user request, SOURCE_CONTEXT.md |
| C-02 | Include all underserved groups, rather than choosing one beneficiary group as the permanent mission. | User chose D in strategy turn |
| C-03 | Generate sustainable income supporting founder and platform growth. | Initial user request |
| C-04 | GitHub repository created and Codex connected, as reported by user. | Setup-complete user statement; connection not independently tested |
| C-05 | Use Global Opportunity OS as the project name for this starter pack. | Current request |
| C-06 | Deliver documentation/scaffold ZIP, honest about absent code, with specified safety and financial topics. | Current request |

## Proposed baseline and unresolved choices

| ID | Proposal / assumption | Owner to decide | Decision needed before |
|---|---|---|---|
| P-01 | Essential beneficiary access free; B2B funds operations; no selling personal data. | Founder | Commercial pilot |
| P-02 | Navigator + verified directory + partner cases + basic impact first. | Product owner | Application implementation |
| P-03 | Thailand pilot, Thai/English, adult personalized workflows initially. | Product + safeguarding leads | Real-user onboarding |
| P-04 | Next.js/TypeScript/Tailwind, Supabase/PostgreSQL; modular monolith. | Technical owner | Code scaffolding |
| P-05 | Vercel or Netlify hosting; model provider/version, deployment region and data residency unresolved. | Technical + privacy owners | Provisioning |
| P-06 | 90-day pilot with 3–5 partners and 100 verified listings. | Operations | Recruitment commitments |
| P-07 | Historical B2B prices and forecast scenarios are experiments. | Founder/finance | Sales offers |
| P-08 | For-profit social enterprise; legal entity and license unresolved. | Founder + local advisers | Contracts/public licensing |
| P-09 | Minor personalization disabled until local age/guardian/safety policy approved; public education browsing allowed. | Safeguarding + privacy owners | Any minor data collection |
| P-10 | No wallets, lending, diagnosis, uncontrolled donations or open minor labor market in MVP. | Product + risk owners | Scope expansion |
| P-11 | Named operational leads, response windows and retention schedules below. | Founder | Pilot launch |
| P-12 | AI optional and server-side, source-grounded; deterministic eligibility filtering; no autonomous high-stakes decisions. | Product + safety owners | AI release |
| P-13 | Small-cohort suppression at n<10 as a starting privacy rule, not anonymity proof. | Privacy owner | Sponsor reporting |
| P-14 | Phased global expansion after local readiness and evidence, never geography-only scaling. | Founder + operations | Second country |

The earlier job-first plan and latest shared-service plan differ. Recommend P-02 as the planning baseline because it reflects the later discussion. If the owner chooses job-first, update PRD, schema, metrics and roadmap together; do not implement both plans concurrently.

## How to record an approval

Append date, decision maker, selected option, scope, rationale, alternatives, consequences and evidence (owner message/issue/PR). Move a P-* item to accepted only with explicit evidence; keep its original ID/history. Record partial approval precisely. Never use “confirmed” for a team's estimate, vendor claim or inferred preference.

## Open questions for Sprint 0

Who is the product owner and safeguarding decision maker? Which pilot province, country operator and partner types? Which workflows need sensitive data? What budget/team capacity exists? Can the platform verify outcomes without documents? Which local rules and vendor terms govern child access, employment, health referrals and cross-border processing? Which regions/vendors and support hours can be funded? These block real launch, not documentation or a synthetic prototype.
