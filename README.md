> อัปเดต C-34: เพิ่ม S4 บน feature branch โดยปิด release gates ไว้ ดู [ผลและข้อจำกัด S4](docs/S4_REPORT_TH.md) · production ยังเป็น S2/S3 จาก PR #3–10 ตาม [รายงาน rollout](docs/PRODUCTION_ROLLOUT_TH.md)

# Global Opportunity OS

โครงการมีพันธกิจทั่วโลก ครอบคลุมผู้รับประโยชน์ทุกกลุ่ม พร้อมเป้าหมายธุรกิจยั่งยืน
ชิ้นงานปัจจุบันมี **หน้าแรกสามมุมมอง, S1 Email/Google/MFA/branding/Live sync, S2 directory, S3 applications/cases และ S4 ส่งต่อ/ผลลัพธ์/สิทธิ์ข้อมูลบน feature branch**
ปรับตาม [Product Blueprint TH v1.0](docs/Global-Opportunity-OS-Product-Blueprint-TH.md) และภาพ UX Showcase ที่เจ้าของแนบ
หน้า `/th/demo/partner` และ `/th/demo/admin` เป็นตัวอย่างข้อมูลสมมติ; การสลับ role ใน demo ไม่ให้สิทธิ์จริง
ระบบจริงใช้ `/th/auth/login`, `/th/account`, `/th/opportunities`, `/th/workflow` และหน้าจัดการที่ตรวจสิทธิ์ฝั่ง server/DB
ผู้ดูแลจริงอยู่ `/th/admin` และต้องผ่าน MFA; เจ้าของยืนยัน Google login/MFA และเปิดหน้าผู้ดูแลได้แล้ว
PR #3–10 รวม main แล้ว เปิด S2/S3 production flags และใช้ migrations 32 ไฟล์กับ Supabase ที่เจ้าของอนุญาต
Confirm email ปิดชั่วคราวตามเจ้าของ: signup ที่ได้ session เข้าบัญชีทันที โดยคง JWT/RLS/MFA
hosted Email/session/Live/สิทธิ์ ยังติด network ของ runtime แยกจากผล local/CI; SMTP/Recovery ยังไม่ปิด; production worker มี cron ทุกนาทีและผ่าน maintenance HTTP 200 หลังแก้ TLS
S4 มี implementation สำหรับทดสอบข้อมูลสมมติที่ `/th/coordination` และ `/th/report` แล้ว แต่ยังไม่ rollout production; AI/aggregate impact จริงยังเป็น S5

[ดูแผน S0–S6 พร้อม functions/features](docs/PHASE_PLAN_TH.md) ·
[ดูผลเทียบ Blueprint/ภาพ](docs/BLUEPRINT_ALIGNMENT_TH.md) ·
[ผลตรวจ S1](docs/S1_REPORT_TH.md) · [ตั้งค่า Email/Google](docs/AUTH_SETUP_TH.md)

[ผลรอบ branding/live/หน้าแรก](docs/PLATFORM_REPORT_TH.md) ·
[นำ knowledge ทั้ง 15 เรื่องมาใช้อย่างไร](docs/KNOWLEDGE_ADOPTION_TH.md)

[งานปิด S1 รอบปัจจุบันและหลักฐาน](docs/S1_READINESS_EXECUTION_TH.md) ·
[กู้ MFA/โอน owner](docs/MFA_OWNER_RUNBOOK_TH.md) ·
[backup/restore](docs/BACKUP_RESTORE_RUNBOOK_TH.md) ·
[แผน PR ของ S2 ที่อนุมัติแบบมีเงื่อนไข](docs/S2_EXECUTION_PLAN_TH.md)

