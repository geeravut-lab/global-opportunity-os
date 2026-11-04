# สถานะ deployment และการแก้ 404

> สถานะล่าสุดรอบ branding/live/หน้าแรกและ hosted S1 อยู่ [PLATFORM_REPORT_TH.md](PLATFORM_REPORT_TH.md) ข้อความสถานะก่อนหน้านี้เป็นประวัติ ไม่ใช้แทนผลรอบใหม่

วันที่ 2026-11-04 ขอบเขตรอบนี้: แก้หน้าแรก 404 ของ `https://opp4all.vercel.app/`
เป็นงานฐาน deployment ของ S1 ตาม C-17; ไม่เริ่ม S2 และไม่แก้ schema/ข้อมูล Supabase ในรอบนี้
C-18 ให้สรุปงานที่เหลือใน Phase ปัจจุบัน/Phase ถัดไปทุกครั้ง

## สาเหตุที่ตรวจพบ

Vercel Project เดิม `global-opportunity-os` ผูก GitHub repo และ Production Branch main ถูกต้อง
โดเมน `opp4all.vercel.app` verified และชี้ production ถูกต้อง แต่ Framework เป็น `null` (Other)
ค้างจากตอน repo เป็นเอกสาร จึงไม่ใช้ Next.js deployment adapter แม้ build command รัน next build ผ่าน
สถานะ Ready ของ commit `0e7c957` จึงไม่ใช่หลักฐานว่ามีหน้าแอปให้เปิดใช้
API details ของ deployment เก่าไม่มี routes ที่ใช้ยืนยันหน้าเว็บ; ไม่ใช้ builds array เพียงตัวเดียวตัดสินว่ามี/ไม่มี functions

Project ตั้ง Node 26.x ในขณะที่ package.json ใช้ 24.x ทำให้เกิด Node override warning
warning นี้เป็นความไม่ตรงกันที่แก้พร้อมกัน ไม่ใช่สาเหตุหลักที่สรุปจากภาพอย่างเดียว

## สิ่งที่แก้และ deploy แล้ว

- สาขา `fix/vercel-nextjs-production`; commit การแก้ `d6f0b5b`
- เพิ่ม `vercel.json`: `framework: nextjs`, `installCommand: npm ci`, `buildCommand: npm run build`
- เปลี่ยน Project เดิมผ่าน Vercel API: Framework `nextjs`, Node `24.x`; ไม่สร้าง Project/domain ซ้ำ
- push สาขาและ main แบบ fast-forward โดยไม่ force push
- production deployment ใหม่ `dpl_7s5EXDz4Lkhh2RRfrzMkZvpptAke`
- Vercel API ยืนยัน `READY`, `aliasAssigned: true` และ Project production target เป็น deployment ใหม่นี้
- alias มี `opp4all.vercel.app`; deployment URL คือ `global-opportunity-iq3rd1553-geeravut-lab.vercel.app`
- build logs ยืนยัน `Detected Next.js version: 16.4.5`, แสดง App Router routes และ `Deployment completed`

## ผลตรวจที่รันจริงในรอบนี้

| การตรวจ | ผล |
| --- | --- |
| `npm run build` | ผ่าน มี root และ routes ของแอป |
| `npm run test:e2e` | 20 ผ่าน ครอบคลุม directory/สามมุมมอง/ไทย–อังกฤษ/มือถือ |
| production server ในเครื่อง `/` | 307 → `/th` |
| production server ในเครื่อง `/th`, `/en`, `/th/auth/login`, `/th/demo/partner`, `/th/demo/admin` | ทุกหน้า 200 และมี main content; X-Frame-Options DENY |
| Vercel Project settings | framework nextjs / Node 24.x |
| Vercel deployment/alias | READY และ opp4all.vercel.app ผูกกับรุ่นแก้แล้ว |
| HTTP/หน้าเว็บจริงจาก workspace | ยังตรวจไม่ได้ เพราะ proxy network policy ปฏิเสธ hostname นี้ ไม่ใช่หลักฐานว่าเว็บยังตอบ 404 |

ไม่มีการนำผล 138 tests เดิมมาอ้างว่ารันซ้ำในรอบแก้ configuration นี้
ผล DB/Auth เดิมอยู่ [S1_REPORT_TH.md](S1_REPORT_TH.md)
คำเตือน NO_COLOR/FORCE_COLOR ของ runner ไม่ทำให้ tests ล้มเหลว

## Network สำหรับตรวจเว็บสด

API domains เดิมใช้งานได้แล้ว และ URL/key/origin/management token พร้อมใน runtime ล่าสุด
การเรียก `opp4all.vercel.app` ผ่าน proxy ถูกปฏิเสธก่อนถึงเว็บ
เพิ่มเฉพาะ hostname นี้ใน draft ของ Cloud Environment แล้ว รักษา API domains และ secret bindings เดิม
successful draft save ไม่ apply network ให้ runtime เดิม และ agent ไม่ publish environment
หากให้ agent ตรวจเว็บสดต่อ ใช้ Review/Save/Publish environment ตาม UI เพื่อ apply hostname นี้
เจ้าของเปิดเว็บจาก browser ของตนได้ตามปกติ; รอผลยืนยันการเปิดเว็บจากเจ้าของด้วย

## งานที่ยังเหลือใน S1 และ Phase ถัดไป

Vercel API คืน `envs: []` คือ Project ยังไม่มี Environment Variables ของแอป
Cloud Environment และ Vercel เป็นคนละ settings จึงยังไม่เปิด Email/Google ให้ใช้งานจริงบนเว็บในรอบนี้
Supabase preflight/migrations/hosted Auth tests ยังไม่รัน ห้ามนับการแก้ 404 เป็นผลผ่าน login/RLS บน hosted

แนะนำปิด S1 hosted ก่อน: ตรวจ Project เดิม → migrations ที่ปลอดภัย → Vercel env/callback →
ทดสอบ Email/Google/MFA/session/permissions ด้วยข้อมูลสมมติ และระบุ operational gaps
จากนั้น S2 จึงทำ verified organization/catalog backend, public search, assessment/bookmarks/rule matching
รายละเอียด functions/features และคำสั่งต่อที่แนะนำอยู่ [NEXT_STEPS.md](NEXT_STEPS.md)
