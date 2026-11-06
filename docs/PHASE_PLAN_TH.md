> สถานะ C-34: S4 มี implementation บน feature branch แล้ว ดู [รายงาน S4](S4_REPORT_TH.md); production ยังเป็น S2/S3, hosted S1/Recovery/SMTP และ gates ข้อมูลจริงยังไม่ปิด

> สถานะล่าสุด C-32: รวมPR3–8และdeploy S2/S3 productionแล้ว ดู [รายงาน rollout](PRODUCTION_ROLLOUT_TH.md); ผล/ข้อความก่อนC-32ด้านล่างรักษาไว้เป็นหลักฐานตามวันที่ ไม่ใช่สถานะrolloutล่าสุด

# แผนพัฒนาใหม่ตาม Product Blueprint v1.0

วันที่ 2026-11-04 อ้าง §5 modules, §6 J1–J7, §16 acceptance, §17 backlog และ §18 gates
**ก่อน pilot มี 7 ระยะ S0–S6**; งานหลัง MVP แยกอีก 5 กลุ่ม ไม่ใช่สิ่งที่ต้องสร้างก่อนเริ่มทั้งหมด
แผนนี้แทนลำดับ 6 ระยะของเซสชันก่อนหน้า สำหรับการพัฒนาต่อไป ไม่แก้ประวัติว่าอนุมัติ production แล้ว

**อนุมัติฐาน S1 เดิม:** C-11 เพิ่มการตรวจต้นแบบ/รายละเอียด S0/ทดลอง Auth→DB และพัฒนา S1 ต่อจาก C-10
ผลทำจริงและส่วน S1 ที่ยังเหลืออยู่ใน [รายงาน S1](S1_REPORT_TH.md) ไม่ขยายไป S2–S6 โดยปริยาย
**อนุมัติเพิ่ม:** C-17 จัดการ Supabase/push/deploy ชิ้นงาน S1; C-19–C-21 เพิ่ม branding/live/knowledge adoption และหน้าแรกการ์ดภาพประกอบ
**คำสั่งเดิม C-23–C-25:** ปิด hosted Email/Live sync/สิทธิ์และ readiness S1 ก่อนเริ่ม S2; ลำดับนี้เปลี่ยนตาม C-28 ด้านล่าง
อนุมัติ S2 verified organizations/catalog/search/assessment/bookmarks/rule matching แบบมีเงื่อนไขแล้ว
Email Recovery/SMTP เลื่อนจนก่อนเปิดรับผู้ใช้จริง ไม่เป็นเงื่อนไขเริ่ม S2 ในรอบนี้
ดู [หลักฐาน S1](S1_READINESS_EXECUTION_TH.md) และ [ลำดับ PR S2](S2_EXECUTION_PLAN_TH.md)
**ยังไม่อนุมัติ:** real-data onboarding, vendor contracts, paid provisioning, external messages และ minor workflows
P/D ใน Blueprint ยังต้อง disposition ตามเรื่อง ไม่ใช่อ่านเอกสารแล้วทุกตัวเลขกลายเป็น approved

**อัปเดต C-29–C-31 วันที่5พฤศจิกายน2026:** เจ้าของอนุมัติพัฒนา S3 ทั้งหมดแล้ว พร้อม typography/color และ loading indicator
ดู [ผล S3](S3_REPORT_TH.md), [ADR-005](adr/ADR-005-S3-TH.md) และ [ผล UX](TYPOGRAPHY_LOADING_REPORT_TH.md)
S2/S3 ยังอยู่ feature PR/local; S1 hosted ยัง blocked; สถานะ implementation แยกจาก rollout และ release gates
S4–S6/real-data/production gates ไม่ได้รับอนุมัติจากการเริ่ม S3

## แผนทุก Phase: functions และ features

