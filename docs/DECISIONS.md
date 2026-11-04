# ทะเบียนการตัดสินใจที่ปรับตาม Blueprint

วันที่ 2026-11-04 ใช้รหัส C/P ของ main เป็นฐาน ไม่ใช้รหัสเดียวกันกับบันทึกเซสชันเก่าโดยไม่บอก
ต้นฉบับ main เก็บที่ [ทะเบียนต้นฉบับ](archive/MAIN_DECISIONS_SOURCE.md)
บันทึกเซสชันเก่าอยู่ที่ [ทะเบียนก่อน Blueprint](archive/PRE_BLUEPRINT_DECISIONS.md) โดยเติม LEG- หน้ารหัสเดิม
C คือหลักฐานการตัดสินใจ P คือข้อเสนอ G คือเกณฑ์ที่เสนอ; ข้อความ “ต้อง” ใน Blueprint ไม่ใช่การรับรองนโยบายหรือผลทดสอบ

## สิ่งที่ยืนยันแล้ว

| รหัส | ข้อยืนยัน | หลักฐาน/ขอบเขต |
| --- | --- | --- |
| C-01 | เว็บแอปเพื่อสังคมที่มีพันธกิจระยะยาวทั่วโลก | ทะเบียน main เดิมและคำสั่งเจ้าของในเซสชัน |
| C-02 | ครอบคลุมผู้รับประโยชน์ทุกกลุ่ม ไม่จำกัดพันธกิจเป็นกลุ่มเดียว | ทะเบียน main เดิมและคำสั่งเริ่มงาน |
| C-03 | สร้างรายได้ที่ยั่งยืนสำหรับผู้ก่อตั้งและแพลตฟอร์ม | ทะเบียน main เดิมและคำสั่งเริ่มงาน |
| C-04 | เจ้าของแจ้งว่ามี GitHub repo และเชื่อม Codex แล้ว | ตรวจอ่าน main จาก origin สำเร็จในเซสชันนี้; ไม่อ้างสิทธิ์เขียนหรือ deployment |
| C-05 | ใช้ชื่อ Global Opportunity OS | ทะเบียน main เดิมและชื่อผลิตภัณฑ์ที่เจ้าของอ้าง |
| C-06 | ทะเบียน main เดิมยืนยันการส่ง starter pack เอกสาร/โครง repo ไม่อ้างว่ามีแอปในแพ็กนั้น | รักษาประวัติจาก main; ปัจจุบันมีโค้ดต้นแบบเพิ่มแล้ว |
| C-07 | แชตและเอกสารที่เขียนใหม่เป็นภาษาไทย คง technical terms/commands ที่จำเป็น | คำสั่งเจ้าของวันที่ 2026-11-04 |
| C-08 | ก่อนหน้าอนุมัติไดเรกทอรีไทย–อังกฤษ Next.js/React/TypeScript/npm ข้อมูลสมมติ และฐาน S0 ชั่วคราว | เจ้าของ: “ผมเลือกตามที่คุณแนะนำทั้ง 4 เรื่องเลยครับ”; ใช้เป็นประวัติ ไม่ถือว่า S0 ครอบคลุม Blueprint |
| C-09 | เลือก Vercel และแจ้งว่าเชื่อม GitHub repository แล้ว | เจ้าของ: “ผมจะใช้ Vercel ในการ deploy โดยผมได้ link กับ Github repo เดียวกันไว้แล้ว”; ไม่ได้อนุญาต push/deploy production |
| C-10 | ใช้ Blueprint TH v1.0 บน main และภาพ UX Showcase เป็นฐานเทียบ; รอบก่อนปรับต้นแบบ 3 มุมมองและแผนทุก Phase | คำสั่งล่าสุดและคำตอบ: “ปรับต้นแบบ 3 มุมมองและแผนทุก Phase ก่อน (แนะนำ)” |
| C-11 | อนุมัติดำเนินขั้นที่ 1–4: ตรวจ/ปรับต้นแบบ ปิดรายละเอียด S0 ที่ทำได้ ทดลองฐาน Auth/server/DB/RLS และพัฒนา S1; login ด้วย Email และ Google Account | เจ้าของวันที่ 2026-11-04: “ขอให้ดำเนินการตาม ขั้นที่ 1-4 ได้เลย, โดยการ login ให้เป็นแบบ Email และ Google Account”; Email ใช้รหัสผ่านเป็นค่าเริ่มต้นในการพัฒนา ไม่เปลี่ยนไป OTP-only โดยปริยาย |
| C-12 | เจ้าของมี Supabase Project อยู่แล้ว และจะใส่ URL/keys ผ่าน Environment Settings | คำตอบเจ้าของ: “มีแล้ว จะตั้งค่า URL/keys ผ่าน Environment Settings”; ไม่อนุญาตให้รัน migration กับ Project ระยะไกลโดยไม่ทราบว่าเป็น dev/staging/prod |

