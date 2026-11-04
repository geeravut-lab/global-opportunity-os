# งานถัดไปหลัง Branding / Live sync / หน้าแรก

วันที่ 2026-11-04 ตาม C-18 แยกสิ่งที่ทำแล้วและสิ่งที่ยังรอหลักฐาน ไม่ถือว่าขั้นถัดไปอนุมัติอัตโนมัติ
ดู [รายงานรอบล่าสุด](PLATFORM_REPORT_TH.md) และ [functions/features ทุก Phase](PHASE_PLAN_TH.md)

## สิ่งที่พร้อมให้ทบทวน

- หน้าแรกผู้ใช้/NGO/admin เปลี่ยนเป็นการ์ดหลายขนาดพร้อมภาพประกอบใหม่ คงธีม Opp4All และ bottom menu
- `/th/account`: Email/Google, profile/consent/delegation/org invitation/security/in-app inbox
- `/th/admin`: ผู้ดูแลจริงที่ผ่าน MFA เปลี่ยนโลโก้/favicon/ชื่อสองภาษา, feature switches, admins, audit/CSV
- private Live sync+polling ไม่ต้อง refresh เองและไม่ทับ dirty form; demo cards ยังระบุข้อมูลสมมติ
- hosted migrations12 และ Auth/Vercel production env ตั้งแล้ว; ผล deploy/test ล่าสุดอยู่ในรายงาน
- knowledge ทั้ง15เรื่องมี [mapping ใช้กับ Opp4All](KNOWLEDGE_ADOPTION_TH.md) AI/LINE/automation/reporting ที่ยังไม่มีระบุเป็นแผน

## S1 ที่ยังต้องปิดหลักฐาน

| ขั้นถัดไป | สิ่งที่ต้องทำ | ผลที่ต้องได้ |
| --- | --- | --- |
| 1 เปิด network สำหรับ agent ตรวจเว็บจริง | Review/Save/Publish draft Cloud Environment ที่เพิ่ม `opp4all.vercel.app` และ `fxqgvqvthrdzmgnmqgom.supabase.co`; รักษา API domains/secret เดิม | HTTP/browser/provider/Realtime smoke ได้จาก workspace; ไม่มีการหลบ proxy/TLS |
| 2 เจ้าของเข้าใช้งาน | เปิด `/th/auth/login` ใช้บัญชีที่ระบุเป็น owner แล้วตั้ง TOTP ที่ `/th/account/security` | verified owner claim ครั้งเดียว, MFA แล้วเปิด `/th/admin/branding` ได้; ไม่ส่งรหัสผ่าน/OTP/secret ในแชต |
| 3 ทดสอบ hosted Auth | Google success/cancel, Email confirmation/recovery/delivery, HTTPS cookies/refresh, session revoke และสองหน้าต่าง | แยก actual hosted evidence จาก local Mailpit/PKCE; ถ้ามี synthetic fixture hosted ต้องมี manifest และลบเฉพาะ fixture |
| 4 ปิด operational gaps ก่อนข้อมูลจริง | owner-transfer/MFA recovery/no-email assisted SOP, manual keyboard/NVDA/VoiceOver/UAT; privacy/retention/safety/ops owners และ backup/restore | เจ้าของรับรองนโยบายและผู้รับผิดชอบตาม BP-G0–G6 ที่เกี่ยวข้อง; technical deploy ไม่ใช่ real pilot readiness |

ไม่ต้องสร้าง Supabase/Vercel Project หรือส่ง management token ใหม่เพียงเพราะ frontend host ถูก network policy ปฏิเสธ
C-17 อนุญาตจัดการ Supabase/push/deploy อยู่แล้ว ไม่มีการขออนุญาตเดิมซ้ำ

## Phase S2 ที่เสนอให้เลือกสั่งต่อ

1. **Verified organizations**: onboarding, independent review, หลักฐาน/วันหมดอายุ, suspend/appeal และ server/RLS isolation
2. **Catalog backend**: draft→review→publish/revision, source/freshness/coverage/cost/accessibility, หยุดเผยแพร่เมื่อหมดอายุหรือองค์กรถูกระงับ
3. **ผู้ใช้**: public search/filter/detail จาก backend, needs assessment ที่ข้าม sensitive fields ได้, bookmarks และ deterministic matching พร้อมเหตุผล/unknown
4. **Knowledge ที่เพิ่มใน S2**: versioned flags/audit สำหรับ lifecycle, expiry rules และ privacy-safe usage event design ไม่มี paid ranking หรือ external partner messages

ใช้ข้อมูลสมมติและ allow/deny tests ต่อ ไม่เริ่ม S2 อัตโนมัติจากการปิดงาน UI
S3 เพิ่มใบสมัคร/คิวเคส/outbox; S4 ส่งต่อ/ผลลัพธ์/privacy lifecycle; S5 AI Navigator/impact; S6 operational drills และ UAT
พันธกิจยังทั่วโลกทุกกลุ่มและธุรกิจยั่งยืน แต่ไม่เปิด no-email/minor personalization/real beneficiary workflows จากคำสั่งนี้

## ส่งต่อบริบท

อ่าน AGENTS.md, README.md, INDEX.md, DECISIONS.md, PLATFORM_REPORT_TH.md และ ADR-003
รักษาต้นฉบับ Blueprint/knowledge ไม่เปลี่ยน P/G เป็น accepted โดยไม่มีหลักฐานเจ้าของ
ใช้ภาษาไทย รายงาน checks ที่รันจริง และแสดงงานค้างปัจจุบัน/Phase ถัดไปทุกครั้ง