โลโก้/favicon เริ่มต้นคัดลอกจากสองไฟล์ Opp4All ใน docs; ผู้ดูแลที่ผ่าน MFA เปลี่ยนภาพ PNG หรือคืนค่าเดิมได้
หน้าแรกทุก role ใช้ภาพประกอบใหม่และการ์ดขนาดต่างกัน คง mobile bottom bar + เพิ่มเติม
สถานะบัญชี/โปรไฟล์/คำเชิญ/สิทธิ์/branding อัปเดตด้วย private Realtime พร้อม polling fallback โดยไม่ทับฟอร์มที่ยังไม่บันทึก
แผงผู้ดูแลมีชื่อสองภาษา feature switches, registered admins และ audit/CSV; demo role switch ไม่ให้สิทธิ์จริง

## S4 — ส่งต่อ ผลลัพธ์ และสิทธิ์ข้อมูลตาม C-34

ใช้ dependencies เดิมและ migrations 33–56; ไม่แก้ migrations 1–32 ที่เผยแพร่แล้ว
ทั้ง `S4_ENABLED` และ `private.s4_release.enabled` ปิดโดยค่าเริ่มต้น ป้องกัน direct RPC bypass ด้วย
ดู [ขอบเขต](docs/S4_SCOPE_TH.md), [วิธีพัฒนา](docs/S4_EXECUTION_TH.md), [ADR-006](docs/adr/ADR-006-S4-TH.md), [OpenAPI](api/s4.openapi.json) และ [ผลตรวจจริง](docs/S4_REPORT_TH.md)

```sh
npm ci
npm run db:start
npm run build
npm run db:prepare-s4
npm run dev:s4
```

เปิด `http://127.0.0.1:3000/th/coordination` ด้วยบัญชีสมมติใน `.local/s4-fixtures.json`
ไฟล์นี้มีข้อมูลยืนยันตัวตนสำหรับ local เท่านั้น เก็บแบบ ignored/mode600 ห้ามส่งในแชตหรือใช้กับ hosted
`dev:s4` เปิด flags เฉพาะ local และตัด operator/worker/SMTP secrets ออกจาก web process
ชุด Auth ปิด S4 DB gate ชั่วคราวแล้วคืนค่าเดิม; S2/S3 seed ปิด gate และ S4 seed เปิดกลับเฉพาะ local
seed จะสร้างบัญชี/องค์กร/รายการสมมติใหม่ และ pause published fixtures เก่าที่ติด metadata ทดสอบใน local โดยคงข้อมูล/ประวัติไว้ ห้ามรันขนานกับ suite ที่ใช้ fixtures ชุดเดียวกัน

```sh
npm run test:s4
npx --no-install vitest run --config vitest.integration.config.ts tests/integration/s4.test.ts
npm run db:process-s4-evidence
npm run db:test:fresh
npm run test:backup-restore
```

`test:s4` seed และเปิด/ปิด server3400 เอง; integration ใช้ user JWT + DB/RLS จริงใน local
ตัวตรวจหลักฐานใช้ worker role แบบจำกัดสิทธิ์ decode/re-encode PNG ไม่เกิน1MB ไม่ใช่การรับรองเนื้อหาเอกสาร
restore ใช้ stack แยกและตรวจ withdrawal replay ของ S1/S3/S4 ตาม fixtures ที่มี ไม่ restore ทับ hosted
รายการคำสั่งนี้เป็นคำสั่งที่มีอยู่จริง ผลการรันแต่ละรายการแยกบันทึกในรายงาน S4

ไม่มี physical purge, การตัดสินด้วย AI, external S4 email หรือ personalized minor workflow
คำขอลบอยู่ `awaiting_policy`/`on_hold`; ต้องรับรอง retention/holds/identity/notice/roster/abuse controls ก่อนรับข้อมูลจริง
รอบนี้ไม่ได้รัน hosted S4 migrations, เปิด production flags หรือ deploy S4

## เริ่มพัฒนา

