# ผลตรวจเทียบ Blueprint, main และภาพ UX

> ผลเทียบนี้บันทึกรอบ prototype C-10; C-11 เพิ่ม S0/local spike/S1 ดู [รายงาน S1](S1_REPORT_TH.md)

วันที่ 2026-11-04 แหล่งหลักคือ docs/Global-Opportunity-OS-Product-Blueprint-TH.md v1.0
จาก origin/main commit `b21613dd7b29f9856828f81dd86ca5755d2091a0` ดึงด้วย git fetch แบบไม่ checkout ทับงานเดิม
ไฟล์ Blueprint ใน checkout ตรง byte กับต้นฉบับ commit นี้ ไม่แก้เนื้อหาต้นทางเพื่อให้ดูว่าชิ้นงานผ่านแล้ว
ภาพอ้างอิงคือ Global Opportunity OS UX Showcase.png ที่เจ้าของแนบในแชต
เส้นทาง C:/Users/... เป็น path บนเครื่องเจ้าของ ไม่ใช่ไฟล์ที่แอปอ่านได้และไม่ได้เข้าถึง Dropbox ของเจ้าของ

## ข้อสรุปตรงไปตรงมา

ชิ้นงานก่อนรอบนี้ **ไม่ตรงทั้งหมด**: เป็น public directory ชิ้นเล็ก ใช้โทนเขียว/ครีม
ไม่มี dashboard ผู้ใช้/พันธมิตร/admin จึงไม่เหมือนภาพ และยังไม่มี core loop ส่วนใหญ่ของ Blueprint
ไม่ควรเรียกชิ้นงานนั้นว่า full MVP หรืออ้างว่าผลทดสอบ 49 กรณีเดิมครอบคลุม Blueprint

เจ้าของเลือกให้รอบนี้ “ปรับต้นแบบ 3 มุมมองและแผนทุก Phase ก่อน” ตาม C-10
จึงแก้ทิศทางต้นแบบและแผนครอบคลุม Blueprint โดยไม่สร้างระบบจริงทั้งหมดเงียบ ๆ
ภาพเป็นเป้าหมายองค์ประกอบ/ภาษาภาพ ไม่ใช่หลักฐานสถิติจริง บัญชีบุคคลจริง หรืออนุมัติสิทธิ์ admin แบบกว้าง

## ตารางเทียบก่อนแก้ → รอบปัจจุบัน → ระบบจริงในอนาคต

| หัวข้ออ้างอิง | ก่อนรอบนี้ | การปรับต้นแบบรอบนี้ | ระบบจริง/Phase |
| --- | --- | --- | --- |
| BP §2 global/all-groups + sustainable business | มีข้อความพันธกิจ แต่มีเพียง directory | รักษาพันธกิจ; มีโอกาสงานผู้ใหญ่ ทักษะ และช่วยเหลือสมมติ; ไม่เก็บเงินผู้รับประโยชน์ | S0 ระบุ pilot/โมเดลทดลอง ไม่เท่ากับเปิดทั่วโลก |
| ภาพมุมผู้ใช้ + BP §11 | หน้า search สีเขียว ไม่มี home dashboard | sidebar navy, welcome/search, hero, category shortcuts, recommendations, progress และ mobile bottom nav | S0 UX → S1/S2 UI จริง |
| สมัคร/โปรไฟล์ ID-01/02 | ไม่มี | ดูตัวละครสมมติ/ข้อมูล privacy ไม่มีแบบฟอร์มเก็บ PII | S1 auth/profile/delegation |
| NA-01 / MA-01 | ไม่มี assessment/matching | เลือกเป้าหมายสมมติและลิงก์ค้นหาด้วยกฎ ไม่อ้าง score/AI จริง | S2 assessment/bookmarks/rules |
| DI-01/02 + SP-REQ-01/04 | fixture directory เท่านั้น | คง search/filter/detail/empty/expiry/suspend และย้ายเส้นทางให้รองรับ dashboard | S2 verified organization/revision/source/capacity จริง |
| AP-01 / CM-01 / NO-01 | ไม่มี | ใบสมัคร/คิวเคส/การส่งต่อ/แจ้งเตือนเป็น records สมมติและรายละเอียดเปิดปิดในหน้า | S3–S4 transactions, consent, outbox, notes ACL |
| ภาพ Partner Portal + BP §12 | ไม่มี | dashboard องค์กรสมมติ 4 KPI, trend, activity, queue; เมนู catalog/team/verification/report/settings | S2–S5 workflow จริงตามบทบาท ไม่ใช่ owner อ่านทุกเคส |
| ภาพ Admin + BP §12 | ไม่มี | overview, filters, metric cards, map/donut, verification/catalog/AI/security panels | S1 สิทธิ์ → S2 queues → S4 safety/privacy → S5 metrics |
| AI-01 / BP §9 | ไม่มี | หน้าตัวอย่างคำแนะนำจากกฎพร้อม manual search; ไม่มี model/API/อ้าง AI ทำงานแล้ว | S5 grounded RAG/evals/kill switch |
| IM-01 / BP §15 | ไม่มี | ตัวเลขเล็กที่สร้างขึ้นเพื่อ demo มี period/timezone/version; ไม่ใช่ยอดจริง | S4 evidence → S5 aggregates/suppression |
| BP §3/7/8 Supabase/RLS/BFF | ไม่มี backend | คงไม่มี backend ตามขอบเขตต้นแบบ; role switch ไม่ใช่ authorization | S0 spike → S1/S2 schema+RLS+server checks |
| BP §13 API / §14 operations | ไม่มี API spec/runtime จริง | ไม่สร้าง endpoint หลอกว่าใช้งานได้; แผนระบุ OpenAPI/contracts/jobs/load/restore | S0 spec → S1–S6 implementation/evidence |
| SP-REQ-13 / BP §11 accessibility | axe/reflow บางกรณีผ่าน | ขยาย regression ไป 3 roles สองภาษาและเส้นทางใหม่ | ทุก S; S6 ต้องมี manual assistive-tech/UAT |
| Vercel | owner แจ้งว่าเชื่อม GitHub | รักษาโครงการ root Next เดิม ไม่เปลี่ยน remote project | ยังไม่ push/deploy; production ต้องอนุญาตแยก |

