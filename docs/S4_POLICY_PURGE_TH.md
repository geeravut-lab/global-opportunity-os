# S4 — policy, rollout และการลบข้อมูลตาม C-35

เจ้าของอนุมัติให้ merge/rollout S4 และพัฒนา notice/retention/ทีมผู้ตรวจ/งานลบจริง วันที่ 6 พฤศจิกายน 2026
PR #11 ผ่าน check และ s1-local ทั้งสองรันที่ commit `9ce5229`; รวม main เป็น `f043e80` และใช้ migrations33–59 กับ hosted แล้ว ไม่มีการลบข้อมูลเดิม

## นโยบายที่เลือกสำหรับ implementation

ใช้ policy version/hash ที่แก้ย้อนหลังไม่ได้ แยก draft/published/retired และ notice ไทย–อังกฤษ
การ publish ต้องระบุผู้ดำเนินการ ประเทศ ช่องทาง privacy เวลารับเรื่อง และผู้รับผิดชอบที่มีบัญชี/MFA จริง พร้อมยืนยันการทบทวนฐานกฎหมาย/การถือครองตามพื้นที่
ไม่ถือว่าการมอบหมายให้พัฒนาเป็นหลักฐานรับรองกฎหมายทุกประเทศ และไม่สร้างบุคคล/สัญญา/เวลาบริการแทนเจ้าของ

| ข้อมูล | ค่าเริ่มต้นทางเทคนิคสำหรับทบทวน | การทำงาน |
| --- | --- | --- |
| draft ที่ไม่ใช้งาน | 30 วัน | เลือกเข้าคิว cleanup โดยไม่ลบ consent/audit |
| case/package/note/evidence | 365 วันหลังปิด | eligibility สำหรับ review; มี hold แล้วหยุด |
| consent/audit/minimal provenance | 730 วัน | จำกัดสิทธิ์และคงเฉพาะ metadata; ไม่เก็บ narrative เพิ่ม |
| raw verification | 90 วันหลังตัดสิน | คิวทบทวน ไม่ลบเอกสารขององค์กรจากคำขอลบบัญชีผู้รับประโยชน์ |
| privacy export | ไม่เก็บ object; stream no-store | ไม่มีไฟล์ export ค้างใน server |
| AI raw prompt | ไม่บันทึก | S5 ใช้ structured filters/public sources และ run metadata เท่านั้น |
| backup | เป้าหมาย 30 วัน ต้องตรวจ plan จริง | ไม่กล่าวว่า backup มีอายุนี้แล้ว; replay ledger ก่อนคืน traffic |

ค่าข้างต้นเป็น selected implementation defaults ภายใต้การมอบหมาย C-35; ไม่ใช่อายุทางกฎหมายที่รับรองแล้ว การเปิด purge อัตโนมัติต้องมี policy/เจ้าหน้าที่/รายการที่อนุมัติจริง
การตั้ง retention ไม่เท่ากับอนุญาตลบแถวทั้งหมดเมื่อครบวัน งานลบตามคำขอเป็น targeted workflow ที่ตรวจ identity/hold/สิทธิ์และขอบเขตอีกครั้ง

## การลบจริงและขอบเขตที่คงไว้

1. เจ้าของข้อมูลยืนยันคำขอลบผ่าน S4; privacy officer ที่ได้รับมอบหมาย/MFA ตรวจ identity และ holds
2. preview แสดงจำนวน store/สิ่งที่จะลบ/metadata ที่ยังคงไว้และ policy hash; ผู้อนุมัติอีกหน้าที่หนึ่งยืนยัน snapshot ปัจจุบัน ห้ามผู้ยื่น/subject/ผู้ตรวจคนเดียวอนุมัติแทนกัน
3. จัดเก็บ deletion ledger ภายนอกฐานข้อมูลและยืนยัน digest ก่อน job ทำงาน; การ restore ต้องนำ ledger ที่เชื่อถือได้กลับมา replay ก่อนเปิด traffic
4. revoke sessions/shares/delegations และหยุด outbox ก่อน scrub profile/assessment/encrypted payloads/notes/evidence; ลบ Auth identity ผ่าน Admin API หลังแยก FK ของ account stub
5. เก็บเฉพาะ opaque IDs, consent/decision/event metadata ตาม policy ที่ยืนยัน ไม่เรียก pseudonymous metadata ว่า anonymous และไม่อ้างว่าลบสำเนาที่ผู้รับดาวน์โหลดไปแล้ว
6. ส่ง recipient cessation และติดตาม acknowledgement; งานภายนอกที่ยืนยันไม่ได้ต้องแสดง pending/exception ไม่ปิดคำขอว่าเสร็จทุก store

