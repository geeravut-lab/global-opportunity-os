# งานถัดไปหลังเริ่ม S2 ตาม C-28

วันที่5พฤศจิกายน2026 ตามเวลาไทย ใช้ C-18: ทุกคำตอบจบ prompt ต้องแจ้งงานค้าง/Phase ถัดไปในแชต
ดู [ผล S2](S2_REPORT_TH.md), [แผนทุก Phase](PHASE_PLAN_TH.md), [ADR-004](adr/ADR-004-S2-TH.md) และ [หลักฐาน S1](S1_READINESS_EXECUTION_TH.md)

## สถานะที่แยกจากกัน

- C-28 อนุมัติเริ่ม S2 แล้ว ไม่รอ S1 hosted ตามลำดับเก่าของ C-27 แต่ S1 ยังเป็น blocked ไม่ใช่ผ่าน
- S2 มี code/schema/API/UX/fixtures/tests สำหรับ organizations/evidence/catalog/search/assessment/bookmarks/rule matching แล้วตามรายงาน
- S2 flag ปิดตามค่าเริ่มต้น ใช้ local/PR ไม่ copy fixtures หรือประกาศองค์กรจริงว่า verified
- production S1 ที่ merge/deploy ก่อนหน้านี้ยังเป็นคนละผลกับ S2; hosted มี13 migrations ขณะที่ S2เพิ่ม14–18ใน local
- Email Recovery/SMTP ยังเลื่อนไว้ก่อนผู้ใช้จริงตาม C-24 ไม่เปิด confirmation กลับเอง ไม่อ้าง local Mailpit เป็น delivery บน hosted

## ขั้นถัดไปที่ยังเหลือ

| ลำดับ / Phase | Functions/features และสิ่งที่จะทำ | เงื่อนไข/หลักฐาน |
| --- | --- | --- |
| 1 / S2 review | ทบทวน3 PRที่ต่อกัน: data/permissions → API/public directory → workspace/live/tests | ตรวจ CI จริงและขอบเขต migration/flag/worker ก่อน rollout ไม่ใช้ local pass แทน hosted readiness |
| 2 / S2 rollout | migration14–18 แบบ transaction/checksum, เปิด flag ใน environment ที่เลือก, ทดสอบ public current/expired/suspended และ role workflows | ไม่ reset ข้อมูลเดิม ไม่สร้าง fake verified partners บนระบบจริง; operator defaultยังเลือกเฉพาะS1จนระบุ include-s2 |
| 3 / S2 evidence/ops | ยืนยัน PNG-only หรือ PDF/Office+AVเพิ่ม, จัด production worker/monitoring, ตั้งผู้ตรวจอิสระและ content revalidation/expiry | local PNG inspection ทำแล้ว ไม่ใช่ general AV และไม่มี production worker จากการ build |
| 4 / S1 hosted | Email signup/login/logout/session, private Realtime/สองหน้าต่าง/dirty form, cross-user/tenant/MFA/revoke และ exact fixture cleanup | runtime ยังใช้ allowlistเก่า ต้องให้ task ใช้ Environment รุ่นที่เข้า opp4all.vercel.app และ Project Supabase ได้จริง ไม่ต้องสร้าง Project/token ใหม่ |
| 5 / ก่อนผู้ใช้จริง | approved notices/retention/legal mapping, support/recovery/owner/ops roster, backup/RPO/RTO/manual AT/device/UAT และ Recovery/SMTP | local restore/Orca smoke เป็นหลักฐานย่อย ไม่แทน hosted PITR/operational sign-off; provider backup0/PITRfalseยังค้าง |
| 6 / S3 | preview recipient/fields/notice/hash→explicit consent→atomic application/share/event/outbox; case queues/assignment/progress/notifications | ยังเป็นแผน รอเลือกขอบเขตหลัง S2 ไม่เริ่ม AI/referral/case/minor/paid workflows จาก C-28 |

พันธกิจยังทั่วโลกทุกกลุ่มและธุรกิจยั่งยืน ไม่ลดเป็น job board หรืออ้าง supply/partner รายประเทศที่ยังไม่มี
C-17/C-26 มีหลักฐานอนุญาตจัดการและ deploy ชิ้นงาน S1; รายงาน S2 แยกสิ่งที่พัฒนาและสิ่งที่ยังไม่ rollout ชัดเจน

## วิธีพัฒนาต่อในเครื่อง

```sh
npm run db:start
npm run dev:s2
```

หรือรัน `npm run build` แล้ว `npm run test:s2` ซึ่งจะ seed ข้อมูลสมมติ local และเปิด/ปิดเว็บ3200ให้เอง
ไม่ commit `.local`/keys/QR/backup ไม่แชร์ manifest ของบัญชีสมมติ ไม่แก้ migration0001–0013 ที่ apply แล้ว
อ่าน DECISIONS.md ตามรหัสล่าสุด รักษา P/G/D ที่ยังเป็นข้อเสนอและผลทดสอบที่ยัง blocked/ไม่รัน
