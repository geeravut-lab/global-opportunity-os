# ผลงาน S0/S1 สำหรับทบทวน

> สถานะล่าสุดรอบ branding/live/หน้าแรกและ hosted S1 อยู่ [PLATFORM_REPORT_TH.md](PLATFORM_REPORT_TH.md) ข้อความสถานะก่อนหน้านี้เป็นประวัติ ไม่ใช้แทนผลรอบใหม่

> รายงานนี้เป็นหลักฐานฐาน S1 ก่อนรอบแก้ Vercel 404; ผล deployment/การเชื่อมต่อล่าสุดดู [DEPLOYMENT_STATUS_TH.md](DEPLOYMENT_STATUS_TH.md)

วันที่ 2026-11-04 สาขา local `feat/s1-email-google-auth` ต่อจากต้นแบบ `5585012`
อ้าง C-11: อนุมัติขั้น 1–4 และ Email/Google; C-12/13: มี Supabase/ตั้ง Provider แล้ว
C-14/15: Project เป้าหมายระบบจริง **เจ้าของอนุญาตใช้ Project เดิมทดสอบได้** และให้เคลียร์ fixture ก่อนขึ้น production
ยังไม่มีการ push, deploy, remote migration, ลบข้อมูล หรือส่งข้อความ/Email จริงจากงานนี้

## ผลที่ส่งมอบตามขั้น 1–4

| ขั้น | ผลงานที่ทำแล้ว | ขอบเขตที่ยังไม่ปิด |
| --- | --- | --- |
| 1 ตรวจ/ปรับ UX | คงต้นแบบ 3 มุมมองตาม Blueprint/ภาพ, เพิ่มหน้าบัญชีไทย–อังกฤษใน design tokens เดิม; แยกเมนูบัญชีจาก demo roles; ไม่แสดง notification/avatar ตัวอย่างบนบัญชี | ภาพ Showcase เป็น reference composition; ยังไม่มี dashboard จริงทุกบทบาทหรือ full platform |
| 2 รายละเอียด S0 | ADR-002, schema/permissions, OpenAPI S1, คำสั่ง setup/test จริง, อัปเดต decisions/แผนทุก Phase | region/PITR/budget/ops/privacy sign-off ยังเปิด ไม่กล่าวว่า S0 ทั้งระยะผ่าน |
| 3 Auth→server→DB/RLS spike | ทดสอบจริงกับ local GoTrue/PostgREST/Postgres, user JWT, deny cross-owner/tenant, revocation, MFA; fresh stack ผ่าน | hosted execution/schema/SMTP/Google round-trip ยังไม่ตรวจ |
| 4 ฐาน S1 | Email/password/signup/confirm/recovery, Google PKCE initiation, protected account/profile, TOTP, session revoke, notice/consent, delegated read/write/revoke, draft org/member invitation/revoke | MFA recovery/ownership transfer/no-email assisted SOP, application prepare/submit scopes และ hosted validation ยังไม่ครบ |

พันธกิจทั่วโลกทุกกลุ่มและธุรกิจยั่งยืนคงเดิม ค่า TH/adult เป็น fixture/ขอบเขตทดสอบ ไม่เปลี่ยน mission
ข้อเสนอ P-* และ gates G-* ยังเป็นข้อเสนอถ้าไม่มีหลักฐานเจ้าของ/ผลตรวจที่ระบุ ไม่ถือว่าเลือกทั้งหมดแล้ว

## สิ่งที่ใช้งานและทดสอบในเครื่องได้

- `/th/auth/login`, `/th/auth/signup`, `/th/auth/recover` และ `/en/...`
- `/th/account` และ profile/security/organizations/delegations/invitations/privacy
- Email confirmation/recovery ผ่าน Mailpit และ PKCE จาก browser เดิม ไม่มีการส่ง Email ออกจริง
- โปรไฟล์ของตัวเองแบบ adult เท่านั้น, safe contact, notice/version/hash, explicit confirmation,
  optimistic version, ไม่มีวันเกิดหรือข้อมูลอ่อนไหวที่ไม่จำเป็น
- มอบสิทธิ์ให้บัญชีเฉพาะรายตาม read/write+expiry พร้อม read-back และถอนสิทธิ์;
  ผู้ช่วยไม่เปลี่ยนเจ้าของ/contact และไม่ได้สิทธิ์อ่าน subject เพราะเป็น NGO employee อย่างเดียว
