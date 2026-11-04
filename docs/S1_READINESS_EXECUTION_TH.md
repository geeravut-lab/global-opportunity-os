# งานปิด S1 และเงื่อนไขเริ่ม S2 ตาม C-23–C-25

ใช้ C-22 Confirm email Off และคำสั่งเจ้าของรอบล่าสุดเป็นขอบเขต ไม่เปิด confirmation กลับเอง
เชื่อม BP-AC-02/03/08/17/18 และ BP-G3/G4/G6 เฉพาะหลักฐานที่ตรวจจริง

| งาน | หลักฐานที่ต้องได้ | ผลที่ตรวจจริงรอบนี้ |
| --- | --- | --- |
| Email hosted | signup ผ่านหน้าเว็บ, bootstrap, HttpOnly/Secure/no-store, reload, logout/login, global session revoke | รอ network มีผลกับ runtime |
| Live sync | สอง browser contexts, own profile update, dirty form ไม่ถูกทับ, private Broadcast authorization และ polling fallback | local ผ่าน รวม own-topic WebSocket SUBSCRIBED/foreign-topic deny และ payload ไม่มี record fields; hosted blocked |
| สิทธิ์ | direct-ID cross-user/tenant deny, read-only/revoked delegate, revoked member ด้วย token เดิม, no role escalation | local ผ่าน; เพิ่ม regression ไม่ส่งกิจกรรมให้ revoked delegate/member; hosted functional tests ยัง blocked |
| Fixture safety | run manifest, UUID allowlist, ไม่แตะ protected owner, cleanup บัญชี/องค์กรสมมติเท่านั้น; audit ID-only คงไว้ | positive/forged manifest ผ่านและ cleanup รอบ local แล้ว; hosted preflight หยุดก่อน signup ไม่มี hosted fixture |
| MFA/owner | runbook กู้ factor/เพิกถอน sessions/โอน owner แบบระบุคนเดิม–คนใหม่และตรวจ MFA; ไม่โอน owner จริงในรอบนี้ | คู่มือทำแล้ว; ซ้อมลบ factor สมมติ/ตรวจ old assurance deny/enroll factor ใหม่ผ่าน; real owner ไม่เปลี่ยน |
| Accessibility | axe, keyboard/focus/Back, zoom/reflow, ชื่อ/ลำดับใน accessibility tree; รายงาน AT/device ที่รันและไม่รันตรงจริง | Orca43.1 + headful Chromium156 ผ่าน8เส้นทาง public/profile/admin ไทย–อังกฤษ มี spoken controls, keyboard/axe/reflow; ไม่รัน NVDA/VoiceOver หรือ human Thai comprehension |
| Backup/restore | backup จาก DB local สมมติ, restore ลง target แยก, เทียบข้อมูล/ACL/RLS/trigger, ตรวจ login/MFA และ asset หลัง restore | ผ่าน local25 table fingerprints/51 policies/exact ACL/PNG/password/TOTP/audit/replay ใน107วินาที; hosted backup0/PITRfalse ไม่ restore ระบบจริง |
| Email Recovery/SMTP | provider/sender/delivery/recovery จริง | **เลื่อนตาม C-24** ต้องทำก่อน real-user production launch ไม่ใช่เงื่อนไขเริ่ม S2 รอบนี้ |

## การเริ่ม S2

C-25 อนุมัติ organizations verification, catalog backend/search, needs assessment/bookmarks/rule matching แล้วแบบมีเงื่อนไข
เมื่อ S1 ส่วนที่สั่งเสร็จและมีหลักฐาน จึงเริ่ม implementation S2 โดยไม่ขออนุมัติชุดเดิมซ้ำ
ระหว่างมี blocker ทำงาน S1 ที่เป็นอิสระและเตรียมแผน S2 ต่อได้ ไม่ทำเครื่องหมายผ่านให้สิ่งที่ยังไม่รัน
ไม่ถือว่าอนุมัติ AI/ใบสมัคร/เคส/LINE/paid provisioning หรือ personalized minors

## Network และการส่งต่องาน

draft มี `opp4all.vercel.app` และ `fxqgvqvthrdzmgnmqgom.supabase.co` โดยรักษา API domains/secret bindings เดิม
เจ้าของแจ้ง Publish/apply แล้ว แต่การตรวจ runtime รอบแรกยังเป็น published version เดิมและ allowlist มีเฉพาะ management APIs
การ Publish template ไม่รับรองว่า running task ถูกย้าย version; ต้องตรวจ destination จริงก่อนเริ่ม hosted writes
ห้ามหลบ proxy/ปิด TLS หรือใช้ API domain เป็น proxy ไปยัง hostname ที่ถูกบล็อก
หลักฐานแต่ละรอบบันทึก target/เวลา/จำนวนกรณี/ผล cleanup โดยไม่รวม credentials หรือ real beneficiary data

