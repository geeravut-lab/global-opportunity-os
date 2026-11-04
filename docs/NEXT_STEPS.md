# สิ่งที่ทำต่อหลัง S1 ในเครื่อง

วันที่ 2026-11-04 C-11 อนุมัติให้ทำขั้นที่ 1–4 และ Email/Google แล้ว ไม่ต้องอนุมัติเริ่ม S1 ซ้ำ
เจ้าของแจ้งว่ามี Supabase และตั้ง Provider ใน Supabase/Google Cloud แล้วตาม C-12/13; C-14 ระบุว่าเป็น Project ระบบจริง และ C-15 อนุญาตใช้ทดสอบได้
พร้อมเคลียร์ข้อมูลทดสอบก่อนเปิด production
**C-17 อนุญาตจัดการ Supabase และ push/deploy production แล้ว** สถานะล่าสุดอยู่ [DEPLOYMENT_STATUS_TH.md](DEPLOYMENT_STATUS_TH.md)
ผลชิ้นงานและข้อจำกัดดู [รายงาน S1](S1_REPORT_TH.md)

## ลำดับถัดไป

1. ใช้ local stack ทบทวนได้ทันที; สำหรับ hosted test ใช้ Project เดิมที่อนุมัติแล้วได้
   ใส่ Project URL/publishable key/APP_ORIGIN ใน Environment Settings ตาม
   [คู่มือ Auth](AUTH_SETUP_TH.md) ไม่ส่ง secret ในแชต; workspace และ Vercel เป็นคนละชุด settings
2. ใช้ read-only preflight ตรวจ schema/roles/history ของ Project เดิมผ่าน SQL Editor หรือ migration operator
   จาก Settings ที่ปลอดภัย; เตรียม manifest ข้อมูลสมมติก่อนทดสอบ hosted แล้วค่อยเปิด Auth flags
   URL/publishable key ไม่ให้สิทธิ์ migration และตอนนี้ runtime ยังไม่มีการเชื่อมต่อที่ใช้งานได้
3. ตรวจ Google↔Supabase callback กับ app redirect allowlist แล้วทดสอบ hosted round-trip/Email/HTTPS session
   รอบนี้ยังไม่มีการ push/deploy/ส่ง Email จริง; C-17 อนุญาต deployment แล้ว ไม่ต้องถามอนุมัติซ้ำ แต่ยังต้องมีการเชื่อมต่อที่ใช้ได้
4. ทบทวน [หน้าจอ S1](S1_REPORT_TH.md) และส่วน assisted/MFA recovery ที่ยังเหลือ
   จากนั้นค่อยกำหนดชิ้นงาน S2 verified organization/catalog/search backend ตาม [แผน S0–S6](PHASE_PLAN_TH.md)

สิ่งที่ยังต้องตัดสินใจก่อนข้อมูลจริง: pilot/country, privacy/safety/ops owners, legal basis/notice/retention,
region/PITR/budget, assisted authority/ownership recovery และ abuse protection
ไม่ต้องเลือก AI vendor ราคา หรือประเทศที่สองเพื่อทดสอบ S1 ต่อ

## เปิดทบทวนในเครื่อง

ต้นแบบ: `/th`, `/th/demo/partner`, `/th/demo/admin`, `/th/opportunities`
บัญชี S1: `/th/auth/login`, `/th/auth/signup`, `/th/auth/recover`, `/th/account`
ทุกเส้นทางมีภาษาอังกฤษ `/en`; demo role switch ไม่ใช่สิทธิ์ของบัญชี
คำสั่ง local อยู่ README และคู่มือ Auth ใช้ข้อมูลสมมติเท่านั้น

## ส่งต่อไป Project เดิม

หากแชตมีเมนู `⋯` → Move to project ให้เลือก Project เดิมแล้วตรวจว่าบทสนทนาปรากฏจริง
หากเป็น Codex/ไม่มีเมนู ให้ส่ง README, docs/INDEX และไฟล์ที่อ้างอิงไป Project ปลายทาง
การเลือก repo เดียวกันไม่ย้ายประวัติแชต และ publish cloud environment ไม่ใช่ git push

งาน S1 อยู่สาขา local `feat/s1-email-google-auth` ต่อจาก snapshot ต้นแบบ `5585012`
push สาขา S1 ขึ้น GitHub แล้วตาม C-17; สถานะ main/production ดู DEPLOYMENT_STATUS_TH

ข้อความส่งต่อ:

> Global Opportunity OS ใช้ภาษาไทยในแชต/เอกสาร อ่าน AGENTS.md, README.md และ docs/INDEX.md
> ใช้ Blueprint TH v1.0/ภาพ UX Showcase เป็นฐาน C-11 อนุมัติ S0/local spike/S1 Email+Google
> อ่าน S1_REPORT_TH, AUTH_SETUP_TH และ ADR-002 ก่อนทำต่อ มี local Auth/DB/RLS จริงและต้นแบบ 3 บทบาท
> Google Provider เจ้าของแจ้งว่าตั้งแล้วใน Project ระบบจริง; C-15 อนุญาตทดสอบใน Project เดิมและล้าง fixture ก่อนเปิดจริง
> hosted round-trip/remote preflight/migrations ยังไม่รัน เพราะ runtime ยังไม่มีค่าการเชื่อมต่อ/สิทธิ์ operator
> รักษาพันธกิจทั่วโลกทุกกลุ่มและธุรกิจยั่งยืน ใช้ข้อมูลสมมติ ไม่ deploy production/paid provisioning/ส่งข้อความ/ข้อมูลจริง/minor workflows