ใช้ Node.js **24.22.1** และ npm **11.9.0** รุ่น dependency ล็อกใน package.json และ package-lock.json
รันทุกคำสั่งจากราก repository (`/workspace/global-opportunity-os` ในเซสชันนี้)
ถ้ามี nvm ให้ใช้ `nvm install && nvm use` ตาม .nvmrc; การเปิดต้นแบบสาธารณะไม่ต้องมีไฟล์ .env
ถ้าไม่ตั้งค่า Auth หน้าบัญชีจะแจ้งว่ายังไม่พร้อม ไม่เปิดสิทธิ์โดยปริยาย

```sh
npm ci
npm run dev -- --hostname 127.0.0.1 --port 3000
```

เส้นทางต้นแบบ:

| มุมมอง            | ไทย               | อังกฤษ            |
| ----------------- | ----------------- | ----------------- |
| ผู้ใช้            | /th               | /en               |
| พันธมิตร NGO      | /th/demo/partner  | /en/demo/partner  |
| ผู้ดูแลระบบ       | /th/demo/admin    | /en/demo/admin    |
| ค้นหาโอกาสสาธารณะ | /th/opportunities | /en/opportunities |

`/` เปลี่ยนไป `/th` ปุ่มเปลี่ยนภาษาคง section/filter และรายการเดิม
ใช้ sidebar เปิด assessment, applications, plan, referrals, updates, profile หรือหน้าตัวอย่างของแต่ละ role
ทดลองเลือกเป้าหมาย ยืนยันเป้าหมาย บันทึกการ์ด ทำขั้นแผนต่อไป เปิด/ปิดรายละเอียดเคส
ขอข้อมูลเพิ่มแบบจำลอง เปิดแจ้งเตือน และกรอง KPI ตัวอย่างได้ ไม่มีการส่งข้อมูลจริง
สถานะเหล่านี้อยู่ในหน่วยความจำหน้าเว็บและหายเมื่อ refresh/เปลี่ยนหน้า ไม่ได้ sync บัญชี

ไดเรกทอรีรองรับ `q`, `category`, `region`, `status` ค่าเริ่มต้นแสดงเฉพาะปัจจุบันสามรายการ
เลือกทุกสถานะเพื่อดูหมดอายุ/ระงับในชุด QA สมมติ ไม่ใช่ public catalog production
ตัวอย่างรายละเอียด `/th/directory/open-path-skills`, `/en/directory/shared-horizon`
ปุ่มในรายการปัจจุบันไปยังคำอธิบายภายในหน้า ไม่ส่งต่อจริง ไม่ควรใส่ข้อมูลส่วนบุคคลในคำค้น/URL

## ตรวจคุณภาพ

```sh
npm run typecheck
npm run lint
npm run test:unit
npm run build
npm run test:e2e
npm run test:a11y
```

หรือใช้ `npm run check` เพื่อรันทั้งหมดตามลำดับ หลัง build สามารถเปิด production server ในเครื่อง:

```sh
npm run start -- --hostname 127.0.0.1 --port 3000
```

Playwright จะเปิด/ปิด production server เองสำหรับแต่ละชุดทดสอบ จึงต้อง build ก่อน
และต้องไม่เปิด server อีกตัวค้างที่พอร์ต 3000 ใช้หนึ่ง worker ไม่มีการข้ามทดสอบโดยตั้งใจ
หากไม่มี Chromium ในเครื่อง ให้ติดตั้งเบราว์เซอร์และส่วนประกอบที่จำเป็น:

```sh
npx --no-install playwright install --with-deps chromium
```

การตั้งค่าทดสอบเลือก `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH` หากกำหนดไว้ มิฉะนั้นใช้
`/usr/bin/chromium` เมื่อมี หรือเบราว์เซอร์ที่ Playwright ติดตั้ง เซสชันนี้ทดสอบด้วย Chromium ของ Debian
เพราะโดเมนดาวน์โหลด Playwright ถูกนโยบายเครือข่ายปฏิเสธ ไม่ได้ปิด TLS หรือหลบนโยบาย
เมื่อใช้เบราว์เซอร์คนละรุ่นต้องตรวจผลในสภาพแวดล้อมนั้นอีกครั้ง
ผลตรวจต้นแบบเดิมอยู่ใน [รายงานต้นแบบ](docs/PROTOTYPE_REPORT_TH.md)
ผลตรวจ Auth/DB และสถานะล่าสุดอยู่ใน [รายงาน S1](docs/S1_REPORT_TH.md)

