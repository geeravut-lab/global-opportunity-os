# การนำ knowledge จาก RooSuk มาใช้ใน Opp4All

วันที่ 2026-11-04 อ้าง [สารบัญต้นทาง](Knowledge-Index.md), Blueprint และ C-19–C-21
พันธกิจยังครอบคลุมทุกกลุ่มทั่วโลกและธุรกิจยั่งยืน บริการช่วยเหลือพื้นฐานไม่เก็บค่าสมัครโอกาส
เป้าหมายรอบนี้คือฐาน S1 และหน้าแรกที่ใช้สะดวก ไม่ใช่เปิด workflow ผู้รับประโยชน์จริงทุกโมดูล
เชื่อม SP-REQ-01/04/13, SP-AC-01/14 และ BP-AC-02/03/08/17/18 เฉพาะส่วน identity/สิทธิ์ที่มีแล้ว

อัปเดต5พฤศจิกายน2026: C-28/C-29 เริ่ม S2/S3 แล้ว ตาราง “รอบนี้” เดิมด้านล่างเป็นประวัติ S1
S3 เพิ่ม atomic preview/consent/application/share/assignment/notes/job steps, scoped signals, outbox/opt-in/typed rule/dry-run/local SMTP ตาม [รายงาน S3](S3_REPORT_TH.md)
C-30 เพิ่ม knowledge ที่16: [TYPOGRAPHY-COLOR](TYPOGRAPHY-COLOR-KNOWLEDGE.md) → ฟอนต์ฝังเอง/rem/contrast/tokens/44px และ C-31 → loading/กันกดซ้ำ ตาม [รายงาน UX](TYPOGRAPHY_LOADING_REPORT_TH.md)
ไม่มี LINE/AI/aggregate impact/production mail จากงานนี้ ข้อเสนอ P/G ยังไม่ accepted

## ความสามารถและ Phase ที่นำไปใช้

