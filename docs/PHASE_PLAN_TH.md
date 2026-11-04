# แผนพัฒนาใหม่ตาม Product Blueprint v1.0

วันที่ 2026-11-04 อ้าง §5 modules, §6 J1–J7, §16 acceptance, §17 backlog และ §18 gates
**ก่อน pilot มี 7 ระยะ S0–S6**; งานหลัง MVP แยกอีก 5 กลุ่ม ไม่ใช่สิ่งที่ต้องสร้างก่อนเริ่มทั้งหมด
แผนนี้แทนลำดับ 6 ระยะของเซสชันก่อนหน้า สำหรับการพัฒนาต่อไป ไม่แก้ประวัติว่าอนุมัติ production แล้ว

**อนุมัติรอบนี้:** C-11 เพิ่มการตรวจต้นแบบ/รายละเอียด S0/ทดลอง Auth→DB และพัฒนา S1 ต่อจาก C-10
ผลทำจริงและส่วน S1 ที่ยังเหลืออยู่ใน [รายงาน S1](S1_REPORT_TH.md) ไม่ขยายไป S2–S6 โดยปริยาย
**ยังไม่อนุมัติ:** real-data onboarding, vendor contracts, paid provisioning, external messages, minor workflows และ production deployment
P/D ใน Blueprint ยังต้อง disposition ตามเรื่อง ไม่ใช่อ่านเอกสารแล้วทุกตัวเลขกลายเป็น approved

## แผนทุก Phase: functions และ features

