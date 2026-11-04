# การตั้งค่า Email + Google สำหรับ S1

วันที่ 2026-11-04 สำหรับการพัฒนาด้วยข้อมูลสมมติ ตาม C-11–17
เจ้าของแจ้งว่ามี Supabase Project และตั้ง Google Provider แล้ว ไม่ต้องสร้าง Project/OAuth client ซ้ำ
**C-15: เจ้าของอนุญาตใช้ Project เดิมทดสอบได้ และให้ล้างข้อมูลทดสอบก่อนขึ้น production**
ข้อกำหนดให้แยก dev/staging ที่เคยแนะนำหลัง C-14 ไม่ใช่เงื่อนไขบังคับใหม่
ก่อนเขียนกับ Project เดิมต้องตรวจ schema/roles/migration history ที่มีอยู่ และแยก test-run/รายการ fixture ให้ชัด
ไม่ลบหรือแทนที่ข้อมูลเดิมเพื่อทำให้ migration ผ่าน; ไม่มีการให้ทดสอบกับข้อมูลผู้รับประโยชน์จริง

C-17 อนุญาตให้ agent จัดการ Supabase และ push/deploy production แล้ว
ผลที่ทำจริงและสิ่งที่ยังติดอยู่ดู [DEPLOYMENT_STATUS_TH.md](DEPLOYMENT_STATUS_TH.md)

## สิ่งที่ทำต่อใน Environment Settings

ใส่ค่าผ่าน Settings ของ environment ที่ใช้รันแอป ไม่ต้องส่งรหัสผ่านหรือ secret ในแชต
สำหรับ Vercel ต้องตั้งใน Project เดิมแยก Preview/Production ด้วย; การตั้ง cloud workspace ไม่ส่งค่าไป Vercel เอง

| ตัวแปร | ค่าที่ใช้ | หมายเหตุ |
| --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Project URL `https://<project-ref>.supabase.co` | ใช้ Project เดิมตาม C-15 ได้หลัง preflight; ชุดทดสอบอัตโนมัติยังใช้ local |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Publishable key `sb_publishable_...` | รองรับ legacy anon JWT ด้วย; ห้าม service_role/secret key |
| `APP_ORIGIN` | origin ของเว็บที่กำลังทดสอบ เช่น `http://127.0.0.1:3000` หรือ HTTPS domain ของ staging | ไม่มี path; callback และ CSRF ใช้ค่านี้ ไม่รับ Host/next จากผู้ใช้เป็นปลายทาง |
| `AUTH_ENABLED` | `true` หลังใช้ migrations และตั้ง Auth ครบ | ถ้าไม่พร้อมให้คง `false` เพื่อปิด Auth โดยปริยาย |
| `AUTH_GOOGLE_ENABLED` | `true` หลัง Provider/redirect พร้อม | ตั้ง Provider อย่างเดียวไม่เปิดปุ่มฝั่งแอป |

หลัง publish environment รอบล่าสุด bindings ของ 5 ตัวแปรและ management tokens พร้อมแล้วใน Cloud Environment
แต่ Vercel Project ยังไม่มี Environment Variables (API คืน envs: []) ต้องตั้งแยกหลังตรวจ schema/Auth
การบันทึก draft ไม่ได้ apply/publish ให้เอง
หากใส่ค่าใน draft ให้ใช้ขั้นตอน Review/Save/Publish ของ Environment Settings แล้วเริ่ม environment ตาม UI
การ publish environment คนละเรื่องกับ git push หรือ deployment; รอบนี้ agent ไม่ publish ให้
เพิ่มโดเมน `<project-ref>.supabase.co` ที่ตรง Project จริงใน Network allowed hosts หากจะเชื่อมจาก workspace
นโยบายปัจจุบันอนุญาต API GitHub/Supabase/Vercel และ package managers แต่ยังไม่มีโดเมน Supabase Project นี้ ห้ามเปลี่ยน proxy/TLS เพื่อหลบ policy

