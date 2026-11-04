# ADR-002: ฐาน Auth และสิทธิ์ S1 ที่ทดสอบในเครื่อง

วันที่ 2026-11-04 สถานะ: ทางเลือกการพัฒนาภายใน C-11 มีหลักฐาน local spike
ไม่ใช่การรับรอง hosted execution/region/ราคา/นโยบายข้อมูล และไม่อนุมัติ P-* ที่เหลือ
เชื่อม BP-B-002/101/102/103; BP-AC-02/03/08/17/18 เฉพาะส่วน identity/profile/org ที่มีแล้ว

## รูปแบบที่เลือกสำหรับชิ้นงานนี้

คง Next.js root app/React/TypeScript/npm และ CSS tokens เดิมเป็น modular monolith
S1 ไม่จำเป็นต้องย้าย monorepo หรือเพิ่ม Tailwind; ลดการแก้ Vercel Root Directory/CI โดยไม่จำเป็น
ADR-001 เป็นหลักฐานขอบเขตต้นแบบในอดีต การอนุมัติ backend เพิ่มมาจาก C-11

ใช้ Supabase Auth Email+password และ Google OAuth PKCE ผ่าน `@supabase/ssr` ฝั่ง server
Auth cookies เป็น HttpOnly/SameSite=Lax และ Secure เมื่อ APP_ORIGIN เป็น HTTPS
browser ส่ง JSON ไป BFF; ไม่เก็บ access/refresh token ใน localStorage หรือส่งกลับใน account DTO
MFA enrollment คืน QR/secret เฉพาะ session เจ้าของเพื่อเพิ่ม Authenticator เป็นข้อยกเว้นที่จำเป็นต่อ flow
ห้ามบันทึก payload นี้ใน screenshot, trace หรือ log ที่เผยแพร่

BFF ใช้ `getUser()` ตรวจ Auth และเรียก DB context ต่อ ไม่ใช้ `getSession()` เป็นหลักฐานอำนาจ
Proxy refresh cookies สำหรับหน้าบัญชีและ apply no-store; BFF/SSR ตั้ง private/no-store ด้วย
PKCE callback ไม่รับ arbitrary redirect; mutations ตรวจ Origin/JSON/ขนาด/ฟิลด์/version
App role ไม่ได้มาจาก `user_metadata` หรือ client role switch

## เส้นทางสิทธิ์ Auth → DB

1. PostgREST ตรวจลายเซ็น JWT แล้วตั้ง request claims
2. public `goos_*` RPC มี allowlist arguments ทำงานด้วย role `goos_api` ที่เป็น NOLOGIN/NOINHERIT/NOBYPASSRLS
3. `app`/`private` เปิด RLS ทุกตาราง ไม่ให้ anon/authenticated ใช้ schema/table CRUD โดยตรง
4. metadata helpers ที่เป็นของ `goos_authz` ตรวจ actor/account/session/member/delegation ปัจจุบัน
   แยกจาก API role เพื่อไม่สร้าง policy recursion
5. RPC เดียวทำ mutation+consent/audit ใน transaction เดียวตามงาน S1; ไม่ใช่ transaction ที่ดึงสิทธิ์จาก browser

JWT ที่ยังไม่หมดอายุไม่ทำให้ membership/delegation ที่ถอนแล้วกลับมาใช้ได้
current session denylist ปิดคำขอใหม่ทันที; global signOut ให้ Auth ถอน sessions/refresh tokens ทุกอุปกรณ์
staff operation ต้อง aal2 และมี verified MFA factor จริงใน Auth ขณะตรวจ ไม่ใช่ดู UI badge
ไม่มี service_role CRUD ในเส้นทางแอป ไม่มี claim role ที่ผู้ใช้กำหนดเอง และไม่มี platform-admin grant RPC

## ข้อยกเว้นของ auth metadata ที่ต้องทบทวนบน hosted

Supabase เป็นเจ้าของ `auth` schema; migration operator ใน local ให้ schema/column grants แก่ custom role ไม่ได้
จึงไม่ให้ app roles inherit สิทธิ์ authenticated แบบกว้าง ไม่เปลี่ยน schema owner และไม่ปิด RLS