- TOTP enrollment/verification และยกระดับ session; staff action ต้อง MFA จริงและสิทธิ์ปัจจุบัน
- draft org, recipient-bound invitations, accept/cancel, member revoke, last-owner protection;
  ไม่มีการให้ verified status หรือ platform admin อัตโนมัติ และไม่ส่ง invitation email
- JSON BFF ปฏิเสธ unknown fields, Origin ผิด/ขาด, minor/unknown profile, consent ไม่ยืนยัน,
  version เก่า และ cross-owner IDs; ไม่ส่ง SQL/token/password ใน error/DTO
- HttpOnly cookies, SameSite=Lax, Secure เมื่อ HTTPS; private no-store, callback allowlist;
  logout ถอน session และออกทุกอุปกรณ์ ไม่พึ่งแค่ซ่อนปุ่ม

`/th`, `/th/demo/partner`, `/th/demo/admin`, public directory และ Navigator/impact ที่อยู่ใน demo
ยังเป็น fixtures ไม่ใช่การให้สิทธิ์หรือผลลัพธ์จริงของบัญชี S1
ไดเรกทอรียังมี current/expired/suspended/no-results scenarios ตามฐานเดิม

## หลักฐานตรวจที่รันจริง

| คำสั่ง/การตรวจ | ผลล่าสุด | ขอบเขต |
| --- | --- | --- |
| `npm ci --no-fund` | ผ่าน | ติดตั้งซ้ำจาก lockfile ที่อัปเดต 263 packages |
| `npm run typecheck` | ผ่าน | Next type generation + TypeScript |
| `npm run lint` | ผ่าน | ESLint |
| `npm run test:unit` | 41 ผ่าน | เดิม 29 + Auth config/input/HTTP 12 |
| `npm run build` | ผ่าน | production build ในเครื่อง ไม่ใช่ deployment |
| `npm run test:e2e` | 20 ผ่าน | regression directory/3 demo roles ไทย–อังกฤษ |
| `npm run test:a11y` | 24 ผ่าน | regression axe WCAG tags/reflow ของต้นแบบเดิม |
| `npm run test:integration` | 32 ผ่าน | Auth/PostgREST/Postgres/RLS จริงในเครื่อง |
| `npm run test:auth` | 21 ผ่าน | 12 flow cases, 8 a11y/keyboard/reflow cases และ 1 งานสร้างภาพทบทวน |
| `npm run db:start` | ผ่าน | local start/health/migrate/status/สร้าง local env ที่ ignored |
| `npm run db:test:fresh` | ผ่าน | stack ใหม่แยก id/ports: 3 migrations + Auth→bootstrap→profile/consent แล้วหยุด |
| preflight SQL | รันผ่านแบบ read-only ใน local | 6 metadata result sets; ยังไม่รันกับ hosted |
| OpenAPI JSON/refs, Markdown links, credential literal scan, `git diff --check` | ผ่าน | 23 paths/27 operations; เป็นการตรวจไฟล์/refs ไม่ใช่ full OpenAPI conformance audit |
| `npm audit --omit=dev --json` | 0 advisories ใน runtime dependencies | ข้อมูล registry ณ เวลาตรวจ ไม่ใช่การรับรองความปลอดภัยทุกส่วน |

รวม 138 test cases ผ่าน ไม่รวม fresh-stack scenario; ไม่ได้นับคำสั่ง build/lint เป็น test case
Browser: Chromium 155.0.8059.79 ของ Debian; runtime Node 24.22.1/npm 11.9.0
คำเตือน NO_COLOR/FORCE_COLOR ของ runner ไม่ใช่ failure; ไม่มีการ skip tests เพื่อให้ผ่าน

Integration negatives ครอบคลุม JWT tamper, user_metadata role injection, app roles NOBYPASSRLS,
ทุก app/private table เปิด RLS, direct CRUD/ownership change deny, read-only/expired/revoked helper,
consent/audit append-only, member/tenant isolation, invitation recipient/MFA/role boundaries,
revoked member ด้วย token เก่า, last owner, stale aal2 หลังถอด factor และ session denylist
Browser ตรวจจริงทั้ง login ไทย/อังกฤษ, no-store/HttpOnly, CSRF/mass assignment, create/edit/escaping/conflict,
Google authorize URL/PKCE/scopes, callback error/open redirect, MFA/org/invitation cancel,
สอง sessions หลัง global logout, email verification และ password recovery/change