| Phase / เป้าหมาย | Functions & features ที่จะทำจริงในระยะนั้น | ผู้ใช้/หน้าจอ | Dependency / exit evidence |
| --- | --- | --- | --- |
| **S0 ฐานผลิตภัณฑ์และต้นแบบ** | เทียบ main/Blueprint/ภาพ, prototype 3 roles desktop/mobile; UX J1/J2; taxonomy/eligibility schema; data classification; OpenAPI เริ่มต้น; ADR stack/region/auth-to-DB spike; scope adult/pilot, cost, privacy/safety/SOP/partner requirements | beneficiary home/search/profile/needs/plan; partner dashboard/queue/catalog; admin overview/review/security | BP-B-001–004; BP-D-01–04 owners, design review, auth/RLS spike evidence ก่อนเริ่มของจริง; **ทำ audit/prototype/plan และ local auth/RLS spike แล้ว; owner/region/budget/legal ยังไม่ครบ** |
| **S1 ตัวตนและฐานสิทธิ์** | เวอร์ชันเครื่องมือ/CI/environments แยก; identity/org/membership/role migrations ใน local disposable DB; signup/email verify/login/recovery; staff MFA/session revoke; minimal account/subject; safe contact; age gate; consent notice versions; delegation แยก read/write/prepare/submit; assisted read-back/revoke; BFF authorization และ DB claims transaction | สมัคร/โปรไฟล์/privacy/delegation, staff sign-in และ org context | BP-B-101–103; ขึ้นกับ S0; BP-AC-02/03/08/17/18 subset; direct API/DB negative tests, no service_role CRUD default |
| **S2 โอกาสที่ตรวจสอบแล้วและการจับคู่** | organization onboarding/independent verification/expiry/suspend/appeal; private upload intent/quarantine/MIME/scan; members/admin; catalog revision/draft/review/publish/material-edit re-review/expiry; public search/filter/detail/country/coverage/language/cost/accessibility/capacity/source; needs assessment ข้ามข้อมูล sensitive ได้; preferences/bookmarks; deterministic matching พร้อม eligible/ineligible/unknown และเหตุผล; adult-job terms/education links | ผู้ใช้ค้นหา/ประเมิน/บันทึก; partner listing editor; admin verification/moderation | BP-B-201–203; ต้อง S1, BP-D-07; BP-AC-01/06/15/17/18 subset; stale source/partner suspension blocks serving, Thai search fixtures |
| **S3 สมัคร → คิวเคส → ติดตาม** | application preview แสดง recipient/exact fields/purpose/notice/hash; explicit confirmation; atomic application+share+event+outbox; idempotency/retry/concurrency/capacity; withdraw/stale preview/version conflict; case queues/assign/reassign; beneficiary-shared vs internal notes; next actions/due dates; adult recruiter human review/interview/offer/decline; generic in-app/email settings, outbox backoff/dedup/dead-letter | ใบสมัคร/preview/consent/progress; partner assigned case detail; employer funnel; notifications | BP-B-301–303; ต้อง S1/S2; BP-AC-04/05/06/08/09/19 และ J1/J5; ยังไม่มีการส่งต่อข้ามองค์กรจน S4 |
| **S4 ส่งต่อและผลลัพธ์ที่ตรวจสอบได้** | warm referral preview/recipient/field consent; pending/accept/decline/cancel; destination case สร้างครั้งเดียว; source ไม่เห็น internal notes ปลายทาง; outcomes L0/L1/L2 + independent review + dispute/corrections/dedupe; report/block/appeal, restricted safeguarding queue; privacy access/export/correct/delete, retention/holds/purge/recipient cessation/deletion replay; safe file proxy | ผู้ใช้ยืนยันหรือโต้แย้งผล/ถอนการแชร์; NGO warm referral; admin safety/privacy/audit | BP-B-401–403; S3 + BP-D-04/08/09/12, staffing SOP; BP-AC-07/08/12/15/16/18 และ J2/J4/J7; safety rota ก่อน real pilot |
| **S5 Navigator และ impact dashboard** | approved public corpus ingestion/version/hash/expiry; Thai/English retrieval with ACL/freshness; AI gateway server-only/vendor adapter; citations/ID validation, risk/output controls; draft assessment/application ต้อง user confirmation; fallback/manual search, budget/rate/circuit breaker/kill switch; NGOs/admin/CSR aggregate reports, program access, fixed cohorts, k10+complementary suppression, safe exports, metric provenance/version | AI ผู้ช่วยของผู้ใช้; NGO/admin/CSR reports; ops AI quality/cost panel | BP-B-501–503; S2–S4 + BP-D-05/10; BP-AC-10/11/13; ≥200 query eval/≥50 adversarial proposed suite, no fabricated contact/service, no PII corpus |
| **S6 ทดสอบครบและความพร้อม pilot** | E2E J1–J7, RBAC/RLS/Storage/direct API negatives; concurrency/race/idempotency; AI red-team; keyboard/NVDA/VoiceOver/zoom/reflow/Thai usability; constrained-network/load/NFR/security; backup/PITR+object+key restore, purge replay; incident/outage/job/rollback/kill-switch drills; UAT, partner training, content revalidation, support roster และ release evidence | ทุกบทบาท รวม assisted/no-email path, safety/privacy owners | BP-B-601–603; BP-AC-01–20 ที่เกี่ยวข้อง + BP-G0–G6 sign-off; production release ต้องอนุญาตแยก; build ผ่านอย่างเดียวไม่ผ่าน pilot |

## โมดูลทุกตัวใน Blueprint §5 อยู่ Phase ไหน

