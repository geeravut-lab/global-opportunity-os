# คู่มือเตรียมใช้ Vercel กับ repository เดิม

เจ้าของเลือก Vercel และแจ้งว่าเชื่อม GitHub repository เดียวกันไว้แล้ว ตาม LEG-C-09
งานนี้เตรียมแอปและ production build ในเครื่องเท่านั้น ไม่สร้าง Vercel Project ซ้ำ
ไม่ติดตั้ง Vercel CLI ไม่ขอ token ไม่ตรวจหรือเปลี่ยนการตั้งค่าระยะไกล ไม่ push/deploy

## ค่าที่ควรตรวจใน Vercel Project เดิมก่อนอนุญาตเผยแพร่

| รายการ | ค่าที่โครงการนี้เตรียมไว้ |
| --- | --- |
| Framework Preset | Next.js |
| Root Directory | รากของ Git repository ไม่ใช่ /workspace/global-opportunity-os ซึ่งเป็น path เฉพาะเซสชัน |
| Node.js | 24.x ให้ตรง engines; ในเครื่องทดสอบ 24.22.1 |
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

ข้อห้าม deploy production ตาม LEG-C-04 ยังอยู่ เจ้าของต้องอนุญาตขั้น push/deployment ที่ต้องการแยกจาก
การเลือก Vercel เป็นโฮสต์ การเริ่มสร้างชิ้นงานไม่ได้อนุญาตทุก deployment ของ integration
ก่อนเผยแพร่ต้องทราบว่าข้อมูลทั้งหมดเป็นสมมติ มี noindex แต่ noindex ไม่ใช่การควบคุมการเข้าถึง
ห้ามเพิ่มข้อมูลจริงหรืออ้างพันธมิตรจริงในตัวอย่างนี้

## ตรวจหลังมี deployment ที่ได้รับอนุญาตในอนาคต

1. เปิด /th, /en และ / ตรวจการเปลี่ยนภาษาและทางเข้าไทย
2. ทดสอบค้นหา/หมวด/พื้นที่/สถานะ ผลว่าง ล้างตัวกรอง และ URL ที่แชร์/โหลดใหม่ได้
3. เปิดรายการปัจจุบัน หมดอายุ ระงับ และรหัสที่ไม่มีอยู่ ตรวจ 404 และไม่มีปุ่มส่งต่อจริง
4. ตรวจ security headers, noindex, ไม่มีคำขอภายนอก และไม่มี secret ในหน้าเว็บ
5. ทดสอบ accessibility ใน deployment จริง พร้อมตรวจด้วยคนตาม LEG-G-03

ผลตรวจในเครื่องอยู่ใน [รายงานชิ้นงาน](IMPLEMENTATION_REPORT.md) ยังไม่มี URL deployment หรือผลตรวจ Vercel จริง
