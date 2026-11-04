# งานถัดไปหลังแก้ Vercel 404

วันที่ 2026-11-04 ตาม C-18 ทุกครั้งที่สรุปงานจะแสดงผลที่ทำแล้ว งานค้างใน Phase ปัจจุบัน
และทางเลือกใน Phase ถัดไป เพื่อให้เจ้าของตัดสินใจสั่งต่อ ไม่ถือว่าข้อเสนอคืออนุมัติ Phase ใหม่
C-17 อนุญาตให้จัดการ Supabase และ push/deploy production แล้ว ไม่ต้องขอสิทธิ์เดิมซ้ำ

## งานรอบนี้: ฐาน deployment ของ S1

พบว่า Project ใช้ Framework Other (`null`) ค้างจากตอนเป็น repo เอกสาร แม้ Next build ผ่าน
แต่ deployment เดิมไม่มี Next.js routes จึงขึ้น Ready พร้อม 404
แก้ Project เป็น Next.js/Node 24 และเพิ่ม `vercel.json` แล้ว รายละเอียดผล deploy อยู่
[DEPLOYMENT_STATUS_TH.md](DEPLOYMENT_STATUS_TH.md)

URL สำหรับทบทวนคือ `https://opp4all.vercel.app/` ซึ่งควรเปลี่ยนไป `/th`
มี `/en`, `/th/demo/partner`, `/th/demo/admin`, `/th/opportunities` และ `/th/auth/login`
หน้าต้นแบบยังใช้ข้อมูลสมมติ บัญชีจริงยังต้องทำงาน S1 ด้านล่างให้ครบ

## งานที่ยังเหลือใน S1 — แนะนำทำก่อน S2

| ลำดับ | Functions/features | ผลตรวจรับที่ต้องได้ |
| --- | --- | --- |
| 1 ตรวจเว็บ production | หน้าแรก/ภาษา/สามมุมมอง/ค้นหา/มือถือ/security headers และ 404 เฉพาะเส้นทางที่ไม่มี | HTTP จริงของ `/` เป็น redirect ไป `/th`, `/th`/`/en` เป็น 200 ไม่ใช่ดู Ready อย่างเดียว |
| 2 เชื่อม Supabase Project เดิม | read-only preflight schema/roles/history/Auth settings; ใช้ migrations แบบไม่ทับของเดิม; ผูก test-run manifest ก่อนสร้าง fixture | remote role/RLS/ACL ผ่าน และไม่มีการแก้หรือลบข้อมูลเดิมที่ไม่เกี่ยวข้อง |
| 3 เปิด Email/Google บน Vercel | ตั้ง Project URL/publishable key/APP_ORIGIN/flags ใน Vercel โดยตรง; callback allowlist; confirmation/recovery; ไม่ใส่ management tokens ในเว็บ | บัญชีของตนเองเข้าได้, คำขอข้ามผู้ใช้/tenant ถูกปฏิเสธ, HTTPS cookies/refresh/no-store ถูกต้อง |
| 4 ปิดช่องว่าง S1 | ทดสอบ Google success/cancel/ลิงก์เก่า, SMTP จริงในขอบเขตที่ตกลง, MFA recovery/owner transfer และ assisted SOP; manual keyboard/screen reader | แยกผลผ่าน/ไม่รัน/ข้อกำหนดปฏิบัติงานที่ยังไม่รับรอง ไม่กล่าวว่า S1 ทั้งระยะผ่านจาก login ครั้งเดียว |

ตอนตรวจรอบนี้ Cloud Environment มี URL/key/origin และ management token พร้อมแล้ว
แต่ Vercel API คืน `envs: []` คือ Project ยังไม่มี Environment Variables
การตั้ง Cloud Environment ไม่ส่งค่าต่อไป Vercel อัตโนมัติ; ไม่ต้องสร้าง token ใหม่จากเหตุนี้
รอบแก้ 404 ไม่เปลี่ยน schema หรือข้อมูล Supabase และไม่เปิด Auth ก่อนตรวจ migrations

การเรียกเว็บสดจาก workspace ถูก network policy ปฏิเสธ เพราะยังไม่อนุญาต `opp4all.vercel.app`
เพิ่ม hostname นี้ใน draft แล้ว โดยคง API domains เดิมทั้งหมดและไม่ publish ให้
ถ้าต้องการให้ agent ตรวจหน้าเว็บสดต่อ ให้ Review/Save/Publish environment ตาม UI เพื่อ apply network change
เจ้าของเปิดเว็บจาก browser ของตนได้ตามปกติ; ข้อจำกัดนี้ไม่ใช่ 404 ของ Vercel

ตัวอย่างคำสั่งต่อที่แนะนำ:

> ปิด S1 ส่วน hosted ต่อ: ตรวจ Supabase เดิม ใช้ migrations อย่างปลอดภัย ตั้งค่า Vercel และทดสอบ Email/Google/สิทธิ์ด้วยข้อมูลสมมติ พร้อมรายงานช่องว่างที่ยังเหลือ

## Phase ถัดไป S2 — เมื่อฐาน S1 พร้อม

- องค์กร: onboarding, independent verification, หลักฐาน/วันหมดอายุ, suspend/appeal และสิทธิ์สมาชิก
- รายการโอกาส: draft/review/publish/revision, แหล่งข้อมูล/ความสด/coverage/cost/accessibility และหยุดเผยแพร่เมื่อหมดอายุหรือองค์กรถูกระงับ
- ผู้ใช้: public search/filter/detail จาก backend, needs assessment ที่ข้าม sensitive fields ได้, bookmarks และ rule-based matching พร้อมเหตุผล/unknown
- ใช้ synthetic fixtures และ allow/deny tests ต่อ ไม่เติมคำกล่าวอ้างพันธมิตรจริงหรือ AI ที่ยังไม่มี

ไม่เริ่ม S2 โดยอัตโนมัติจากการแก้ deployment ดู [แผน functions/features S0–S6](PHASE_PLAN_TH.md)
S0 ยังมี pilot scope/ops/privacy/safety/region/PITR/budget ที่ต้องได้ข้อสรุปก่อนใช้ข้อมูลผู้รับประโยชน์จริง

## ส่งต่อบริบท

อ่าน AGENTS.md, README.md, docs/INDEX.md, DECISIONS.md, DEPLOYMENT_STATUS_TH.md และ S1_REPORT_TH.md
ใช้ภาษาไทย รักษาพันธกิจทั่วโลกทุกกลุ่มและธุรกิจยั่งยืน
ต้นแบบ/ฐาน S1 ไม่ใช่ full MVP; no-email/minor/real beneficiary workflows ยังไม่เปิด
C-17 อนุญาต Supabase/push/deploy แล้ว ส่วน paid provisioning/partner messages ไม่รวมในคำสั่งนี้
