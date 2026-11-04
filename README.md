# Global Opportunity OS

โครงการมีพันธกิจทั่วโลก ครอบคลุมผู้รับประโยชน์ทุกกลุ่ม พร้อมเป้าหมายธุรกิจยั่งยืน
ชิ้นงานปัจจุบันคือ **ต้นแบบ UX สามมุมมอง: ผู้ใช้ / พันธมิตร NGO / ผู้ดูแลระบบ**
ปรับตาม [Product Blueprint TH v1.0](docs/Global-Opportunity-OS-Product-Blueprint-TH.md) และภาพ UX Showcase ที่เจ้าของแนบ
พร้อมไดเรกทอรีไทย–อังกฤษและข้อมูลสมมติทั้งหมด ไม่มีบัญชี ฐานข้อมูล AI จริง หรือการส่งต่อจริง
การสลับ role เป็น demo navigation ทุกคนเปิดได้ ไม่ใช่ระบบสิทธิ์/ยืนยันตัวตน

[ดูแผน S0–S6 พร้อม functions/features](docs/PHASE_PLAN_TH.md) ·
[ดูผลเทียบ Blueprint/ภาพ](docs/BLUEPRINT_ALIGNMENT_TH.md) ·
[ดูผลตรวจรอบปัจจุบัน](docs/PROTOTYPE_REPORT_TH.md)

## เริ่มพัฒนา

ใช้ Node.js **24.22.1** และ npm **11.9.0** รุ่น dependency ล็อกใน package.json และ package-lock.json
รันทุกคำสั่งจากราก repository (`/workspace/global-opportunity-os` ในเซสชันนี้)
ถ้ามี nvm ให้ใช้ `nvm install && nvm use` ตาม .nvmrc; ไม่ต้องมี secret หรือไฟล์ .env

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
ผลทดสอบที่รันจริงและข้อจำกัดอยู่ใน [รายงานต้นแบบรอบปัจจุบัน](docs/PROTOTYPE_REPORT_TH.md)

## โครงสร้าง

- `app/` หน้าเว็บตามภาษา รายละเอียด 404 และ CSS
- `components/` ตัวกรองและปุ่มเปลี่ยนภาษา
- `lib/` คำแปล ข้อมูลสมมติ กฎสถานะ และการเลือกฟิลด์สาธารณะ
- `tests/` unit, browser และ accessibility
- `.github/workflows/check.yml` ขั้นตรวจ CI ที่เตรียมไว้ ยังไม่เคยรันบน GitHub ในงานนี้

## Vercel

เจ้าของแจ้งว่าเชื่อม repository แล้ว ไม่ต้องสร้าง Project ซ้ำ รายละเอียดค่าที่ควรตรวจใน Project เดิม
และข้อควรตรวจเรื่อง deployment อัตโนมัติอยู่ใน [คู่มือ Vercel](docs/VERCEL.md)
ยังไม่ได้ตรวจการตั้งค่าระยะไกลหรือ deploy; การ build สำเร็จในเครื่องไม่รับรองว่า deploy สำเร็จแล้ว

อ่าน [สารบัญ](docs/INDEX.md), [ทะเบียนการตัดสินใจ](docs/DECISIONS.md) และ
[ขั้นตอนถัดไป](docs/NEXT_STEPS.md) ก่อนขยายขอบเขต แชตและเอกสารใช้ภาษาไทย
ชื่อเทคโนโลยี รหัส และคำสั่งคงรูปที่จำเป็น
