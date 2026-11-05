# ขอบเขต S4 ที่เลือกเตรียมตาม C-32

เจ้าของให้เลือกขอบเขตก่อนเริ่มพัฒนา จึงแบ่งเป็น3ชิ้น review โดยใช้ข้อมูลสมมติและสิทธิ์ S3 เดิม
ยังไม่มีโค้ด S4 จากเอกสารนี้ และไม่ถือว่ารับรองนโยบายข้อมูลจริง/retention/minors

| ชิ้นงาน      | Functions/features                                                                                                                                                             | หลักฐานยอมรับ                                                                                                                       |
| ------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------- |
| S4.1 / B-401 | ผู้รับประโยชน์ preview recipient/purpose/exact fields/notice ใหม่ → consent → pending referral; ปลายทาง accept/decline, ผู้ใช้ cancel/revoke; destination case สร้างครั้งเดียว | BP-AC-07/08; idempotency/concurrent accept; sourceไม่เห็น internal notes ปลายทาง; ถอนสมาชิก/แชร์แล้วอ่านไม่ได้                      |
| S4.2 / B-402 | outcome ที่ระบุแหล่ง/เวลา/ผู้รายงาน, self-reportedแยกจาก independently reviewed; evidence quarantine; independent reviewer; dispute/correction/dedup                           | BP-AC-12/15; partnerรับรองผลตัวเองไม่ได้; ไม่อ้างผลจ้างงาน/ผลกระทบก่อนตรวจ; employer-only assertionsไม่เป็น verified outcome        |
| S4.3 / B-403 | privacy request access/export/correct/delete, identity check, routing/holds/recipient cessation/withdrawal replay; report/appeal queue แยกสิทธิ์                               | BP-AC-16/18; export deny/tenant tests, immutable request history; ห้าม purge จริงจน owner/legal กำหนด retention/holds และกู้คืนผ่าน |

ลำดับเริ่มพัฒนาที่แนะนำคือ S4.1 หลัง rollout/worker/SMTP และ hosted S1 ผ่าน
S4.2/S4.3 ต้องระบุผู้ตรวจอิสระ/ผู้รับผิดชอบ privacy/safety และนโยบายหลักฐาน/retention/holds ก่อนข้อมูลจริง
ระบบแจ้งเหตุ safeguarding ที่มีคนตอบรับจริงต้องมี roster/escalation drill; ไม่เปิด personal minor workflow จากขอบเขตนี้

## ขั้นถัดไป

ปิดงาน deployment/hosted verification ตามรายงาน rollout แล้วให้เจ้าของยืนยันเริ่ม S4.1 ตามขอบเขตข้างต้น
ข้อเสนอเรื่องนโยบายและเจ้าหน้าที่คงเป็นข้อเสนอ ไม่อ้างผลทดสอบก่อนมี implementation

## ขอบเขตหน้าจอและสิทธิ์ที่เสนอสำหรับ PR แรก

S4.1 จะเพิ่มการเริ่มส่งต่อจากเคสที่ผู้ปฏิบัติงานได้รับมอบหมาย โดยผู้ปฏิบัติงานเสนอได้แต่กดยินยอมแทนผู้รับประโยชน์ไม่ได้
ผู้ใช้เห็นองค์กรปลายทางที่ตรวจสอบแล้ว วัตถุประสงค์ รายการข้อมูลและรุ่น notice ก่อนยืนยันใหม่
ปลายทางเห็นเฉพาะข้อมูลที่ได้รับอนุญาตและรับ/ปฏิเสธคำขอได้ ไม่อ่านเคสต้นทางทั้งชุด
ไม่มีการส่งต่อหมู่ ไม่มีการเลือกข้อมูลส่วนบุคคลเพิ่มอัตโนมัติ และไม่คัดลอก internal notes หรือไฟล์ทุกชิ้นจากเคสเดิม

สถานะที่เสนอ: `pending → accepted/declined/cancelled/expired`; การถอนความยินยอมเป็นเหตุการณ์สิทธิ์แยกจากสถานะธุรกิจ
รับคำขอซ้ำ/พร้อมกันต้องสร้าง destination case เดียว พร้อม unique constraint และ idempotency key
เมื่อถอนสิทธิ์ต้องหยุดการอ่าน/ดาวน์โหลด/แจ้งเตือนต่อ ตรวจสิทธิ์ใหม่ทุก request และไม่ใช้ผล Live sync แทน authorization
ขอบเขตนี้ยังไม่ตัดสินฐานกฎหมายการเก็บประวัติหลังถอนหรือระยะเวลาถือครองข้อมูล

| ส่วน               | สิ่งที่จะทดสอบเมื่อเริ่มพัฒนา                                                                                                               |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------- |
| Consent            | preview เปลี่ยน recipient/fields/notice แล้วใช้ consent เดิมไม่ได้; ไม่บังคับยินยอมหลายองค์กรรวมกัน                                         |
| Tenant/case        | ผู้ใช้อีกคน องค์กรที่สาม สมาชิกที่ถูกถอน ผู้ไม่มี assignment และ source ที่เปิด internal notes ปลายทาง ต้องถูกปฏิเสธ                        |
| Transactions       | double submit, accept พร้อม cancel/revoke, stale version, retry หลัง timeout; ไม่มี orphan/duplicate destination case                       |
| Live/accessibility | สองหน้าต่างเห็นสถานะใหม่โดยไม่ refresh, dirty form ไม่ถูกทับ, keyboard/focus/live announcement/Thai-English/mobile/spinner ครบ              |
| Fixtures           | ผู้ใหญ่สมมติสองคน องค์กรสมมติสามแห่ง, verified/expired/suspended, accepted/declined/revoked/no-results; ไม่เติมลงฐาน hosted ที่มีข้อมูลจริง |

## สิ่งที่ยังต้องกำหนดก่อนข้อมูลจริง

- S4.1: อายุคำขอส่งต่อ ผู้รับผิดชอบติดตามกรณีไม่มีผู้ตอบ และข้อความ notice สำหรับองค์กรปลายทาง
- S4.2: ผู้ตรวจอิสระ เกณฑ์ L0/L1/L2 ประเภทหลักฐาน อายุหลักฐาน และกระบวนการโต้แย้ง; ไม่ใช้จำนวน self-reported เป็น verified impact
- S4.3: ผู้รับผิดชอบ privacy/safety ช่องทางยืนยันตัวตน SLA ตามเขตอำนาจ retention/holds/recipient cessation และ drill กู้คืน/ลบซ้ำหลัง restore
- Reports/safety: คิวจำกัดสิทธิ์และผู้รับช่วง escalation จริง; ไม่แจ้งผู้ถูกร้องเรียนอัตโนมัติหรือให้ AI ชี้ขาด

การเลือกขอบเขตโดยผู้พัฒนาในเอกสารนี้ไม่ใช่หลักฐานว่าเจ้าของยอมรับนโยบายข้างต้นแล้ว