ห้าม purge ผู้เป็น owner/ผู้ดูแลที่ยังต้องโอนสิทธิ์ ห้ามข้าม active safety/legal hold และห้ามเลือกข้อมูลของอีก subject จาก request เดียว
audit/consent/decision events ยังคง append-only; ช่องทาง scrub immutable content จำกัดไว้เฉพาะ execution context ของ job ที่อนุมัติ ไม่มี public arbitrary SQL หรือ payload-update endpoint

## การเปิดใช้งาน

ใช้ off → owner preview → enabled แยกจากการ deploy โค้ด owner preview ให้ผู้ดูแลที่ผ่าน MFA ตรวจ policy/คิวได้ แต่ไม่เปิด anonymous/public intake
enabled ต้องมี policy ที่ publish และบัญชี impact/privacy/safety ที่มี scope/MFA/expiry จริง ไม่ถือว่าชื่อ role คือทีมปฏิบัติงานพร้อมแล้ว
S1 hosted/SMTP/Recovery/manual accessibility/hosted backup ยังคงต้องปิดก่อนรับข้อมูลจริง

ผลทดสอบและสิ่งที่รันจริงจะอยู่ในรายงาน rollout ของรอบนี้ ไม่ถือว่าเอกสารนี้เป็นหลักฐานทดสอบผ่าน

## หลักฐานลบและการกู้คืน

ดาวน์โหลด ledger สองจังหวะ: `intent` ก่อน worker และ `executed` หลัง scrub/Auth โดยใช้ลายเซ็น HMAC ที่แยก purpose จาก maintenance authentication
เก็บไฟล์ในที่กู้คืนได้ภายนอกฐานข้อมูล จำกัดผู้เข้าถึง และรักษา signing key รุ่นที่ใช้อยู่ หากพบเพียง intent หลัง restore ให้คงระบบใน quarantine จนตรวจ execution ได้ ห้ามเดาว่าลบสำเร็จแล้ว
ต้อง replay executed receipts ที่ตรวจลายเซ็นแล้วและลบ Auth identity ใน target ก่อนเปิด traffic การ replay ซ้ำต้องไม่เพิ่มผลข้างเคียง
ไฟล์จากเบราว์เซอร์เพียงอย่างเดียวไม่ใช่หลักฐานว่าเก็บใน durable external storage แล้ว ผู้ดูแลต้องยืนยันที่เก็บจริง การหมุน worker secret ไม่หมุน dedicated ledger signing key โดยอัตโนมัติ

## ผลตรวจในเครื่อง ณ 6 พฤศจิกายน 2026

- integration policy/purge10/10: policy publication/roster, MFA, independent approvals, stale snapshot, expired hold, external receipt, concurrent writer, DB scrub และ Auth hard-delete ด้วยบัญชีสมมติ
- fresh install migrations1–65 ผ่าน bootstrap/profile/consent จาก Auth จริงใน stack จำลองใหม่
- isolated backup restore ผ่าน: exact table fingerprints/RLS/ACL, encrypted payload/PNG/password/MFA, S1/S3/S4 withdrawal และ signed executed purge replay/ลบ Auth/replay ซ้ำ
- unit policy/signature/kill-switch4/4 ผ่านพร้อมชุดเดิม รวม93 tests ก่อนเพิ่ม S5
- ผล browser/CI/hosted รอบใหม่ต้องดูรายงาน rollout ที่ระบุ commit จริง ยังไม่ถือว่า hosted UAT หรือ policy/roster ของบุคคลจริงผ่าน