| Knowledge ต้นทาง | นำมาใช้กับ functions/features ของ Opp4All | ทำแล้วในรอบนี้ | ส่วนที่ออกแบบไว้สำหรับ Phase ถัดไป |
| --- | --- | --- | --- |
| [AI provider/model](AI-PROVIDER-MODEL-KNOWLEDGE.md) | Navigator และแผงต้นทุน/คุณภาพของผู้ดูแล | ยังไม่เรียกโมเดล ไม่เพิ่ม SDK หรือ key | **S5** gateway/adapter ต่องาน: อธิบายโอกาส สรุปเงื่อนไข ร่างแผน; เลือก primary/fallback, capabilities, budget, timeout, circuit breaker และทดสอบด้วยข้อความสมมติ; vendor/รุ่น/ราคาเป็นข้อเสนอ ต้องตรวจเอกสารทางการใหม่ |
| [AI prompts/rules](AI-PROMPTS-RULES-KNOWLEDGE.md) | คำแนะนำที่มีแหล่งอ้างอิงและผู้ใช้ยืนยันเอง | หน้าตัวอย่างยังระบุว่า AI ไม่เปิดใช้งาน | **S5** prompt versions, preview/rollback/audit, grounding/citation validation, input/output policy; ห้าม model ตัดสิน eligibility หรือส่งใบสมัครเอง; มีค้นหาด้วยตนเองเสมอ |
| [Usage analytics](USAGE-ANALYTICS-KNOWLEDGE.md) | เข้าใจการค้นหา ช่องทางที่ช่วยได้ และผลลัพธ์ | ไม่ติด third-party tracker; ตัวเลข dashboard ยังสมมติ | **S2** กำหนด event allowlist แบบไม่เก็บคำค้นหรือ PII; **S5** cohort/cost/funnel/impact, k10+complementary suppression, metric provenance; ไม่บันทึก prompt/ข้อมูลเคสลง telemetry |
| [Branding](BRANDING-KNOWLEDGE.md) | ชื่อสองภาษา โลโก้ favicon และติดตั้งเป็นแอป | `/th/admin/branding`, PNG upload/reset, versioned image/ETag, browser icons, manifest และหน้า offline; defaults ตรงสองไฟล์ของเจ้าของ | ตรวจ install/update บน Safari/Android จริงใน **S6**; ยังไม่อ้างว่าเป็น native app หรือทำงานบัญชีแบบ offline |
| [Feature flags](FEATURE-FLAGS-KNOWLEDGE.md) | หยุดฟีเจอร์โดยไม่ deploy โค้ดใหม่ | สวิตช์ `branding` และ `live_sync` ฝั่ง server; เก็บเฉพาะ false; ชื่อ unknown ถูกปฏิเสธ; flags ไม่ให้สิทธิ์ใคร | เพิ่มเฉพาะฟีเจอร์ที่มีจริงใน **S2–S5**, เช่น catalog publish และ AI kill switch; permission/consent ไม่ใช่ feature flag |
| [Audit trail](AUDIT-TRAIL-KNOWLEDGE.md) | ใครแก้สิทธิ์ branding และบริบทสำคัญ | append-only ID/action/time, admin/MFA read และ CSV export ที่มี audit; ป้องกันสูตร spreadsheet | **S3–S4** เพิ่ม domain event และ privacy lifecycle/retention ที่ owner รับรอง; ไม่ลอก retention 4 ปีหรือ purge อัตโนมัติมาใช้ |
| [Admins](ADMINS-KNOWLEDGE.md) | ผู้ดูแลแพลตฟอร์มและการคุมสิทธิ์ | designated owner หลัง verified login; MFA; เพิ่ม/ถอน registered UUID; owner/self ป้องกันการถอน; หน้า demo ไม่ให้สิทธิ์จริง | operator recovery/owner transfer ต้องมี runbook/หลักฐานบุคคลและ policy; org roles แยกจาก platform admin |
| [Responsive](RESPONSIVE-WEB-KNOWLEDGE.md) | หน้าแรกของผู้ใช้ NGO และผู้ดูแล | การ์ดขนาดต่างกัน ภาพสีสดใส คงธีมม่วง/น้ำเงิน Opp4All; sidebar scroll อิสระ; mobile bottom bar; ทดสอบ reflow/axe | ทดสอบอุปกรณ์จริง ตัวหนังสือขนาดใหญ่ และผู้ใช้ภาษาไทย/อังกฤษใน **S6** |
| [Back button](BACK-BUTTON-KNOWLEDGE.md) | ปิด More sheet ก่อนออกจากหน้า | Back/Escape/คืน focus; internal navigation เอาประวัติ sheet ออกก่อนเปลี่ยนหน้า; account/admin มี parent link ที่จำกัด allowlist | **S3–S4** confirmation preview และ modal workflow ต้องเพิ่ม history/dirty-form tests ของแต่ละงาน |
| [Change password](CHANGE-PASSWORD-KNOWLEDGE.md) | Email login และบัญชี Google ที่ต้องการเพิ่มรหัสผ่าน | ตรวจ current password หรือ recent verified recovery; บังคับ TOTP ถ้ามี; ใหม่ 12–72 UTF-8 bytes; sign out หลังเปลี่ยน; ไม่ส่งรหัส/credential hash ใน DTO | **S6** ทดสอบ hosted delivery/rotation และ recovery support ที่ปฏิบัติได้จริง; Google-only ขออีเมล recovery เพื่อเพิ่มรหัสผ่าน |
| [Navigation](NAVIGATION-KNOWLEDGE.md) | เมนูหลักทุก role และ public/account/admin | nav definition กลาง; desktop sidebar, มือถือ 4 เมนู+เพิ่มเติม, scroll hint, native dialog; การ์ดเชื่อมเมนูเดียวกัน | **S2–S5** เพิ่มเมนูตามฟีเจอร์จริงพร้อม server permission; ไม่ใช้ซ่อนเมนูแทน authorization |
| [Automation](AUTOMATION-RULES-KNOWLEDGE.md) | เตือน review expiry งานค้าง และวันติดตาม | ยังไม่มี tick/scheduler หรือ rule editor | **S2** expiry transitions; **S3** typed rule/action registry, idempotent outbox, dry-run, timezone, retry/dead-letter; **S4** outcome follow-up โดยไม่อนุมัติผล/consent อัตโนมัติ |
| [Live sync](LIVE-SYNC-KNOWLEDGE.md) | บัญชี โปรไฟล์ สิทธิ์ คำเชิญ แจ้งเตือน และ branding | private Broadcast ส่ง `{}` เป็นสัญญาณเท่านั้น; server fingerprint authoritative; polling backoff/focus fallback; ไม่ทับฟอร์มที่ยังไม่บันทึก; session revoke พาออกจากหน้าที่ป้องกัน | **S2–S4** เพิ่มเฉพาะ assigned org/case topics หลังมี domain ACL; ไม่ส่ง PII หรือใช้ client topic เป็นการอนุญาต |
| [LINE notifications](LINE-NOTIFICATIONS-KNOWLEDGE.md) | แจ้งเตือนคำเชิญ สถานะใบสมัคร และกำหนดติดตาม | generic in-app inbox/mark read สำหรับเหตุการณ์ S1; ไม่มี LINE หรือข้อความภายนอก | **S3** atomic outbox+dedup/backoff/quota, locale/deep link, delivery status; LINE เป็นช่องทาง opt-in ที่ยังต้องเลือก/อนุมัติ integration ไม่ใส่รายละเอียดเคสใน notification |
| [I18n](I18N-KNOWLEDGE.md) | ไทย/อังกฤษทุกบทบาท | ข้อความใหม่สองภาษา; language switch คง section/query; branding แยกชื่อไทย/อังกฤษ; server error แปลเป็นข้อความผู้ใช้ | **S2–S6** catalog translation/source provenance, notices แยก version+locale, dates/timezone และ human language review |

