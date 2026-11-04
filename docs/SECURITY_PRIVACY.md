# Security, privacy and safeguarding — proposed policy baseline

Design obligations, not a compliance certification or legal opinion. The launch jurisdiction, controller/operator, processor contracts, lawful bases, age thresholds and country-specific obligations are unresolved. Obtain qualified local review before collecting real sensitive data; this pack does not assert compliance with any named law.

## Threat model and controls

| Threat | Required design response |
|---|---|
| Fake NGO, employer or exploitative offer | Independent scoped verification, program review, expiry, report/suspend/appeal |
| Cross-tenant or guessed-ID access | Server checks plus database policies and negative tests, including files/exports |
| Coercive helper or unsafe guardian | Separate accounts, task-scoped authority, independent confirmation and safeguarding review |
| Sponsor surveillance | Aggregate-only contract, small-group suppression, no beneficiary search/export |
| Shared phone or abusive household | Guest browsing, safe contact choice, generic notifications, clear sign-out, no sensitive offline cache |
| Child exploitation/grooming | Minor gate, no open messaging/job marketplace, trained escalation, partner child-safety review |
| AI leakage/hallucination | Minimal input, authorized grounded sources, ID validation, no automatic actions, manual fallback |
| Malicious imports/files | Allowlisted sources, safe parsing, malware checks, size/type limits, private storage |
| Insider misuse | Split administrative duties, MFA, scoped/time-bound exceptional access and audit |
| Service outage/stale program | Fail closed for handoffs, current alternatives, outbox retries and restore drills |

## Data and consent lifecycle

Guest search should not require a name, diagnosis or identity document. Use coarse location and age band where sufficient. Separate service processing from optional research/AI/marketing permissions. Explain in plain Thai/English: what is collected, why, named recipient, retention, withdrawal limits and human help. No prechecked sensitive-data consent, bundled sponsor consent or service denial for optional analytics refusal.

Consent alone is not an assumed lawful basis for all operations. Privacy lead maps each processing purpose, local legal basis, operator/processor role and contract. Record notice version, scope and authority. Partner requests for more information require fresh field-specific authorization. Withdrawal stops future sharing, revokes helper access where requested and sends a cessation request to recipients; clearly explain already-sent information cannot be technically recalled. Record recipient response.

Encrypt transport and managed storage; keep credentials in environment/secret management. Logs contain event identifiers and reason codes, not beneficiary narratives, tokens or raw AI prompts. No advertising trackers or model training use of beneficiary data by default. Review model vendor retention, training, region and subprocessors before any real-data use. Do not promise zero retention without contractual and technical evidence.

## Proposed retention schedule for review

| Data | Proposed default | Reason / release condition |
|---|---|---|
| Guest input / unsaved needs | Request lifetime; no persistent raw text | Minimize inadvertent collection |
| Inactive draft | 30 days | Warn before cleanup; local synthetic only until approved |
| Needs assessment | 90 days then refresh/delete | Avoid stale sensitive profiles |
| Closed case/referral | 12 months after closure | Local legal/contract review may change this |
| Consent/disclosure and audit metadata | 24 months | Limited evidence, restricted access; not full case text |
| Partner identity evidence | Review expiry plus 90 days | Keep decision metadata longer only if justified |
| AI raw prompt | Off by default | Any opt-in debug capture requires redaction and short TTL |
| Safety reports | Case-specific approved schedule | No universal deletion promise during active investigations |
| Backups | Proposed 30-day rotation | Verify provider capability and deletion/restore handling |

All durations are proposed, not legal mandates. Make them configurable, document holds and exceptions, and implement deletion jobs with audit. Privacy requests: verify identity proportionately, route within 2 staffed business days as an internal target, then apply the locally approved deadline. Do not demand national ID for every export. Exports must exclude other people's notes/evidence.

Deletion removes or irreversibly de-identifies unnecessary live data and sends recipient requests; record lawful restricted retention, backup expiry and aggregate corrections. After restore, replay deletion/withdrawal ledger before reopening service. Account deletion must include session revocation and authorization denial, not just removing an auth row.

## Vulnerable users and minors

Do not rank by poverty severity, disability inference or sponsorship value. Accommodation preferences may guide usable options with user control. Adult assisted use preserves agency. Protect exact locations of displaced people and confidential facilities. Allow anonymous safety reports and safe communication without notifying the alleged abuser.

P-09: minor personalized access disabled until local age rules, proportionate age assurance, guardian authority, child assent, safe exceptions, staff training, reporting obligations and escalation procedures are approved. Unknown age at a gated step routes to the safe public path. Do not quietly save a blocked child's chat. No collecting extra documents just to improve an age estimate. Education browsing is separate from accounts and personal referrals.

## Incident procedure

Assign a named incident commander, technical responder, privacy owner and safeguarding lead before launch; one person may hold roles only with explicit capacity review. Quarantine affected listing/access, preserve minimal evidence, revoke credentials/sessions as needed, assess affected people and safe contact method, obtain local notification guidance, document remediation and follow-up. Do not automatically notify guardians where that could endanger a child. Human emergencies require verified local resources; never invent numbers or claim 24/7 monitoring. Publish funded service hours and escalation alternatives. Unstaffed safeguarding is a launch blocker.
