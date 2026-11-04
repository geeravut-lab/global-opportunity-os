# ผลรอบ Branding, Live sync, หน้าแรก และ hosted S1

วันที่ 2026-11-04 สาขา `feat/s1-branding-live-sync` เริ่มจาก main `d109044`
ขอบเขต C-17/C-19–C-21: S1, knowledge adoption และ UX ไม่เริ่ม domain backend S2–S6
ใช้ [Blueprint](Global-Opportunity-OS-Product-Blueprint-TH.md) และ [mapping knowledge ทั้ง 15 เรื่อง](KNOWLEDGE_ADOPTION_TH.md)

## การใช้งานที่เพิ่ม

| ส่วน | พฤติกรรมปัจจุบัน |
| --- | --- |
| หน้าแรกทุก role | การ์ดกว้างสลับเล็ก ภาพประกอบใหม่ 16 ภาพ สีม่วง/น้ำเงินและ pastel ของ Opp4All; ผู้ใช้/NGO/admin demo และบัญชี/admin จริง; คง smartphone bottom bar 4 เมนู+เพิ่มเติม |
| โลโก้/favicon | defaults จากไฟล์เจ้าของตรงต้นฉบับ; `/th/admin/branding` สำหรับผู้ดูแลที่ผ่าน MFA; upload PNG/เปลี่ยนชื่อสองภาษา/คืนค่าเดิม, optimistic version/ETag; favicon/manifest เปลี่ยนตาม version |
| ผู้ดูแล | `/th/admin` เป็นสิทธิ์จริงแยกจาก `/th/demo/admin`; owner designation หลัง verified login ไม่ใช้ first-user rule; grant/revoke registered UUID, ป้องกัน owner/self revoke |
| Live sync | private empty Broadcast+server fingerprint; polling เมื่อ WebSocket ไม่พร้อม; อัปเดต profile/คำเชิญ/notifications/สิทธิ์/branding; ไม่ refresh ทับ dirty form; global logout ออกจากหน้าบัญชีอีก session |
| ตั้งค่า/audit | feature flags ที่ทำแล้วสองตัว ตรวจฝั่ง DB; audit ID/action/time append-only; admin+MFA CSV export มี audit และกัน spreadsheet formula |
| บัญชี | current password หรือ verified recovery ก่อนเปลี่ยน; TOTP เมื่อมี; sign out หลังเปลี่ยน; Google-only เพิ่มรหัสผ่านด้วย Email recovery; in-app inbox เฉพาะผู้รับ |
| PWA | manifest/favicon192/512 + offline shell; service worker ไม่ cache บัญชี/API/token/ข้อมูลส่วนตัว |

ภาพทบทวน: [ผู้ใช้ mobile](ux-review/beneficiary-cards-mobile.png), [NGO mobile](ux-review/partner-cards-mobile.png), [admin mobile](ux-review/admin-cards-mobile.png)
และ [ผู้ใช้ desktop](ux-review/beneficiary-cards-desktop.png), [NGO desktop](ux-review/partner-cards-desktop.png), [admin desktop](ux-review/admin-cards-desktop.png)
ภาพเป็น synthetic prototype; role switch/dashboard metrics ไม่ใช่ระบบเคสหรือผลลัพธ์จริง

## Supabase และ Vercel ที่ดำเนินการจริง