## พัฒนาและทดสอบ S1 ในเครื่อง

ต้องมี Docker daemon และพอร์ต 54320–54325 ว่าง คำสั่งนี้สร้าง Supabase เฉพาะ local project
พร้อมใช้ migrations กับ DB ในเครื่อง; ไม่ link กับ Project ของเจ้าของ ไม่ส่ง Email ออกภายนอก

```sh
npm run db:start
npm run dev -- --hostname 127.0.0.1 --port 3000
```

`db:start` เก็บ status/keys ใน `.local/` และสร้าง `.env.local` เฉพาะ local (ignored, mode 600)
จะไม่เขียนทับ `.env.local` ที่ผู้ใช้สร้างเอง เปิดบัญชีสมมติที่ `/th/auth/signup` และยืนยันอีเมลผ่าน
Mailpit `http://127.0.0.1:54324` ใช้เบราว์เซอร์เดิม Google ของ local stack ปิดตามค่าเริ่มต้น

```sh
npm run build
npm run test:integration
npm run test:auth
npm run db:test:fresh
npm run db:stop
```

`test:integration` สร้าง fixture ใหม่และทดสอบ Auth/PostgREST/RLS จริง;
`test:auth` เปิด/ปิดเว็บพอร์ต 3000 เองและบังคับใช้ local runtime แม้มี hosted environment variables
`db:test:fresh` สร้าง stack แยกพอร์ต 55320–55325 ทดสอบ migrations ทั้งชุดแล้วหยุด stack นั้น
ข้อมูล fixture และ Docker volumes ยังเก็บอยู่ตาม CLI default; ไม่มีคำสั่ง reset/destructive cleanup ใน workflow นี้
`npm run check:s1` รวม integration + auth browser ต้องเริ่ม local DB และ build ก่อน
`npm run db:migrate` ใช้ `migration up --local` เท่านั้น

การตั้ง Supabase/Google ที่คุณมีอยู่แล้ว ดู [คู่มือ Auth](docs/AUTH_SETUP_TH.md)
และ [สถาปัตยกรรม/ข้อจำกัดสิทธิ์](docs/adr/ADR-002-S1-AUTH-TH.md) ก่อนใช้ Project ระยะไกล
C-15/C-17 อนุญาต Project เดิม; ตรวจ preflight และใช้ migrations แบบ transaction/checksum แล้ว ไม่ reset ข้อมูลเดิม
อย่าคัดลอก service_role หรือ Google Client Secret มาใส่ในแอป

## ทดสอบ Confirm email Off, Live sync และการกู้ระบบ

คำสั่งด้านล่างมีสคริปต์จริง ต้อง build ก่อน และมี Docker daemon ในเครื่อง
stack ทดสอบแยกใช้พอร์ต56320–56324 พร้อม Realtime; ไม่เปลี่ยน Confirm email ของ stack543xx หรือ hosted

```sh
npm run db:validation:start
npm run test:validation:local
npm run db:validation:stop
npm run test:backup-restore
```

restore ต้องเปิด stack543xx ด้วย `npm run db:start` ก่อน สร้าง target ใหม่573xx ไม่ทับต้นทาง
suite ใหม่ใช้ signup ผ่าน UI, HttpOnly cookies, session จริง, MFA, private WebSocket,
สองหน้าต่าง, user/tenant isolation และถอนสิทธิ์; ลบเฉพาะ fixture ตาม manifest/UUID/tag
คำสั่ง cleanup เมื่อหยุดกลางคัน: `node scripts/cleanup-validation.mjs .local/<ชื่อ manifest จริง>.json`
ห้ามลบ fixture แบบเหมารวมตาม email suffix หรือใช้ manifest คนละ environment
หลักฐานที่มี credentials/QR/เสียง/backup อยู่ใน `.local/` ที่ ignored ไม่อัปโหลดเป็น CI artifact

