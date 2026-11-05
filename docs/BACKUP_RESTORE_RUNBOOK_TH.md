# คู่มือ backup/restore และ replay สิทธิ์หลัง snapshot

ขอบเขต C-23: ตรวจการกู้ด้วยข้อมูลสมมติใน stack แยก ไม่ restore ทับ Supabase ที่ใช้งานจริง
เชื่อม BP-G6 และ BP-AC-02/03/08/18; ไม่ถือว่า local drill ผ่านแล้วเท่ากับ hosted PITR/production RTO ผ่าน

## สถานะที่ตรวจจากระบบจริง

Management API ของ Project `fxqgvqvthrdzmgnmqgom` ตอบ200: `pitr_enabled=false` และรายการ `backups` มี0รายการ ณ รอบตรวจนี้
จึงยังไม่มีหลักฐาน hosted restore point ที่พร้อมใช้จาก endpoint นี้ ไม่สรุปว่ามี daily backup/PITR จากการมี Project เพียงอย่างเดียว
ไม่ได้เปิดแพ็กเกจเสียเงิน เปลี่ยน schedule หรือเรียก restore API; ก่อน real-user launch ต้องเลือกและพิสูจน์แผน backup จริง
ทางเลือก manual encrypted backup/off-site หรือ managed backup/PITR ยังต้องเลือกงบ/ผู้รับผิดชอบและช่องทางเชื่อมต่อที่ได้รับอนุญาต

## สิ่งที่ต้องเก็บให้ครบ

| ส่วน | วิธีเก็บ/ข้อจำกัด |
| --- | --- |
| SQL schema/data | migrations + version/checksum ledger + consistent database snapshot; รวม Auth metadata/consent/audit/revocations/private branding |
| Roles/ACL/RLS | app roles ต้อง NOLOGIN/NOINHERIT/NOBYPASSRLS; เก็บ role definitions แบบไม่รวม role passwords และขั้น recreate ที่ตรง provider |
| Keys/config | Supabase/Google/Vercel settings และ encryption/signing keys ผ่าน secret manager ที่จำกัดสิทธิ์; ไม่เก็บใน Git/แชตหรือรายงาน |
| Images | custom branding ปัจจุบันอยู่ binary table จึงอยู่ใน DB backup; default images/atlas อยู่ใน Git |
| Storage ในอนาคต | DB backup ไม่ใช่ object-byte backup; S2 evidence ต้องมี object inventory/version/hash/access configuration และ restore proof แยก |
| Privacy/revocation ledger | การถอน delegation/consent, session denylist และเมื่อมี deletion workflow ต้องมี tombstone/recipient cessation/purge replay หลังเวลา snapshot |

## คำสั่งซ้อมที่มีจริง

```sh
npm run db:start
node scripts/test-backup-restore.mjs
```

สคริปต์รับเฉพาะ source local API54321/DB54322 และ target ใหม่แบบสุ่มที่ API57321/DB57322
ตรวจว่าต้นทางมีเฉพาะ email fixture `@example.test` ไม่ export ข้อมูลผู้ใช้จริงหรือ link ไป hosted
ใช้ PostgreSQL image/CLI ที่มีใน repo; เตรียมเฉพาะ global app roles แบบ NOBYPASSRLS ใน cluster เป้าหมายก่อน restore แล้วตรวจ attributes/ownership/policies อีกครั้ง
ไม่ apply app migrations ใหม่กว่าจุด snapshot ก่อน restore เพื่อไม่ให้ FK/trigger ของรุ่นใหม่ขัดกับ archive; ตรวจ fresh migrations เป็นอีกชุดทดสอบ
snapshot ใช้ exported repeatable-read transaction เดียวกันกับ `pg_dump --snapshot` จึงเทียบ data fingerprints กับจุดเวลาเดียวกัน
archive/manifest/MFA fixture/ledger เก็บ `.local/restore-*/` mode600 ไม่ commit/share log ที่มี credentials
สคริปต์หยุด target stack ที่สร้างเองและ cleanup fixture ต้นทางแบบ allowlist; audit ID-only ของกิจกรรมจริงคงไว้ตาม append-only guard

## สิ่งที่ drill ตรวจ

