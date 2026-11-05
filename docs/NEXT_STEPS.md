# ขั้นถัดไปหลังพัฒนา S3 และปรับ UX

วันที่5พฤศจิกายน2026 ตาม C-18 ทุกคำตอบจบ prompt ต้องแจ้ง Phase/functions/features ที่ยังเหลือในแชตด้วย
ดู [รายงาน S3](S3_REPORT_TH.md), [typography/loading](TYPOGRAPHY_LOADING_REPORT_TH.md), [ผล S2](S2_REPORT_TH.md) และ [แผนทุก Phase](PHASE_PLAN_TH.md)

## สถานะปัจจุบัน

- C-28 อนุมัติ S2; C-29 อนุมัติ S3 ทั้งหมด; C-30/C-31 เพิ่ม typography/color และ loading/กันกดซ้ำ
- S2/S3 มีโค้ดและการทดสอบ local/PR; feature flags ปิดตามค่าเริ่มต้น ไม่ย้ายข้อมูลสมมติไป hosted
- production ยังเป็น S1 มี13 migrations; local มี31 migrations; ไม่ใช้ local/CI pass กล่าวว่าระบบจริงผ่านแล้ว
- S1 hosted ยังติด allowlist ของ runtime revision1; draft ที่แก้แล้วไม่ใช่ runtime ที่ task ใช้อยู่ ไม่ควร publish/reapply ซ้ำโดยไม่มีเหตุ
- Email Recovery/SMTP Auth ยังเลื่อนไว้ตาม C-24 ก่อนผู้ใช้จริง; local S3 SMTP adapter ไม่ได้ปิดช่องว่างนี้

## งานที่ยังเหลือ เรียงตาม dependency

| ลำดับ / Phase | Functions/features และขั้นที่ต้องทำ | เงื่อนไข |
| --- | --- | --- |
| 1 / S2–S3 review | ทบทวน PR ตามลำดับ data/permissions → API → UX/tests และชุด S3 ที่ต่อกัน; ตรวจ CI/notice consent/assignment/capacity/worker และการเปลี่ยน typography/spinner | ไม่ merge ข้าม dependency; production flags ยังปิด |
| 2 / S2–S3 rollout | ใช้ migrations14–31 แบบ transaction/checksum ใน environment ที่เลือก, เปิด flags, ตรวจ directory/apply/queue/team/live/inbox ตาม role | ไม่ reset ข้อมูลเดิม/ไม่สร้าง fake verified partner บน hosted; ต้องกำหนดขอบเขต rollout และผู้รับผิดชอบ |
| 3 / S3 operations | worker principal/secret rotation/scheduler, monitoring/lease/dead-letter/retry, production SMTP opt-in/transport, ผู้ดูแลเคส/ผู้ตรวจอิสระ และ notices/retention จริง | local Mailpit/SMTP ไม่ใช่ external delivery; KMS/backup trust boundary และ policy TTL/capacity ต้องทบทวนก่อนข้อมูลจริง |
| 4 / S1 hosted | Emailสมัคร–เข้า–ออก/session จริงเมื่อ Confirm email Off, สองหน้าต่าง/private Realtime/dirty form, MFA/revoke/cross-user/tenant และ exact cleanup | ให้ task ใช้ Environment runtime ที่เข้าถึง opp4all.vercel.app และ Supabase Project domain ได้จริง; ไม่ต้องสร้าง Project/token ใหม่ |
| 5 / S1/S6 ก่อนผู้ใช้จริง | Recovery/SMTP Auth, support/MFA recovery/owner-transfer roster, hosted backup/PITR/RPO/RTO และ replay, manual AT/device/UAT | automated local restore/axe ไม่แทน hosted operational approval; no real minors/partner claims จากงานนี้ |
| 6 / S4 เมื่ออนุมัติ | warm referral พร้อม recipient consent/acceptance, outcome follow-up/verification, report/appeal/safeguarding และ privacy request lifecycle | ยังไม่เริ่ม; เลือก scope และ policy/roles/retention ให้ชัดก่อน ไม่ถือว่าตารางนี้อนุมัติเอง |
| 7 / S5–S6 เมื่ออนุมัติ | Navigator ที่มีแหล่งอ้างอิงและ human confirmation, aggregate impact/privacy suppression; security/AT/language/performance/cost และ pilot gates | ยังเป็นข้อเสนอ; ไม่มี AIตัดสินสิทธิ์/ผลประโยชน์/การจ้างงาน |

พันธกิจยังทั่วโลกทุกกลุ่มและธุรกิจยั่งยืน บริการช่วยเหลือหลักและการสมัครโอกาสไม่เก็บค่าธรรมเนียมแอบแฝง

## คำสั่ง local ที่มีจริง

```sh
npm run db:start
npm run dev:s3
```

หรือ `npm run build` แล้ว `npm run test:s3` ซึ่ง seed fixture ใหม่และเปิด/ปิดเว็บ3300เอง
`npm run worker:s3 -- --dry-run` ตรวจจำนวนงานโดยไม่เขียน; `--tick --email` ส่งเฉพาะ Mailpit/fake addresses
ไม่ commit `.local`/keys/QR/backup และไม่แก้ migrations001–018 ที่ใช้เป็นฐานแล้ว
ผลตรวจที่รันจริงและข้อจำกัดดูรายงาน ไม่ใช้เอกสารแผนเป็นหลักฐานผ่าน
