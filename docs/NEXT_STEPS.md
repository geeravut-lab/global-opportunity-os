# ขั้นถัดไปหลังพัฒนา S4 ตาม C-34

production ปัจจุบันเป็น S2/S3 จาก PR #3–10 และ migrations1–32 ตาม [รายงาน rollout](PRODUCTION_ROLLOUT_TH.md)
S4 เพิ่มบน feature branch ด้วยข้อมูลสมมติ ยังไม่ใช้ migrations33–54 หรือเปิด flags บน hosted
ผลตรวจที่รันจริงและข้อจำกัดดู [รายงาน S4](S4_REPORT_TH.md)

1. **S4 — review และ rollout:** ตรวจ PR การส่งต่อเคส/consent/destination assignment, outcomes/evidence/dispute และ privacy/export/holds/reports; ตรวจ notice/TTL/สิทธิ์เจ้าหน้าที่และนโยบายหลักฐาน ก่อนเลือกอนุมัติ rollout migrations/flags แบบแยกขั้น พร้อม rollback ที่ปิด gates โดยไม่ลบข้อมูล
2. **S4 — ก่อนข้อมูลจริง:** กำหนดผู้ตรวจอิสระและ privacy/safety roster, identity/SLA/retention/holds/recipient cessation; ทดสอบ escalation/abuse controls และ hosted restore/replay คำขอลบยังไม่มี physical purge และไม่ได้ถือว่าผ่าน BP-AC-16 ทั้งข้อ; การแจ้งเตือน S4 ทางอีเมลยังไม่รวมใน implementation นี้
3. **S1/S3/S6 — Email/Recovery/hosted:** ยืนยัน Resend API key และ sender ที่ verify แล้วในช่องทางจัดเก็บ secrets ที่ใช้จริง; ตั้ง Supabase SMTP และทดสอบ delivery/Recovery เมื่อ runtime เข้าถึงเว็บและ Supabase ได้ ทดสอบ Email Confirm=Off, session, Live sync, revoke/tenant และ cleanup ข้อมูลสมมติ; ปิดงาน backup/restore และ manual accessibility/device UAT ก่อนรับข้อมูลจริง
4. **S5 — Navigator และ impact:** ให้เจ้าของเลือกขอบเขต approved public corpus/AI gateway/citations/manual fallback กับ aggregate privacy/metric provenance ก่อนเริ่มพัฒนา ไม่เริ่มจากการเสนอขั้นถัดไปนี้

ทุกคำตอบจบ prompt ต้องแจ้งขั้นถัดไปในแชตตาม C-18; ผล local/CI หรือ deployment READY ไม่แทน hosted UAT/operational gates