| C-13 | เจ้าของแจ้งว่าตั้ง Google Provider ใน Supabase/Google Cloud แล้ว | ข้อความเจ้าของ: “ผมตั้ง provider ใน Supabase/Google Cloud แล้วครับ”; ยังไม่ได้ยืนยัน remote settings หรือ OAuth round-trip จากแอป |

| C-14 | Supabase Project ที่ตั้ง Provider เป็น Project ใช้งานจริงหรือมีข้อมูลจริง | คำตอบเจ้าของ “ใช้งานจริงหรือมีข้อมูลจริงอยู่แล้ว”; เป็นข้อมูลสถานะ Project; ข้อจำกัดให้ใช้ local ที่บันทึกตอนนั้นถูกปรับโดย C-15 ด้านล่าง |

| C-15 | เจ้าของอนุญาตใช้ Supabase Project เดิมทดสอบได้ และให้เคลียร์ข้อมูลทดสอบก่อนขึ้น production | ข้อความล่าสุด “ใช้งานจริง แต่สามารถใช้ได้เลย โดยไว้เราค่อยเคลียร์ข้อมูลทดสอบออกก่อนขึ้น production”; ใช้เป็นอนุญาตทดสอบและเตรียม S1 บน Project นี้หลังตรวจของเดิม ไม่ใช่อนุญาตล้างข้อมูลเดิม/production deployment; การเชื่อมต่อและ migration operator ยังไม่พร้อมใน runtime |

| C-16 | เจ้าของแจ้งว่าตั้ง URL/publishable key/APP_ORIGIN ใน Cloud Environment ของแชตนี้แล้ว | คำตอบล่าสุดระบุตำแหน่งแล้ว; runtime ที่ตรวจยังเป็น config รุ่นเดิมและยังไม่เห็น 3 ค่า ไม่อ้างว่าเชื่อม Project แล้ว |
| C-17 | อนุญาตให้ agent สร้าง/ปรับโครงสร้างและข้อมูลใน Supabase เอง และ push/deploy production ของ S1 | คำสั่งล่าสุดข้อ 2–3: “สร้าง ปรับแก้ โครงสร้าง และ ข้อมูล ใน Supabase ได้เองเลย” และ “push และ deploy production เลย”; ไม่ต้องขออนุญาต push/deploy ซ้ำ ขอบเขตคือ S1/ข้อมูลทดสอบที่กำลังทำ ไม่ใช่ลบข้อมูลเดิมเหมารวมหรืออ้างว่า MVP ทุก Phase พร้อมแล้ว |

| C-18 | เมื่อจบแต่ละ prompt ให้แสดงงานที่เหลือใน Phase ปัจจุบันหรือ Phase ถัดไปเพื่อให้เจ้าของตัดสินใจสั่งต่อ | คำสั่งเจ้าของวันที่ 2026-11-04 ข้อ 2; ใช้กับแชต/เอกสารที่สรุปงาน ไม่ขยายขอบเขต Phase ใหม่โดยปริยาย |

## ข้อยืนยันเพิ่มเติมรอบ knowledge และหน้าแรก