## ข้อแตกต่างที่ตั้งใจปรับจากต้นทาง

- ใช้ Next.js App Router/Vercel/Supabase เดิม ไม่เพิ่ม TanStack Start, Netlify หรือ framework ตัวที่สอง
- เก็บภาพ PNG ขนาดเล็กใน private binary table พร้อมสลับ reference แบบ transaction; public อ่านได้เฉพาะภาพที่เผยแพร่ปัจจุบัน ไม่ใช้ service_role หรือ private-Storage signed URL จาก browser ดู [ADR-003](adr/ADR-003-PLATFORM-TH.md)
- ค่า default ใช้ต่อได้เฉพาะชื่อ/รูปสาธารณะ การอ่าน authorization, tenant, consent, session หรือ mutation flag ล้มเหลวต้องปฏิเสธ ไม่คัดลอก fail-open ของต้นทางมาใช้กับความปลอดภัย
- audit ของ mutation สำคัญอยู่ transaction เดียวกัน ถ้าบันทึกไม่ได้ให้ rollback; สัญญาณ Realtime ล้มเหลวได้เพราะ server polling ตรวจสถานะจริงซ้ำ ไม่ให้ telemetry กลายเป็นเงื่อนไขอนุญาต
- model IDs ราคา free-tier และผลทดสอบที่เขียนในต้นทางเป็นข้อมูลของ RooSuk ไม่ใช่ผลตรวจหรือการตัดสินใจของโครงการนี้ ไม่เพิ่ม diagnosis/สุขภาพ/ร้านยา/การชำระเงินตามตัวอย่าง
- ไม่มี real partner claims, ข้อความภายนอก, paid provisioning หรือ personalized minor workflows ในงานนี้

## หน้าแรกที่ปรับตามภาพ RooSuk

ใช้แนวทาง greeting → การ์ดเมนูหลัก → รายละเอียดรอง การ์ดกว้างสลับสองคอลัมน์บนมือถือและหลายคอลัมน์บน desktop
สร้างภาพประกอบใหม่ 16 ภาพเป็น sprite WebP ใช้สีสดใสสอดคล้องเมนูและธีมเดิม รูปเป็น decorative ข้อความลิงก์อ่านได้ด้วย screen reader
ผู้ใช้มีค้นหา/ประเมิน/แผน/ติดตาม; NGO มี catalog/cases/team/impact; admin มี review/security/settings
หน้าบัญชีและผู้ดูแลจริงใช้รูปแบบเดียวกัน แต่ partner/case/AI cards ใน demo ยังเป็นต้นแบบข้อมูลสมมติ
ไม่คัดลอกหน้าสุขภาพหรือชี้ว่าทุกเมนูในภาพเป็นฟังก์ชันที่ใช้งานจริงแล้ว

## ขั้นถัดไป

S2 และ S3 ได้รับอนุมัติ C-28/C-29 และมีโค้ด/ผลทดสอบ local ตามรายงานแล้ว; typography/loading ตาม C-30/C-31
ขั้นต่อไปคือ review PR/rollout/production worker/notices และปิด S1 hosted/Recovery ก่อนผู้ใช้จริง ตาม [NEXT_STEPS](NEXT_STEPS.md)
S4 ส่งต่อ/ผลลัพธ์/privacy; S5 Navigator/impact; S6 operational/UAT gates ยังรอ scope/policy/ผู้รับผิดชอบ ไม่อนุมัติ vendor ราคา retention หรือระยะใหม่จากตารางนี้