ไฟล์ `.env.local` ที่ `db:start` สร้างเป็นของ local stack เท่านั้น มีเครื่องหมาย Generated และถูก ignore
อย่านำ anon key ในไฟล์นั้นไปใช้กับ hosted Project หรือแทนค่าที่ใส่ใน Settings โดยไม่ตั้งใจ
อย่ารัน integration/browser suites กับ Project ระยะไกล; suites ตรวจ loopback และบังคับ local config

## ตรวจ URL ให้ถูกทั้งสองฝั่ง

1. **Google Cloud → OAuth client → Authorized redirect URI:** ใช้ callback ของ Supabase
   `https://<project-ref>.supabase.co/auth/v1/callback` ตามค่าที่ Supabase แสดง
2. **Supabase → Authentication → URL Configuration:** ตั้ง Site URL ให้ตรง environment และเพิ่ม Redirect URLs
   ที่ตรง `APP_ORIGIN` สำหรับ `/th/auth/callback`, `/en/auth/callback`,
   `/th/auth/callback?next=password`, `/en/auth/callback?next=password`
3. **Supabase → Authentication → Providers → Google:** ตรวจ Client ID/Secret ที่ตั้งไว้แล้วให้เป็น client เดียวกัน
   Client Secret อยู่ฝั่ง Supabase/Google เท่านั้น แอปไม่ต้องมี `GOOGLE_CLIENT_SECRET`
4. ถ้า OAuth consent screen ยังเป็น Testing ให้บัญชีทดสอบอยู่ใน Test users ของ Google ตามสถานะ client
   ใช้บัญชีของเจ้าของทดสอบเอง; agent ไม่ล็อกอิน Google แทนหรือส่งข้อความออก

`/th/auth/callback` ของเว็บไม่ใช่ callback URI ที่เอาไปแทน Supabase callback ใน Google Cloud
ใช้โดเมน staging คงที่ก่อน ไม่ใส่ wildcard ครอบคลุม preview ทุกสาขาโดยปริยาย
ถ้า Preview มีโดเมนใหม่ ต้องตั้ง APP_ORIGIN และ allowlist ของ environment นั้นให้ตรงกัน

## ฐานข้อมูลและ Email ก่อนทดสอบ hosted

Migrations ใน `supabase/migrations/` ทั้ง 3 ไฟล์ผ่านการติดตั้งและทดสอบกับ DB ใหม่ในเครื่องแล้ว
**ยังไม่ได้ใช้กับ Supabase ของเจ้าของ** C-15 อนุญาตใช้ Project เดิมแล้ว
ให้ตรวจ [preflight SQL แบบอ่านอย่างเดียว](../supabase/preflight/s1_existing_project.sql) ก่อนใช้ migrations
ให้ผู้ดูแลทบทวน migrations/สิทธิ์ตาม ADR-002 และกระบวนการ backup ของ Project ก่อนใช้
การตรวจ preflight ต้องใช้ SQL Editor หรือสิทธิ์ migration operator ผ่านช่องทางปลอดภัย
Project URL/publishable key ใช้ Auth/BFF ได้ แต่ไม่ใช่สิทธิ์ DDL/migration
ปัจจุบัน runtime มี URL/key และ SUPABASE_ACCESS_TOKEN พร้อมแล้ว แต่รอบแก้ Vercel 404 ยังไม่รัน
preflight หรือ migrations ระยะไกล; งานนี้ยังเหลือใน S1 ตาม NEXT_STEPS.md
ไม่ต้องส่ง DB password/access token ในแชต; ใช้ Settings/secret binding ของเครื่องมือที่เจ้าของเลือก
ถ้าเปิด Auth ก่อน migrations ครบ แอปจะไม่ให้ข้าม bootstrap/permission checks

เปิด Email provider, Confirm email, minimum password 12 ตัวอักษร, refresh rotation และ TOTP enroll/verify
ตรวจ secure password change/recent authentication ตาม Supabase plan และความสามารถจริง
ทดสอบ SMTP/sender/domain/อัตราส่งกับระบบ staging ที่อนุมัติแยก; Mailpit ผ่านไม่ได้ยืนยันส่ง Email จริงสำเร็จ
ไม่ปิด email confirmation เพื่อให้ทดสอบผ่าน และไม่ใช้ local test rate limits เป็นค่าของ production

