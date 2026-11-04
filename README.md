# Global Opportunity OS

โครงการมีพันธกิจทั่วโลก ครอบคลุมผู้รับประโยชน์ทุกกลุ่ม พร้อมเป้าหมายธุรกิจยั่งยืน
ชิ้นงานปัจจุบันคือ **ไดเรกทอรีสาธารณะไทย–อังกฤษ ใช้ข้อมูลสมมติทั้งหมด** ตามการอนุมัติ Phase 1–2
ไม่มีบัญชี ฐานข้อมูล การติดตามผู้ใช้ หรือส่งต่อเคสจริง ยังไม่ deploy และยังไม่ใช่ MVP ทั้งหมด

## เริ่มพัฒนา

ใช้ Node.js **24.22.1** และ npm **11.9.0** รุ่น dependency ล็อกใน package.json และ package-lock.json
รันทุกคำสั่งจากราก repository (`/workspace/global-opportunity-os` ในเซสชันนี้)
ถ้ามี nvm ให้ใช้ `nvm install && nvm use` ตาม .nvmrc; ไม่ต้องมี secret หรือไฟล์ .env

```sh
npm ci
npm run dev -- --hostname 127.0.0.1 --port 3000
```

เส้นทางหลัก `/th` และ `/en`; `/` เปลี่ยนไป `/th` ปุ่มเปลี่ยนภาษาคงรายการและตัวกรอง
ตัวกรองใน URL รองรับ `q`, `category`, `region`, `status` ค่าเริ่มต้นแสดงเฉพาะสถานะปัจจุบัน
เลือกทุกสถานะเพื่อดูตัวอย่างหมดอายุ/ระงับ หรือเปิดรายละเอียดโดยตรง
ตัวอย่างรายการ: `/th/directory/open-path-skills`, `/en/directory/shared-horizon`
ปุ่มในรายการปัจจุบันไปยังคำอธิบายตัวอย่างภายในหน้า ไม่ส่งข้อมูลออกไป
ไม่ควรใส่ข้อมูลส่วนบุคคลในช่องค้นหาหรือ URL เพราะ log ของผู้ให้บริการโฮสต์อาจบันทึก URL ได้

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
ผลทดสอบที่รันจริงและข้อจำกัดอยู่ใน [รายงานชิ้นงาน](docs/IMPLEMENTATION_REPORT.md)

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
