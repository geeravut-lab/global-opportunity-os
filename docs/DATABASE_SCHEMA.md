# Conceptual database schema — proposed, not executable SQL

No migration exists. Review this model, then implement constraints and permission tests together. UUID primary keys, UTC timestamps, explicit foreign keys, versioned enums/checks and purpose-limited text fields are proposed defaults. Do not store all sensitive data in one JSON profile.

| Entity | Important fields / relationships | Classification |
|---|---|---|
| accounts | id linked to auth identity, locale, safe_contact_preference, status | Private |
| persons | id, optional account_id unique, display_alias, age_band, country, coarse_region | Private; no required national ID |
| needs | id, person_id, category, optional constraints, consent_reference, expires_at | Restricted |
| organizations | id, legal/display name, country, type, status | Public projection only |
| memberships | id, organization_id, account_id, role, status, expires_at | Private authorization |
| authority_grants | id, subject_person_id, helper_account_id, purpose, tasks, field_scope, evidence_ref, valid_until, revoked_at | Restricted |
| partner_reviews | id, organization_id, reviewer_id, scope, evidence_ref, decision, valid_until, reason | Restricted verification evidence |
| opportunities | id, organization_id, category, source_url, country/region, status, eligibility_version, capacity_state, cost/currency, reviewed_at, expires_at | Public approved fields |
| opportunity_translations | opportunity_id, locale, title, description, accessibility_text, translation_status, source_version | Public approved fields |
| consents | id, subject_person_id, actor_account_id, authority_grant_id nullable, recipient_org_id, purpose, field_scope, notice_version, granted_at, expires_at, withdrawn_at | Restricted |
| referrals | id, person_id, opportunity_id, recipient_org_id, consent_id, state, idempotency_key, submitted_at | Restricted |
| referral_events | id, referral_id, actor_id, previous/new_state, reason_code, occurred_at | Restricted append-only history |
| cases | id, referral_id unique, organization_id, assigned_membership_id, status, next_action_at, version | Restricted |
| case_notes | id, case_id, author_id, visibility_scope, limited_text, created_at | Highly restricted; no sponsor access |
| outcome_attestations | id, referral_id, outcome_type, occurred_at, reporter_id, evidence_level, status, supersedes_id | Restricted |
| consent_handoffs | id, referral_id, consent_id, recipient_org_id, field_manifest, sent_at, cessation_requested_at, acknowledged_at | Restricted disclosure ledger |
| files | id, owner_resource/type, organization_id nullable, private_storage_key, purpose, retention_until, scan_status | Restricted; no public bucket |
| safety_reports | id, reporter_id nullable, subject_resource, severity, assigned_officer, state, protected_detail_ref | Safeguarding restricted |
| privacy_requests | id, subject_id, type, verified_at, state, due_at, exception_reason | Restricted |
| audit_events | id, actor/service, action, resource_type/id, reason, timestamp | Restricted; no raw payloads |
| outbox_events | id, resource_id, event_type, minimal_payload, retry_count, status | Internal |
| ai_interaction_metadata | id, pseudonymous_session, model/prompt_version, retrieved_ids, fallback_reason, latency, token_cost | Internal; raw prompt off |

Account email/phone remain with the identity/contact service where possible. Exact address, diagnoses, migration status, government identity and child date of birth are not baseline required fields. Any addition needs a documented purpose, access policy, retention and local review.

## Integrity and transition invariants

- Unique active membership per organization/account/role combination; authority grants cannot be self-issued by helpers.
- Referral recipient must equal the opportunity's organization and the consent recipient. Enforce composite relationships or transactional checks, not UI conventions.
- Cases' organization and assignee membership must belong to that recipient organization; an unrelated tenant cannot be substituted on update.
- Consent subject must match referral person, be valid at handoff and cover shared fields/purpose. Withdrawal blocks new handoffs; existing disclosure ledger remains for accountability under approved retention.
- Publication requires active verification for the listing's category/region, human review and nonexpired program source. Material edits return to review.
- One referral per idempotency key scoped to actor; duplicate active person/program referrals require explicit override/reason, not silent duplication.
- Referral states: draft → submitted → acknowledged → accepted / declined; accepted → in_progress → outcome_pending → closed. Submitted/acknowledged/accepted/in_progress may become withdrawn; submitted can expire. Declined/withdrawn/expired are terminal; a new submission is explicit. Outcome disputes create a review event/flag; reopening requires authorized human reason and version check.
- Outcome “verified” requires the approved evidence rule and independent review for disputes. Corrections supersede prior attestations; never overwrite audit history or count both versions.

## Authorization policy design

Enable row-level security for all exposed tables, configure grants explicitly, and use private schemas for internal evidence/notes where practical. Default deny. Guest access only to a sanitized, active public directory. Beneficiary access uses account-to-person ownership; helpers need current scoped grants. Partners need active membership, matching tenant, case assignment and consent scope. Sponsors have only a separate aggregate endpoint. Staff access is function-specific and logged.

For every table specify SELECT/INSERT/UPDATE/DELETE independently. Updates validate old ownership and new values so organization/person IDs cannot be reassigned. Do not trust user-editable metadata. Views and functions require independent review; avoid privileged functions as permission workarounds. Public profile fields must not accidentally expose auth identities. Storage downloads recheck authorization and use short-lived URLs; removing a UI link is not revocation of an already issued URL, so define the bounded URL lifetime and delivery risk.

Indexes to evaluate: current public catalog by country/category/expiry; unique translation per locale/source version; membership account/status and org; cases org/assignee/status/next_action; referrals person/submitted_at; consent person/recipient/withdrawal; audit resource/time. Validate plans with synthetic realistic volume; no premature sensitive-data embeddings.

Deletion policy must distinguish identity deletion, restricted retained evidence and aggregate recomputation. Revoke access before removing account links. No cascade deleting safeguarding evidence accidentally. Test account deletion against issued sessions, backups, files, consent and partner handoffs. See SECURITY_PRIVACY.md.
