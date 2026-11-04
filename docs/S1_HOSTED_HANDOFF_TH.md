# ผลส่งขึ้นระบบและวิธีปิด S1 hosted ต่อ

วันที่2026-11-04 ขอบเขต C-17/C-23–C-27 และ BP-AC-02/03/08/18
**S1 ยังไม่ปิดครบ และยังไม่เริ่ม S2 implementation**; Email Recovery/SMTP เลื่อนตาม C-24
เจ้าของยืนยันรอ S1 hosted ผ่านก่อนตามเดิม ไม่ให้เริ่ม S2 local คู่ขนานระหว่าง Network ถูกบล็อก

## สิ่งที่ดำเนินการและตรวจจริง

| รายการ | หลักฐาน |
| --- | --- |
| Source | [PR #1](https://github.com/geeravut-lab/global-opportunity-os/pull/1), head `c0840faf80c18e4bff7b41580f46e4c90e4405ae`, merge เข้า main เป็น `5c32d5d9b48d7944a520d34efe1dc08a51e80039` |
| CI ของ PR | [run41877357948](https://github.com/geeravut-lab/global-opportunity-os/actions/runs/41877357948) completed/success; check และ s1-local ผ่านก่อน merge ไม่ได้ข้าม CI; run push ซ้ำถูกยกเลิก ไม่ใช้ cancelled run เป็นหลักฐานผ่าน |
| Production หลัง PR #1 | Vercel API ยืนยัน `dpl_4KnPsEdH6eNb9ixY8UThYyMb8Hxi`, target production, readyState READY, aliasAssigned=true และ commit ตรง merge main |
| Domain | alias API ของ `opp4all.vercel.app` คืน deployment ID ตรงรุ่นข้างต้น |
| Supabase | verify ยืนยัน ledger13, unsafe roles0, tables without RLS0; owner/settings/realtime/audit guards อยู่ครบ; ตรวจ SHA-256 ของ local/hosted13ไฟล์ตรงกันทั้งหมด จึงไม่มี pending migration ที่ต้อง apply ซ้ำในรอบนี้ |
| Auth config | Management API ยืนยัน mailer_autoconfirm=true, Google enabled, TOTP enroll/verify enabled; ไม่แก้ provider/confirmation กลับ |
| Backup metadata | pitr_enabled=false, backups0; ไม่ได้เปิดบริการเสียเงินหรือ restore ทับระบบจริง |
| Frontend/provider HTTP จาก task นี้ | fetch ทั้งสอง hostname ยังล้มเหลวก่อนเข้าแอป; ไม่ใช่หลักฐานว่า production ตอบ404 หรือการล็อกอินล้มเหลว |

ผล Ready/alias/metadata เป็นหลักฐาน control plane ไม่แทน hosted browser/Auth/session/Realtime tests
ชุด local และคู่มือที่ผ่านอยู่ [รายงาน S1](S1_READINESS_EXECUTION_TH.md), [MFA/owner](MFA_OWNER_RUNBOOK_TH.md), [backup/restore](BACKUP_RESTORE_RUNBOOK_TH.md)
รอบนี้ไม่รัน local suites เดิมซ้ำเพียงเพื่อบันทึกสถานะเอกสาร ไม่มีการสร้าง fixture hosted

## เหตุที่ Network ยังต้องแก้ที่ runtime

ตรวจ `environment_status` ได้ observations_current=true และ network state enforced แต่ custom allowed_hosts ของ task มีเพียง
`api.github.com`, `api.supabase.com`, `api.vercel.com`
source config version ที่ task ใช้อยู่คือ `cecfgver_6aeb296fd85881a2b871bef424f0fe71` และ observed spec revision1
draft ที่เตรียมไว้มี `opp4all.vercel.app` และ `fxqgvqvthrdzmgnmqgom.supabase.co` ครบแล้ว
ไม่บันทึก draft เดิมซ้ำ ไม่เพิ่ม wildcard ไม่ปิด TLS ไม่เปลี่ยน proxy หรือใช้ Management API เป็นทางผ่านไป host ที่ถูกบล็อก

การ Publish Environment กับการให้ running task ใช้ Network รุ่นใหม่เป็นคนละสถานะ
tool ที่มีอ่าน runtime/บันทึก draft ได้ แต่ไม่ apply/publish/restart/เปลี่ยน instance ให้ task ได้เอง
ข้อมูลนี้ไม่ใช่ปัญหา token: Supabase/Vercel Management API ทำงานได้ด้วย bindings เดิม

## สิ่งที่ต้องเกิดก่อนทดสอบต่อ

1. ให้ task ที่ทดสอบใช้ Environment version ซึ่งอนุญาตสอง hostname ข้างต้นจริง โดยคง API domains/secret bindings เดิม
2. หาก task นี้ยังผูก configuration version เก่าหลัง Publish ให้เริ่ม task ใหม่จาก Environment เวอร์ชันล่าสุด แล้วใช้ repository/main ล่าสุด; งานทั้งหมดของ PR #1 อยู่ใน GitHub แล้ว
3. ตรวจ environment_status และเชื่อมต่อทั้งสอง destination จริงก่อนสร้าง fixture การมี hostname ใน draft หรือคำว่า Publish ไม่แทนผล connectivity
4. หาก task ใหม่ยังถูกปฏิเสธ ให้แก้การผูก version/runtime ผ่าน Cloud Environment product/support โดยแจ้ง version/revision และ hostname จากรายงานนี้ ไม่ส่ง token/secret หรือ raw diagnostic logs

ไม่ต้องสร้าง Supabase/Vercel ใหม่ ไม่ต้องคัดลอก key ลงแชต และไม่ต้อง reset/live restore/migrate ซ้ำ

## คำสั่งที่มีจริงสำหรับ task ที่เข้าถึง Network ได้แล้ว

อ่าน AGENTS.md, README.md, DECISIONS.md, S1_READINESS_EXECUTION_TH.md และคู่มือนี้ก่อน
ตรวจ checkout/งานเดิมและ dependencies ตาม README โดยไม่เขียนทับงานที่ยังไม่ commit

```sh
NODE_USE_ENV_PROXY=1 node scripts/hosted-s1.mjs verify
npm run test:validation:hosted
```

คำสั่งแรกตรวจ metadata เท่านั้น คำสั่งที่สองทดสอบระบบจริงด้วย fixture และเปลี่ยนข้อมูลเฉพาะ run นั้น
suite ตรวจ origin/Project/Confirm email Off/สิทธิ์ cleanup ก่อน signup; ไม่ส่ง Email recovery หรือเรียก Google login ของ owner แทนบุคคล
ต้องได้10กรณีผ่านและ cleanup ที่ตรวจยืนยันแล้วก่อนถือว่าปิด subset S1 นี้
ครอบคลุม UI signup, bootstrap, HttpOnly/Secure/HTTPS/no-store, logout/login/session,
cross-user/tenant, read-only/revoked delegate/member, private WebSocket topics,
สองหน้าต่าง/dirty form, การแทน MFA ของ fixture และ global logout

หากหยุดกลางคัน ใช้ manifest ของ run/target จริงเท่านั้น:

```sh
node scripts/cleanup-validation.mjs .local/<ชื่อ-manifest-ของ-run-จริง>.json
```

ห้ามลบตาม email suffix แบบเหมารวม ห้ามแตะ owner จริงหรือปิด RLS/audit เพื่อให้ test ผ่าน
manifest/backup/QR/password/token อยู่ใน `.local/` ที่ ignored/private ไม่ส่งเป็น artifact หรือแชต

## หลัง S1 hosted ผ่าน

บันทึก target/commit/วันเวลา/จำนวนกรณี/cleanup จริง แล้วเริ่ม S2 ตาม C-25 โดยไม่ขออนุมัติชุดเดิมซ้ำ:
organization verification และ evidence quarantine → catalog lifecycle/backend/public search → assessment/bookmarks/rule matching
ใช้ [แผน6 PR](S2_EXECUTION_PLAN_TH.md) และ fixtures สมมติ ไม่ขยายไป AI/cases/LINE/paid provisioning/minor workflows
คู่มือและผล local ไม่แทน operational roster, backup policy หรือ manual device/UAT ก่อนผู้ใช้จริง