Google ใน browser suite **ตรวจขั้นเริ่ม PKCE เท่านั้น** ไม่ follow ไป Google และ local Provider ไม่เปิดจริง
HTTPS Secure-cookie/refresh rotation บน hosting และ hosted Google success/error ยังไม่รัน
Axe/คีย์บอร์ดเบื้องต้น/320 CSS px/200% text ผ่าน ไม่ใช่การรับรอง WCAG ทั้งระบบ
NVDA/VoiceOver, การแปลโดยผู้ใช้จริง และ manual focus-obscuration/UAT ยังไม่รัน

## ไฟล์ที่เปลี่ยนจริง

| กลุ่ม | ไฟล์ |
| --- | --- |
| หน้า/เส้นทาง | `app/[lang]/auth/[mode]/page.tsx`, `auth/callback/route.ts`, `app/[lang]/account/[[...section]]/page.tsx`, `app/api/auth/[action]/route.ts`, `app/api/v1/[...path]/route.ts`, `proxy.ts` |
| UI | `components/sign-in-form.tsx`, `components/account-panel.tsx`, `components/app-shell.tsx`, `app/globals.css` |
| Auth adapter/DTO/validation | `lib/auth/{account,config,copy,http,input,types}.ts`, `lib/supabase/{request,server}.ts` |
| DB/contract | `supabase/config.toml`, `supabase/.gitignore`, migrations `202611040001`–`003`, `supabase/preflight/s1_existing_project.sql`, `api/s1.openapi.json` |
| Setup/tests | `scripts/{local-stack,local-auth-env,seed-auth-fixtures,test-fresh-migrations}.mjs`, `scripts/local-runtime.ts`, `vitest.integration.config.ts`, `playwright.auth.config.ts`, `tests/unit/auth.test.ts`, `tests/integration/*`, `tests/auth/*` |
| Dependencies/CI | `package.json`, `package-lock.json`, `.env.example`, `.gitignore`, `.github/workflows/check.yml` |
| เอกสาร | `README.md`, `docs/DECISIONS.md`, `INDEX.md`, `NEXT_STEPS.md`, `PHASE_PLAN_TH.md`, note ใน `BLUEPRINT_ALIGNMENT_TH.md`/`PROTOTYPE_REPORT_TH.md`, `AUTH_SETUP_TH.md`, `S1_REPORT_TH.md`, `adr/ADR-002-S1-AUTH-TH.md`, ภาพ S1 สองไฟล์ |

Blueprint ต้นฉบับคงเดิม SHA-256:
`d7017db9c54fa7917f19ff26fddedc393847d85b3b63dce1e6684b6130ed329e`
รายงาน prototype เก่าเป็นหลักฐานรอบ C-10 ไม่เขียนผล Auth ใหม่ย้อนกลับไปในรายงานนั้น
CI เพิ่ม local S1 job แล้ว แต่ **ยังไม่เคยรัน workflow นี้บน GitHub**; protected branch settings ยังไม่ตรวจ

การวินิจฉัย environment เพิ่ม loopback ใน Docker client noProxy โดยรักษาค่า/credentials เดิม;
health probe ยังต้องใช้ wrapper ที่มีโค้ดใน repo เฉพาะ wget ไป loopback ไม่ปิด proxy ของ service/การเชื่อมต่อภายนอก
local runtime/fixtures/logs/env ถูก ignore และจำกัด mode 600 ไม่รวมในชิ้นงาน Git

## เทคโนโลยีและข้อยกเว้นสิทธิ์

คง Next 16.4.5/React 19.3.1/TypeScript 6.0.3 เดิม เพิ่มและ pin
`@supabase/ssr` 0.12.7, `@supabase/supabase-js` 2.118.0, Supabase CLI 3.0.0,
`pg`/`@types/pg` 8.23.1 พร้อม lockfile ใช้ pg เฉพาะ scripts/tests
จัดรูปแบบโค้ด S1 ด้วย Prettier 3.9.10 ผ่าน npm exec ที่ระบุรุ่น เป็นเครื่องมือรอบนี้ ไม่เพิ่มเป็น runtime dependency

