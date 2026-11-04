# รายงานต้นแบบ 3 มุมมองหลังเทียบ Blueprint

> รายงานนี้เป็นหลักฐานต้นแบบก่อน C-11; สถานะ Auth/DB ปัจจุบันดู [รายงาน S1](S1_REPORT_TH.md)

วันที่ 2026-11-04 สาขา `feat/blueprint-ux-alignment`
ฐานเอกสาร main `b21613dd7b29f9856828f81dd86ca5755d2091a0`
เก็บชิ้นงานเดิมใน local commit `3906306` และรวม main ใน `60de51e`; UX รอบปัจจุบันยังเป็น working changes ต่อจากนั้น
ไม่มีการ push, สร้าง PR ภายนอก, เปลี่ยน Vercel Project, paid provisioning หรือ deployment

## ขอบเขตและหลักฐาน

เจ้าของขอเทียบ docs/Global-Opportunity-OS-Product-Blueprint-TH.md กับภาพ Showcase และเลือก
“ปรับต้นแบบ 3 มุมมองและแผนทุก Phase ก่อน (แนะนำ)” จึงดำเนินตาม C-10 ไม่ขยายเป็น backend โดยไม่ขอ
อ่าน Blueprint ฉบับเต็ม/เอกสารประกอบและ AGENTS.md จาก main แล้วรวมเข้าคลังงานโดยรักษาประวัติเดิม
ตรวจ byte ของ Blueprint ตรง main: SHA-256 `d7017db9c54fa7917f19ff26fddedc393847d85b3b63dce1e6684b6130ed329e`

ใช้เอกสารแนบเป็นข้อกำหนดอ้างอิง ไม่ถือว่าคำสั่งภายในเอกสาร/illustrative SQL/ตัวเลข SLA
อนุญาตให้รัน migration, จัดซื้อบริการ หรือรับข้อมูลส่วนบุคคลจริง เกณฑ์ P/D ยังไม่กลายเป็น approved policies
ข้อแตกต่างและการแยก SP/BP/LEG IDs อยู่ใน BLUEPRINT_ALIGNMENT_TH.md และ DECISIONS.md

## พฤติกรรมที่เปลี่ยนจริง

- เปลี่ยนดีไซน์เขียวเดิมเป็น navy/indigo/lavender ตามโครงภาพ โดยใช้ CSS tokens เดิม ไม่เพิ่ม framework
- ผู้ใช้: welcome/search/hero, quick categories, 3 opportunity cards, bookmark ในหน้า, goals assessment/confirm,
  plan progress 3/5→4/5, applications/referrals example, updates และ profile/privacy example
- พันธมิตร: org header, 4 KPI, trend chart, activities, case queue เปิด/ปิดรายละเอียด, catalog/team/verification/settings
  กดขอข้อมูลเพิ่มได้เฉพาะ state สมมติในหน้า ไม่มีการส่งข้อความ
- Admin: 4 KPI พร้อมตัวกรอง country/period สำหรับ KPI; map/donut ของชุดสมมติรวมมีป้ายระบุ scope แยก
  เมนู organizations/review/catalog/AI/impact/security/settings ไม่เปิดข้อมูลจริง
- sidebar และ bottom nav มือถือ; drawer เปิด/ปิดด้วยคีย์บอร์ด Escape คืนโฟกัสปุ่มเปิด
- เปลี่ยนภาษาคง section/filter/item; ทุกเมนูมีหน้าให้ดู ไม่สร้างลิงก์ตายเพื่อทำให้ภาพดูครบ
- directory เดิมย้ายไป /th/opportunities และ /en/opportunities; เพิ่มงานสมมติสำหรับผู้ใหญ่ 1 รายการ
  รวม fixtures 5 รายการ (ปัจจุบัน3/หมดอายุ1/ระงับ1) รายละเอียดเดิมและ 404 ยังใช้ได้
- logo, icons และ hero/map/trend เป็น SVG ในโครงการ ไม่โหลดรูป/ฟอนต์ภายนอก ไม่มีบุคคลหรือสถิติจริง

## ผลตรวจรอบสุดท้ายที่รันจริง

Next build ID: `xazws-vJDGJbpS5ItFrwp`
เครื่อง Debian 13, Node 24.22.1, npm 11.9.0, Chromium ระบบ 155.0.8059.79
ใช้ dependency/lockfile เดิมที่ผ่าน npm ci ในรอบก่อน ไม่อ้างว่าติดตั้งใหม่หรือ npm audit ใหม่ในรอบนี้

| คำสั่ง/การตรวจ | ผลล่าสุด |
| --- | --- |
| npm run typecheck | ผ่าน next typegen และ tsc |
| npm run lint | ผ่าน |
| npm run test:unit | ผ่าน 29 กรณี จาก 2 ไฟล์ |
| npm run build | ผ่าน production build ในเครื่อง |
| npm run test:e2e | ผ่าน 20 กรณี สองภาษา รวมทุกเมนูสาม role, assessment/save/progress/queue/filter, 404 และ keyboard drawer |
| npm run test:a11y | ผ่าน 24 กรณี รวม axe ทั้งสาม role บน desktop/mobile และ reflow 320px; หน้าภาวะ error/empty/detail และ form examples |
| npm run check | exit 0 รวมทดสอบ 73 กรณี ไม่มี skipped/expected-failure แทนผลผ่าน |
| ตรวจภาพ | 6 ภาพ: 3 role × desktop1440×1000/mobile375×900; บันทึก build/viewport ใน ux-review/capture.json |
| ตรวจเอกสาร | ลิงก์ภายใน/Phase S0–S6/module24รายการ/Blueprint ตรง main และ git diff --check |

