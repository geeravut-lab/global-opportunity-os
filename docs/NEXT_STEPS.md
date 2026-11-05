# ขั้นถัดไปหลัง rollout ตาม C-32

- PR3–8 รวมmainและ deploy production แล้ว เปิด S2/S3 flags และverify migrations31; เพิ่มmigration32สำหรับmachineworkerแล้วตามรายงาน
- worker PR #9 รวมแล้ว; รุ่นแก้ TLS ตอบ HTTP 200 และ cron active ทุกนาทีตามรายงาน ส่วน SMTP และ hosted tests ยังไม่ปิด
- S4เลือกขอบเขตส่งต่อ/ผลลัพธ์/privacyใน [S4_SCOPE_TH](S4_SCOPE_TH.md) แล้ว ยังไม่เริ่มimplementation
- ผลละเอียด/ข้อจำกัด/production IDs ดู [PRODUCTION_ROLLOUT_TH](PRODUCTION_ROLLOUT_TH.md)

## ขั้นตอนที่ยังเหลือ

1. **S3 operations:** ติดตาม worker/cron ที่เปิดแล้ว; ตั้ง Resend SMTP/verified sender และทดสอบ delivery; ระบุops roster และretention/key policyก่อนข้อมูลจริง
2. **S1/S6:** ให้taskใช้runtimeที่อนุญาตเว็บ/Supabaseจริง แล้วทดสอบEmailOff/session/Live/MFA/revoke/tenantและcleanup; ทดสอบRecoveryกับSMTPจริง และhosted backup/restore/manual AT/device UAT
3. **S4:** ทบทวนขอบเขตS4.1 warm referral consent/accept/destination case ก่อนเริ่ม; S4.2outcome review/dispute และS4.3privacy/retention/holdsต้องมีผู้รับผิดชอบและpolicyชัด
4. **S5–S6:** Navigator/aggregate impact และpilot gatesยังไม่เริ่มจากคำสั่งนี้

ทุกคำตอบจบpromptต้องแจ้งขั้นถัดไปในแชตตาม C-18; ไม่ใช้คำว่าREADYหรือlocal/CIpassแทน hosted UAT/operational gates
