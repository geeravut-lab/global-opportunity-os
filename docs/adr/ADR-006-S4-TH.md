# ADR-006 — S4 ส่งต่อ ผลลัพธ์ และสิทธิ์ข้อมูล

สถานะ: แนวทาง implementation ภายในขอบเขต C-34; ไม่ใช่นโยบาย legal/retention หรืออนุมัติเปิดข้อมูลจริง
ใช้ Next.js/PostgreSQL/Supabase และ dependencies ที่ pin อยู่เดิม ไม่มีบริการใหม่

## เคสส่งต่อและความยินยอม

เคส S3 ผูกกับใบสมัครโดย FK จึงแยก destination coordination case ใน S4 พร้อม FK ไป referral และ assignee ภายในองค์กรปลายทาง
การรับเคสหมายถึงรับประสานงาน ส่วนการได้รับบริการ/เริ่มงานต้องมี outcome แยก ไม่เพิ่มยอด verified จากสถานะ accepted
การจองที่นั่ง/รับสมัครยังผ่าน S3 และ capacity barrier เดิม

caseworker ต้นทางเสนอได้แต่ยืนยัน consent แทนผู้ใช้ไม่ได้ อำนาจ delegation ของ S3 ไม่ถูกยกมาเป็นสิทธิ์ S4 โดยอัตโนมัติ
ผู้ใช้ตรวจ named recipient/purpose/exact fields/values/notice hash และยืนยันใหม่ snapshot เข้ารหัสด้วย key ของ S3
ตรวจ source/profile/assessment/listing revisions และ expiry อีกครั้งก่อน submit; idempotency lock/receipt และ unique destination case ป้องกันการส่งซ้ำ
ไม่มีการคัดลอก internal notes ต้นทางหรือส่งต่อทั้งโปรไฟล์

สิทธิ์ปลายทางขึ้นกับ verified org, active member, assignment, MFA และ current share ทุก request/download
การถอนแชร์ต้นทางหยุด derived access และสร้าง cessation ledger; ข้อมูลที่ผู้รับอ่านไปแล้วไม่อาจเรียกคืนทางเทคนิค
restore ต้อง replay S3 และ S4 withdrawals ก่อนคืน traffic ไม่ใช้ผล Live sync แทน authorization
TTL request/share/scope ที่ใช้เป็นค่าทดลอง development ต้องรับรอง notice/policy ก่อนข้อมูลจริง

## ผลลัพธ์และหลักฐาน

L0 = ผู้รับประโยชน์รายงานเอง, L1 = ผู้ให้บริการรายงาน, L2 = ผู้ตรวจอิสระตรวจหลักฐานตามสิทธิ์และการมอบหมาย
L2 ต้องมี clean PNG evidence พร้อม beneficiary confirmation หรือ human-reviewed documentary alternative ที่ระบุชัด
ผู้รายงาน/เจ้าของ subject/สมาชิกองค์กรที่ถูกรายงานผลไม่เป็น independent reviewer ของรายการนั้น
การ dispute/reject/supersede เอา L2 ออกโดยคงที่มาของผู้รายงาน; corrections เป็นแถวใหม่และ history เดิมคงอยู่
unique case/kind/service-period ป้องกันนับซ้ำ ไม่มี L3/audit claim หรือ causal impact จากโค้ดนี้

รับเฉพาะ PNG ไม่เกิน 1 MB ใน quarantine ไม่มี download จน worker decode/re-encode และลบ original
นี่เป็น image validation ไม่ใช่การรับรองว่าเอกสารเป็นจริงหรือ antivirus certification
worker อ่านเฉพาะ quarantine columns และอัปเดต clean/rejected ใช้ตัวตรวจเดียวกันใน local กับ maintenance production
private evidence download ตรวจสิทธิ์ใหม่ทุกครั้ง ส่ง attachment + nosniff + sandbox + no-store

## เจ้าหน้าที่และ privacy

goos_api ใช้ user JWT และ RLS; goos_authz อ่าน metadata สำหรับ predicates ไม่มี BYPASSRLS
ชื่อ staff ใน roster มาจาก narrow checked helper เฉพาะผู้มีสิทธิ์จัดทีม ไม่เพิ่มสิทธิ์อ่าน display_alias ทั้งตารางให้ authz
เจ้าหน้าที่ impact/privacy/safety ต้องมี scope ไม่หมดอายุ + MFA + resource assignment ปัจจุบัน
platform admin จัดคิวได้แต่ไม่มี body/evidence access โดยตำแหน่ง ไม่ให้ self-grant/self-assignment และไม่ให้ reporter verify ผลตนเอง

privacy requests รองรับ access/export/correct/delete, identity review, holds และ recipient cessation/ack
export หลัง approval ให้เฉพาะเจ้าของข้อมูล รวมข้อมูลตนเองและ shared notes ไม่ให้ partner internal notes, encryption keys หรือ auth rows
correction ให้เจ้าของแก้ profile ผ่านสิทธิ์เดิมและตรวจ version ก่อนปิดคำขอ
คำขอลบอยู่ awaiting_policy/on_hold ไม่มี physical purge endpoint ก่อน owner/legal/restore gate ผ่าน
การ acknowledge เป็นคำยืนยันของผู้รับ ไม่ใช่หลักฐานว่าคัดลอกข้อมูลภายนอกทั้งหมดถูกลบแล้ว

reports/appeals ใช้ restricted officer assignment ไม่แจ้งผู้ถูกร้องเรียนอัตโนมัติ ไม่มี AI ชี้ขาด
anonymous intake ใช้ goos_reporter แบบ NOLOGIN/NOINHERIT/NOBYPASSRLS, INSERT-only ต่อ anonymous report และไม่มี decrypt/table SELECT
receipt สุ่ม 256-bit เก็บเฉพาะ hash, ตรวจสถานะด้วย proof ผ่าน POST โดยไม่ใส่รหัสใน URL/localStorage/email
anonymous events ใช้ ledger ที่ actor เป็น null แยกจาก audit ของ staff; จำกัด body/อัตราการรับเรื่องใน DB และ BFF
ยังต้อง edge abuse protection, staffed rota/escalation drill และ local legal policy ก่อนเปิดใช้งานจริง

## UI และการปล่อยรุ่น

ไทย–อังกฤษ, typography/color tokens เดิม, home cards, mobile bottom bar และ BusyForm/BusyLink/busyFetch/DownloadLink เดิม
Live signals มีแต่ account revision ไม่มี narrative/payload; dirty forms ไม่ถูกทับ และ revocation ต้องปิดข้อมูลที่ไม่มีสิทธิ์แม้ฟอร์มยังไม่บันทึก
S4 จับ fingerprint ก่อนอ่านข้อมูล server และเปรียบเทียบกับ revision ของหน้าที่แสดงจริง เพื่อไม่พลาดสถานะที่เปลี่ยนก่อน client poll แรก; ระหว่างบันทึก/เปลี่ยนหน้ารอให้จบก่อน refresh ซ้อน
สัญญาณ evidence/outcome ส่งถึงเจ้าของ ผู้ตรวจ และเจ้าหน้าที่เคสที่ยังมีสิทธิ์ปัจจุบัน ไม่มี narrative และไม่ใช้สัญญาณแทน authorization
S4_ENABLED กับ private.s4_release.enabled ต้องเปิดทั้งคู่; DB gate ปิดโดยค่าเริ่มต้นเพื่อกัน direct RPC bypass
รอบ C-34 พัฒนา local/feature branch เท่านั้น ยังไม่ migrate/เปิด S4 บน production หรือถือว่า SMTP/hosted S1/Recovery ผ่าน