| รหัส | ข้อยืนยัน | หลักฐาน/ขอบเขต |
| --- | --- | --- |
| C-19 | นำ knowledge ทั้งสารบัญมาออกแบบใช้กับ Opp4All และลงมือฐาน branding/live/ส่วน S1 ที่ค้าง | เจ้าของคำสั่งข้อ 1–4; defaults ใช้ไฟล์โลโก้/favicon ใน docs ของ main; ความสามารถ AI/LINE/automation/domain S2–S6 แสดงเป็นแผน ไม่ถือว่าต้องสร้างทุก Phase ใน S1 หรืออนุมัติ vendor/ข้อความภายนอก |
| C-20 | กำหนดอีเมลที่เจ้าของแจ้งในแชตเป็น protected platform owner คนแรก | เก็บ designation แบบ salted hash ใน private DB ไม่ commit อีเมล/สร้าง fake verified account; เจ้าของต้อง verified login ด้วยบัญชีที่ระบุแล้วทำ MFA ก่อนใช้สิทธิ์ผู้ดูแล |
| C-21 | ปรับหน้าแรกทุก role ตามภาพ RooSuk ด้วยการ์ดขนาดต่างกันและภาพประกอบใหม่ | คำสั่งข้อ 5; คงธีม Opp4All และ mobile bottom bar; ใช้กับ demo สามมุมมองและหน้าบัญชี/ผู้ดูแลจริง ไม่เพิ่มฟังก์ชันสุขภาพ/ร้านค้าในภาพ |
| C-22 | เจ้าของตั้ง Confirm email เป็น Off ไว้ชั่วคราว | เจ้าของแจ้งว่า “การ login ด้วย email ผมตั้งค่า Confirm email เป็น off ไว้ก่อน”; ตรวจ Management API ตรงกัน; คงค่าที่เจ้าของเลือก ไม่เปิดกลับอัตโนมัติ สมัครที่ provider ส่ง session กลับมาให้ bootstrap/เข้าใช้ได้ทันที ไม่ถือว่าได้พิสูจน์การครอบครอง mailbox; SMTP ยังจำเป็นสำหรับ recovery และ confirmation เมื่อเปิดกลับ |

ดู [mapping knowledge](KNOWLEDGE_ADOPTION_TH.md) และ [ADR-003](adr/ADR-003-PLATFORM-TH.md)
คำสั่ง C-17 ครอบคลุมการนำชิ้นงานนี้ขึ้น production แต่ไม่ใช่การรับรอง real pilot หรือ BP-G0–G6

## ข้อเสนอหลักจาก main และสถานะปัจจุบัน

