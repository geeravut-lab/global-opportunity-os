# ADR-005 — ใบสมัคร เคส และการแจ้งเตือน S3

วันที่5พฤศจิกายน2026 ขอบเขต C-29 และ BP-B-301–303; ต่อจาก S2 ที่ยังไม่ rollout
รายละเอียดเป็นการเลือกทางวิศวกรรมเพื่อทดสอบด้วยข้อมูลสมมติ ไม่รับรองนโยบาย production/retention หรือข้อเสนอ P/G แทนเจ้าของ

## Consent และ transaction

ผู้ใช้เลือก recipient/purpose/notice/fields ก่อนสร้าง server-frozen preview15นาที พร้อม hash และ source versions
submit ต้องยืนยันด้วย checkbox ที่ไม่ติ๊กไว้ล่วงหน้า; delegation แยก prepare/submit/progress และ assisted submit ต้อง read-back
ไม่ส่ง whole profile/assessment: allowlist7ช่อง, skills เป็น self-reported, contact_email เฉพาะ verified Auth email เมื่อ safe contact เป็น email และเลือกส่งเอง
คำขอข้อมูลเพิ่มสร้าง preview/consent/response/share ชุดใหม่ ไม่แก้ package ต้นฉบับย้อนหลัง

ใบสมัคร/package/consent/share/fields/event/case/outbox/receipt สร้างใน transaction เดียว
advisory lock ผูก actor/route/idempotency key, row lock ของ opportunity และ unique active cycle ป้องกัน duplicate และ last-seat race
body เปลี่ยนหรือ preview/profile/listing version หมดความสดคืน409 ไม่มี partial share
capacity จองตอน accept หรือผู้ใช้ accept_offer; pending requests ยังไม่กินที่นั่ง
withdraw คืน reservation เฉพาะเคสที่ยังไม่เริ่มงาน เป็นพฤติกรรมทดสอบที่ยังต้องรับรอง policy จริง
revoke_share หยุดการอ่านในอนาคตได้แม้งาน completed โดยรักษาประวัติ; ข้อมูลที่ผู้อ่านเคยเห็นไม่สามารถเรียกคืนจากความจำ/สำเนาภายนอก

## ขอบเขตสิทธิ์และ encryption

BFF ส่ง user JWT ปัจจุบันผ่าน RPC owner `goos_api` ที่ NOLOGIN/NOINHERIT/NOBYPASSRLS
ทุกตารางเปิด RLS, composite subject/organization FKs, expected versions และ immutable event/package/note/consent
platform admin/org owner/supervisor อ่าน routing metadata ได้ตามหน้าที่ แต่ไม่ได้ package จาก role อย่างเดียว
caseworker/recruiter ต้องเป็นสมาชิกปัจจุบัน+MFA+assignment+active share+องค์กรยัง verified/unexpired
recruiter อ่านได้เฉพาะ beneficiary-shared notes; internal notes ไม่เปลี่ยน beneficiary fingerprint
reassign/revoke บังคับถอนหน้า package แม้มี draft; dirty form ปกติยังรักษาข้อความและคืน409เมื่อ stale

package/response/preview/note ใช้ pgcrypto AES256 กับ key_id และ key ใน private DB ที่ไม่ grant ให้ web/API roles
crypto helpers เป็น operator-owned narrow exception; **ยังไม่ได้แยก KMS หรือ backup trust boundary** จึงไม่อ้างว่าผู้ดูแลฐานข้อมูลอ่านไม่ได้
restore ต้องเก็บ keys/ACL ให้ถูกและ replay ledger การถอนสิทธิ์ก่อนเปิด Auth/REST อีกครั้ง

## Human workflows

เคสมี triage/start/await_external/resolve/close/reopen, priority, due UTC และ IANA timezone
close/reopen เป็น supervisor; resolution ต้องมี reason code; correction เป็น note ใหม่อ้าง supersedes ไม่ overwrite
งานมี interview/offer/ผู้ใช้ accept_offer/started/completed โดยคนที่ได้รับสิทธิ์ ไม่ใช้ AI/automation ตัดสิน
job_started ต้อง case in_progress; job_completed ต้อง case resolved; ไม่สร้าง job payment/placement fee/ผลรับรองรายได้

## Outbox และ automation

แต่ละ event enqueue เฉพาะช่องทางที่เปิดไว้ในขณะเกิดเหตุการณ์ พร้อม dedupe key
worker lease2นาที/SKIP LOCKED/revalidate ก่อนส่ง/ack แบบ idempotent; failure backoff+jitter สูงสุด5ครั้งและ dead letter
opt-out/safe contact/revoke/withdraw/assignment change ถูกตรวจซ้ำ ไม่ส่งงานเก่าที่เกิดก่อน opt-in
in-app source_event_id unique; SMTP เป็น at-least-once พร้อม stable Message-ID ไม่อ้าง exactly-once ระหว่าง DB และ mail server
ข้อความไทย–อังกฤษเป็น generic ไม่มีชื่อรายการ/ชื่อบุคคล/รายละเอียดเคส มี protected deep link และต้อง login/ตรวจสิทธิ์ใหม่
manual retry ตรวจ scope/attempts และจำกัด3ครั้งต่อวัน; monitor แสดง metadata ไม่คืน payload/email

`goos_worker` เป็น NOLOGIN/NOINHERIT/NOBYPASSRLS แยกจาก user RPC ไม่มีสิทธิ์อ่าน application_packages
local runner ใช้ operator connection เพื่อ SET LOCAL ROLE; จำกัด loopback543xx/Mailpit SMTP54325 และ fake @example.test เท่านั้น
production worker principal/credential rotation/queue supervision/SMTP provider/webhooks ยังไม่มีการติดตั้ง
rule editor รับเฉพาะ followup_due + minutes/timezone และ dry-run writes0; ไม่รับ SQL/JS หรืออนุมัติธุรกิจอัตโนมัติ
ไม่มี LINE/inbound provider webhook ใน slice นี้

## UI และการเปิดใช้

`S3_ENABLED=true` ต้องคู่กับ `S2_ENABLED=true`; ค่าเริ่มต้นปิดทั้งคู่
หน้า `/th/workflow` และคู่ `/en/workflow` เชื่อม apply/applications/queue/team/settings/automation/delivery ตามสิทธิ์ server
typed input, exact confirmation, current role guards และ error states แยก backend unavailable จากไม่มีข้อมูล
Live sync ส่ง private `{}` signals เท่านั้น และ fingerprint/active-resource authorization เป็น authoritative
ดู [OpenAPI](../../api/s3.openapi.json), [แผน](../S3_EXECUTION_PLAN_TH.md) และ [รายงานผลจริง](../S3_REPORT_TH.md)
S1 hosted ยัง blocked และ S4/S5 ยังไม่เริ่ม; build/CI ไม่ใช่ pilot release gate
