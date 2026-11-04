# Global Opportunity OS

โครงการมีพันธกิจทั่วโลก ครอบคลุมผู้รับประโยชน์ทุกกลุ่ม พร้อมเป้าหมายธุรกิจยั่งยืน
ชิ้นงานปัจจุบันมี **หน้าแรกการ์ดภาพประกอบสามมุมมอง, ฐาน S1 Email/Google, ผู้ดูแล branding และ Live sync**
ปรับตาม [Product Blueprint TH v1.0](docs/Global-Opportunity-OS-Product-Blueprint-TH.md) และภาพ UX Showcase ที่เจ้าของแนบ
ไดเรกทอรีและ dashboard สามบทบาทยังใช้ข้อมูลสมมติ การสลับ role เป็น demo navigation
บัญชี S1 อยู่ `/th/auth/login` และ `/th/account` แยกจาก demo; ผู้ดูแลจริงอยู่ `/th/admin` และต้องผ่าน MFA
ใช้ migrations ทั้ง 12 ไฟล์กับ Supabase ที่เจ้าของอนุญาตแล้ว พร้อมตั้ง Auth callback/production env ใน Vercel
ยังไม่มี AI หรือการส่งต่อจริง; เจ้าของยืนยัน Google login/MFA และเปิดหน้าผู้ดูแลได้แล้ว
Email delivery/recovery และ hosted security/live smoke ยังต้องยืนยัน แยกจากผลทดสอบในเครื่อง

[ดูแผน S0–S6 พร้อม functions/features](docs/PHASE_PLAN_TH.md) ·
[ดูผลเทียบ Blueprint/ภาพ](docs/BLUEPRINT_ALIGNMENT_TH.md) ·
[ผลตรวจ S1](docs/S1_REPORT_TH.md) · [ตั้งค่า Email/Google](docs/AUTH_SETUP_TH.md)

[ผลรอบ branding/live/หน้าแรก](docs/PLATFORM_REPORT_TH.md) ·
[นำ knowledge ทั้ง 15 เรื่องมาใช้อย่างไร](docs/KNOWLEDGE_ADOPTION_TH.md)

โลโก้/favicon เริ่มต้นคัดลอกจากสองไฟล์ Opp4All ใน docs; ผู้ดูแลที่ผ่าน MFA เปลี่ยนภาพ PNG หรือคืนค่าเดิมได้
หน้าแรกทุก role ใช้ภาพประกอบใหม่และการ์ดขนาดต่างกัน คง mobile bottom bar + เพิ่มเติม
สถานะบัญชี/โปรไฟล์/คำเชิญ/สิทธิ์/branding อัปเดตด้วย private Realtime พร้อม polling fallback โดยไม่ทับฟอร์มที่ยังไม่บันทึก
แผงผู้ดูแลมีชื่อสองภาษา feature switches, registered admins และ audit/CSV; demo role switch ไม่ให้สิทธิ์จริง

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

| มุมมอง | ไทย | อังกฤษ |
| --- | --- | --- |
| ผู้ใช้ | /th | /en |
| พันธมิตร NGO | /th/demo/partner | /en/demo/partner |
| ผู้ดูแลระบบ | /th/demo/admin | /en/demo/admin |
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

ต้องมี Docker daemon และพอร์ต 54320–54324 ว่าง คำสั่งนี้สร้าง Supabase เฉพาะ local project
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
`db:test:fresh` สร้าง stack แยกพอร์ต 55320–55324 ทดสอบ migrations ทั้งชุดแล้วหยุด stack นั้น
ข้อมูล fixture และ Docker volumes ยังเก็บอยู่ตาม CLI default; ไม่มีคำสั่ง reset/destructive cleanup ใน workflow นี้
`npm run check:s1` รวม integration + auth browser ต้องเริ่ม local DB และ build ก่อน
`npm run db:migrate` ใช้ `migration up --local` เท่านั้น

การตั้ง Supabase/Google ที่คุณมีอยู่แล้ว ดู [คู่มือ Auth](docs/AUTH_SETUP_TH.md)
และ [สถาปัตยกรรม/ข้อจำกัดสิทธิ์](docs/adr/ADR-002-S1-AUTH-TH.md) ก่อนใช้ Project ระยะไกล
C-15/C-17 อนุญาต Project เดิม; ตรวจ preflight และใช้ migrations แบบ transaction/checksum แล้ว ไม่ reset ข้อมูลเดิม
อย่าคัดลอก service_role หรือ Google Client Secret มาใส่ในแอป

## โครงสร้าง

- `app/` หน้าเว็บตามภาษา รายละเอียด 404 และ CSS
- `components/` ตัวกรองและปุ่มเปลี่ยนภาษา
- `lib/` คำแปล ข้อมูลสมมติ กฎสถานะ และการเลือกฟิลด์สาธารณะ
- `tests/` unit, browser, accessibility และ local DB integration
- `supabase/migrations/` ฐาน identity/permissions S1; `api/s1.openapi.json` สัญญา BFF ที่มีแล้ว
- `.github/workflows/check.yml` ขั้นตรวจ CI ที่เตรียมไว้ ยังไม่เคยรันบน GitHub ในงานนี้

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