## ข้อขัดกันของเอกสารและ disposition

| ประเด็น | starter pack / เซสชันเดิม | Blueprint v1.0 | วิธีใช้ในแผนใหม่ |
| --- | --- | --- | --- |
| ขอบเขต MVP | directory/referral/AI/impact; เดิมไม่มี job vertical ในชิ้นแรก | core platform + verified referral + narrow adult jobs | Blueprint เป็นฐานแผนครบ; ชิ้นงานปัจจุบันเป็น UX prototype ไม่แอบเพิ่ม jobs marketplace |
| จำนวนระยะ | เซสชันเดิม 0–5; MVP_ROADMAP เดิม S0–S5 | §17 S0–S6 | ใช้ 7 ระยะใน PHASE_PLAN_TH.md และเก็บแผนเก่าเป็นประวัติ |
| นิยาม AC | SP-AC-01–16 | BP-AC-01–20 และ BP-MOD-AC-01 เป็นรหัสโมดูล accessibility | แยก namespace ไม่เอา ID ชื่อเหมือนกันมานับแทนกัน |
| C/P/G collision | รหัสเซสชันเดิมไม่ตรง main | main มีทะเบียนอยู่แล้ว | ใช้ canonical main; archive เซสชันเก่าด้วย LEG-* และเพิ่ม C-07–10 พร้อมหลักฐาน |
| Recovery | starter 24h/24h | RPO≤1h/RTO≤4h ตาม plan ที่รองรับ | BP-D-02/11 ยังเปิด ห้ามประกาศ SLA ก่อนซื้อความสามารถและ restore drill |
| AI eval | starter 100 cases/20 adversarial | ≥200 queries และ ≥50 adversarial ใน test strategy | ใช้ Blueprint เป็น proposed gate ของ S5 ไม่อ้างต้นแบบผ่าน AI eval |
| Partner/listing validity | starter org6เดือน/listing30วัน | org12เดือน/listing≤90วันหรือ deadline ที่สั้นกว่าเป็นข้อเสนอ | BP-D-07 ให้เจ้าของปฏิบัติการรับรองก่อนข้อมูลจริง ไม่เปลี่ยน fixture2099เป็นนโยบายจริง |
| Retention | starter raw prompt off/ระยะต่างกัน | AI messages30วัน, metadata180วัน และ store-specific policy | BP-D-04/05 ยังต้อง lawful basis/vendor review; prototype ไม่มี transcript storage |
| frontend/layout | root Next + plain CSS | reference Tailwind และ proposed apps/web monorepo | รักษาของที่ทำงานได้ ไม่เพิ่ม framework เพื่อเปลี่ยนสี; ADR-001 บันทึกส่วนที่ยังต่าง ไม่อ้างครบ architecture |
| ภาพ admin แสดงคน/ตัวเลขใหญ่ | ภาพเป็น showcase | Blueprint ห้าม unrestricted PII/ตัวเลขไร้ provenance | ไม่คัดลอกยอดนับเป็นความจริง; mock metrics มีป้ายชัด สิทธิ์จริงแยกหน้าที่ภายหลัง |
| directory ตัวอย่างหมดอายุ/ระงับ | ดูได้จาก status filter เพื่อ QA | BP-AC-01 public production ต้อง current valid only | ต้นแบบดูทุกสถานะได้โดยมีป้าย demo; production serving rules ของ S2 ต้องแยก test fixture surface |

## สิ่งที่ยังไม่ได้ทำและไม่อ้างว่าตรงทั้งหมดแล้ว

ยังไม่มี auth, database, RLS, Storage/quarantine, consent transaction,โมเดล AI จริง,
case sharing, outcome verification, worker/outbox, privacy purge หรือ operations readiness
ภาพผู้ใช้และภาพ hero ในต้นฉบับไม่ได้ถูกนำมาใช้เป็นรูปบุคคลจริง ใช้ avatar ตัวอักษรและภาพประกอบ SVG ที่วาดใหม่ในโครงการ
จึงเป็นการออกแบบตาม reference ไม่ใช่การรับรอง pixel-perfect หรือการใช้ไฟล์ภาพต้นฉบับทุกส่วน
รายละเอียดการวัด UX และข้อจำกัดอยู่ใน UX_SPEC_TH.md และ PROTOTYPE_REPORT_TH.md
