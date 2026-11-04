# Codex kickoff instructions

## First prompt — documentation and planning only

Copy this into Codex with the imported repository selected:

```text
Read AGENTS.md and README.md, then all documents linked by docs/INDEX.md.
This is Global Opportunity OS, a documentation-only starter pack. Inspect the actual
checkout before assuming code or tooling exists. Do not build the application yet.

Preserve the confirmed worldwide, all-beneficiary-groups mission and sustainable
business goal. Separate C-* confirmed decisions from P-* proposals and G-* proposed
release gates. The latest recommended MVP is Navigator + verified directory + partner
referrals/cases + basic impact, not a full jobs/commerce/learning platform at launch.

Complete Sprint 0 planning in a feature branch:
1. Audit repository contents and identify conflicts without overwriting existing work.
2. Summarize scope, contradictions, assumptions, and material decisions needing the owner.
3. Evaluate the proposed stack using current official docs; do not provision services.
4. Produce docs/SPRINT_0_PLAN.md with a phased PR plan, dependencies, acceptance IDs,
   security/consent/tenant tests, accessibility checks, synthetic fixtures and estimates.
5. Refine architecture/schema/permissions as proposals and update the decision register
   without marking proposals accepted in the absence of explicit owner evidence.
6. Recommend the smallest first implementation slice and list exact setup/test commands
   that will exist after scaffolding; distinguish planned commands from commands run.
7. Report actual files changed, checks run, gaps and decisions blocking implementation.

No real beneficiary data, real partner claims, external messages, paid provisioning,
production deployment, migrations against a live database or personal minor workflows.
Continue independent documentation work while material questions remain unresolved.
```

## Follow-up prompt — after owner chooses a scope

```text
Implement only the scope explicitly approved in my message, recording that approval
and its boundaries in docs/DECISIONS.md. If I approved the recommended first slice,
build the bilingual accessible public directory with synthetic fixtures and current,
expired, suspended and no-results scenarios (REQ-01/04/13; AC-01/14).
Inspect existing work, create a small feature branch, select/pin current dependencies,
create real setup and test commands, run appropriate checks and update README.md.
Do not invent runtime instructions or passing tests. Keep other proposals unapproved.
Prepare a reviewable change and report remaining MVP gaps. No production deployment.
```

The follow-up prompt does not itself approve every proposed choice. State selected stack and slice in the owner's message. If only Sprint 0 was requested, stop at the completed plan and concrete reviewable choices; no application code is expected yet.