## ผลคำสั่งที่รันและการแก้ที่เกิดจากการทดสอบ

วันที่2026-11-04 บน branch `feat/s1-readiness-validation` จาก main `cd632dd`:

| คำสั่ง / target | ผลจริง |
| --- | --- |
| `npm run db:validation:start` / local563xx | เริ่ม stack แยก Confirm email Off พร้อม Realtime และ apply migration ใหม่ได้ |
| `npm run test:validation:local` | ผ่าน10กรณีใน22.3วินาที ใช้ Auth/PostgREST/WebSocket จริง; signup/logout/login/refresh, user/tenant, delegation/member revoke, two windows/dirty form, fixture guard, MFA replacement, global logout |
| `npm run test:integration` / local543xx | ผ่าน45กรณี |
| `npm run db:test:fresh` / target553xx | migrations13ไฟล์ + real Auth→bootstrap→profile/consent ผ่าน; หยุดเฉพาะ stack ที่สร้าง |
| `npm run test:backup-restore` / source543xx→fresh573xx | ผ่าน snapshot/import/ACL/Auth/MFA/audit/revocation replay; source/target เป็น fixture เท่านั้น |
| `npm run test:a11y:orca` / local563xx | ผ่าน8เส้นทาง,134 speech output lines, WAV4913388bytes; เก็บ private ไม่ commit raw speech/credentials |
| `npm run typecheck`, `npm run lint`, `npm run test:unit`, `npm run build` | ผ่าน; unit65กรณี |
| `npm run test:auth` / local543xx | ผ่าน28กรณี รวม Confirm email On/PKCE/recovery เดิมใน Mailpit; ไม่ถือว่า hosted SMTP/recovery ผ่าน |
| `npm run test:e2e`, `npm run test:a11y` | ผ่าน25และ24กรณีตามลำดับ |
| `npm run test:validation:hosted` | ไม่ผ่าน preflight เพราะ runtime เข้าถึง host ไม่ได้;1 blocked/9ไม่รัน ไม่มี signup หรือ hosted fixture |
| `NODE_USE_ENV_PROXY=1 node scripts/hosted-s1.mjs preflight/migrate/verify` | รัน3คำสั่งแยก; apply เฉพาะ migration0013 atomically; ledger13, unsafe roles0, tables without RLS0, owner/settings/realtime/audit guards อยู่ครบ |

พบ bug จริงจาก regression: trigger เดิมเพิ่ม revision ให้ delegate/member ที่ถอนแล้ว แม้ data RPC ปฏิเสธการอ่าน
แก้ด้วย `202611040013_live_authorized_fanout.sql` กรองผู้รับที่ยังมีสิทธิ์ ส่ง withdrawal ให้ผู้ได้รับผลครั้งสุดท้าย
เพิ่ม role-change trigger, ลำดับ recipient lock คงที่ และ polling fingerprint ตรวจ current MFA/platform role/invitation expiry
ไม่แก้ migration0001–0012 ที่ apply แล้ว ไม่ขยาย Realtime topic policy และไม่ส่ง record/PII ใน Broadcast
Realtime provider อาจเติม generated delivery UUID ใน `payload.id`; ไม่ใช่ account/record ID ของแอป

drill พบ default ACL เพิ่มบน target หลัง restore จึงเพิ่ม exact source ACL reconciliation และ negative RPC grants check
พบ cleanup DELETE trigger สร้าง revision กลับก่อนลบ account จึงเรียง cleanup ให้ลบ subject ก่อน revision; cleanup run ที่ค้างผ่านการตรวจซ้ำแล้ว
ไม่ซ่อนข้อผิดพลาดเหล่านี้ด้วยการปิด RLS/audit/authorization tests

หลักฐาน raw อยู่ `.local/` ที่ ignored/private; ไม่แนบ dump/manifest/token/password/QR ใน PR
CI เพิ่ม validation+restore แล้ว แต่ผล GitHub run ต้องรายงานตามที่ตรวจได้ ไม่ใช้ผล local แทน CI

## สิ่งที่ยังค้าง

S1 hosted Email/HTTPS cookies/สองหน้าต่าง/Realtime/สิทธิ์ยังต้องรันจริงเมื่อ runtime ใช้ network version ใหม่
local HTTP cookies ไม่มี Secure ตาม loopback; Secure/HTTPS ของ production ยังไม่ผ่านจาก suite รอบนี้
ก่อนผู้ใช้จริงต้องกำหนด operational recovery/owner roster, backup policy/RPO/RTO และ manual device/UAT ตามเป้าหมาย
Email Recovery/SMTP เลื่อนไว้ตาม C-24; S2 implementation รอ hosted S1 ไม่ใช่รอ Recovery และไม่ต้องขออนุมัติ C-25 ซ้ำ
