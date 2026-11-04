> หมายเหตุรอบปัจจุบัน: roadmap ด้านล่างเป็นต้นฉบับ starter pack จาก main ไม่ใช่สถานะชิ้นงานล่าสุด
> ใช้ [แผนตาม Blueprint v1.0 S0–S6](PHASE_PLAN_TH.md) สำหรับลำดับงานปัจจุบัน
> [รายงานต้นแบบ](PROTOTYPE_REPORT_TH.md) แยกสิ่งที่ทำแล้วออกจากระบบจริงที่ยังไม่มี

# MVP roadmap — proposed, capacity-dependent

No work below is implemented. Durations are sequencing estimates, not delivery promises. Start with a synthetic prototype, then a locally staffed pilot only after gates pass.

| Phase | Work / dependency | Reviewable exit evidence |
|---|---|---|
| Sprint 0, ~1–2 weeks | Inspect repo, reconcile decisions, choose bounded scope/stack, draft architecture/data-flow/threat review, prototype directory flow | Approved implementation scope, risk register, schema/policy plan, AC mapping and actual setup commands |
| Sprint 1, ~2 weeks | Project tooling, Thai/English accessible shell, synthetic public directory and tests | Guest searches current fixture listings; expired/suspended excluded; CI runs actual checks |
| Sprint 2, ~2 weeks | Identity, partner verification and listings, memberships and policy tests | Reviewer approval workflow; cross-tenant and role escalation denied |
| Sprint 3, ~2 weeks | Consent, scoped authority, referral transaction, partner queue, case events | Full synthetic referral succeeds; withdrawal and retries safe; unauthorized paths denied |
| Sprint 4, ~2 weeks | Outcomes, aggregate metrics, reporting/appeal, export/deletion | Disputes excluded; sponsor privacy; deletion/restore plan exercised |
| Sprint 5, ~2 weeks | Optional grounded navigator, safety evaluations, accessibility and operational rehearsal | AI hard gates, manual fallback, incident and restore drills; independent release review |
| Pilot, proposed 90 days | Small real-user cohort with verified partners after release gates | Measured service receipt, cost/time, user safety, buyer willingness to pay |

AI can follow a useful manual directory/referral workflow; it is not a prerequisite for proving local operations. No public launch date is fixed. Minor personalization remains off unless separately approved.

## Historical 24-month proposal retained for continuity

Months 1–3: Thailand MVP, 100 reviewed listings and 5 trial organizations. Months 4–6: at least 100 verified case outcomes. Months 7–9: partner SaaS/CSR with 5 paying organizations. Months 10–12: education/elder support if safe and measurable. Months 13–18: assess second-country pilot. Months 19–24: repeatable partner network across countries. All numbers are planning targets, not evidence or commitments; technical sprints and operational milestones must be rebased to team capacity.

Pilot outreach proposal: 20 contacts (5 NGOs, 5 employers, 5 CSR teams, 3 community groups, 2 education providers), seeking 3–5 actual pilot delivery partners. Contacts are not signed partners or paid customers. Proposed first program is 90 days with defined delivery and data terms. Budget hypothesis THB 300,000–600,000 over 3–6 months assumes existing core development capacity; see BUSINESS_MODEL.md.

## Go / revise / stop

Proposed 90-day review: at least 3 paying buyer organizations, referral completion/time compared with an agreed pre-pilot baseline, verified user benefit and no unresolved critical security/safeguarding issues. Set the numerical improvement threshold before recruitment, once baseline exists. If benefit or willingness to pay is weak, narrow service scope or buyer hypothesis; do not mask problems with feature expansion. Pause harmful workflows immediately; continue safe independent work.

Country two requires local operator, verified supply, supported language, contracts/privacy/child-safety review, funded support, tested unit economics and rollback. Philippines/Indonesia (and earlier Vietnam) are research candidates, not approved rollout destinations. Broadening geography, commerce, payments, clinical functions or minors creates a new risk review, not automatic reuse of the pilot approval.