| BP-MOD-ID | Function/feature | ระยะหลัก | ข้อจำกัด |
| --- | --- | --- | --- |
| ID-01 | Auth / recovery / MFA | S1 | ใช้ provider adapter ไม่สร้าง password protocol ใหม่ |
| ID-02 | Minimal profile / assisted authority | S1 | actor ≠ subject; no password sharing |
| NA-01 | Needs assessment | S2 | optional sensitive questions; confirmed draft เท่านั้น |
| OR-01 | Organization verification | S2 | independent review, evidence expiry, appeal |
| DI-01 | Verified directory | S2 | public safe DTO current reviewed records |
| DI-02 | Catalog lifecycle | S2 | revision audit + material edit re-review |
| MA-01 | Deterministic matching | S2 | unknown ไม่ตีความว่า eligible; score ไม่ใช่ final decision |
| AI-01 | Bounded RAG Navigator | S5 | no model writes/auto-submit; manual path |
| AP-01 | Applications / referrals | S3 → S4 | atomic consent/package/share; cross-org ใน S4 |
| CM-01 | Case management | S3 → S4 | assignment, note visibility, warm referral |
| OC-01 | Outcome verification | S4 | independently reviewed ไม่ใช่ partner self-approval |
| SF-01 | Complaints / safeguarding | S4 | restricted incident ACL, no auto-notify accused |
| NO-01 | In-app / email | S3 | generic content, outbox; no SMS/LINE yet |
| DA-01 | Partner / admin dashboard | S2 → S5 | permission-specific queues; หน้าตา S0 ไม่ใช่สิทธิ์จริง |
| IM-01 | Aggregate impact / CSR | S5 | approved cohorts, no beneficiary drilldown |
| PR-01 | Privacy rights / retention | S0 design, S4 lifecycle | D-04/legal basis ก่อน real processing |
| AC-01 | Accessibility / low bandwidth | S0–S6 ทุกระยะ | BP-MOD-AC-01 ไม่ใช่ BP-AC-01 criterion |
| JB-01 | Narrow adult jobs | S2 catalog, S3 workflow, S4 evidence | no fees/deposits to apply, no minor jobs/payment custody |
| ED-01 | Education links/pathways | S2 directory; P1-C tracking | no full LMS |
| MN-01 | Minor assisted cases | P1-B หลัง gate | ปิดทั้ง UI/API/DB สำหรับ personalization จนอนุมัติ |
| BI-01 | Billing / entitlements | P1-A | MVP ใช้ข้อตกลง/ใบแจ้งหนี้นอกแอป ไม่เปิดเก็บเงินอัตโนมัติ |
| IN-01 | LINE/SMS/provider API | P1-A | opt-in/contracts/webhook validation |
| GL-01 | Country expansion | P2-A | local operations/legal/transfer readiness |
| CO-01 | Inclusive marketplace/payments | P2-B | แยก payment/fraud/dispute blueprint |

## ระยะหลัง MVP — ไม่ใช่งานที่อนุมัติให้ทำตอนนี้

| กลุ่ม | Functions & features | เงื่อนไขเริ่ม |
| --- | --- | --- |
| P1-A องค์กรจ่ายเงิน/การเชื่อมต่อ | plans/entitlements/invoice integration, admin quality controls, LINE/SMS, verified callbacks, opt-in | willingness-to-pay จริง สัญญา vendor ต้นทุนวัดแล้ว BP-D-06 |
| P1-B เด็กและเยาวชน | guardian authority/assent, safe education referrals, independent reporting, trained safeguarding | BP-D-03/local legal+SOP+rota; ห้ามเปิดเป็น flag โดยไม่ทดสอบ |
| P1-C เรียนรู้และงานลึกขึ้น | learning progress/skills assessment, richer employer pipeline | outcome reliability/fairness; ไม่มี full LMS หรือรับรองได้งานโดยอัตโนมัติ |
| P2-A ประเทศที่สอง | locale/country policy pack, verified network, local support/data transfer | ready local operator/contracts/cost model ไม่เลือกประเทศเอง |
| P2-B ตลาดรวม/ชำระเงิน | inclusive seller/buyer marketplace, payment-provider integration, disputes/fraud/refunds | แยก transaction/labor/payment/legal review; ไม่เป็น MVP dependency |

## Dependency และเกณฑ์ตรวจรับ

เส้นวิกฤตตาม Blueprint: B-001 → B-002 → B-101 → B-102/B-103 → B-201/B-202 → B-301 → B-302 → B-401/B-402/B-403 → B-601/B-602 → B-603
AI: D-05 + B-202/B-203 → B-501 → B-502 → B-601; CSR: B-402 → B-503 → B-601
ใช้ prefix BP- เมื่ออ้างงานใน Blueprint; เลข AC ของ starter pack ไม่ใช้แทนกัน
ทุก phase ต้องมี ticket linked B-ID, module, API/data scope, allow/deny tests, AC และ gate owner

ก่อนรับ PR ของระบบจริง ต้องมี unit + contract + local migrations/RLS tests ตามส่วนที่เปลี่ยน
เพิ่ม integration/E2E critical, storage negatives, membership revoke และ consent race ตาม feature
ก่อน pilot ต้องมี performance/restore/safeguarding/UAT และหลักฐานทั้งผ่าน/ไม่ผ่าน/ไม่รัน/blocked
ไม่มีชื่อเจ้าของ/สัญญา/เอกสารอนุมัติ = gate ยังไม่ผ่าน ไม่แต่งหลักฐานแทน

