# Product requirements — proposed MVP

P-02 planning baseline. Every REQ is proposed and unimplemented. Pilot persona priority is local adult beneficiaries using direct or assisted access; the all-groups long-term mission remains confirmed.

## End-to-end slice

A beneficiary browses verified current offers without an account, optionally records a need, sees explainable suggestions, consents to a named partner referral, tracks status, and confirms or disputes an outcome. A verified partner receives only assigned referral data. Staff review partner verification, reports and appeals. Sponsor dashboards show aggregate outcomes only.

| ID | Requirement | Priority | Acceptance |
|---|---|---|---|
| REQ-01 | Guest browse/search by area, language, category, accessibility and service availability; disclose last review and source. | Must | AC-01 |
| REQ-02 | Optional account; secure sign-in/recovery, locale, safe contact preference and minimum profile. No compulsory sensitive history. | Must | AC-02 |
| REQ-03 | Structured needs assessment, skippable questions, editable answers; AI optional. | Must | AC-03 |
| REQ-04 | Verified directory with approved partner, program eligibility, costs, coverage, contact, capacity, source and expiry. | Must | AC-01, AC-04 |
| REQ-05 | Partner onboarding, independent review, expiry, suspension and appeal. | Must | AC-04 |
| REQ-06 | Consent preview for each named recipient/purpose/field set; record sharing, withdrawal and delegated authority. | Must | AC-05 |
| REQ-07 | Referral/case tracking with controlled transitions, assignment, deadlines, reason codes and event history. | Must | AC-06 |
| REQ-08 | Navigator grounded in active authorized listings, source links and uncertainty; human/manual fallback. | Must, behind flag | AC-07, AC-08 |
| REQ-09 | Outcome attestation, evidence level, deduplication, user dispute and human correction. | Must | AC-09 |
| REQ-10 | Tenant-safe partner work queue and scoped admin/audit workflows. | Must | AC-10 |
| REQ-11 | Aggregate impact by consented/safe cohorts; sponsor isolation and suppressed small groups. | Must | AC-11 |
| REQ-12 | Report abuse, human triage, appeal, privacy requests and incident handling. | Must | AC-12, AC-13 |
| REQ-13 | Thai/English mobile accessible interface, low-bandwidth flow, secure shared-device behavior. | Must | AC-14 |
| REQ-14 | Minor gate and safe assisted-user controls; no minor job matching or direct messages. | Must | AC-15 |
| REQ-15 | Tenant membership revocation, secure files and rate limiting. | Must | AC-10, AC-16 |

## Screen inventory

Public home/coverage, search results, listing detail, optional sign-in/recovery, needs form, navigator/suggestions, referral preview/consent, my referrals/detail, profile/privacy controls, help/report, partner onboarding, partner listing editor, partner work queue/case detail, admin verification/reports/audit and aggregate dashboard. Mark demo fixtures conspicuously. Account deletion and consent withdrawal must be findable without contacting sales.

## State and interaction rules

Return distinct empty, loading, unavailable and error states. No-results must not imply ineligibility. Never automatically send a referral from chat. Recheck program status and consent at submission, not just at search time. External applications display destination and data handoff; MVP does not scrape or submit forms on a user's behalf. Notifications are opt-in, generic by default and exclude sensitive case names.

## Nonfunctional targets — proposed, to measure

Target WCAG 2.2 AA as an engineering goal; conduct manual assistive-technology review. Initial mobile page usable within 3 seconds on an agreed low-end device/connection test profile; document actual test setup. Paginated server search, bounded AI latency (proposed 15 seconds then fallback), no core workflow dependent on AI uptime. Pilot recovery targets: RPO 24 hours, RTO 24 hours, with restore drill; confirm affordability before contracts. Define availability and response commitments only when staffed and measured.

No wallets, credit, payment custody, automated hiring, diagnosis, unrestricted donations, child labor marketplace, social feed, open direct messages, fully automatic eligibility rulings or global launch. Marketplace/learning delivery, billing automation, external integrations, PWA offline mode and advanced recommendations are later phases. Education and jobs can appear as verified referral categories without building an LMS or labor marketplace.
