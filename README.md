# Global Opportunity OS — Codex Development Starter Pack

Version 1.0 • 4 November 2026 • Documentation and repository scaffold only

One Platform. Equal Access to Opportunity.

Help underserved people find verified opportunities and reach real outcomes, while building a sustainable business funded primarily by organizations. The global mission includes every beneficiary group; services will be introduced in phases.

**There is no application code, package manifest, database migration, deployed service, automated test suite, or working AI in this pack.** Folder READMEs describe future work. No install or run command exists yet. Do not interpret a specification as a delivered capability.

## Start here

1. Read [START_HERE_TH.md](START_HERE_TH.md) for Thai import and kickoff instructions.
2. Read [AGENTS.md](AGENTS.md), then [the document index](docs/INDEX.md).
3. Read [DECISIONS.md](docs/DECISIONS.md): confirmed user decisions and proposed designs have different authority.
4. Give Codex the prompt in [CODEX_KICKOFF.md](CODEX_KICKOFF.md). Start with documentation and planning, then implement a bounded vertical slice after scope approval.

## Status and scope

Confirmed: a global social web application, all underserved groups, sustainable income, an existing GitHub repository and Codex connection, and this development pack.

Proposed baseline: AI Opportunity Navigator + verified directory + partner referral/case workflow + basic impact reporting. The latest strategy supersedes an earlier job-first recommendation as a proposal, not as a user-approved product decision. Jobs, learning, inclusive commerce and care expand later. Essential beneficiary access is proposed to remain free.

Proposed pilot: Thailand, Thai/English, 3–5 delivery partners, a 90-day evidence-gathering program. Proposed stack: Next.js, TypeScript, Tailwind, Supabase/PostgreSQL and server-side AI; hosting unresolved. None of these vendor, price, jurisdiction, timeline or launch choices is confirmed.

## Repository map

```text
AGENTS.md                       Persistent Codex guidance
CODEX_KICKOFF.md                 Copyable initial and implementation prompts
START_HERE_TH.md                 Thai import/commit instructions
docs/                           Product, business, architecture and safety specifications
apps/web/                       Future web application; README only
packages/domain/                Future shared domain rules; README only
packages/ui/                    Future accessible components; README only
packages/ai/                    Future AI adapter/evaluations; README only
supabase/migrations/            Future reviewed migrations; README only
supabase/tests/                 Future authorization tests; README only
tests/acceptance/               Future acceptance automation; README only
.github/                       Issue and PR templates; no automated CI yet
```

No open-source license is selected. The owner must choose licensing before redistribution as open source. No secrets, real beneficiary data or copied private conversation transcript are included. This pack does not commit, push, provision services or deploy anything.

## Reading conventions

`C-*` = confirmed from user statements. `P-*` = proposed, unapproved. `G-*` = recommended launch gate in this pack. `REQ-*` = proposed product requirement. `AC-*` = executable-in-future acceptance scenario. IDs support review; they do not imply implementation or approval.

All implementation details are proposals unless explicitly marked confirmed. Product owner approval must be recorded with date, evidence and scope in DECISIONS.md. See [source provenance](docs/SOURCE_CONTEXT.md) and [acceptance criteria](docs/ACCEPTANCE_CRITERIA.md).
