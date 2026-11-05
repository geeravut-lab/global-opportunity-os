# ขอบเขต S4 ที่เลือกเตรียมตาม C-32

เจ้าของให้เลือกขอบเขตก่อนเริ่มพัฒนา จึงแบ่งเป็น3ชิ้น review โดยใช้ข้อมูลสมมติและสิทธิ์ S3 เดิม
ยังไม่มีโค้ด S4 จากเอกสารนี้ และไม่ถือว่ารับรองนโยบายข้อมูลจริง/retention/minors

| ชิ้นงาน | Functions/features | หลักฐานยอมรับ |
| --- | --- | --- |
| S4.1 / B-401 | ผู้รับประโยชน์ preview recipient/purpose/exact fields/notice ใหม่ → consent → pending referral; ปลายทาง accept/decline, ผู้ใช้ cancel/revoke; destination case สร้างครั้งเดียว | BP-AC-07/08; idempotency/concurrent accept; sourceไม่เห็น internal notes ปลายทาง; ถอนสมาชิก/แชร์แล้วอ่านไม่ได้ |
| S4.2 / B-402 | outcome ที่ระบุแหล่ง/เวลา/ผู้รายงาน, self-reportedแยกจาก independently reviewed; evidence quarantine; independent reviewer; dispute/correction/dedup | BP-AC-12/15; partnerรับรองผลตัวเองไม่ได้; ไม่อ้างผลจ้างงาน/ผลกระทบก่อนตรวจ; employer-only assertionsไม่เป็น verified outcome |
| S4.3 / B-403 | privacy request access/export/correct/delete, identity check, routing/holds/recipient cessation/withdrawal replay; report/appeal queue แยกสิทธิ์ | BP-AC-16/18; export deny/tenant tests, immutable request history; ห้าม purge จริงจน owner/legal กำหนด retention/holds และกู้คืนผ่าน |

ลำดับเริ่มพัฒนาที่แนะนำคือ S4.1 หลัง rollout/worker/SMTP และ hosted S1 ผ่าน
S4.2/S4.3 ต้องระบุผู้ตรวจอิสระ/ผู้รับผิดชอบ privacy/safety และนโยบายหลักฐาน/retention/holds ก่อนข้อมูลจริง
ระบบแจ้งเหตุ safeguarding ที่มีคนตอบรับจริงต้องมี roster/escalation drill; ไม่เปิด personal minor workflow จากขอบเขตนี้

## ขั้นถัดไป

ปิดงาน deployment/hosted verification ตามรายงาน rollout แล้วให้เจ้าของยืนยันเริ่ม S4.1 ตามขอบเขตข้างต้น
ข้อเสนอเรื่องนโยบายและเจ้าหน้าที่คงเป็นข้อเสนอ ไม่อ้างผลทดสอบก่อนมี implementation
