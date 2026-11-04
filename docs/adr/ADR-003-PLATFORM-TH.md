# ADR-003 — Branding, Live sync และขอบเขตผู้ดูแล

สถานะ: technical implementation ภายใน C-19–C-21; ไม่ใช่การอนุมัตินโยบาย retention/real pilot
วันที่ 2026-11-04 ต่อจาก [ADR-002](ADR-002-S1-AUTH-TH.md)

## ปัญหาและทางเลือกที่ใช้

เจ้าของต้องการเปลี่ยนแบรนด์โดยไม่แก้โค้ด อัปเดตสถานะข้ามหน้าต่าง และหน้าแรกที่ใช้สะดวกตาม RooSuk
คง Next.js/Vercel และ user-JWT → RPC → RLS; `goos_api`/`goos_authz` เป็น NOLOGIN/NOBYPASSRLS
schema private/app ไม่เปิด CRUD แก่ anon/authenticated; public wrappers เปิดเฉพาะ DTO ที่อนุญาต

PNG โลโก้สูงสุด 1 MB และ favicon 512 KB เก็บเป็น bytea พร้อม metadata ใน private.brand_assets
server ใช้ sharp ตรวจ decode/dimensions, reject SVG/APNG และล้าง metadata; DB ตรวจ PNG signature/IHDR/IEND และ bounds
ภาพเป็นข้อมูลสาธารณะที่ตั้งใจเผยแพร่เท่านั้น ไม่ใช่ช่องทางอัปโหลดเอกสารผู้รับประโยชน์
บันทึกภาพ+reference+version+audit ใน transaction เดียว ลด orphan/ช่วง signed URL หมดอายุ
อ่านได้เฉพาะ current reference; admin ที่ผ่าน MFA อ่านภาพใน transaction เขียนได้; เปลี่ยนภาพลบ binary เดิมหลังเปลี่ยน reference
ทางเลือก Storage เหมาะกับเอกสาร/ไฟล์ใหญ่ S2 ซึ่งต้อง quarantine/scan/access proxy แยก ไม่ใช้ตารางนี้แทน
ข้อจำกัดคือ binary อยู่ใน DB backup และ DB traffic; ภาพมีขนาดจำกัด ไม่เก็บประวัติ binary ไม่จำกัดรุ่น

## Owner และขอบเขตสิทธิ์

operator บันทึก salted hash ของอีเมลที่ owner ระบุไว้ใน private.platform_bootstrap โดยไม่ commit อีเมลนั้น
เมื่อ verified account ที่ตรงกัน login/bootstrap ระบบ claim owner แบบครั้งเดียวภายใต้ row lock
ไม่สร้างบัญชีแทนบุคคล ไม่ยืนยัน Email แทน ไม่ให้ผู้สมัครคนแรกเป็น admin; public RPC ไม่รับ email/actor ที่จะตั้ง owner
ผู้ดูแลต้องมี active session+platform grant+MFA ระดับ aal2 ที่ตรวจ factor ใน Auth อีกครั้ง
เพิ่ม/ถอนเฉพาะ registered account UUID, ถอน protected owner/self ไม่ได้; operator recovery/transfer ยังต้องมี runbook
URL `/demo/admin` เป็นต้นแบบเท่านั้น `/admin` ตรวจ server/DB จริง

## ข้อยกเว้น operator ที่มีสิทธิ์สูง

นอกจาก Auth predicates ใน ADR-002 มี no-argument helper ตรวจ recovery/password-ready/owner designation
อ่านได้เฉพาะ Auth ของ current actor และคืน boolean หรือ claim ที่ตรง designation; ไม่คืน email/hash/secret
trigger ที่เพิ่ม live revision/ส่ง private ping ทำงานด้วย migration operator เพื่อ fan-out ตามความสัมพันธ์ใน DB
ทุก helper REVOKE PUBLIC/anon/authenticated และ search_path ว่าง มี signature/ACL tests
ไม่กล่าวว่าทุก helper ไม่มีสิทธิ์พิเศษ และไม่ใช้ operator/service_role เป็น web CRUD client

## Live sync และ browser token

ส่ง private topics `goos:u:<current UUID>` และ `goos:settings`; application ส่ง payload `{}` ไม่มี record/PII
Realtime รุ่นที่ตรวจเติม UUID `id` ของข้อความอัตโนมัติได้ เป็น transport metadata ไม่ใช่ account/subject ID; tests อนุญาตเฉพาะ generated ID นี้และปฏิเสธ field ข้อมูลอื่น
RLS อนุญาต topic ส่วนตัวเฉพาะ active current actor และ settings เฉพาะ active account
restrictive namespace guard ป้องกัน permissive policy เดิมเปิด `goos:` โดยไม่ตั้งใจ
fingerprint API ตรวจ getUser+DB session/context ใหม่และ no-store เสมอ; realtime เป็นสัญญาณให้ revalidate เท่านั้น
polling 4/8/16 วินาที backoff สูงสุด 60 วินาที, เมื่อ socket เชื่อมแล้ว heartbeat 60 วินาที; focus/online/visibility catch-up
บันทึกฟอร์มไม่ได้หรือมี draft ให้ขึ้นสถานะรอ ไม่ refresh ทับ; security/MFA page ไม่ auto-refresh ขณะ enrollment

ปรับข้อกำหนดเดิมเรื่อง “ไม่ส่ง access token ไป browser” อย่างจำกัด: `/api/live/token` ส่ง **access token ของ current actor เท่านั้น** ผ่าน same-origin/no-store หลังตรวจ session
ใช้ในหน่วยความจำสำหรับ Realtime authorization ไม่คืน refresh token ไม่ใส่ regular DTO/log/URL/localStorage/sessionStorage
client Realtime ปิด persist/auto-refresh/detectSession; token หมุนจาก BFF ที่อ่าน HttpOnly cookie; unmount/revoke ลบ channels
HttpOnly cookie ยังเป็นเจ้าของ session ฝั่ง BFF; browser token ตามธรรมชาติยังถูกอ่านได้หากเกิด XSS จึงต้องรักษา CSP/escaping/dependency checks
feature flag live_sync ปิดการอัปเดตอัตโนมัติได้ แต่ไม่ปิดการตรวจสิทธิ์ของ BFF

## PWA และ cache

manifest ใช้ favicon 192/512; service worker cache เฉพาะ offline shell และ default icon
ไม่ cache HTML/API ส่วนตัว token consent หรือรายละเอียดเคส ไม่ให้ offline mutation queue
dynamic favicon ใช้ versioned URL/ETag และ nosniff/CSP sandbox; public display settings อ่านไม่ได้ใช้ defaults ได้
การเขียน settings/branding ต้องอ่าน flag/สิทธิ์จาก DB สำเร็จและใช้ expectedVersion ป้องกันเขียนทับกัน

## หลักฐานและงานถัดไป

ผลตรวจรอบนี้อ้าง [รายงาน platform/S1](../PLATFORM_REPORT_TH.md) และ mapping ทุก knowledge ที่ [KNOWLEDGE_ADOPTION_TH](../KNOWLEDGE_ADOPTION_TH.md)
ก่อน S2 ต้องปิด hosted login/MFA evidence และการตั้งค่า operational ของ owner ตาม NEXT_STEPS ไม่ถือว่า public deploy ผ่าน BP-G0–G6 แล้ว