Orca smoke ต้องเริ่ม validation stack และสร้าง image ก่อน (Linux/Docker; CA bundle ของ environment ต้องมีจริง):

```sh
docker --host=unix:///var/run/docker.sock build --secret id=ca_bundle,src=/etc/ssl/certs/ca-certificates.crt -t goos-a11y:node24-orca -f scripts/a11y/Dockerfile scripts/a11y
npm run test:a11y:orca
```

ใช้ headful Chromium/Orca, keyboard, axe และ reflow สำหรับ public/profile/admin ภาษาไทยและอังกฤษ
ไม่อ้างว่าได้ตรวจ NVDA/VoiceOver หรือรับรอง WCAG ครบจาก smoke นี้

hosted suite เปลี่ยนข้อมูลเฉพาะบัญชีสมมติ จึงต้องมี C-23, runtime network ที่เข้าถึงเว็บ/Supabase จริง
และ operator token สำหรับ tag/cleanup ใน environment ของเครื่องทดสอบเท่านั้น:

```sh
npm run test:validation:hosted
```

guard จำกัด Project/origin ตรวจ Confirm email Off และสิทธิ์ cleanup ก่อน signup
ไม่ใช้ test bypass ในเว็บ ไม่เผย service key ให้ browser; ถ้า network ไม่ผ่านจะหยุดก่อนสร้าง fixture
รอบนี้ยังไม่ถือว่าผล hosted ผ่าน ดูรายงานหลักฐานที่แยก target ชัดเจน

## S2 — ชุดพัฒนาตาม C-28

เพิ่มองค์กร/หลักฐาน/การตรวจอิสระ, catalog revisions และค้นหาจาก backend,
assessment ที่ข้ามคำถามได้, bookmarks, rule matching และ Live sync ของข้อมูล public
ดู [รายงาน S2](docs/S2_REPORT_TH.md), [ADR-004](docs/adr/ADR-004-S2-TH.md) และ [สัญญา API](api/s2.openapi.json)
S1 hosted ยังติด Network; C-28 อนุมัติให้เริ่ม S2 ต่อโดยไม่เปลี่ยนสถานะนั้นเป็นผ่าน

S2 ปิดตามค่าเริ่มต้น (`S2_ENABLED` ไม่เป็น true) และ migrations14–18 ยังเป็นงาน local/PR
Supabase ที่ให้บริการจริงยังมี13 migrations ตามรายงาน S1; ไม่มีการ copy fixtures ไป hosted

```sh
npm ci
npm run db:start
npm run dev:s2
```

เปิด `http://127.0.0.1:3000/th/opportunities` หรือ `/th/workspace`
`dev:s2` บังคับใช้ loopback runtime543xx, Auth local/Google off และ origin3000
ไม่รับ hosted URL/key ที่อาจ inherited จาก Cloud และไม่ส่ง operator/service credentials ให้ web child
Email signup ใน local ยังยืนยันผ่าน Mailpit54324 ตามฐาน S1; ไม่เปลี่ยน Confirm email ของ hosted

```sh
npm run build
npm run test:unit
npm run test:integration
npm run test:s2
npm run db:test:fresh
npm run test:backup-restore
```

`test:s2` สร้างบัญชี/องค์กร/รายการสมมติใหม่ใน local และเปิด production server3200 เอง
credentials/MFA/manifest อยู่ `.local/s2-fixtures.json` mode600 ไม่ส่งเป็น artifact หรือแชต
fixtures เก็บใน local DB เพื่อทบทวน UI ไม่ลบข้อมูลเดิมหรือ disable immutable events; อย่าอ้างว่าเป็น partner จริง
หยุด test server ก่อนเปิดตัวอื่นที่พอร์ตเดียวกัน

Worker ตรวจหลักฐาน PNG ใน local:

```sh
npm run db:process-evidence
```

รับ UUID เฉพาะไฟล์ได้ด้วย `npm run db:process-evidence -- <UUID>`
worker ตรวจขนาด/pixels/PNG และสร้างภาพใหม่ ลบ original หลังตัดสิน; ไม่ใช่ general antivirus/PDF/Office scanner
ไม่ deploy worker/cron อัตโนมัติ เมื่อ worker ไม่พร้อมไฟล์คง quarantine และดาวน์โหลดไม่ได้
การ rollout จริงต้องยืนยันชนิดเอกสาร/scan policy/ผู้ตรวจอิสระ/worker และ privacy/retention ก่อนข้อมูลจริง

คำสั่ง operator `hosted-s1.mjs migrate` เลือกเพียง S1≤0013 ตามค่าเริ่มต้น
`migrate --include-s2` จะเลือก S2 ด้วย เป็นคำสั่งเปลี่ยนระบบจริงที่ **ยังไม่รันในงาน S2 นี้**
ต้องตรวจ PR/migration checksums/ขอบเขต rollout ก่อนใช้ ไม่ reset DB และไม่สร้าง fake verified partners บน hosted

## S3 — ใบสมัคร เคส และการแจ้งเตือนตาม C-29

เพิ่ม exact-field preview/consent, atomic application/idempotent receipt, คิว/assignment/notes,
human job workflow, notification preferences/outbox/typed follow-up rules และ scoped Live sync
รายละเอียดสิทธิ์/ข้อจำกัด: [ADR-005](docs/adr/ADR-005-S3-TH.md), [OpenAPI](api/s3.openapi.json), [ผลจริง](docs/S3_REPORT_TH.md)
พร้อมปรับ typography/color และ spinner ตาม [C-30/C-31](docs/TYPOGRAPHY_LOADING_REPORT_TH.md)

```sh
npm ci
npm run db:start
npm run dev:s3
```

เปิด `/th/workflow` หรือ `/en/workflow` บน localhost3000; สมัคร/สร้างโปรไฟล์ adult สมมติก่อน
`dev:s3` บังคับ Auth local และ S2/S3 flags true แต่ค่าเริ่มต้น deployment ยังปิดทั้งสอง flag
ไม่มี credentials ของ worker/operator ใน web child; ไม่ copy fixtures ไป hosted

```sh
npm run build
npm run test:unit
npm run test:integration
npm run test:s3
npm run db:test:fresh
npm run test:backup-restore
```

`test:s3` seed local S2/S3 fixtures แล้วเปิด/ปิด production server3300 เอง
manifest/password/MFA อยู่ `.local/s3-fixtures.json` mode600 ที่ ignored; ไม่ส่งเป็น CI artifact
Mailpit UI54324/SMTP54325 รับอีเมลทดสอบในเครื่องเท่านั้น (`db:start` ต้องใช้ config ล่าสุด)

```sh
npm run worker:s3 -- --dry-run
npm run worker:s3 -- --tick --email
npm run worker:s3 -- --watch --tick --email
```

worker จำกัด loopback543xx และ fake @example.test, deep link localhost3000;
เมื่อใช้ test server3300 เพิ่ม `--origin http://127.0.0.1:3300`
`--org <UUID>`/`--ids <UUID,UUID>` จำกัดงานเฉพาะ; dry-run writes0, watch ทุก3วินาที หยุดด้วย Ctrl+C
คำสั่ง local เหล่านี้ไม่ตั้ง worker/cron/SMTP production; SMTP delivery เป็น at-least-once
restore หลัง `test:s3` ตรวจ encrypted package+key และ replay withdrawal ของ S3 เพิ่มจากฐาน S1