- ตรวจ Project เดิมผ่าน Management API: ไม่พบ app/private schema, goos roles/functions หรือ migration history ก่อนรัน จึงไม่มีชนกับงานเดิมในขอบเขตนี้
- ใช้ migrations `202611040001`–`202611040012` แบบ transaction/advisory lock พร้อม SHA-256 ledger และ Supabase migration history ไม่ reset หรือล้างข้อมูลเดิม
- ตรวจ hosted metadata: migration12, unsafe app roles0, tables without RLS0; browser ไม่มี USAGE schema app/private, anon อ่าน public branding ได้แต่เขียน settings ไม่ได้, public RPC owners ไม่มี BYPASSRLS
- ตั้ง designation owner แบบ salted hash ตามบัญชีที่เจ้าของแจ้ง ไม่ commit อีเมล ไม่สร้าง/ยืนยัน Auth account แทนเจ้าของ
- ตั้ง Site URL `https://opp4all.vercel.app`, exact callback ไทย/อังกฤษและ recovery, Email confirmation, minimum password12, secure password change, refresh rotation/TOTP; รักษา Google Provider ที่เจ้าของตั้งไว้
- ใส่เฉพาะ production app variables ใน Vercel เดิม: URL, publishable key, APP_ORIGIN, Auth/Google flags, Realtime flag; ไม่ใส่ management token/service_role/Google secret ในเว็บ
- ชื่อ Project, repo link, Next.js/Node24 และ production branch main ตรวจตรงกัน; เจ้าของยืนยันแก้ 404 ก่อนหน้านี้แล้ว
- ขั้น push/deploy และผล API รุ่นที่ตรวจบันทึกในส่วนท้ายรายงาน ไม่ถือว่าการตั้ง env ทำให้ deployment เก่าเปลี่ยนเอง

ยังไม่ได้สร้าง hosted test accounts หรือข้อมูลบุคคลสมมติ จึงไม่มี fixture hosted ที่ต้องลบในรอบนี้
ข้อมูล Auth fixture/local Mailpit อยู่ `.local`/Docker แยกจาก Project จริง ไม่ commit credentials
การตรวจ hosted metadata ไม่ใช่การทดสอบ signed JWT/Email/Google round-trip ผ่านหน้าเว็บ

## คำสั่งและผลตรวจ

คำสั่งทั้งหมดต่อไปนี้มีจริง ไม่ใช่คำสั่งหลัง scaffolding ที่ยังไม่มี:

```sh
npm run typecheck
npm run lint
npm run test:unit
npm run build
npm run test:integration
npm run db:test:fresh
npm run test:auth
npm run test:e2e
npm run test:a11y
NODE_USE_ENV_PROXY=1 node scripts/hosted-s1.mjs preflight
NODE_USE_ENV_PROXY=1 node scripts/hosted-s1.mjs verify
```

ผลสุดท้ายของ browser suites และ deploy เพิ่มในส่วนหลักฐานท้ายรายงาน
ชุด Auth ใช้ Chromium+local Supabase/PostgREST/Mailpit จริง มี allow/deny, MFA, CSRF,
cross-user/tenant, session revoke, password recovery/change, PNG/ETag/default/reject SVG และสองหน้าต่าง Live sync
Google local ตรวจ PKCE/start/error/open redirect ไม่ปลอมผล Google login สำเร็จ
axe/reflow/keyboard ไม่ใช่การรับรอง WCAG หรือผล NVDA/VoiceOver ของผู้ใช้จริง

ตรวจพบและแก้ระหว่างงาน: streamed shell ทำให้ 404 กลายเป็น200; build-time env inlining ทำให้ test อ่าน hosted URL;
Back sheet แข่งกับ router; demo/admin ถูกจัดเป็นหน้าบัญชี; และ refresh หลัง upload อาจล้างไฟล์ถัดไป
แก้ด้วย SSR shell, runtime config injection, deferred navigation หลัง popstate, anchored path matcher และรักษา form draft/version
ไม่ใช้ test skip หรือลดเงื่อนไขความปลอดภัยเพื่อให้ผ่าน

## ไฟล์เปลี่ยนจริงและการออกแบบ

- `app/[lang]/{layout,account,admin}`, `components/{app-shell,home-menu-cards,live-sync,platform-panel,account-panel,prototype}`, `app/globals.css`
- `/api/{platform,platform/audit,live,live/token}`, `/brand/[kind]`, Auth/v1 routes, metadata/manifest, proxy
- `lib/platform/*`, Auth validation/DTO/copy; sharp0.35.5 exact และ lockfile
- `public/brand-defaults/*`, `public/illustrations/menu-atlas.webp`, offline/service worker; ไม่แก้ต้นฉบับสองภาพใน docs
- migrations0004–0012, `scripts/hosted-s1.mjs`, fresh/fixture helpers, unit/integration/browser tests และ OpenAPI
- README, DECISIONS, INDEX, phase/next steps, ADR-003 และรายงานนี้; knowledge/Blueprint ต้นทางคงเดิม

