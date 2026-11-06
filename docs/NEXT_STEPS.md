# งานถัดไปตาม C-35/C-36

1. **S4 — policy PR/rollout:** hosted ใช้ policy60–65 แล้วและตั้ง preview flags โดยไม่ provision credentials; ตรวจ CI security update แล้ว merge/deploy เปิดเฉพาะ owner preview ก่อน; public intake/purge ปิดจน notice/roster/ที่เก็บ ledger จริงพร้อม ดู [สถานะล่าสุด](S4_ROLLOUT_2026_11_06_TH.md)
2. **S4 — ผู้ตรวจและงานลบจริง:** ระบุผู้ดำเนินการ ประเทศ ช่องทาง privacy เวลารับเรื่อง บัญชี impact/privacy/safety ที่มี MFA และทบทวน retention/holds; ทำ approved request เฉพาะรายพร้อม independent review/approval/intent/executed receipts ไม่ใช่ bulk delete
3. **S5 — review implementation:** approved public corpus, Navigator สองภาษา/ตัวกรองที่แก้ได้/citations/manual search; รายงาน fixed closed-month L2/k10/complementary suppression/export authorization ดู [ขอบเขต](S5_SCOPE_TH.md) มี implementation/tests แล้ว รอ PR/CI/review; mobile active menu/More auto-scroll ตาม C-37 รวมอยู่ในชิ้นงานนี้ provider/key/vendor terms และ production S5 เป็นเรื่องแยก
4. **S1/S3/S6 — ก่อนข้อมูลจริง:** แก้ runtime host access, ทดสอบ Email Confirm=Off/Live sync/ถอนสิทธิ์/tenant จริง, verified Resend sender/SMTP/Recovery, hosted backup restore, incident/recipient cessation และ manual accessibility/device UAT

ผลที่ยังไม่รันต้องไม่รายงานว่าผ่าน ทุกคำตอบสุดท้ายระบุ phase/functions/features ที่เหลือในแชตตาม C-18