## ปัญหาที่พบและแก้ ไม่ซ่อนเป็น passing tests

รอบแรก browser tests พบค่าคาดหวัง Asia ยังอิง fixture เดิมหนึ่งรายการ แต่เพิ่มงานสมมติแล้วเป็นสองรายการ
แก้ expectation ให้ตรง fixture ใหม่โดยยังตรวจการกรองจริง ไม่ลดการตรวจ
พบ Suspense ที่ครอบทั้ง workspace ทำให้ not-found streaming ส่ง HTTP200 จึงย้าย boundary ไปเฉพาะ nav/language
คงข้อทดสอบว่า unknown listing ต้องตอบ404 และรันผ่านแล้ว
axe พบ footer contrast4.46:1 ต่ำกว่า4.5:1 จึงเปลี่ยนสีให้เข้มขึ้น ไม่ปิดกฎ
ข้อทดสอบโฟกัสที่เพิ่มใหม่เลือกปุ่มปิดสองตำแหน่งชื่อเดียวกัน จึงจำกัด selector ไปปุ่มใน sidebar โดยคง assertion การโฟกัส/Escape
ทั้งหมดรันซ้ำผ่านชุดสุดท้าย ไม่เอาผลรันที่ล้มเหลวมานับว่าผ่าน

## ข้อจำกัดที่ยังอยู่

นี่เป็น interactive UX prototype ไม่ใช่ full MVP: ไม่มี auth/RBAC enforcement, Supabase, RLS, storage scan,
real consent/application transactions, outbox/email, actual AI/RAG, outcome verification หรือ privacy purge
role switch ทุกคนเปิดได้ ไม่ใช่การทดสอบ tenant/permission security ไม่เอา unit allowlist ของ nav ไปอ้างว่า DB ปลอดภัย
ข้อมูลและ state อยู่ในหน่วยความจำหน้าเว็บ refresh/เปลี่ยนหน้าแล้ว reset; ไม่มี persistence/account sync
metrics/chart/map เป็นข้อมูลสมมติ ไม่อ้างบริการ/พื้นที่ปฏิบัติการจริง ไม่แสดงสถิติจากภาพว่าเป็นยอดของเรา

อิงองค์ประกอบ/โทนภาพ ไม่ใช่ pixel-perfect; avatar อักษรและภาพประกอบ SVG วาดใหม่แทนรูปบุคคล/ภาพถ่ายต้นฉบับ
plain CSS/root app ยังต่างจาก Tailwind/monorepo reference ตาม ADR-001; ไม่อ้างว่าได้ architecture ระบบจริงครบแล้ว
ยังไม่ทดสอบ NVDA/VoiceOver/ซูมด้วยคน คุณภาพคำแปลกับผู้ใช้จริง constrained network/load/restore และ Firefox/WebKit
ไม่มี AI eval หรือ BP-AC-02–20 ของระบบจริงที่ผ่านเพียงเพราะต้นแบบผ่าน 73 tests
รายงานเดิม 49 tests เป็นประวัติคนละขอบเขต ไม่บวกซ้ำเป็น122testsหรือถือว่าผ่าน full Blueprint

## ภาพเพื่อทบทวน

| มุมมอง | เดสก์ท็อป | มือถือ |
| --- | --- | --- |
| ผู้ใช้ | [เปิดภาพ](ux-review/beneficiary-desktop.png) | [เปิดภาพ](ux-review/beneficiary-mobile.png) |
| พันธมิตร | [เปิดภาพ](ux-review/partner-desktop.png) | [เปิดภาพ](ux-review/partner-mobile.png) |
| ผู้ดูแล | [เปิดภาพ](ux-review/admin-desktop.png) | [เปิดภาพ](ux-review/admin-mobile.png) |

ภาพแสดงข้อมูลสมมติทั้งหมด และเป็น snapshot ของสถานะเริ่มต้น ไม่พิสูจน์ business mutations หรือสิทธิ์จริง

## งานถัดไป

ทบทวน UI กับ [UX spec](UX_SPEC_TH.md) และ [ตารางเทียบ](BLUEPRINT_ALIGNMENT_TH.md)
จากนั้นทบทวน [แผน S0–S6 และ functions/features ทุกโมดูล](PHASE_PLAN_TH.md)
ก่อนระบบจริงต้อง disposition D-01–04 ส่วนที่เกี่ยวข้อง ทำ auth/RLS spike และ OpenAPI ตาม S0
การอนุญาตต้นแบบไม่อนุญาตให้เปิด real-data pilot หรือ deploy production