ใช้ binary table สำหรับ PNG เล็กแบบ atomic ไม่ใช้ Storage signed URL หรือ service_role CRUD
Realtime มีข้อยกเว้น access token ของตนเองใน memory-only browser client; refresh token คงใน HttpOnly cookie
รายละเอียด ACL/ข้อยกเว้น operator/cache ดู [ADR-003](adr/ADR-003-PLATFORM-TH.md)

## งานที่เหลือก่อนปิด S1 และสิ่งที่ให้เจ้าของเลือกต่อ

1. hosted HTTP/Auth/Realtime smoke จาก workspace: network policy ที่ใช้งานยังให้เฉพาะ API domains ไม่ให้ frontend/provider; เพิ่ม draft hosts `opp4all.vercel.app` และ `fxqgvqvthrdzmgnmqgom.supabase.co` แล้ว ต้อง Review/Save/Publish environment ใน UI เพื่อ apply ไม่มีการหลบนโยบายหรือปิด TLS
2. เจ้าของ login ด้วย Google/Email ของบัญชีที่ระบุ แล้วตั้ง MFA ที่ `/th/account/security`; ตรวจว่าเปิด `/th/admin/branding` ได้; ไม่ต้องส่ง password/OTP/QR/secret ให้ agent
3. ยืนยัน hosted Email confirmation/recovery delivery และ Google success/cancel/refresh/HTTPS-cookie; local Mailpit ไม่พิสูจน์ SMTP ภายนอก; ยังไม่กล่าวว่า S1 ทั้งหมดผ่าน
4. operator recovery/owner-transfer/no-email assisted SOP, privacy/retention/ops owners และ manual assistive-tech/UAT ยังต้องปิดก่อนรับข้อมูลจริง; no-email/minor personalization ยังไม่เปิด

**S2 ที่เสนอให้สั่งต่อ:** verified organization/expiry/suspend/appeal, catalog draft→review→publish/revision,
public backend search/filter/detail, needs assessment แบบข้าม sensitive fields ได้, bookmarks และ deterministic matching พร้อมเหตุผล/unknown
ยังไม่เริ่ม S2 อัตโนมัติ ไม่เปิด AI/LINE/เคสจริงจากการ deploy รอบนี้

## หลักฐานตรวจรับรอบนี้

| การตรวจที่รันจริง | ผล |
| --- | --- |
| TypeScript / ESLint / production build | ผ่าน |
| Unit | 52 ผ่าน |
| Local Auth/PostgREST/RLS integration | 45 ผ่าน |
| Fresh stack migrations12 + verified designated-owner bootstrap + profile/consent | ผ่าน |
| Auth/admin/Live browser + axe/reflow | 28 ผ่าน |
| Public directory/3 roles/navigation browser | 25 ผ่าน |
| Public/3 roles accessibility | 24 ผ่าน |
| เอกสารลิงก์ใหม่/สัญญา security scheme OpenAPI | ไม่พบลิงก์หรือ scheme ที่หาย |
| Hosted schema/RLS/ACL/namespace/audit metadata | ผ่าน; ไม่เท่ากับ hosted JWT/browser round-trip |

รวม suites หลัก 174 กรณี ไม่มี skipped; หลังแก้รูปแบบลูกศร SVG ตรวจ build/types/lint และภาพหน้าจอซ้ำเฉพาะส่วนที่เกี่ยวข้อง
ใช้ Chromium ของระบบตาม Playwright config; NO_COLOR/FORCE_COLOR warnings ไม่ทำให้ tests ล้มเหลว
CI บน GitHub ของ code commit ตรวจผ่านทั้งสอง jobs ตามหลักฐานส่วนท้ายรายงาน

