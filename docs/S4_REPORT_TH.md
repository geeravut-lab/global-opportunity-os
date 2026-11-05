# ผลพัฒนา S4 — ส่งต่อ ผลลัพธ์ และสิทธิ์ข้อมูล

## ขอบเขตและสถานะ

C-34 อนุมัติเริ่ม S4.1–S4.3 จาก [ขอบเขตที่เตรียมไว้](S4_SCOPE_TH.md) บน branch `feat/s4-referrals-outcomes-privacy`
ตรวจชิ้นงานได้ใน [draft PR #11](https://github.com/geeravut-lab/global-opportunity-os/pull/11)
คงพันธกิจทั่วโลก/ทุกกลุ่มและเป้าหมายธุรกิจยั่งยืน ไม่มีค่าธรรมเนียมผู้รับประโยชน์หรือ paid ranking
ใช้ stack และ dependency versions เดิม ไม่มีบริการใหม่หรือข้อมูลผู้รับประโยชน์จริง
production ยังเป็น main `ec81321` จาก PR #10; รอบนี้ไม่ merge main/deploy production หรือใช้ migrations S4 กับ hosted

## Functions/features ที่มี implementation

| ชิ้นงาน         | พฤติกรรม                                                                                                                                                                                                                            | AC และขอบเขตหลักฐาน                                                                                                                                                |
| --------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| S4.1 / BP-B-401 | ผู้ปฏิบัติงานต้นทาง/เจ้าของข้อมูลเสนอส่งต่อจากเคสที่ share ยังใช้ได้; ผู้ใช้ดู named recipient/purpose/exact values/notice/hash/expiry แล้วยืนยันเอง; pending/accept/decline/cancel/revoke, destination case ครั้งเดียวและ reassign ภายในองค์กร | BP-AC-07/08: user JWT/RLS, consent/version/idempotency/race, source/third tenant/assignment negatives; acceptance เป็นการรับประสานงาน ไม่ใช่ผลได้รับบริการ         |
| S4.2 / BP-B-402 | L0 self-report/L1 provider-report แยก provenance; PNG quarantine → restricted worker inspect; independent scoped MFA reviewer/assignment, beneficiary confirmation หรือ documentary alternative, L2 verify/dispute/correct/dedup    | BP-AC-12/15: ไม่ให้ partner ตรวจตนเอง, ไม่ให้ general admin อ่าน narrative โดยตำแหน่ง; ไม่มี L3 หรือ causal-impact claim                                           |
| S4.3 / BP-B-403 | access/export/correct/delete request, identity check, officer routing/holds/reasons/append-only history, recipient cessation/ack และ operator-only withdrawal replay                                                                | BP-AC-16/18 เฉพาะส่วนที่ทำแล้ว: no-store owner-only export, internal notes ไม่รั่ว, stop sharing; **ยังไม่มี physical purge/deletion replay และไม่อ้าง AC-16 ครบ** |
| Reports/appeals | คิว safety/service จำกัดสิทธิ์, independent officer/assignment; ไม่แจ้ง accused อัตโนมัติ; anonymous report/status/appeal ด้วย receipt สุ่มที่เก็บเฉพาะ hash                                                                        | ไม่มี SLA/24h/emergency promise; anonymous role write-only ไม่อ่าน/decrypt narrative; abuse/roster/escalation จริงยังต้องปิดก่อนเปิด intake                        |
| UI/Live | หน้า coordination/report ไทย–อังกฤษ, home cards, mobile bottom bar, typography/color tokens, spinner/duplicate suppression, exact-field consent และ current-rights download | account signals/fingerprint ไม่มี narrative; dirty forms ไม่ถูกทับ แต่ถอนสิทธิ์แล้วต้องปิดข้อมูลทันที; automated axe ไม่แทน manual assistive-technology UAT |

## ไฟล์และโครงสร้างที่เปลี่ยนจริง

- migrations33–59 เพิ่ม referrals/previews/packages/cases/notes, outcomes/evidence, staff scopes, privacy/reports/cessations/withdrawals/events/idempotency, current notice map และ default-off DB release gate; ไม่แก้ published migrations1–32
- `lib/s4`, `app/api/s4`, `components/s4-panel.tsx`, `components/guest-report.tsx`, pages coordination/report: DTO/input/BFF/สองภาษา/หน้าจอ; [OpenAPI](../api/s4.openapi.json) อธิบาย routes และ validators ที่มีอยู่
- ปรับ navigation/shell/proxy/Live endpoint และสิทธิ์กรณีถอนสมาชิกหรือ source share โดยคง MFA/tenant/assignment checks ทุก request
- worker PNG inspector ใช้ฟังก์ชันเดียวกับ maintenance เดิมและจำกัด table allowlist; production จะประมวลผล S4 เฉพาะเมื่อ flag เปิดหลัง rollout
- scripts local fixtures/app/evidence, integration/browser/unit suites, fresh migrations/backup restore และ CI; `.local` เก็บ credentials/log/archive แบบ ignored จำกัดสิทธิ์ ไม่ใส่ลง Git
- README/INDEX/PHASE_PLAN/NEXT_STEPS/DECISIONS/S4_SCOPE และ ADR-006 อัปเดตสถานะ/ขอบเขต; ไม่เปลี่ยน P-* หรือนโยบาย legal ให้เป็น accepted

## ผลตรวจจริง

| คำสั่งที่รันจริง | ผล |
| --- | --- |
| `npm run typecheck`, `npm run lint`, `npm run build` | ผ่าน รวม design-token/ขนาดฟอนต์ checks |
| `npm run test:unit` | 89/89 ผ่าน |
| `npm run test:e2e` | 25/25 ผ่าน |
| `npm run test:a11y` | 24/24 ผ่าน (axe ไทย–อังกฤษ/320px ของหน้าเดิม) |
| `npm run db:test:fresh` | ผ่าน migrations59/59 บน stack ใหม่; Auth/bootstrap/profile/consent, default-off S4 gate และ reporter write-only negatives |
| `npm run test:integration` | 103/103 ผ่านใน6ไฟล์บน schema59 รวม S4 25กรณีและ regression S1–S3 |
| `npm run test:auth` | 27/28 ผ่าน แล้วทวน MFA/องค์กร/คำเชิญเฉพาะกรณีผ่าน1/1 หลังรอ spinner ครบ; เป็นผลสองรัน ไม่ใช่ single-run28/28 |
| `npm run test:s2` | 13/13 ผ่าน รวมสองหน้าต่าง/draft/stale save, publication, axeและ reflow ไทย–อังกฤษ |
| `npm run test:s3` | 12/12 ผ่าน รวม consent/application/case lifecycle, assignment revoke, preferences, typed automation, axeและ fonts/reflow ไทย–อังกฤษ |
| `npm run test:s4` | 8/8 ผ่านในรันเดียว รวมสองหน้าต่าง/ถอนสมาชิกขณะ dirty, inspected evidence/independent review/dispute, private export, spinner/duplicate/error recovery, ไทย–อังกฤษ/axe WCAG2.2/reflow360px และปิด DB gate แล้วหยุดแสดงข้อมูลโดยไม่ refresh |
| `npm run test:backup-restore` | ผ่านบน snapshot schema59: ข้อมูล/ไฟล์/ACL/RLS/key/Password/MFA/audit และ idempotent withdrawal/session replay ของ S1/S3/S4 บน stack แยก; referral ที่ถอนแล้วคงปิดพร้อม cessation เดียว |
| JSON parse/local OpenAPI response references, Markdown local links, staged credential-pattern scan และ `git diff --check` | ผ่านกับ diff สุดท้าย (รวมไฟล์ migrations58–59) |

migrations53–59 เพิ่ม candidate IDs/index ก่อนตรวจ predicates/RLS สำหรับ matching, publisher catalog, account metadata, subjects, sources, queues และ Live clock โดยคงการตรวจสิทธิ์/consent/MFA เดิมทุกแถว ไม่เพิ่ม timeout หรือ table grants; helpers อยู่ private ไม่ให้ anon/authenticated/worker/reporter execute
query นับโควตาการเสนอเคส/preview ใช้ actor index และ uid scalar candidate โดยคง limit development เดิม ตัวอย่างการวัด query คิวปลายทางลดจาก timeout8วินาทีเป็นประมาณ0.8วินาที และ query นับโควตาของผู้เสนอจาก8วินาทีเป็นประมาณ1มิลลิวินาทีบนข้อมูลสมมติชุดเดิม ตัวเลขนี้เป็นการวินิจฉัยเฉพาะ query ไม่ใช่เวลา API ทั้งคำขอหรือผล NFR/load

seeder S2/S3 หมุน published fixtures เก่าเป็น paused เฉพาะ loopback port/อีเมล example.test/metadata ทดสอบ โดยเก็บข้อมูล/ประวัติไว้; notice-version test ใช้ version label แยกแต่ละรอบเพื่อรันซ้ำได้
ชุด accessibility ของบัญชี8หน้าและวงจร MFA/องค์กร/คำเชิญใช้ budget90วินาที; S2 axe10หน้าใช้120วินาที กรณี login/บันทึกรอ navigation หรือ spinner จบแบบมีขอบเขต ไม่ใช้ผลเหล่านี้แทน NFR

ชุด Auth ตั้ง S4 DB gate ปิดระหว่างทดสอบและคืนค่าเดิมเมื่อจบ เพื่อให้ตรง app flags ของ S1; seeder S2/S3 ปิด gate ก่อนเตรียม fixtures และ S4 seed เปิดกลับเฉพาะ local สำหรับ enabled-matrix tests ห้ามรันชุดเหล่านี้พร้อมกัน

เมื่อ account metadata โหลดไม่สำเร็จโดย session ยังถูกต้อง หน้า S2 แสดง retry error แทนส่งไป login; genuine account/session invalid ยัง redirect เหมือนเดิม ชุดทดสอบปิดหน้าต่างเสริมเมื่อใช้เสร็จเพื่อลด polling ที่ไม่ใช่ส่วนของสถานการณ์

S3 โหลดรายชื่อ subject เฉพาะ apply/settings และคำขอข้อมูลเพิ่มเติมที่เจ้าของมีสิทธิ์ submit; หน้ารายละเอียดเคสไม่โหลดข้อมูลส่วนนี้เมื่อไม่ใช้ โดยคง RPC/RLS และ scope checks เดิม

Live ของ S4 ผูก fingerprint ก่อนอ่านข้อมูลหน้า server กับ revision ของหน้าที่แสดงจริง เพื่อไม่พลาดการเปลี่ยนสถานะระหว่าง server render กับ poll แรก และหลีกเลี่ยง refresh ซ้อนระหว่างบันทึก/เปลี่ยนหน้า; migration57 ส่งสัญญาณสถานะหลักฐานให้เจ้าหน้าที่เคสปัจจุบันด้วย โดยไม่มี payload และยังตรวจสิทธิ์ทุกครั้ง

ผลเหล่านี้เป็น functional checks ด้วย synthetic fixtures ไม่ใช่ผล load/NFR หรือ hosted UAT

## ข้อจำกัดและสิ่งที่ยังไม่รัน

- S4 เปิดเฉพาะ local synthetic fixtures; `S4_ENABLED` และ `private.s4_release.enabled` ปิด default ทั้ง app/DB ไม่เปิด direct RPC ให้ bypass gate
- ไม่มี hosted S4 migration, flags, production deploy หรือ hosted S4 UAT จากรอบนี้
- notice/TTL/rate budgets เป็นค่าทดลอง development; ต้องรับรองข้อความ/expiry/identity/retention/holds/roster/SLA/abuse controls ก่อนข้อมูลจริง
- ไม่มี physical purge, minor personalized flow, user-to-user blocking feature, external S4 email delivery หรือ AI adjudication; reports/appeals และ withdrawal controls ไม่เท่ากับงานเหล่านี้
- PNG decode/re-encode เป็น image inspection ไม่รับรองเนื้อหา/คุณสมบัติ/ความจริงหรือ antivirus certification
- cessation acknowledgement ยืนยันรับคำขอ ไม่พิสูจน์ว่าลบสำเนาภายนอกทุกแห่งแล้ว
- hosted S1 Email/Live/tenant/Recovery ยังติด runtime network revision เดิม; ไม่ bypass policy และไม่ถือว่าผล local ปิด hosted gates
- Resend SMTP/verified sender, hosted backup/restore และ manual keyboard/screen-reader/device/load/incident UAT ยังไม่ปิดจาก S4; local restore ไม่แทน production recovery

## ขั้นตอนถัดไป

1. **S4:** ตรวจ PR/AC/สิทธิ์และ policy gaps แล้วเลือกอนุมัติ rollout migrations/flags แยกจากการอนุมัติเริ่มพัฒนา
2. **S1/S3/S6:** ปิด Resend SMTP/Recovery/runtime network/hosted UAT/backup/manual accessibility ก่อนรับข้อมูลจริง
3. **S5:** เลือก scope Navigator/citations/manual fallback และ aggregate impact พร้อม privacy gates ก่อนเริ่ม

CI ให้ตรวจที่ head ล่าสุดของ PR; ผลตารางนี้เป็นหลักฐาน local ไม่ใช้ CI ของ SHA เก่าแทนรุ่นล่าสุด