มีข้อยกเว้นแคบ **`private.goos_auth_identity()`** เป็น SECURITY DEFINER ของ migration operator
ใน local คือ `postgres` ที่มี BYPASSRLS อ่านเฉพาะ auth.users/auth.sessions/auth.mfa_factors ของ actor/session ปัจจุบัน
ไม่มี argument ให้เลือกบุคคลอื่น คืนเพียง `verified`, `session_live`, `mfa_live` booleans ไม่มี PII หรือ mutation
fixed empty search_path, ไม่มี API exposure; revoke EXECUTE จาก PUBLIC/anon/authenticated/goos_api
ให้เฉพาะ goos_authz เรียกผ่าน permission helpers เท่านั้น

ฟังก์ชันนี้เป็น privileged boundary ที่ต้องตรวจเป็นพิเศษ ไม่กล่าวว่าทุก SECURITY DEFINER เป็น NOBYPASSRLS
migration001/003 จำกัด ownership/rewrite เฉพาะฟังก์ชัน/ตาราง S1 ที่ระบุชื่อ ไม่แก้ schema อื่นแบบเหมารวม
ก่อน hosted ต้องตรวจ migration operator/role attributes/ACL/metadata compatibility และ deny tests อีกครั้ง
ถ้า provider ไม่ให้สิทธิ์ ห้ามแก้ปัญหาด้วย service_role ทั้งแอป; ต้องแก้ architecture/permissions โดยมีผล spike ใหม่

## ข้อมูลและการแยกอำนาจ

| ส่วน | ข้อมูล/ข้อจำกัด |
| --- | --- |
| account ≠ subject | account FK Auth, locale/status; subject ของตัวเอง unique, alias/country/coarse region/safe contact/version; ไม่ทำสำเนา email/วันเกิด |
| role ≠ tenant | normalized role definitions แยก org/platform realm; membership และ role join; owner/admin สร้าง platform role ไม่ได้ |
| delegation | เจ้าของระบุผู้รับที่มีบัญชีและ profile:read/profile:write, read-back/notice/hash/expiry; ผู้ช่วยไม่เปลี่ยน contact/owner; ถอน/หมดอายุ deny คำขอใหม่ |
| consent/audit | append-only private events ผูก actor/subject/recipient/purpose/notice/scopes; ไม่บันทึกเนื้อหาโปรไฟล์หรือ token ใน audit |
| organization | draft เท่านั้น; MFA เพื่อสร้าง/จัดสมาชิก; การสร้าง org ไม่รับรอง verification และไม่ให้ดู subject ทั้งหมด |
| invitation | recipient-bound, dev expiry 7 วัน; ยังไม่ให้ role จนรับด้วย MFA; ผู้ส่งถูกถอนสิทธิ์ทำให้รับคำเชิญเก่าไม่ได้; ยกเลิกได้ |
| revocation | member/delegation ตรวจปัจจุบัน; optimistic version; ล็อกสมาชิกและห้ามถอน owner คนสุดท้าย |
| minor | profile API/DB รับ adult เท่านั้น; ไม่สร้าง unknown/minor subject หรือ guardian workflow; เป็น self-declared gate ไม่ใช่หลักฐานยืนยันอายุจริง |

ค่า 90 วันสูงสุดของ delegation, 7 วัน invitation, ประเทศ TH ของ UI fixtures และ dev notice
เป็นสมมติฐานพัฒนา ไม่ใช่การเปลี่ยนพันธกิจทั่วโลกหรือการรับรอง retention/legal basis
การสร้างแทนผู้ไม่มีบัญชี/การโอนเจ้าของปิดจน BP-D-12/SOP ผ่าน
prepare/submit scopes ต้องผูก application/referral domain ใน S3–S4 จึงยังไม่เปิด scope ที่ไม่มีงานจริง

## ข้อจำกัดและการยืนยัน

ผล fresh migrations/permission/browser อยู่ [รายงาน S1](../S1_REPORT_TH.md)
OpenAPI ระบุเฉพาะ API ที่มีโค้ดแล้ว [s1.openapi.json](../../api/s1.openapi.json)
ไม่มี real cases/storage/outbox/AI/verified directory backend ใน S1
local rate limiter เป็น per-instance ไม่ใช่ distributed abuse protection
ก่อน pilot ต้องมี hosted session/SMTP verification, MFA recovery/owner transfer SOP, operational privacy/safety owners,
retention/deletion workflow, manual screen-reader/UAT และ release gates ตาม Blueprint
