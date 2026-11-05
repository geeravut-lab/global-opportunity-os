# ผล rollout S2/S3 ตาม C-32

วันที่ 5 พฤศจิกายน 2026 เจ้าของอนุมัติ merge/deploy production พร้อม migrations, flags, worker, SMTP และทดสอบ hosted readiness ต่อ
งานรอบนี้ไม่ reset ข้อมูลเดิม ไม่เติม fixtures ลง hosted ไม่ซื้อบริการ และไม่ใช้สถานะ Vercel READY แทน browser/UAT

## สิ่งที่ทำแล้ว

| ส่วน               | หลักฐาน                                                                                                                     |
| ------------------ | --------------------------------------------------------------------------------------------------------------------------- |
| PR #3–8            | ตรวจ head/checks และรวมตามลำดับด้วย merge commit; main หลัง PR #8 คือ `a8b1b95063c1c7ca9591633fcfffeed41aefb69f`            |
| Schema             | ใช้ migrations 14–31 แบบ atomic transaction/checksum และใช้ migration 32 สำหรับ worker แล้ว; ledger รวม 32                  |
| Guardrails         | unsafe roles = 0, tables without RLS = 0; owner designation, Realtime namespace guard และ immutable audit ครบ               |
| Flags              | Production เปิด `S2_ENABLED=true` และ `S3_ENABLED=true`                                                                     |
| S2/S3 deployment   | `dpl_9MUaNv7jfMdRB7jfvDyDLaUgocpZ` READY และ alias `opp4all.vercel.app`                                                     |
| Worker PR #9       | CI ครบทั้งสองชุดผ่านหลังทวนชุดที่ล้มเหลวตอนเริ่ม validation stack; รวม main เป็น `3106f7a5f555c07844f48ae03c821491f03d5f18` |
| Worker credentials | machine principal และ encrypted Vercel env/Vault ตั้งแล้ว; package_read=false, schema_create=false                          |

สร้าง `private.rollout_ddl_snapshots` ภายใน DB เก็บ function definitions, policies และ ACL ก่อนเปลี่ยน โดยไม่ส่งข้อมูลจริงออก workspace
สิ่งนี้เป็น DDL rollback bundle ไม่ใช่ full backup หรือ PITR; ตรวจ provider พบ backups = 0 และ PITR = false

## Worker และการแก้ TLS

`POST /api/internal/maintenance` ต้องผ่าน machine bearer secret; ไม่ผ่านตอบ 404 และไม่คืนข้อมูลผู้ใช้
ใช้ DB login แบบ NOINHERIT/NOSUPERUSER/NOBYPASSRLS แล้ว `SET LOCAL ROLE goos_worker` ภายใน transaction
migration 32 ให้เฉพาะ quarantine columns และการเปลี่ยน clean/rejected โดยลบ original; ไม่ให้อ่าน application packages หรือแก้สถานะธุรกิจ

งานแต่ละรอบจำกัดจำนวน: decode/re-encode PNG, tick follow-up, claim/revalidate/ack in-app และ email queue ตาม lease/retry/dedup เดิม
SMTP ต้องมี config ครบ ใช้ TLS และข้อความทั่วไปกับ protected deep link; หากยังไม่มี SMTP จะไม่ claim email jobs
การส่ง SMTP เป็น at-least-once ไม่รับรอง exactly-once จาก Message-ID เพียงอย่างเดียว