Email confirmation และ recovery ใช้ PKCE ต้องเปิดลิงก์จากเบราว์เซอร์ที่เริ่มรายการ
ใช้ลิงก์ล่าสุด หากเริ่มรายการ PKCE ใหม่ใน browser เดียว verifier เดิมอาจถูกแทนที่
template ต้องรักษา ConfirmationURL ที่ Provider สร้างสำหรับ flow นี้; เปลี่ยน template ต้องตรวจ flow ใหม่
ยังไม่รองรับลิงก์ข้ามอุปกรณ์แบบ token_hash และไม่มี auto-redirect ตาม URL ที่ผู้ใช้ส่งมา

## คำสั่งที่มีและทดสอบจริงใน local

ต้องมี Node 24/npm 11, Docker และ Chromium รันจากราก repo:

```sh
npm ci
npm run db:start
npm run build
npm run test:integration
npm run test:auth
npm run db:test:fresh
npm run dev -- --hostname 127.0.0.1 --port 3000
```

`db:start` เริ่ม stack id `global-opportunity-os-s1-local`, migration up --local, เก็บ status ใน `.local/`
และสร้าง `.env.local` ถ้าไม่มีไฟล์ที่ผู้ใช้ทำเอง Stack ใช้ Database/Auth/API/Mailpit เท่านั้น
เมื่อ server รันอยู่ อย่ารัน Playwright ที่ใช้พอร์ตเดียวกันพร้อมกัน ปิด dev server ก่อน suites
Auth browser ใช้ production build จึง build ก่อน และไม่ reuse server อื่น

เปิด `/th/auth/signup` ด้วยอีเมล `ชื่อสมมติ@example.test` และรหัสผ่านสมมติใหม่
เปิด Mailpit `http://127.0.0.1:54324` ใน browser เดิมเพื่อยืนยันหรือกู้รหัสผ่าน
ค่า URL/keys/fixture passwords เก็บเฉพาะไฟล์ ignored mode 600 ไม่ต้องคัดลอกไปในเอกสาร/log ที่เผยแพร่
`test:integration` สร้าง 10 actors ใหม่; browser สร้าง actors เพิ่มด้วย user-JWT bootstrap
local service_role ใช้เฉพาะสร้างผู้ใช้สมมติใน test helper ไม่ถูกใช้ใน app routes

```sh
npm run db:migrate
npm run db:stop
```

สองคำสั่งนี้ใช้เฉพาะ config local ที่ตรวจ project id ไม่ใช้ linked/remote DB
`db:stop` รักษาข้อมูลตาม CLI default; ไม่มี reset หรือลบ volumes อัตโนมัติ
`db:test:fresh` สร้าง id ใหม่และพอร์ต 55320–55324 ตรวจ migrate+Auth+profile/consent แล้วหยุดเฉพาะ stack นั้น
มีข้อมูล/volumes ของการทดสอบเก็บไว้ ไม่อ้างว่าล้างทิ้งทั้งหมดแล้ว

CLI ใช้ official GHCR image mirror เพราะ public ECR ถูก policy ปฏิเสธใน environment นี้
helper แก้ proxy เฉพาะ wget health probe ที่ไป `127.0.0.1/.../health` ใน container
service และการเชื่อมต่อภายนอกยังใช้ proxy/CA เดิม ไม่ใช้ ignore-health-check หรือปิด TLS

## เกณฑ์ตรวจรับ hosted ที่ยังไม่ได้รัน

- Google: กดจากเว็บจริง → เลือกบัญชี → Supabase callback → app callback → บัญชีของตนเอง;
  ยกเลิก consent/บัญชีทดสอบไม่อยู่ใน allowlist/ใช้ code ซ้ำ ต้องไม่เปิด session ผิดบัญชี