1. byte/content fingerprint และจำนวนแถว app/private/Auth ที่กำหนดตรง snapshot
2. binary PNG SHA-256 ตรง, policies ตรง, schema/table/column/RPC ACL ตรง, app roles ไม่มี BYPASSRLS และ audit UPDATE ถูกปฏิเสธ
3. login ด้วย password เดิมใน Auth ของ target ได้จริง และ verified TOTP ที่เข้ารหัสใน backup ยังใช้ step up ได้
4. จำลองถอน delegation และ revoke session หลัง snapshot แล้ว replay ledger ก่อนเปิดใช้งาน target
5. JWT เก่าที่ลายเซ็นยังถูกต้องถูก DB ปฏิเสธหลัง replay; login ใหม่ของผู้ช่วยยังเข้า account ตนได้แต่ไม่กลับมาอ่าน subject ที่ถอนแล้ว
6. replay ซ้ำไม่เพิ่มแถวหรือคืนอำนาจ และไม่มีการปิด audit/RLS เพื่อให้ restore ผ่าน

ข้อผิดพลาดที่พบและแก้ใน drill: `pg_restore --clean` พยายาม drop inherited primary key ของ Realtime partition
จึงเตรียม **เฉพาะ container restore ที่เพิ่งสร้าง** ด้วยการ drop root `realtime.messages` ก่อน restore; มี project/port/container guard
ห้ามนำขั้น drop นี้ไปรันกับต้นทางหรือ hosted ที่ให้บริการอยู่

อีกข้อที่พบ: default grants ของ cluster เป้าหมายอาจเพิ่มสิทธิ์แม้ restore ข้อมูล/policies ตรง
drill จึงเก็บ source ACL snapshot และ reconcile เฉพาะ schema/objects ของแอปใน target ใหม่แบบ transaction
รวม column grants และ RPC EXECUTE ก่อนเทียบ exact ACL และตรวจ anon/authenticated negatives
ไม่เปลี่ยน ACL ของต้นทาง ไม่ยอมให้ anon เรียก privileged RPC เพื่อผ่านการทดสอบ

## ขั้น production incident จริง

1. ระบุ incident ID/ผู้รับผิดชอบ/target/จุด snapshot และหลักฐานสำรอง หยุด writes/jobs/ข้อความออกนอกระบบตามแผนที่ทดสอบแล้ว
2. เลือก restore point ตาม RPO ที่ตกลง; restore ไป environment แยกก่อน โดยใช้ provider workflow ที่มีสิทธิ์และงบอนุมัติ
3. คืน keys/config ผ่าน secret manager และ object bytes พร้อม hash/ACL; อย่าเดาว่า DB snapshot รวมทุกอย่าง
4. ตรวจ schema/migration versions, role ownership, RLS/Storage, Auth login/MFA, tenant negatives และ integrity ของ consent/audit
5. replay รายการถอนสิทธิ์และ privacy events หลัง snapshot อย่าง idempotent ก่อนอนุญาตให้ login/read ตามปกติ
6. ตรวจ outbox/job dedup และ recipient cessation ก่อนปล่อยข้อความออก; S1 ยังไม่มี external outbox ไม่ถือว่าผ่าน S3–S4 แล้ว
7. สลับ traffic แบบย้อนกลับได้ บันทึก measured RTO/RPO พร้อมเวลาจริง และเฝ้าระวัง session/permission anomalies

ห้ามใช้คำว่า production restore สำเร็จจนตรวจปลายทางจริง; ไม่ restore ทับ Project เดิมโดยไม่ระบุขอบเขตและ impact ของเหตุการณ์
drill นี้ไม่ทดสอบ privacy deletion replay ที่ยังไม่มีใน S1; งานนั้นอยู่ S4 และต้องทดสอบก่อนรับข้อมูลจริงตามขอบเขต pilot


## เพิ่มเติม S3 ตาม C-29

เมื่อทดสอบ S3 แล้ว ให้รัน `npm run test:backup-restore` โดย source543xx มี synthetic fixtures เท่านั้น
script ตรวจ decrypt ของ immutable package หลัง restore ว่า hash ตรงต้นทางและ key ใช้ได้
ทดสอบ snapshot ก่อน withdraw → source withdraw → replay `private.goos_s3_replay_withdrawals(jsonb)` แบบ operator-only ก่อนเปิด Auth/REST target
ledger ต้อง identity-bound application_id/subject_id/action/time จากแหล่งที่เชื่อถือได้ ไม่รับ arbitrary user input
replayซ้ำต้องไม่เปลี่ยน fingerprint เพิ่มและ active shares ต้องเป็นศูนย์; เก็บ ledger/archives mode600 แยกจากระบบเผยแพร่
key ปัจจุบันอยู่ private DB จึงอยู่ใน backup เดียวกัน ยังไม่อ้าง KMS/separate trust boundary
ผลเฉพาะlocalไม่แทน hosted PITR/backup/RPO/RTO; ตรวจ [ผลS3](S3_REPORT_TH.md) ก่อนสรุปความพร้อม