ติดตั้ง route แล้ว cron เรียกถึง production ได้ แต่การตรวจรอบแรกตอบ 503 จาก TLS trust chain จึงพัก cron ก่อนแก้
เพิ่มรหัสวินิจฉัยจำกัดหมวดที่ไม่เปิดเผย message/stack/credentials และเพิ่ม public production CA roots จาก [Supabase CLI ที่ pin commit](https://github.com/supabase/cli/blob/5a07fe08496575916e3a4281ead4e8b0283b4a6d/apps/cli/src/command-internal/pgdelta-ssl.ts)
เลือกเฉพาะ production roots ไม่รวม staging; คง `rejectUnauthorized=true` และ hostname verification
อ้างอิงแนวทาง [Supabase SSL enforcement](https://supabase.com/docs/guides/platform/ssl-enforcement)

รุ่นแก้ที่ตรวจ: deployment `dpl_6j96a1RTeBi8PShR36W4DBvAEZ2J` READY, source `6dbd2c434190789b81591376e272b12e50cbc894`, alias `opp4all.vercel.app`
เรียก maintenance จริงได้ HTTP 200, timed_out=false, failed=0, emailConfigured=false; ไม่มี email ถูกส่งในรอบตรวจ
เปิด cron กลับแล้วและยืนยัน active=true ทุกนาที; รอบตามเวลา 09:09 UTC มี status=succeeded; คำสั่ง worker-schedule ปรับให้เปิด job เดิมที่เคยพักด้วย
รหัสวินิจฉัย/CA และการปรับ operator อยู่ใน PR #10; ไม่มี migration เพิ่มเกิน 32 จากการแก้ TLS

## คำสั่ง operator ที่มีจริง

ใช้ credentials ผ่าน Environment เท่านั้น คำสั่งเหล่านี้เปลี่ยน production ภายในขอบเขต C-32

```sh
NODE_USE_ENV_PROXY=1 node scripts/hosted-s1.mjs migrate --include-s3
NODE_USE_ENV_PROXY=1 node scripts/hosted-s1.mjs worker-configure
NODE_USE_ENV_PROXY=1 node scripts/hosted-s1.mjs worker-schedule
NODE_USE_ENV_PROXY=1 node scripts/hosted-s1.mjs verify
```

- `worker-configure` สร้าง/หมุน machine credential และเก็บใน Vercel encrypted env กับ Supabase Vault; ต้อง deploy ใหม่หลังหมุน อย่ารันซ้ำเพียงเพื่อดูสถานะ
- `worker-schedule` ใช้ pg_cron/pg_net ของ Supabase เดิม เรียก endpoint ที่กำหนดทุกนาที; ตรวจ preload แล้วไม่ต้อง restart/upgrade
- ต้องมี deployment READY พร้อม env ก่อนเปิด schedule และตรวจ HTTP outcome ของ maintenance จริง; cron status succeeded อย่างเดียวไม่ยืนยัน HTTP 200
- ไม่ใส่ SUPABASE_ACCESS_TOKEN หรือ service-role key ใน web runtime และไม่ใช้ scheduler เป็น proxy เลี่ยง network policy เพื่อทดสอบหน้าเว็บ

## ผลตรวจที่รันจริง

- Worker รอบแรก: 83 unit ผ่าน, typecheck/lint/build ผ่าน; integration เดิม 77 ผ่าน และ worker ACL อีก 1 ผ่านหลังแยกบัญชี fixture; CI ของ PR #9 ครบผ่าน
- รุ่น TLS/diagnostics: 85 unit ผ่าน, typecheck/lint/build ผ่าน; ตรวจ production CA fingerprints, self-signature, CA flag และอายุใบรับรอง
- Worker ACL ตรวจทั้ง clean/rejected ด้วย transaction rollback; อ่าน quarantine/ลบ original ได้ แต่อ่าน application_packages ไม่ได้
- Hosted validation รันแล้วหยุดที่ preflight ก่อนสมัคร fixture เพราะ runtime network; 1 failed, 9 not run จึงไม่อ้างว่า hosted Email/Live/สิทธิ์ผ่าน
- ผล local/CI ไม่ใช่หลักฐานว่า SMTP delivery, Recovery, backup บน hosted หรือ manual AT/UAT ผ่าน

## งานที่ยังไม่ปิด

1. **SMTP / S3:** เจ้าของเลือก Resend ตาม C-33; ยังรอ verified sender และ SMTP_HOST/PORT/USER/PASSWORD/FROM ผ่าน Secrets ต้องตรวจ delivery/retry/bounce จริง
2. **S1/S6 network:** runtime task ยัง revision 1 อนุญาตเฉพาะ management APIs แม้ draft มีเว็บ/Supabase hosts แล้ว; ไม่มีเครื่องมือ rebind/apply/restart ใน task ต้องเริ่ม task จาก version ที่ถูกต้องหรือให้แพลตฟอร์มตรวจ binding
3. **S1 Recovery:** ทดสอบ Email Off/session/Live/MFA/revoke/tenant และ recovery browser flow หลัง network/SMTP พร้อม แล้ว cleanup ตาม manifest
4. **S6:** hosted backup/restore, RPO/RTO, privacy/safety/SMTP roster และ manual AT/device/UAT ยังไม่ปิด; ไม่ซื้อ PITR แทนเจ้าของ
5. **S4:** เลือกขอบเขตใน [S4_SCOPE_TH](S4_SCOPE_TH.md) แล้ว ยังไม่มี implementation หรือนโยบาย retention/purge/holds ที่รับรองจากเอกสารนี้

ดู [คู่มือ Resend และ Network/Recovery](SMTP_RECOVERY_ROLLOUT_TH.md) และ [ขั้นถัดไป](NEXT_STEPS.md)