- Email: สมัคร → ส่งจริง → ยืนยัน; recover → เปลี่ยน password; คำตอบไม่เปิดเผยว่ามีบัญชี;
  expired/replayed link และ browser ไม่มี verifier ต้องอธิบายให้เริ่มใหม่
- HTTPS cookies เป็น HttpOnly/Secure/SameSite=Lax; CDN ไม่ cache หน้า/DTO ส่วนบุคคล;
  refresh หมุนคุกกี้ถูกต้อง และ logout ทำให้ token/cookies เก่าเข้าข้อมูลไม่ได้
- ตรวจ cross-tenant/revocation/RLS บน hosted execution ด้วยบัญชีสมมติ;
  ทบทวนสิทธิ์ auth metadata predicate ไม่แก้โดยให้ service_role CRUD ทั้งแอป

รายงานผลในเครื่องและช่องว่าง [S1_REPORT_TH.md](S1_REPORT_TH.md)
การทดสอบ hosted/Preview ใช้ Project เดิมได้ตาม C-15; ยังต้องตั้งค่าฝั่ง Vercel, ตรวจ schema และ callback domain
และขอบเขตการส่ง Email/ผู้ทดสอบให้ชัด
C-17 เป็นหลักฐานอนุญาต production deployment แล้ว; Provider พร้อมไม่ได้เป็นหลักฐานว่าทดสอบ flow จริงผ่าน


## แผนล้างข้อมูลทดสอบก่อนเปิดจริงตาม C-15

ยังไม่มีการสร้าง fixture ใน hosted Project; ไม่รัน local integration/browser suites กับ Project นี้
ก่อนสร้างข้อมูลทดสอบ hosted ให้ทำ test-run manifest ของ account/subject/org/invite/delegation IDs
และระบุผู้ทดสอบจริงที่ใช้ Google แยกจากบัญชี fixture ห้ามใช้คำว่า sample/test ในชื่อเป็นตัวเลือกเพื่อลบทิ้งทั้งหมด
ไม่ติดป้ายให้ข้อมูลที่มีอยู่เดิมย้อนหลังว่าเป็น fixture

ก่อนเปิดจริงให้แสดง dry-run รายการที่จะลบ ตรวจ foreign keys และผลต่อ consent/audit/Auth users
สำรองและกำหนด retention/legal holds ที่เกี่ยวข้องก่อนลบ จัดลำดับถอน session/permission และลบตามความสัมพันธ์
บัญชี Google ของเจ้าของที่ใช้ทดสอบไม่เท่ากับ fixture ที่ลบได้อัตโนมัติ
ต้องมีผล reconciliation ว่าเหลือเฉพาะข้อมูลที่ตั้งใจเก็บ และไม่มี test keys/notice/roles ค้างเป็นนโยบายเปิดจริง
นี่เป็นแผน ยังไม่มี cleanup script ที่ผ่านการตรวจหรือหลักฐานล้าง hosted สำเร็จ ไม่ลบข้อมูลในรอบนี้


## รับ token ให้ agent ทำงานแทน

- Supabase: [Account → Access Tokens](https://supabase.com/dashboard/account/tokens) → Generate new token →
  Secret ชื่อ `SUPABASE_ACCESS_TOKEN` ใช้ Management API สำหรับตรวจ schema/ใช้ migrations
- Vercel: [Account → Tokens](https://vercel.com/account/tokens) → Create Token →
  เลือก Scope บัญชี/ทีมที่มี Project นี้ → Secret ชื่อ `VERCEL_TOKEN`

ไม่ส่ง token ในแชต ไม่ใส่ token ใน NEXT_PUBLIC_* และไม่ส่งให้เว็บ production
หลังตั้งค่าใน draft ให้ Review/Save และ Publish environment ตาม UI แล้วเริ่ม runtime ที่ใช้ config รุ่นใหม่
เพราะ successful draft save ไม่ได้ apply variables/network/secret bindings ให้ runtime เดิม