**อัปเดต C-28 วันที่5พฤศจิกายน2026:** เริ่ม S2 schema/API/UX/fixtures/tests แล้วตาม [รายงาน S2](S2_REPORT_TH.md)
S1 hosted ยัง blocked, Recovery/SMTP ยังเลื่อน; สถานะ “ต้องรอ S1 ก่อนเริ่ม S2” ในประวัติ C-27 ถูกเปลี่ยนเฉพาะลำดับงานนี้
C-28 ไม่อนุมัติ S3 โดยลำพัง; การเริ่ม S3 มีคำสั่ง C-29 แยกแล้ว ส่วน S4–S6/ข้อมูลจริง/production readiness ยังไม่อนุมัติ

รายละเอียด knowledge เดิม15เรื่องและ typographyที่เพิ่มเป็นเรื่อง16และสิ่งที่ทำจริง/เสนอในแต่ละ Phase อยู่ [KNOWLEDGE_ADOPTION_TH.md](KNOWLEDGE_ADOPTION_TH.md)
S1 เพิ่ม real platform admin/MFA, protected owner, โลโก้/favicon upload/reset, feature switches, audit/CSV,
in-app notifications, private Live sync+polling, password hardening, PWA offline shell และเมนูการ์ดทุก role
S2 และ S3 มี backend/UX/fixtures/tests ใน feature branches ตาม C-28/C-29; ยังไม่ rollout production และ S4–S6 ยังเป็นแผน

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
| ID-01 | Auth / recovery / MFA | S1 | Recovery/SMTP เลื่อนตาม C-24; MFA runbook ยังอยู่รอบนี้ |
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


## สถานะชิ้นงานล่าสุดตาม C-29–C-31

| ระยะ | ทำแล้ว | งานถัดไป/สิ่งที่ยังไม่ยืนยัน |
| --- | --- | --- |
| S0 | prototype/แผน, ADR-002, schema/permissions, OpenAPI S1, local user-JWT/RLS spike | pilot scope/ops/privacy sign-off, hosted region/PITR/budget; ไม่อ้างว่าปิด S0 ทั้งระยะ |
| S1 | Email/password, Google login/MFA/admin ที่ owner ยืนยัน, session revoke, own adult profile, notice/consent/delegation, org invitations, branding/admin/live; เพิ่ม validation/Orca/restore และ MFA-owner runbooks | hosted Email/Live/tenant tests ยังติด network; Recovery/SMTP เลื่อนตาม C-24; operational roster/backup/device UAT ก่อนผู้ใช้จริง; S3เพิ่ม prepare/submit/progress แยก scope ใน local ตาม C-29 |
| S2 | verified organizations/evidence, catalog/search/assessment/bookmarks/rules, workspace/live/tests ตาม C-28; รวม main และ rollout production ตาม C-32 แล้ว | scan policy/ผู้ตรวจจริง, privacy/retention และ hosted UAT ยังต้องปิด; S1 hosted ไม่ได้ผ่านจากการ rollout S2 |
| S3 | consent preview/atomic application/share/case/outbox, assigned staff notes/progress/job steps, typed rules และ UI/tests; typography/loading ร่วมทุกหน้า; รวม PR3–10 และเปิด production worker/cron หลังแก้ TLS แล้ว | ยืนยัน Resend SMTP/delivery, Recovery/notices/key/retention/operations และ hosted UAT ตาม [รายงาน rollout](PRODUCTION_ROLLOUT_TH.md); S1 hosted ยังไม่ผ่าน |
| S4 | migrations33–59, warm referral พร้อม consent ใหม่และ destination case, outcomes L0/L1/L2/evidence/dispute, privacy/export/holds/cessation/withdrawal replay และ restricted reports/appeals บน feature branch | review/rollout แยก; notice/retention/roster/abuse/SLA/hosted restore ก่อนข้อมูลจริง; ไม่มี physical purge, user blocking หรือ external S4 email |
| S5 | มีหน้าตัวอย่าง AI/impact เท่านั้น | RAG/AI gateway/evaluation และ aggregate privacy จริง |
| S6 | ยังไม่เริ่ม pilot readiness | manual a11y/UAT/restore/incident/load/release gates |
