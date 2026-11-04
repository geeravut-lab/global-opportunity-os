# User roles and authorization — proposed

Person, authenticated account and organization membership are separate concepts. An assisted person may lack an account. A helper must use their own account. All access combines actor identity, current membership, resource ownership/assignment, purpose and valid authority; a role label alone is insufficient.

| Actor | Allowed scope | Explicit denial |
|---|---|---|
| Guest | Public approved current directory and help | Profiles, referrals, cases and private files |
| Beneficiary | Own profile, needs, referrals, consent, outcome attestations, privacy requests | Other people or partner internal notes |
| Authorized helper | Specific tasks/fields for named person until grant expires/revokes | Blanket impersonation, unrelated records, self-granted authority |
| Guardian | Locally validated child authority for approved workflows only | Automatic access to all child disclosures or unsafe contacts |
| NGO/community caseworker | Assigned cases within active organization and sharing scope | Other organizations, unassigned cases, full beneficiary history |
| Partner manager | Own organization's listings and staff assignments | Granting platform verification, cross-tenant case access |
| Employer | Own approved listings; explicitly submitted application fields | Searching poverty/disability profiles or broad case notes |
| Service provider | Own program and authorized referrals | Clinical diagnosis functions or unrelated health history |
| CSR sponsor | Contract-scoped aggregate/suppressed reports | Identifiable beneficiary data, raw cases, small-cohort drilldown |
| Verification reviewer | Partner evidence and review decisions within assigned remit | Self-review, bulk beneficiary access |
| Safeguarding officer | Assigned incident and minimum necessary records | General-purpose unrestricted analytics/export |
| Platform operator | System operation and scoped support tooling | Routine browsing of private case content |

Administration is split into verification, support, safeguarding and technical operations rather than one universal admin flag. Emergency exceptional access requires named approval, reason, expiry and audit; proposed default disabled in MVP. Privileged staff MFA and periodic access review required before real data.

Membership lifecycle: invited → accepted → active → suspended/revoked. Invite acceptance cannot assign platform roles or another tenant. Revocation is checked at request time, including downloads, not delayed until token expiry. Tenant identifiers and user metadata from a client are never trusted as authorization evidence.

Delegation record: subject, helper, tasks, field scope, purpose, authority evidence type, valid dates, grantor, review status and revocation. An adult's disability does not remove decision-making authority. Support accessible consent and independent confirmation; detect coercion. Guardianship disputes go to trained humans; do not grant both claimants access while disputed. Child confidentiality exceptions require local safeguarding policy, not automated parental disclosure.
