# พัฒนา S4 ตาม C-34

เจ้าของอนุมัติเริ่มขอบเขตใน S4_SCOPE_TH แล้ว วันที่ 5 พฤศจิกายน 2026 (เวลาไทย)
พัฒนาบน feature branch ด้วย stack/versions เดิม ไม่เพิ่มบริการหรือ dependency ใหม่

1. S4.1 / BP-B-401: source worker เสนอ ผู้ใช้ preview/consent ฟิลด์ใหม่ ปลายทางรับ/ปฏิเสธและกำหนด assignee; destination case แยกจากเคสใบสมัคร S3 เพราะมีต้นกำเนิดต่างกัน แต่ใช้บัญชี/องค์กร/สิทธิ์/หน้า workflow เดิมเชื่อมถึงกัน ทดสอบ BP-AC-07/08
2. S4.2 / BP-B-402: L0/L1 report, PNG quarantine, L2 review โดยผู้ตรวจที่ได้รับมอบหมายและไม่ใช่ผู้รายงาน/สมาชิกองค์กรนั้น, confirm/dispute/correction/dedup; ทดสอบ BP-AC-12/15
3. S4.3 / BP-B-403: access/export/correct/delete requests, identity review, holds, recipient cessation/ack, withdrawal replay, restricted reports/appeals; ไม่มี purge จริงจน policy/restore gate ผ่าน ทดสอบ BP-AC-16/18 เฉพาะส่วนที่มี implementation ไม่อ้าง full purge gate ผ่าน

RLS ใช้ metadata predicates ของ goos_authz และ public RPC ที่ทำงานเป็น goos_api ไม่มี table grants แก่ผู้ใช้
ข้อมูลข้อความ/preview/package/note เข้ารหัสด้วย key เดิมของ S3; audit/events เป็น append-only และไม่ใส่ narrative
เจ้าหน้าที่ impact/privacy/safety ต้องมี scope ที่ยังไม่หมดอายุ + MFA + resource assignment; platform admin จัดคิวได้แต่ไม่มีสิทธิ์อ่านเนื้อหาโดยอัตโนมัติ
Live sync ใช้ account signals/fingerprint เดิม ตรวจสิทธิ์ทุก request รวม downloads/exports และไม่ทับ dirty forms
ใช้ BusyForm/busyFetch/BusyLink/DownloadLink เดิม พร้อม typography/color tokens และข้อความไทย–อังกฤษ

S4_ENABLED ปิดโดยค่าเริ่มต้น; production migrations/flags/deploy S4 เป็นงาน release หลัง review ไม่เปลี่ยน production จากการเริ่มพัฒนารอบนี้
notice/TTL ที่ใช้ทดสอบติดป้าย development ไม่ยืนยัน legal policy การเก็บข้อมูลจริง
SMTP/hosted S1/Recovery/backup/manual UAT ยังไม่ปิดจากการเริ่ม S4
