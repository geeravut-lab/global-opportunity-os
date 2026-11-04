# UX/UI ต้นแบบตามภาพ Showcase

อ้างภาพที่เจ้าของแนบวันที่ 2026-11-04 และ Blueprint §6/11/12
รอบนี้อนุมัติเฉพาะ prototype ตาม C-10 ใช้ข้อมูลสมมติทั้งหมด ไม่เก็บข้อมูลผู้รับประโยชน์

## ภาษาภาพและ layout ที่ใช้

- เปลี่ยนจากเขียว/ครีมเป็น sidebar navy #151c3b, primary indigo #3e43c8, lavender surfaces และการ์ดสีขาว
- โลโก้ globe+people แบบ SVG วาดใหม่ในโครงการ พร้อมชื่อ Global Opportunity OS
- เดสก์ท็อปใช้ sidebar, topbar ภาษา/แจ้งเตือน และ workspace; มือถือใช้เมนูยุบ/ขยายและ bottom navigation
- ผู้ใช้มี greeting/avatar สมมติ, search, hero, 4 category shortcuts, AI callout, cards และ progress ring
- พันธมิตรมี org header/badge สมมติ, 4 KPI cards, line/area chart, activity และ case queue
- Admin มี period/geography filters, 4 KPI, world-map illustration/legend และ donut chart
- เส้นทาง 6 ขั้นจาก profile → needs → guidance → review → progress → outcomes สะท้อน user journey ในภาพ

ไม่ได้คัดลอกภาพบุคคล/รูปถ่ายจริงจากภาพอ้างอิง ใช้ตัวอักษร avatar และ SVG landscape/figure วาดใหม่
ไม่มี external fonts/images/tracking; แผนที่เป็นภาพสื่อแนวคิด ไม่ใช่การรับรองพื้นที่บริการจริง
ไม่อ้าง pixel-perfect หรือใช้ตัวเลข 2,476,312/128,703 จากภาพเป็นสถิติของระบบ

## Feature ในภาพ → ต้นแบบรอบนี้ → ระบบจริง

| Feature ในภาพ | กดทดลองอะไรได้ตอนนี้ | ระบบจริงตามแผน |
| --- | --- | --- |
| สมัคร/สร้างโปรไฟล์ | เปิด profile ตัวละครสมมติและอ่านขอบเขต privacy ไม่มี signup จริง | S1 verified auth/minimal profile/recovery/age gate |
| ประเมินความต้องการ | เลือกเป้าหมาย 3 แบบ กดยืนยันแล้วได้ลิงก์ตัวกรองที่ตรงกัน ไม่จัดเก็บ | S2 confirmed assessment + skippable sensitive questions |
| AI แนะนำโอกาส | แสดงคำแนะนำตัวอย่างจากกฎพร้อมข้อจำกัดและ manual search ไม่มี model | S5 RAG/citations/eval/consent/vendor |
| ค้นหางาน/หลักสูตร/บริการ | public search/filter/detail/current/expired/suspended/no-results จาก fixtures | S2 verified catalog/revision/source/eligibility/capacity |
| สมัคร/ติดตามสถานะ | เปิด applications/referrals queue สมมติ ดูรายละเอียดแล้วปิดได้ ไม่มี submitจริง | S3 preview/share/atomic submit/outbox; S4 warm referral |
| My Plan | ดู progress 3/5 แล้วจำลองทำขั้นต่อไปเป็น 4/5 ในหน้าเดียว | S2 needs baseline; S3/4 event-based plan/progress |
| ขอความช่วยเหลือ/ส่งต่อ | ดูหน้าการส่งต่อสมมติ ไม่สร้างเคสหรือส่งข้อมูล | S3/4 recipient-specific consent/assignment/safety |
| ข้อความ/แจ้งเตือน | เปิดแจ้งเตือน กดอ่านแล้วซ่อน และดูหน้า updates แบบ structured ไม่มี DM | S3 generic in-app/email ไม่ใช้ open chat |
| หลายภาษา/accessibility | ไทย/อังกฤษ เปลี่ยนภาษาแล้วคง section/filter, keyboard, labels, skip/focus/reflow tests | S6 ต้อง manual NVDA/VoiceOver/Thai usability/low bandwidth |
| Partner/manage opportunities/team/verification | เปิดเมนูย่อย ดู catalog/team และจำลองขอข้อมูลเพิ่มในหน้า | S1/S2 auth/RBAC/verification workflow จริง |
| Admin/review/metrics/security/settings | เปิดเมนูและกรอง KPI ตัวอย่าง เปิด/ปิดตัวอย่าง setting | S1–S5 backend scopes, MFA, audit, privacy-safe metrics |

ทุก state ในต้นแบบอยู่ในหน่วยความจำหน้าเว็บ ไม่มี localStorage/sessionStorage/cookie หรือ server mutations
ออกจากหน้า/refresh แล้วการบันทึก เป้าหมาย และ setting จะ reset ต้องไม่ถือเป็นโปรไฟล์จริงหรือความยินยอมจริง
saved view ให้ลองบันทึกรายการในหน้านั้นได้ ไม่อ้างการ sync ข้ามหน้า/อุปกรณ์
การเปลี่ยน role เป็น navigation ของ demo ทุกคนเปิดได้ ไม่ใช่ login/authorization และไม่มีข้อมูลจริงให้เปิด

## เกณฑ์ตรวจต้นแบบรอบนี้

| UX ID | เกณฑ์ตรวจที่ต้องเห็น |
| --- | --- |
| UX-01 | ทั้งสาม role มี landmark/h1 ภาษาและข้อความสมมติที่ชัด ไม่มี network requests ภายนอก |
| UX-02 | sidebar ทุกเมนูไปหน้าที่มีเนื้อหา ไม่เป็นลิงก์เสีย; role/language switch ใช้คีย์บอร์ดได้ |
| UX-03 | home cards/shortcuts ไป directory/detail และค้นหายังได้ทั้งสองภาษา |
| UX-04 | assessment confirm, plan step, bookmark, case detail, verification simulation, notifications และ admin filters ทำงานในหน้า |
| UX-05 | เปิดที่ 320 CSS px ไม่มี horizontal overflow ของหน้า; ตารางเลื่อนภายใน wrapper ได้ |
| UX-06 | axe ตาม WCAG tags ผ่านเส้นทางที่ตรวจ และมี focus/label/icon names; ไม่อ้างแทน manual audit |
| UX-07 | ภาพหน้าจอเดสก์ท็อปสาม role และมือถือสำหรับทบทวน; ต้องระบุสิ่งที่ไม่เหมือน reference |

ตรวจ automated ตาม PROTOTYPE_REPORT_TH.md; semantic correctness ของคำแปล รูปจริงที่ได้รับอนุญาต
manual screen-reader/zoom และการทดสอบกับผู้ใช้ยังต้องทบทวน ไม่เติมสถานะผ่านเอง
