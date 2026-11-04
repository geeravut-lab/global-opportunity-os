# Acceptance criteria — proposed test specification, not test results

Run with synthetic fixtures. Capture result, date, build/commit, fixture version and reviewer. Unimplemented scenarios are **not run**, not passed. Each scenario requires appropriate automated checks plus manual review where judgment/accessibility is involved.

| ID / requirement | Given / when / then | Required evidence |
|---|---|---|
| AC-01 / 01,04 | Given active, expired, suspended and out-of-area listings, when a guest searches, then only current eligible published entries appear with source, freshness, language and costs; zero results produces no fabricated alternative. | Search/filter tests and mobile screenshot |
| AC-02 / 02 | Given a guest and account owner, when browsing or recovering access, then browsing needs no account, recovery does not reveal account existence, and private records require correct owner. | Auth/recovery abuse and access tests |
| AC-03 / 03 | Given optional sensitive questions and AI disabled, when a user skips them, then structured search/referral remains usable with editable filters. | Form and fallback checks |
| AC-04 / 04,05 | Given an unverified, expired or self-reviewing partner, when publishing or submitting a referral, then publication/handoff is blocked. Suspension after search also blocks submission and prompts review of existing cases. | Lifecycle and race-condition tests |
| AC-05 / 06 | Given named recipient/fields, when consent is granted then withdrawn, then only those fields are shared, new handoffs stop, disclosure history remains restricted and recipient cessation is tracked. | Consent, outbox and field-scope tests |
| AC-06 / 07 | Given duplicate requests and concurrent case updates, when submitted/retried, then one referral/outbox action occurs; illegal transitions and stale updates are rejected with recoverable feedback. | Transaction/idempotency/version tests |
| AC-07 / 08 | Given malicious source instructions, unsupported or stale listing IDs, when AI responds, then no secret/data leakage or invented suggestion reaches the user; sources resolve server-side. | Versioned adversarial evaluation report |
| AC-08 / 08 | Given AI timeout, no verified match or refused request, when navigating, then a useful manual search/human route remains and no automatic referral occurs. | Failure injection and manual review |
| AC-09 / 09 | Given conflicting outcome attestations or duplicate events, when reporting, then disputed/unverified items are separate, only the latest valid verified outcome counts and corrections are auditable. | Deduplication/dispute/report tests |
| AC-10 / 10,15 | Given two tenants, guessed resource IDs, user-edited role claims and revoked membership, when accessing API/DB/export/file routes, then unrelated and revoked access is denied even with a still-valid token; authorized assignment works. | Allow/deny matrix for each operation and direct API/DB checks |
| AC-11 / 11 | Given sponsor cohorts smaller than 10 and overlapping filters, when querying/exporting, then small/complementary cells are suppressed and no person-level payload is returned. | Aggregate and inference-risk review |
| AC-12 / 12 | Given a coercion/abuse report, when submitted without safe contact, then reporting succeeds, a restricted human queue receives it, the accused is not notified automatically and published support limits are honest. | Safeguarding tabletop and access checks |
| AC-13 / 12 | Given verified deletion/withdrawal and later backup restore, when processing, then live access stops, partner requests and exceptions are recorded, and deletion ledger is reapplied before service resumes. | Privacy workflow and restore drill |
| AC-14 / 13 | Given Thai/English, keyboard/screen reader, zoomed small screen and constrained network, when completing the core journey, then labels, focus, errors, language, dates and consent are understandable; sensitive data is not cached. | Automated accessibility plus manual records |
| AC-15 / 14 | Given minor or unknown age at a personalized gate, or an unauthorized helper, when proceeding, then personal profiling/referral is blocked without retaining raw child disclosure; safe public information remains. | Age/delegation negative tests and safeguarding review |
| AC-16 / 15 | Given private attachments, revoked access and abusive request bursts, when downloading/uploading/searching, then file rules and short-lived links work, unsafe files are rejected and rate limits preserve ordinary use. | Storage, upload and rate-limit checks |

## Proposed release evidence record

Use one row per AC: ID, status (not run/pass/fail/blocked), test location, command or manual procedure, observed result, evidence reference, reviewer and unresolved issues. Add regression tests for actual failures. Never replace negative permission tests with a frontend screenshot. No end-to-end safety claim follows from this table alone; operational gates also apply.
