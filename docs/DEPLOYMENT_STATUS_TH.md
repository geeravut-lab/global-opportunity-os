# สถานะการเผยแพร่ S1

วันที่ 2026-11-04 ตาม C-17 เจ้าของอนุญาตให้จัดการ Supabase และ push/deploy production แล้ว
ชิ้นงานนี้ยังเป็น S1 พร้อมต้นแบบ 3 มุมมอง ไม่ใช่ผลส่งมอบ S2–S6 หรือการเปิด pilot ทุกฟังก์ชัน

## ทำแล้วในรอบนี้

- ตรวจ main ล่าสุด `b21613d` และยืนยันว่าอยู่ในประวัติ S1 ไม่มีงาน remote ใหม่ให้ทับ
- push `feat/s1-email-google-auth` ที่ commit `a02bb26` ขึ้น GitHub สำเร็จ
- ตรวจ runtime: ยังไม่เห็น URL/publishable key/APP_ORIGIN หรือ Supabase/Vercel management token
- เจ้าของยืนยันว่าค่า 3 ตัวใส่ใน Cloud Environment ไม่ใช่ Vercel; ยังต้อง apply config ไป runtime ใหม่
- เตรียม draft Secret names `SUPABASE_ACCESS_TOKEN`/`VERCEL_TOKEN` และ network domains
  `api.github.com`, `api.supabase.com`, `api.vercel.com`; draft บันทึกแล้ว แต่ยังไม่ apply/publish

## ลำดับดำเนินการที่อนุญาตแล้ว

1. push main แบบ fast-forward เท่านั้น ไม่ force push เพื่อเริ่ม Vercel Git integration ที่ผูก repo อยู่แล้ว
2. เมื่อ management bindings พร้อม เลือก Supabase Project ตาม URL และ Vercel Project ตาม GitHub repo
3. ตรวจ schema/roles/migration history/Auth config เดิมแบบอ่านก่อน ไม่ใช้ local fixture suites กับ hosted
4. ใช้ S1 migrations ใน transaction หลังตรวจความเข้ากันได้ เก็บหลักฐาน migration/version/hash
   ไม่ reset DB หรือแก้ schema ที่ไม่เกี่ยวข้องเพื่อให้ผ่าน
5. ตั้ง env ฝั่ง Vercel ให้ตรง production domain; ตั้ง Supabase redirect allowlist โดยรักษาค่าเดิม
   เปิด Email/Google flags หลัง schema/Provider พร้อม แล้ว deploy Project เดิม
6. ตรวจ deployment URL, routes/headers/noindex, Auth failure paths, Google initiation และ session/permissions
   การเข้าสู่ Google สำเร็จต้องเจ้าของเลือกบัญชีเอง; ไม่อ้างผ่านจากการสร้าง authorize URL อย่างเดียว

## สิ่งที่ยังไม่ยืนยัน

- ผล production deployment และ URL ยังไม่มีหลักฐานจาก Vercel
- schema/Auth settings และ migration บน Project จริงยังไม่รัน
- `gh` อ่าน API ยังถูก network policy ปฏิเสธที่ `api.github.com`; Git HTTPS fetch/push ใช้ได้
- ยังไม่มีการสร้าง hosted fixture หรือล้างข้อมูลจริง; แผน cleanup อยู่ AUTH_SETUP_TH.md

ผลเดิมก่อนรอบเผยแพร่: 138 test cases ผ่าน, build และ fresh local migrations ผ่าน
ดู [รายงาน S1](S1_REPORT_TH.md) สำหรับรายละเอียดและข้อจำกัด ไม่ได้รันซ้ำโดยไม่มีการเปลี่ยน runtime code