ตอนนี้มี31 migration files ใน local; hosted S1 ยัง13 ไม่มีการใช้14–31กับระบบจริงในงานนี้
operator `migrate` เลือก≤0013, `--include-s2` เลือก≤0018, `--include-s3` เลือก≤0031 อย่างชัดเจน
คำสั่งด้านล่างเป็น runbook ของรอบ S3; ผล rollout ที่รันจริงดู PRODUCTION_ROLLOUT_TH ไม่รวม S4; ตรวจ PR/checksum/rollout/worker/notices ก่อน
S1 hosted Network/Recovery ยังเป็นงานค้าง ไม่อ้างว่า S3 technical pass ทำให้ pilot พร้อม

## โครงสร้าง

- `app/` หน้าเว็บตามภาษา รายละเอียด 404 และ CSS
- `components/` ตัวกรองและปุ่มเปลี่ยนภาษา
- `lib/` คำแปล ข้อมูลสมมติ กฎสถานะ และการเลือกฟิลด์สาธารณะ
- `tests/` unit, browser, accessibility และ local DB integration
- `supabase/migrations/` ฐาน identity/permissions S1; `api/s1.openapi.json` สัญญา BFF ที่มีแล้ว
- `.github/workflows/check.yml` ขั้นตรวจ CI; สถานะ run จริงแยกตาม PR ในรายงาน S2/S3

## Vercel

เจ้าของแจ้งว่าเชื่อม repository แล้ว ไม่ต้องสร้าง Project ซ้ำ รายละเอียดค่าที่ควรตรวจใน Project เดิม
และข้อควรตรวจเรื่อง deployment อัตโนมัติอยู่ใน [คู่มือ Vercel](docs/VERCEL.md)
แก้ Framework เป็น Next.js/Node24 แล้ว เจ้าของยืนยันเปิดหน้าแอปได้หลังแก้ 404
สถานะ deploy รุ่นรอบนี้และข้อจำกัด hosted tests ดู [PLATFORM_REPORT_TH](docs/PLATFORM_REPORT_TH.md)

คำสั่ง operator ที่มีจริง (อ่านก่อนใช้ ไม่ใช่ส่วนของ web runtime):

```sh
NODE_USE_ENV_PROXY=1 node scripts/hosted-s1.mjs preflight
NODE_USE_ENV_PROXY=1 node scripts/hosted-s1.mjs verify
```

ต้องมี Supabase URL/APP_ORIGIN และ operator token ใน Environment Settings; อย่าใส่ management token ใน Vercel
คำสั่ง `migrate`, `auth`, `designate-owner`, `vercel-env` เปลี่ยนระบบระยะไกล ใช้ตาม [คู่มือ platform](docs/PLATFORM_REPORT_TH.md)
Preview ไม่ใช้ production Auth env โดยปริยาย; local suites ป้องกันการชี้ไป Project จริง

อ่าน [สารบัญ](docs/INDEX.md), [ทะเบียนการตัดสินใจ](docs/DECISIONS.md) และ
[ขั้นตอนถัดไป](docs/NEXT_STEPS.md) ก่อนขยายขอบเขต แชตและเอกสารใช้ภาษาไทย
ชื่อเทคโนโลยี รหัส และคำสั่งคงรูปที่จำเป็น

## Maintenance production

worker route `/api/internal/maintenance` ต้องมี MAINTENANCE_SECRET และ machine DB connection ที่ตั้งผ่าน operator เท่านั้น
เมื่อ worker PR/deployment พร้อม ให้ใช้ `node scripts/hosted-s1.mjs worker-configure` แล้ว deploy code+env ก่อน `worker-schedule`
คำสั่งเหล่านี้เปลี่ยน production ใช้เฉพาะ scope C-32; ไม่ provision paid services ไม่ใช้ operator/service-role ในweb runtime
SMTPต้องมี SMTP_HOST/PORT/USER/PASSWORD/FROM ผ่าน encrypted Environment Settings; เฉพาะ465/587พร้อมTLSverification
ไม่มีSMTPจะประมวลผลเฉพาะ PNG/in-app และไม่claimemail queue ดูรายงานก่อนกล่าวว่าRecoveryพร้อมแล้ว
