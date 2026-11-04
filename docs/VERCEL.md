# คู่มือเตรียมใช้ Vercel กับ repository เดิม

เจ้าของเลือก Vercel และแจ้งว่าเชื่อม GitHub repository เดียวกันไว้แล้ว ตาม C-09
C-17 อนุญาต push/deploy production แล้ว ใช้ Vercel Project เดิมที่เชื่อม repo ไม่สร้างซ้ำ
สถานะการทำจริงและสิ่งที่ติดอยู่ดู [สถานะ deployment](DEPLOYMENT_STATUS_TH.md)
เนื้อหาด้านล่างเป็นค่าตั้งต้นจากรอบก่อน การตรวจที่ยังไม่ทำไม่ถือว่าผ่าน

## ค่าที่ต้องตรวจใน Vercel Project เดิม

| รายการ | ค่าที่โครงการนี้เตรียมไว้ |
| --- | --- |
| Framework Preset | Next.js (`nextjs`); ระบุใน `vercel.json` และ Project settings |
| Root Directory | รากของ Git repository ไม่ใช่ /workspace/global-opportunity-os ซึ่งเป็น path เฉพาะเซสชัน |
| Node.js | 24.x ตรง engines; เปลี่ยน Project เดิมจาก 26.x เป็น 24.x แล้ว |
| Package manager | npm; packageManager ระบุ npm@11.9.0 และมี package-lock.json |
| Install Command | npm ci |
| Build Command | npm run build |
| Output Directory | ใช้ค่ามาตรฐานของ Next.js/Vercel ไม่ตั้งเป็น out และไม่ใช้ static export |
| Environment Variables | ชิ้นงานนี้ไม่ต้องมี secret, database URL หรือ API key; อาจตั้ง NEXT_TELEMETRY_DISABLED=1 สำหรับเครื่องมือ build |

ไม่ต้องมี vercel.json สำหรับโครงมาตรฐานนี้ ตรวจหน้า Project จริงว่าค่าที่ตั้งไว้ไม่ทับค่าเหล่านี้
และ Vercel รองรับ runtime ที่เลือกก่อนเผยแพร่ รอบนี้ยังไม่ได้เข้าถึง Project เพื่อตรวจ
เอกสารอ้างอิงสำหรับเจ้าของ: [Next.js บน Vercel](https://vercel.com/docs/frameworks/full-stack/nextjs)
และ [Git integration](https://vercel.com/docs/git) ลิงก์เหล่านี้เป็นเอกสารให้อ่านต่อ ไม่ใช่หลักฐานว่าทดสอบ integration แล้ว

## ก่อน push หรือ merge

Vercel Git integration อาจสร้าง Preview เมื่อ push สาขา และ Production เมื่อแก้ production branch
ต้องตรวจ Production Branch, การเปิด automatic deployment และสิทธิ์เข้าถึง Preview ใน Project เดิมก่อน
CI workflow ที่เพิ่มใน repository เป็นการตรวจคุณภาพ ไม่รับรองว่า Vercel จะรอผล CI อัตโนมัติ
ถ้าต้องการบังคับให้รอ ต้องตั้งกฎและ branch protection ที่เหมาะสมแยกต่างหาก ซึ่งงานนี้ไม่ได้แก้

C-17 อนุญาต push และ production deployment ของ S1 แล้ว; C-10 เป็นขอบเขตในอดีต
ยังไม่ใช้การเผยแพร่เว็บเป็นหลักฐานว่าผ่าน release gates หรือพร้อมรับข้อมูลผู้รับประโยชน์จริง
ก่อนเผยแพร่ต้องทราบว่าข้อมูลทั้งหมดเป็นสมมติ มี noindex แต่ noindex ไม่ใช่การควบคุมการเข้าถึง
ห้ามเพิ่มข้อมูลจริงหรืออ้างพันธมิตรจริงในตัวอย่างนี้

## ตรวจหลังมี deployment ที่ได้รับอนุญาตในอนาคต

1. เปิด /th, /en, /th/demo/partner, /th/demo/admin และ / ตรวจมุมมองต้นแบบ ภาษา และทางเข้าไทย
2. เปิด /th/opportunities หรือ /en/opportunities แล้วทดสอบค้นหา/หมวด/พื้นที่/สถานะ ผลว่าง ล้างตัวกรอง และ URL ที่แชร์/โหลดใหม่ได้
3. เปิดรายการปัจจุบัน หมดอายุ ระงับ และรหัสที่ไม่มีอยู่ ตรวจ 404 และไม่มีปุ่มส่งต่อจริง
4. ตรวจ security headers, noindex, ไม่มีคำขอภายนอก และไม่มี secret ในหน้าเว็บ
5. ทดสอบ accessibility ใน deployment จริง พร้อมตรวจด้วยคนตาม LEG-G-03

ผลตรวจในเครื่องอยู่ใน [รายงานต้นแบบ](PROTOTYPE_REPORT_TH.md) ยังไม่มี URL deployment หรือผลตรวจ Vercel จริง


## สิทธิ์สำหรับ agent จัดการ Project เดิม

สร้าง token ที่ [Vercel Account → Tokens](https://vercel.com/account/tokens) ด้วย Scope บัญชี/ทีมที่มี Project นี้
ใส่ใน Secret Settings ชื่อ `VERCEL_TOKEN` ไม่ส่งค่าในแชต และต้องให้ runtime ที่รันเห็น binding แล้ว
agent จะอ่านรายการ Projects และเลือกเฉพาะ Project ที่เชื่อม `geeravut-lab/global-opportunity-os`
ก่อนเปลี่ยน env/deploy ตรวจ Production Branch และ domain จริง ไม่เดาชื่อ Project หรือ team
Vercel environment variables แยกจาก Cloud Environment; ค่าที่ใส่ใน workspace ไม่ปรากฏบน Vercel อัตโนมัติ

`SUPABASE_ACCESS_TOKEN` มาจาก [Supabase Account → Access Tokens](https://supabase.com/dashboard/account/tokens)
เป็น Personal Access Token สำหรับ Management API ไม่ใช่ publishable key/service_role
ใช้สำหรับตรวจ Project/schema และใช้ migrations ที่ผ่านการตรวจแล้ว ไม่ฝัง token ในเว็บหรือ commit


## สาเหตุ Ready แต่เปิดหน้าแรกเป็น 404 ที่ตรวจพบจริง

Project ถูกสร้างตอน repo ยังเป็นเอกสาร จึงมี `framework: null` (Other) ค้างอยู่
แม้ build logs รัน `npm run build`/`next build` ผ่าน แต่ deployment `0e7c957` มี `routes: null` และ `builds: []`
โดเมน `opp4all.vercel.app` verified และผูก production ถูกต้องแล้ว จึงไม่ต้องสร้าง domain/Project ใหม่

แก้โดยกำหนด `framework: nextjs` ใน Project เดิมและ `vercel.json` พร้อม npm ci/npm run build
ไม่เพิ่ม catch-all rewrite หรือ static output directory ที่ทำให้ App Router/Auth ทำงานผิดรูปแบบ
Node Project เดิม 26.x ถูกเปลี่ยนเป็น 24.x ให้ตรง package.json; warning Node override ไม่ใช่ต้นเหตุหลักของ 404
หลังเปลี่ยนต้อง deploy ใหม่ deployment เก่าไม่เปลี่ยนตาม Project settings อัตโนมัติ
รายละเอียดผลตรวจหลังแก้ดู DEPLOYMENT_STATUS_TH.md
