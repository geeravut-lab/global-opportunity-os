# รายงานชิ้นงาน Phase 1–2

วันที่ 2026-11-04 สาขา `feat/bilingual-demo-directory` ฐาน Git เดิม
`335a80196c5cbfe1234af7d3a252250621649e51` ไม่มีการ commit/push หรือ deploy ในงานนี้
เอกสารเดิมที่ยังไม่อยู่ใน Git ถูกเก็บและปรับสถานะต่อเนื่อง ไม่ลบทิ้งหรืออ้างว่าส่งขึ้น GitHub แล้ว

## การอนุมัติและขอบเขต

เจ้าของกล่าวว่า “ผมเลือกตามที่คุณแนะนำทั้ง 4 เรื่องเลยครับ” พร้อมเลือก Vercel และแจ้งว่าเชื่อม GitHub แล้ว
บันทึก C-07 ถึง C-09 ใน DECISIONS.md: ไดเรกทอรีไทย–อังกฤษ ข้อมูลสมมติ Next.js/React/TypeScript/npm
ใช้ S0-01 ถึง S0-09 เป็นฐานชั่วคราว ไม่แต่งนิยาม REQ-01/04/13 และ AC-01/14 ที่ไม่มีต้นฉบับ
Phase 3–5 และข้อเสนอสถาปัตยกรรมข้อมูลจริงยังไม่อนุมัติ ไม่ย้ายฐานข้อมูล ส่งข้อความภายนอก หรือจัดซื้อบริการ

## สิ่งที่สร้าง

- หน้า /th และ /en, เปลี่ยนจาก / ไป /th พร้อมรายการและรายละเอียดสองภาษา
- ค้นหา/กรองหมวด พื้นที่ และสถานะ บันทึกตัวกรองใน URL; เปลี่ยนภาษาคงรายการ/ตัวกรอง
- ข้อมูลสมมติสี่รายการ: ปัจจุบันสองรายการ หมดอายุหนึ่ง และระงับหนึ่ง; มีผลว่างและ 404
- กฎตรวจข้อมูล/คำแปล วันหมดอายุเท่ากับเวลาปัจจุบันถือว่าหมดอายุ หลักฐานขาดหรืออนาคตไม่เปิดปุ่ม
- ป้ายสมมติทุกหน้า รายการปัจจุบันมีเพียงลิงก์อธิบายภายในหน้า ไม่มีการส่งต่อจริง
- ฟิลด์ tenant/evidence ภายในไม่ส่งให้คอมโพเนนต์รายการ client ไม่มีบัญชี ฐานข้อมูล คุกกี้ analytics หรือ API ภายนอก
- CSS ในโครงการ ไม่มีฟอนต์/รูปภายนอก; ปุ่มข้ามเนื้อหา label, live status, โฟกัส และการจัดหน้ามือถือ
- ล็อกรุ่นจริงพร้อม lockfile, สคริปต์ติดตั้ง/ทดสอบ, CI workflow และคู่มือ Vercel Project เดิม

## รุ่นที่ใช้จริง

เครื่อง: Debian 13, Node 24.22.1, npm 11.9.0, Chromium 155.0.8059.79 ของ Debian

| แพ็กเกจ | รุ่นที่ล็อก |
| --- | --- |
| next | 16.4.5 |
| react | 19.3.1 |
| react-dom | 19.3.1 |
| typescript | 6.0.3 |
| @types/node | 24.19.2 |
| @types/react | 19.3.0 |
| @types/react-dom | 19.3.0 |
| eslint | 10.14.0 |
| vitest | 5.1.0 |
| @playwright/test | 1.64.1 |
| @axe-core/playwright | 4.14.0 |
| typescript-eslint | 8.72.1 |
| @next/eslint-plugin-next | 16.4.5 |
| eslint-plugin-react-hooks | 7.1.1 |

อ่านเอกสาร Next ที่มากับรุ่นติดตั้งเรื่อง installation และ page params/searchParams แบบ Promise
ตรวจ engines/peer dependencies จาก npm metadata และ npm ls; ไม่บังคับข้าม peer dependency
รุ่นล่าสุดเริ่มต้นของ TypeScript 7/ESLint 10 ขัดกับชุด eslint-config-next บางส่วน จึงใช้ TypeScript 6.0.3
และ ESLint 10 กับ typescript-eslint, React hooks และ Next plugin โดยตรง ไม่ใช้ eslint-config-next ที่ดึงปลั๊กอินเก่า
ไม่คง ESLint 9 ที่มีคำเตือนหยุดรองรับ การติดตั้งจาก lockfile หลังปรับสำเร็จ
npm ls แสดง optional sharp WASM สองรายการเป็น extraneous แม้หลัง npm ci; ไม่ใช่ peer conflict
ไม่แก้ node_modules หรือ checksum เพื่อให้ผ่าน

## ผลตรวจที่รันจริง

