# Rollout S2/S3 ตาม C-32

วันที่5พฤศจิกายน2026 เจ้าของอนุมัติ merge/deploy production และดำเนิน workers/SMTP/hosted readiness ต่อ
ไม่ reset ข้อมูลเดิม ไม่ copy fixturesไป hosted ไม่ provision paid services และไม่อ้างว่า production READY แทน browser/UAT

## ผลที่ยืนยันแล้ว

- รวม PR3–8 ตามลำดับด้วย merge commit โดยตรวจ exact heads และ checks ก่อนแต่ละ merge; main รวมเป็น `a8b1b95063c1c7ca9591633fcfffeed41aefb69f`
- migrations14–31 ใช้ transaction/checksum สำเร็จ; verify ledger31, unsafe roles0, tables without RLS0 และ guards owner/Realtime/auditครบ
- สร้าง `private.rollout_ddl_snapshots` ภายใน DB เก็บ function definitions/policies/ACL ก่อนเปลี่ยน ไม่ดึงข้อมูลจริงออก workspace; เป็น DDL rollback bundle ไม่ใช่ full backup/PITR
- production flags S2_ENABLED/S3_ENABLED=true; Vercel deployment `dpl_9MUaNv7jfMdRB7jfvDyDLaUgocpZ` READY, commitตรง main และ alias `opp4all.vercel.app` ผูกแล้ว
- Supabase SMTPยังว่าง, backups0/PITRfalse; ไม่เปลี่ยน Confirm email Off หรือ Google provider ที่เจ้าของตั้งไว้

## Worker production ที่เพิ่ม

`/api/internal/maintenance` รับPOSTด้วย machine bearer secretเท่านั้น; ข้อมูลตอบกลับเป็นจำนวนงาน ไม่มี payload/email/PII
ใช้ machine DB login NOINHERIT/NOSUPERUSER/NOBYPASSRLS → SET LOCAL ROLE goos_worker
migration32 ให้เฉพาะ quarantine columns/UPDATE clean/rejected; ไม่อ่าน application_packages ไม่แก้สถานะธุรกิจ
processed evidence เห็น metadataแต่ original_bodyต้องnull; ไม่มี grantอ่าน safe_body ให้ worker
PNG decode/re-encodeด้วย validatorเดิม; in-app/outbox/tick/lease/revalidate/ackเดิม; SMTPเมื่อ configครบใช้ TLSและข้อความgeneric+protected deep link
ไม่มี SMTPจะไม่ claim email jobs; จึงไม่แกล้งรายงานว่าอีเมลส่งแล้ว

คำสั่ง operatorที่มีจริง (credentialsผ่านEnvironmentเท่านั้น):

```sh
NODE_USE_ENV_PROXY=1 node scripts/hosted-s1.mjs migrate --include-s3
NODE_USE_ENV_PROXY=1 node scripts/hosted-s1.mjs worker-configure
NODE_USE_ENV_PROXY=1 node scripts/hosted-s1.mjs worker-schedule
NODE_USE_ENV_PROXY=1 node scripts/hosted-s1.mjs verify
```

worker-configure สร้าง/หมุนmachine credentialและเก็บใน Vercel encrypted env/Vault; worker-schedule เปิดpg_cron/pg_netใน Supabaseเดิมและเรียกendpointที่กำหนดทุกนาที
ต้องdeploy routeพร้อมenvก่อนเริ่มschedule ไม่ใช้schedulerเป็นproxyเพื่อทดสอบเว็บที่workspaceถูกบล็อก
อย่าใส่ SUPABASE_ACCESS_TOKEN/service_role ในweb runtime

## ผลตรวจ worker code

83 unitผ่าน, typecheck/lint/buildผ่าน; integrationฐาน77ผ่าน และ worker ACL1ผ่านรอบยืนยันหลังแยกบัญชีfixture
worker ACLใช้ transaction rollback: อ่านquarantine/ลบoriginalได้, อ่านapplication_packagesไม่ได้
ผล hosted migration32/worker deployment/schedule จะบันทึกหลังทำจริง ไม่ถือว่าบรรทัดคำสั่งด้านบนคือผลผ่าน

## งานที่ยังรอข้อมูล/บริการภายนอก

1. SMTP provider/ผู้ส่งที่ยืนยันdomainแล้ว: SMTP_HOST/PORT/USER/PASSWORD/FROM ในSecrets; ไม่ส่งรหัสผ่านในแชต ต้องตรวจ delivery/recoveryจริงก่อนปิด S1
2. Runtime taskยังrevision1อนุญาตเพียงManagement API แต่draftมีเว็บ/Supabaseโดเมนครบ เครื่องมือไม่มีrebind/apply/restart จึงต้องใช้ taskจากEnvironment versionที่เข้าถึงสองโดเมนได้จริง แล้วรัน hosted suite/cleanupตามmanifest
3. Backup/PITR/RPO/RTO, owner/privacy/safety/SMTP roster และmanual AT/device/UATก่อนข้อมูลจริงยังไม่ถือว่าผ่าน
4. S4เลือกขอบเขตใน [S4_SCOPE_TH](S4_SCOPE_TH.md) แล้ว ยังไม่มีS4implementation/retention/purgeที่อนุมัติจากเอกสาร