## ดูตารางใน Supabase Dashboard

ตรวจสดซ้ำหลังเจ้าของสอบถาม: Project `global-opportunity-os` รหัส `fxqgvqvthrdzmgnmqgom` มี `app` 12 ตาราง และ `private` 9 ตาราง รวม21 ทุกตารางเปิด RLS
12 migrations ไม่ได้หมายถึง12ตาราง; `public` มี RPC เป็นหลัก จึงอาจไม่เห็นตารางแอปเมื่อ Table Editor เลือก public
เลือก schema `app`/`private` ใน Table Editor แล้ว reload Dashboard; ไม่ต้องเปิด schema เหล่านี้เป็น Data API หรือย้ายตารางเพียงเพื่อให้เห็นใน UI
SQL Editor ใช้คำสั่งอ่านอย่างเดียวได้:

```sql
select schemaname, tablename, rowsecurity
from pg_tables
where schemaname in ('app', 'private')
order by schemaname, tablename;
```

`app` มี accounts, subjects, organizations, memberships, invitations, notices, delegations, notifications, platform_settings และตาราง role/scope
`private` มี audit/consent, brand_assets, platform owner/grants/designation, session revocations, live revisions และ migration ledger
อย่าส่งข้อมูลในตาราง private หรือ Auth secrets มาในแชต; การดู schema ไม่ต้องเปลี่ยน RLS/สิทธิ์

## Production deployment ที่ยืนยันแล้ว

- push feature branch และ `main` แบบ fast-forward สำเร็จ: code commit `e8bf29b`
- Vercel deployment `dpl_4vaQ27ioV1JvVQtxgTEoitmerzJa` เป็น `READY`, `aliasAssigned:true`, alias มี `opp4all.vercel.app`
- logs ยืนยัน Next.js16.4.5, compiled/static generation, Route(app), Build Completed และ Deployment completed
- GitHub workflow ของ code commit เริ่มแล้ว: [run41853602993](https://github.com/geeravut-lab/global-opportunity-os/actions/runs/41853602993); ตรวจผลแล้ว `success` ทั้ง `check` และ `s1-local`
- ส่งขั้นตอนให้เจ้าของทดสอบ verified Google login/MFA/admin branding แล้ว รอผล actual human round-trip; ไม่ขอให้ส่ง credentials
- workspace probe ไป frontend/provider ยัง network unavailable และ network allowlist ยังมีเฉพาะ management APIs; Ready ไม่ถูกนำมาแทน hosted browser tests

หน้าให้ทบทวน: https://opp4all.vercel.app/th, `/th/demo/partner`, `/th/demo/admin`, `/th/auth/login`, `/th/account`, `/th/admin/branding`
งานค้าง S1/แผน S2 ตาม NEXT_STEPS ยังมีผล ไม่ถือว่า deploy สำเร็จแล้วผ่าน real pilot gates

## Email delivery ที่ยังต้องตั้งค่า

ตรวจ Auth config หลัง deploy: Email confirmation=true, Google enabled=true และ Site URL production ถูกต้อง แต่ **custom SMTP ยังไม่ได้ตั้ง** (`smtp_host` ว่าง; ไม่บันทึก credential/ผู้รับ)
Email/password BFF และ recovery ผ่าน local Mailpit แล้ว แต่ไม่ถือว่า Project ส่งถึงผู้ใช้ทั่วไปได้
ต้องตั้ง SMTP ที่เจ้าของเลือกใน Supabase Authentication → Email/SMTP Settings และทดสอบ confirmation/recovery กับอีเมลที่เจ้าของควบคุมก่อนปิด hosted Email gate
ไม่ provision บริการ Email แบบมีค่าใช้จ่ายหรือเลือก vendor แทนเจ้าของในรอบนี้ ไม่ส่ง SMTP password/key ในแชต