| คำสั่ง/การตรวจ | ผล |
| --- | --- |
| npm ci --no-fund | ผ่าน ติดตั้งใหม่จาก lockfile |
| npm ls typescript eslint | ไม่มี peer dependency ผิดช่วงหลังปรับรุ่น |
| npm run typecheck | ผ่าน รวม next typegen และ tsc --noEmit |
| npm run lint | ผ่าน |
| npm run test:unit | ผ่าน 25 กรณี |
| npm run build | ผ่าน production build ในเครื่อง |
| npm run test:e2e | ผ่าน 10 กรณี ไทย/อังกฤษ ตัวกรอง ภาษา รายละเอียด สถานะ 404 คีย์บอร์ด และตรวจไม่มีคำขอภายนอก/คุกกี้/browser storage |
| npm run test:a11y | ผ่าน 14 กรณี: axe 12 หน้า/สถานการณ์ และ reflow 320 CSS px สองภาษา ไม่มีรายการข้าม |
| npm run check | รันคำสั่งข้างต้นตามลำดับสำเร็จ รวมทดสอบ 49 กรณี ไม่ใช้ชุดทดสอบว่าง |
| npm audit --omit=dev --audit-level=high | รายงาน 0 vulnerabilities ณ เวลาตรวจ เฉพาะ dependency ฝั่งแอป ไม่ใช่การรับรองไร้ช่องโหว่ |
| ตรวจ HTTP response ในเครื่อง | /th ตอบ 200; nosniff, no-referrer, DENY, Permissions-Policy และ CSP แบบจำกัดขอบเขตส่งออกจริง |
| ตรวจภาพหน้าจอ | ตรวจหน้าไทยเดสก์ท็อปและรายละเอียดอังกฤษมือถือ; พบลูกศรฟอนต์แสดงเป็นกล่อง จึงเปลี่ยนเป็น SVG ภายในโครงการและตรวจซ้ำ |

build ครั้งแรกภายใต้ command sandbox ไม่สามารถอ่านผล subprocess ของ TypeScript ได้
เมื่อรันนอก sandbox ผ่านคำสั่งที่ได้รับอนุญาต build สำเร็จโดยไม่ปิดการตรวจชนิดข้อมูล
การดาวน์โหลดเบราว์เซอร์จาก cdn.playwright.dev ถูก 403 Domain forbidden จึงไม่ได้ติดตั้ง artifact นั้น
ใช้ Chromium ที่มีอยู่ในระบบผ่าน executablePath ที่ Playwright รองรับ ไม่เปลี่ยน network policy และไม่ปิด TLS
CI ที่เตรียมไว้ติดตั้งเบราว์เซอร์ Playwright ตามปกติ แต่ยังไม่รันบน GitHub จึงไม่อ้างว่ารุ่นนั้นผ่านใน CI แล้ว

## หลักฐานเกณฑ์ตรวจรับและข้อจำกัด

S0-01/02 มีการติดตั้งซ้ำ เครื่องมือจริง และจำนวนทดสอบ; S0-03 ถึง S0-08 มี unit/browser test
S0-09 มี axe และ reflow แต่ยังไม่ครบการตรวจด้วยคน G-03 ยังไม่ปิด:
ต้องตรวจโปรแกรมอ่านหน้าจอจริง ซูม 200% คุณภาพคำแปล ลำดับและการมองเห็นโฟกัสด้วยคน
จึงไม่อ้างว่า WCAG 2.2 AA ได้รับการรับรองครบถ้วน

ยังไม่ทดสอบ Firefox/WebKit ไม่ตรวจ deployment จริง และไม่เข้าถึง Vercel/GitHub integration
ไม่ได้ทดสอบ tenant RLS/consent เพราะไม่มีฐานข้อมูลหรือเคสในขอบเขตนี้
ข้อมูลปัจจุบันอ้างเวลาฝั่งเซิร์ฟเวอร์ ณ การเปิดหน้า; นี่เป็นชุดสมมติ ไม่รับรองการระงับ/หมดอายุทันทีบนหน้าที่เปิดค้าง
CSP ที่ใส่จำกัด frame/object/base/form เท่านั้น ไม่ใช่ CSP แบบ nonce ครบทุก script
ช่องค้นหาไม่ใช่ช่องเก็บข้อมูลส่วนบุคคล แต่ URL อาจอยู่ใน access log ของโฮสต์ จึงมีคำเตือนผู้ใช้
ไม่อ้างพันธมิตรจริง การมีหลักฐานสมมติไม่ใช่การตรวจสอบองค์กรจริง

## ไฟล์เปลี่ยนและขั้นต่อไป

โค้ดใหม่อยู่ใน app/, components/, lib/, tests/; การตั้งค่าที่รากคือ package.json/package-lock.json,
.nvmrc, .npmrc, .gitignore, tsconfig.json, next-env.d.ts, next.config.ts, eslint.config.mjs,
vitest.config.ts, playwright.config.ts และ .github/workflows/check.yml
อัปเดต README กับเอกสารใน docs/ เพิ่ม VERCEL.md และรายงานนี้
ไม่มี .env หรือข้อมูลรับรอง ไม่มีไฟล์ deploy ที่เรียกใช้บริการโดยอัตโนมัติในเครื่อง

เจ้าของทบทวนชิ้นงาน/ภาษาและตรวจ Vercel settings ตาม VERCEL.md ก่อนขั้นส่งสาขาหรือ deployment
repository เชื่อม Vercel อยู่ตามที่เจ้าของแจ้ง การ push อาจสร้าง Preview หรือ Production จึงไม่ได้ push ในรอบนี้
ยังต้องอนุมัติการเผยแพร่ที่ต้องการ ไม่อ้างว่า build ในเครื่องเท่ากับพร้อมใช้งานจริงทุกด้าน
ช่องว่าง MVP: Navigator, พันธมิตร/การตรวจสอบจริง, ส่งต่อ/เคส/ความยินยอม และรายงานผลยังไม่มีตามขอบเขตที่จำกัด