[ADR-002](adr/ADR-002-S1-AUTH-TH.md) ระบุข้อยกเว้นสำคัญ: private auth metadata predicate
เป็น SECURITY DEFINER ของ migration operator/postgres ที่มี BYPASSRLS
คืนเพียง booleans ของ current actor/session ไม่มี argument/PII/mutation และเปิด EXECUTE เฉพาะ authz helper
public RPC ยังคงเป็น goos_api NOBYPASSRLS; ไม่กล่าวว่าทุก helper ไม่มีสิทธิ์พิเศษ
ต้องทดสอบ ACL/metadata บน Project จริงก่อนใช้งาน ไม่ใช้ service_role เป็นทางลัดของ app CRUD

เอกสารทางการที่ตรวจเนื้อหาในรอบนี้ผ่านต้นฉบับของ Supabase:
[SSR clients](https://supabase.com/docs/guides/auth/server-side/creating-a-client),
[Password auth](https://supabase.com/docs/guides/auth/passwords),
[TOTP MFA](https://supabase.com/docs/guides/auth/auth-mfa/totp),
[CLI 3.0.0](https://github.com/supabase/cli/tree/v3.0.0)
SSR รุ่นปัจจุบันเตือน cache headers ตอน refresh; adapter ของงานนี้ตั้ง no-store ทุก protected response
ไม่บันทึก fetch ที่ 404 ว่าเป็นเอกสารที่อ่านสำเร็จ

## ช่องว่างและงานถัดไป

| ส่วน | สถานะ/ขั้นต่อไป |
| --- | --- |
| Project เดิม | C-15 อนุญาตแล้ว; runtime ยังไม่มี URL/publishable key/APP_ORIGIN หรือ DB operator จึงยังไม่ preflight/migrate/write ระยะไกล |
| ข้อมูลทดสอบ hosted | ก่อนสร้างต้องมี manifest ID/run/ผู้ทดสอบ แยก fixture จากข้อมูลเดิม; cleanup ยังเป็นแผนตามคู่มือ ไม่ได้ล้างจริงหรืออนุญาตให้ลบข้อมูลเดิมเหมารวม |
| Google/Email hosted | Provider เจ้าของตั้งแล้ว; รอค่าที่ apply, preflight/migrations, callback domain และรอบทดสอบที่เจ้าของเข้าบัญชีเอง; ยังไม่ส่ง Email จริง |
| S0 decisions | region/PITR/budget, pilot scope, privacy/safety/ops owners, legal basis/notice/retention ยังไม่ sign off |
| S1 ที่เหลือ | MFA recovery/owner transfer และ no-email assisted SOP; prepare/submit scopes ต้องมี domain application/referral ใน S3–S4; age gate เป็น self-declaration ไม่ใช่พิสูจน์อายุจริง |
| ก่อน real pilot | distributed abuse protection/provider limits, hosted permissions/refresh/CDN, manual a11y/security/UAT, backup restore/incident drills และ BP-G0–G6 |
| S2–S6 | verified partner/catalog backend, real assessment/matching, applications/cases/referral/outcomes/safety/privacy lifecycle, AI และ impact จริงยังไม่ทำ |

อนุญาตใช้ Project เดิมทดสอบไม่ใช่การอนุญาต paid provisioning, real beneficiary workflows,
external partner messages หรือ production deployment การเปิดจริงต้องมี release evidence แยก
คู่มือตั้งค่าและแผนล้างข้อมูลอยู่ [AUTH_SETUP_TH.md](AUTH_SETUP_TH.md)
แผน functions/features ทุกระยะอยู่ [PHASE_PLAN_TH.md](PHASE_PLAN_TH.md)

## ภาพหน้าจอทบทวนจากข้อมูลสมมติ

[เข้าสู่ระบบภาษาไทย desktop](ux-review/s1-login-th.png) ·
[โปรไฟล์ภาษาไทย mobile](ux-review/s1-profile-mobile-th.png)
ภาพไม่มีรหัสผ่าน/token/MFA secret ไม่ใช่หลักฐาน Google hosted round-trip