| รหัส | ข้อเสนอเดิม | สถานะ/ขอบเขต |
| --- | --- | --- |
| P-01 | ผู้รับประโยชน์เข้าถึงพื้นฐานฟรี รายได้ B2B ไม่ขายข้อมูลส่วนบุคคล | หลักออกแบบของต้นแบบ ไม่ใช่โมเดลราคาหรือสัญญาที่รับรองแล้ว |
| P-02 | Navigator + directory + partner cases + basic impact ก่อน | ใช้เป็นทิศทาง Blueprint; ต้นแบบไม่ใช่ full MVP |
| P-03 | ไทย ไทย/อังกฤษ และ adult personalized pilot | ไทย/อังกฤษยืนยันใน C-08; ประเทศ pilot/การรับข้อมูลจริงยังต้อง D-01/D-03 |
| P-04 | Next.js/TypeScript/Tailwind + Supabase/PostgreSQL แบบ modular monolith | Next/TypeScript อนุมัติแล้ว; ใช้ root app/CSS tokens เดิม; C-11 อนุมัติ Auth/backend S1 ในเครื่องแล้ว ตาม ADR-002; Tailwind/monorepo ยังไม่อนุมัติให้ย้าย |
| P-05 | Vercel/Netlify, model และ region ยังไม่เลือก | เลือก Vercel ตาม C-09; database region/plan, AI vendor และเงื่อนไขข้อมูลยังไม่เลือก |
| P-06 | pilot 90 วัน 3–5 พันธมิตร 100 รายการ | สมมติฐานทดลอง ไม่ใช่ผลจริง/กำหนดส่ง |
| P-07 | ราคา B2B/ประมาณการรายได้เดิมเป็นการทดลอง | ยังไม่อนุมัติราคา/การเรียกเก็บ |
| P-08 | โครงสร้างกิจการและ license | ยังต้องเจ้าของ/ที่ปรึกษาเลือกก่อนสัญญาหรือเปิดเป็นโอเพนซอร์ส |
| P-09 | ปิด minor personalization จนผ่าน safety gate | S1 มีบัญชีทดสอบสมมติผู้ใหญ่เท่านั้น; API/DB ปฏิเสธ minor/unknown profile; กระบวนการเด็กจริงยังไม่อนุมัติ |
| P-10 | ไม่รวม wallet, lending, diagnosis, donations ที่ควบคุมไม่ได้ หรือ open minor labor market | คงข้อจำกัด ไม่เพิ่มตามภาพ |
| P-11 | ผู้รับผิดชอบ operations, เวลาตอบ และระยะเก็บ | ยังต้องระบุทีม/นโยบายก่อน pilot |
| P-12 | AI optional, server-side, grounded; ไม่ตัดสินเดิมพันสูงอัตโนมัติ | แผน Phase 5; UI ต้นแบบเป็นตัวอย่างอธิบายกฎ ไม่มี model จริง |
| P-13 | ซ่อนกลุ่มเล็ก n<10 เป็นฐาน ไม่ใช่หลักฐานว่าเป็น anonymous | แผนรายงานจริงต้อง D-10; ตัวเลขต้นแบบเป็น fixtures ไม่เปิดข้อมูลบุคคล |
| P-14 | ขยายประเทศหลังความพร้อมพื้นที่จริง | ระยะหลัง MVP ไม่อ้างว่าการเปิดเว็บแปลว่าให้บริการทั่วโลกแล้ว |

## สิ่งที่ต้องตัดสินใจก่อนระบบจริง

ใช้ D-01 ถึง D-12 และ G0–G6 จาก Blueprint โดยอ้างเป็น BP-D-*/BP-G* ในแผน เพื่อไม่ชนรหัสของ starter pack
C-10 เดิมอนุมัติต้นแบบ; C-11 เพิ่ม S0/S1 สำหรับการพัฒนาและข้อมูลสมมติ แต่ยังไม่อนุมัติราคา SLA retention สูตรคะแนน
vendor contract, real beneficiary processing, minor workflow, paid provisioning หรือ external partner messages
C-17 เพิ่มอนุญาตการจัดการ Supabase และ push/deploy production ของชิ้นงาน S1 แล้ว ไม่ต้องอนุมัติซ้ำ
D-02 มีผลทดลอง Auth→BFF→user JWT→RPC/RLS บน local stack แล้วตาม S1_REPORT_TH; ยังไม่ปิด region/PITR/ต้นทุน หรือรับรอง hosted execution

การเลือกทางเทคนิคที่ย้อนกลับได้ภายใน C-11: Email+password, Google PKCE, HttpOnly cookies,
user-JWT RPC และ role/RLS ตาม ADR-002; ค่า delegation 90 วัน/คำเชิญ 7 วันและ notice เป็น dev assumptions
ไม่ใช่นโยบาย production ที่เจ้าของรับรอง และไม่อนุมัติ P-* ที่เหลือแทนเจ้าของ

## กติกาอ้างอิงไม่ให้รหัสชนกัน

- SP-REQ-* / SP-AC-* = PRODUCT_REQUIREMENTS.md / ACCEPTANCE_CRITERIA.md จาก main
- BP-MOD-* = รหัสโมดูลใน Blueprint §5; BP-AC-* = เกณฑ์ใน Blueprint §16 (คนละชุดกับ SP-AC)
- BP-B-* / BP-D-* / BP-G* = backlog/decision/release gate จาก Blueprint
- S0-* และ LEG-C/P/G-* = ประวัติแผนเซสชันก่อนเห็น main ล่าสุด ไม่ใช่หลักฐานผ่าน Blueprint
- G-* ของ RELEASE_GATES.md เป็นข้อเสนอของ starter pack แยกจาก BP-G0–G6
