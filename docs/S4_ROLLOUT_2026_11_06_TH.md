# S4 — rollout และข้อจำกัด ณ 6 พฤศจิกายน 2026

ตาม C-35 เจ้าของอนุมัติตรวจ PR/CI, merge และ rollout พร้อม policy/retention/ทีมผู้ตรวจ/งานลบจริง
เป้าหมาย BP-B-401–403 และ BP-AC-16 ไม่ถือว่าผ่านทั้งข้อจากผล local เพียงอย่างเดียว

## งานที่เกิดขึ้นจริง

- PR #11 head `9ce5229` ผ่าน check/s1-local ทั้งสองรัน `42097010517`/`42097007190` และ Vercel preview; merge เข้า main เป็น `f043e80`
- Supabase ใช้ migrations33–59 แบบ atomic; verify รวม59, unsafe roles0, ตาราง app/private ที่ไม่มี RLS0, owner designation1, Realtime guard1 และ immutable audit1
- ไม่ seed ข้อมูลสมมติบน hosted และไม่ลบข้อมูลจริง ไม่ใช้ Vercel READY แทน hosted UAT
- เพิ่ม migrations60–65 บน feature branch: policy version/hash, published notice/ประเทศ/retention, named expiring roster, owner-preview gate, independent purge approval, write barrier, scrub/Auth hard-delete, anonymous receipt และ signed restore ledger
- ค่า retention/เงื่อนไขบุคคลจริงดู [S4 policy/purge](S4_POLICY_PURGE_TH.md); C-36 เริ่ม S5 แยกตาม [ขอบเขต](S5_SCOPE_TH.md)

## Checks ที่รันจริงก่อนเปิด PR policy

| การตรวจ | ผล |
| --- | --- |
| typecheck/lint | ผ่านก่อนเพิ่ม S5; ไม่มี dependencies ใหม่ |
| unit | 93/93 รวม policy/signature/kill-switch4 |
| policy/purge integration | 10/10; JWT/MFA/DB ในเครื่อง, synthetic Auth hard-delete, stale approval/hold/queued writer/tenant deny |
| fresh migrations1–65 | ผ่านบน stack ใหม่ ไม่ reset ฐานเดิม |
| backup/restore65 | ผ่าน target แยก; exact fingerprints/RLS/ACL/encryption/PNG/password/MFA, S1/S3/S4 withdrawal และ signed purge replay/Auth hard-delete/idempotency |
| browser policy | 4/4: MFA/ordinary-user deny, draft/spinner/no duplicate, ไทย/อังกฤษ notice/receipt, mobile reflow และ axe |
| production build | ผ่าน; browser ใช้ build นี้ |
| integration รวม/CI policy/rollout60–65 | กำลังตรวจ ยังไม่บันทึกว่าผ่านหรือใช้ hosted แล้ว |

## การเปิดใช้งานที่เตรียมไว้

`NODE_USE_ENV_PROXY=1 node scripts/hosted-s1.mjs migrate --include-policy` เลือกถึง65เท่านั้น ไม่รวม S5
`verify --include-policy` ตรวจจำนวน/ขอบเขตเดิม
`policy-preview` ตั้ง S4 owner preview และเก็บ dedicated signing key/Auth cleanup key แบบ encrypted ใน Vercel โดยไม่แสดงค่า; คง public intake/purge/S5 ปิด ต้อง deploy commit ที่ผ่าน CI เพื่อรับ environment ใหม่
ต้องใช้ script จาก commit ที่ตรวจแล้ว ไม่มีการเรียก `policy-preview` ในผลก่อนเปิด PR นี้

worker production จะ execute purge ต่อเมื่อ runtime flag, DB flag, published policy/roster และ independent request/receipt ผ่านทั้งหมด งานลบจริงไม่เกิดจาก rollout โดยอัตโนมัติ

## สิ่งที่ยังต้องมี

1. ผู้ดำเนินการ/ประเทศ/ช่องทาง privacy/เวลารับเรื่องจริง และบัญชี impact/privacy/safety ที่มี MFA; ไม่แต่งข้อมูลให้แทนเจ้าของ
2. ทบทวน notice/retention/holds/ผู้รับสำเนาและที่เก็บ signed ledger ภายนอก; รักษากุญแจรุ่นเก่าและ quarantine restore ก่อนเปิด traffic
3. runtime ยัง revision1 ไม่อนุญาตเว็บ/Supabase project host; hosted Email/session/Live sync/revoke/tenant และ Recovery/Resend ยังไม่ผ่านใน task นี้
4. backup/restore hosted, manual accessibility/device UAT และทีมปฏิบัติงานจริง ยังแยกจากผล local/CI

## Regression ที่พบก่อน merge

integration รวมครั้งแรกผ่าน110/113; inbox สองจุด timeout เมื่อประวัติแจ้งเตือนสะสม และ scenario recruiter หลาย transition เกิน test timeout20วินาที
เพิ่ม recipient candidate query + index ก่อนตรวจ RLS ใน migrations65 (ยังไม่เผยแพร่ hosted) โดยคงสิทธิ์รายคนเดิม กำลังตรวจซ้ำ ไม่ merge จากผล110/113