## ประมาณการและการแบ่ง PR

ช่วง effort จาก story sizes ใน Blueprint ไม่ใช่เวลาใช้ agent หรือสัญญาวันส่งมอบ:

| Phase | Engineer-days สำหรับวางแผน | งานภายนอกที่ไม่นับรวม |
| --- | --- | --- |
| S0 ทั้งระยะ | 12–20 | PO/design/partner/privacy/legal และการรอข้อสรุป |
| S1 | 12–20 | auth vendor/environment/region approval |
| S2 | 15–25 | reviewer/partner verification และ content/translation |
| S3 | 15–25 | case operation/consent notices/email agreement |
| S4 | 15–25 | legal/retention/safeguarding/evidence authority |
| S5 | 15–25 | AI vendor contract, human eval labels, metric/privacy review |
| S6 | 12–20 | independent QA/a11y/security, training/rota/UAT |

รวมประมาณ 96–160 engineer-days ก่อนนับงานภายนอกและการรอ จึงไม่ใช้คำว่า “7 sprint ต้องเสร็จใน 14 สัปดาห์”
ต้อง re-estimate จากทีม/งบจริง แบ่ง story L ให้เล็กก่อนรับเข้า sprint
แต่ละ Phase แบ่ง PR ตาม B-ID และเส้นตั้งที่ทดสอบได้ ไม่ทำ mega-PR ทั้ง platform
pilot ที่เสนอ 90 วันเริ่มหลัง readiness ไม่ใช่ 90 วันรวมสร้างระบบ และไม่ใช่การรับรองรายได้/ยอดผู้ใช้

## จุดตรวจให้เจ้าของทบทวนต่อ

S1 local foundation ดำเนินการแล้วตาม C-11 ไม่ต้องอนุมัติเริ่ม S1 ซ้ำ
C-15 อนุญาตใช้ Project เดิมทดสอบได้; ก่อนเชื่อม hosted ต้องมีค่าที่ apply และตรวจของเดิม/read-only preflight
พร้อม manifest fixture สำหรับ cleanup; ก่อน real pilot ยังต้องปิด
BP-D-01/02/03/04 ส่วนที่เกี่ยวข้อง ระบุผู้รับผิดชอบ/region/budget
ไม่ต้องเลือก AI vendor/ราคา/ประเทศที่สองเพื่อให้ต้นแบบรอบนี้เสร็จ


## สถานะชิ้นงานหลัง C-11

| ระยะ | ทำแล้ว | งานถัดไป/สิ่งที่ยังไม่ยืนยัน |
| --- | --- | --- |
| S0 | prototype/แผน, ADR-002, schema/permissions, OpenAPI S1, local user-JWT/RLS spike | pilot scope/ops/privacy sign-off, hosted region/PITR/budget; ไม่อ้างว่าปิด S0 ทั้งระยะ |
| S1 | Email/password/confirm/recovery, Google PKCE initiation, MFA, session revoke, own adult profile, notice/consent, scoped delegation/read-back/revoke, draft org/member invitation/revoke, local migrations/tests | hosted Google round-trip, SMTP/refresh on hosting, distributed abuse controls, MFA recovery, assisted/no-email ownership SOP; prepare/submit scopes รอ domain S3 |
| S2 | public directory และหน้าจอ demo จาก fixtures เท่านั้น | verified partner/catalog backend, storage quarantine, assessment/bookmarks/matching จริง |
| S3 | หน้าตัวอย่าง applications/plan/case เท่านั้น | consent preview/atomic apply/cases/notifications จริง |
| S4 | ยังไม่มี backend ของระยะนี้ | warm referral/outcomes/safety/privacy lifecycle |
| S5 | มีหน้าตัวอย่าง AI/impact เท่านั้น | RAG/AI gateway/evaluation และ aggregate privacy จริง |
| S6 | ยังไม่เริ่ม pilot readiness | manual a11y/UAT/restore/incident/load/release gates |
