> สถานะล่าสุด C-32: รวมPR3–8และdeploy S2/S3 productionแล้ว ดู [รายงาน rollout](PRODUCTION_ROLLOUT_TH.md); ผล/ข้อความก่อนC-32ด้านล่างรักษาไว้เป็นหลักฐานตามวันที่ ไม่ใช่สถานะrolloutล่าสุด

# ผลพัฒนา S3 — ใบสมัคร เคส และการแจ้งเตือน

วันที่5พฤศจิกายน2026 ตามเวลาไทย เริ่มจาก S2 `8fdd573` ตาม C-29; C-30/C-31 เพิ่ม typography/color และ spinner ระหว่างงาน
main `213b6e9` เพิ่ม knowledge ตัวอักษร/สารบัญ นำสองไฟล์นั้นมาตรงต้นทางโดยไม่ทับ code S2/S3
S1 hosted ยัง blocked; S2/S3 อยู่ local/feature PR ไม่ถือว่าระบบจริงผ่านหรือ pilot พร้อม

## Functions/features ที่มีโค้ดแล้ว

| กลุ่ม | พฤติกรรม/ขอบเขต | หน้าไทยและอังกฤษ |
| --- | --- | --- |
| BP-B-301 ใบสมัคร | exact recipient/purpose/notice/fields → preview/hash/expiry → explicit consent; atomic package/share/event/outbox/receipt; idempotent concurrent submit; expected versions/last seat; request-info ต้อง consent ใหม่; withdraw และ revoke future sharing | `/th/workflow/apply/{id}`, `/th/workflow/application/{id}`, `/th/workflow/applications` |
| การช่วยสมัคร | delegation แยก prepare/submit/progress, expiry/revoke/read-back; helper ไม่เป็นเจ้าของข้อมูลและไม่มี whole-profile access | `/th/workflow/settings`, apply preview |
| BP-B-302 คิวเคส | metadata-only routing, supervisor assign/reassign, current assigned caseworker+MFA, internal/shared encrypted append-only notes/corrections, triage/progress/due UTC/IANA zone/resolve/close/reopen/history | `/th/workflow/queue`, team และ application detail |
| งานสำหรับผู้ใหญ่ | recruiter assignment, interview/offer/decline, ผู้ใช้ accept_offer, case started/resolved ก่อน recorded started/completed; แสดง compensation/contract ที่ freeze ไว้ | application detail; ไม่มีการเรียกเก็บเงินหรือรับรองผลจ้างงาน |
| BP-B-303 แจ้งเตือน | generic inbox/deep links/settings, channel opt-in ณ event creation+recheck, opt-out ยกเลิกคิว, transactional outbox/lease/dedupe/backoff5/dead letter/manual retry, typed followup_due และ dry-run writes0 | `/th/workflow/settings`, `/th/workflow/automation`, `/th/workflow/delivery` |
| Live/UX | private empty signals+fingerprint; ถอน package access แม้มี draft; form ปกติรักษาข้อมูลและ stale save409; role menus/cards/bottom bar ตาม Opp4All | `/th/workflow` และคู่ `/en/...` |
| Typography/loading | self-hosted Geist/Noto Sans Thai, rem/tokens/contrast/16px controls/44px targets, spinner+ข้อความระหว่าง API/navigation/search/download และกันกดซ้ำ | shared components ทุก Phase ที่มีโค้ด ตาม [รายงาน UX](TYPOGRAPHY_LOADING_REPORT_TH.md) |

## PR ที่ต่อกัน

[#6 ฐานข้อมูล/API/สิทธิ์](https://github.com/geeravut-lab/global-opportunity-os/pull/6) → [#7 typography/loading](https://github.com/geeravut-lab/global-opportunity-os/pull/7) → [#8 หน้าจอ/tests/รายงาน S3](https://github.com/geeravut-lab/global-opportunity-os/pull/8)
ต่อจาก S2 #3–5 ยังไม่ merge/rollout; CI ชุดโค้ดรวม `443167c` และฐาน `6ec1a35`: check+s1-local ผ่านทั้ง push/pull_request
Vercel Preview ของ UX `9227f0c` ผ่าน; การอัปเดตหลังชุดโค้ดรวมเป็น tests/ภาพ/เอกสารเท่านั้น ไม่มี runtime code เปลี่ยน
ดู Checks ของ commitล่าสุดในแต่ละ PR ก่อน merge; ผลCIของcommitที่ระบุไม่ใช่ hosted UAT

## ไฟล์และสถาปัตยกรรม

- migrations0019–0031 เพิ่ม schema/workflow/outbox/guardrails และ UI DTO; ไม่แก้001–018ที่เป็นฐาน
- `lib/s3`, `/api/s3/[...path]`, workflow page/panel/menu/live authorization และ [OpenAPI](../api/s3.openapi.json)
- `scripts/seed-s3-fixtures.mjs`, `s3-app.mjs`, `s3-worker.mjs` และ integration/browser/unit/CI/fresh/restore เพิ่มจากของเดิม
- `app/theme.css`, globals/icons, Fontsource dependencies/licenses และ design-token lint; central activity/link/form/router/download wrappers
- [ADR-005](adr/ADR-005-S3-TH.md), [แผน](S3_EXECUTION_PLAN_TH.md), decision/knowledge/README/next steps และคู่มือ restore

ใช้ nodemailer10.3.1, Fontsource Variable Geist/Noto Sans Thai5.3.0 แบบ exact pins+lockfile
เลือกจาก npm official metadata และเอกสาร package; Node24/frameworkเดิม ไม่มี frameworkหรือserviceใหม่
คำสั่งที่มีจริงใน [README](../README.md); ไม่ใช้ตัวอย่าง planned commands เป็นผลรัน

## ผลตรวจจริง

| คำสั่ง / target | ผลที่รันจริง |
| --- | --- |
| typecheck / lint+design tokens / production build | ผ่านชุดรวม S3/typography/loading |
| `npm run test:unit` | 81/81 ผ่าน input/authorization/model/contrast และ manifest palette |
| `npm run test:integration` local543xx | 77/77 ผ่าน; S3เพิ่ม17ข้อ รวม submit10พร้อมกัน/idempotency/capacity/role/reassign/consent/worker/SMTP และฐาน S1/S2 |
| `npm run db:test:fresh` | 31 migrations ติดตั้งจากศูนย์บน target553xx ผ่าน Auth/bootstrap/profile/S2/S3/worker boundary; targetหยุดแล้ว |
| `npm run test:e2e` / `npm run test:a11y` | หน้าเดิม25/25 และ accessibility24/24 ผ่าน รวม HTTP404/reflow/keyboard |
| `npm run test:validation:local` target563xx | 10/10 ผ่าน Confirm email Off/session/private WebSocket/สองหน้าต่าง/dirty draft/revoke/tenant; targetหยุดแล้ว |
| browser typography/axe/reflow | 26กรณีผ่าน (13เส้นทาง×2ภาษา): axeที่1280px, reflow390/320px, computed body/controls≥16px และ h1≥24px; fonts จาก originเดียว |
| Markdown/OpenAPI refs/secret scan | links ผ่าน, OpenAPI22paths refsผ่าน, ไม่พบ injected secrets ในไฟล์เปลี่ยน, migrations001–018ไม่เปลี่ยน |
| `npm run test:s3` | 12/12 ผ่าน ครบ preview/submit/assignment/notes/reassign/close/dirty settings/สองภาษา/automation/revoke-sharing รวม spinner ที่หน่วง API/route/search และกดซ้ำ |
| `npm run test:backup-restore` | ผ่าน74วินาที, fingerprint54ตาราง/120 RLS policies/ACL/binary asset/Auth password/MFA, decrypt S3 package+key และ idempotent withdrawal/session replay ก่อนเปิด target573xx; targetหยุดแล้ว |

integration77/77 รอบยืนยันรวม lost-lease reclaim/stale ack และ manual-retry authorization/budget ผ่านแล้ว
Auth28กรณีตรวจครบ:27ผ่านชุดเต็ม + profileผ่านรอบยืนยันด้วย `playwright test --config playwright.auth.config.ts --grep "profile creation/edit"`; ยังคง version/escaped-text/conflict assertions ครบ
`npm run test:s2` ผ่าน13/13 (รวม20หน้า/ภาษาของ axe/reflow และ two-window/live pause)
spinner regression ล่าสุดผ่าน2/2 หลังใช้ pending-state ร่วมกัน; ทดสอบ login/navigation โดยรอ completion จริงสูงสุด20วินาที ไม่มี timer ปิดสถานะรอในแอป
ชุด Auth เดิมรอบแรก27/28 ส่วน profile ผ่านหลังเพิ่มการรอ spinner; คำสั่งรันทวนข้างต้นเป็นผลที่ใช้ปิดกรณีนั้น ไม่กล่าวว่ารอบแรกผ่าน28/28
ฟอนต์ตรวจ FontFace.load ได้จริง (Geist1face/Noto Sans Thai2faces สถานะloaded) และ HTTP200ทั้ง3ไฟล์จาก local origin
ผลผ่านข้างต้นเป็น local/synthetic เท่านั้น ไม่ใช้แทน hosted readiness

พบ regression audit export timeout บนประวัติ local ที่สะสมมาก จึงเพิ่ม migration0031:
index ตาม occurred_at และ initplan ของ role/MFA predicate ต่อ statement โดยไม่ลดขอบเขต RLS หรือความเป็น append-only
ไม่ล้างประวัติ ไม่เพิ่ม timeout เพื่อทำให้ test ผ่าน
restore guard เดิมไม่รับตัวเลขในชื่อตาราง จึงแก้ identifier allowlist และ resume เฉพาะ exact synthetic subject/listing หลังการทดสอบหยุดกลางคัน ก่อนผล restore ที่ผ่านข้างต้น

## ข้อจำกัดที่ยังเปิดอยู่

1. local มี31 migrations; hostedยัง13และ flags S2/S3ปิด ค่า default operator เลือก≤13; include-s2≤18 และ include-s3≤31 แยกชัดเจน ยังไม่รันสอง scope ใหม่บน hosted
2. SMTP adapter ส่งเฉพาะ Mailpit/fake @example.test ในเครื่อง ไม่มี production worker/cron/provider/LINE/webhook; SMTP at-least-once มี stable Message-ID แต่ไม่ใช่ exactly-once
3. encryption key ยังอยู่ private DB/backup เดียวกัน ไม่ได้ KMS/separate trust boundary; policy preview15นาที/share30วัน/idempotency24ชั่วโมง/retry5/capacity ยังเป็นค่าทดสอบทางเทคนิค
4. notices เป็น development/synthetic ฉบับแยก purpose ไม่ใช่ legal production notices; ต้องกำหนด retention/incident/recipient contracts/เจ้าหน้าที่ก่อนข้อมูลจริง
5. S1 hosted Email/Realtime/สิทธิ์ยังติด runtime Network; Recovery/SMTP Auth เลื่อนตาม C-24; local SMTP S3 ไม่ใช่การปิด Recovery
6. automated axe/keyboard/reflow ไม่แทน NVDA/VoiceOver/Safari/iOS/Android และ human language review; restored local backup ไม่แทน hosted PITR/RPO/RTO
7. S4 warm referral/outcome verification/report/privacy lifecycle และ S5 AI/aggregate impact ยังไม่เริ่ม ไม่กล่าวว่า phase ถัดไปเสร็จจาก notes/recorded status ของ S3

## ขั้นถัดไปให้เจ้าของเลือก

1. **S2–S3 review/rollout:** ทบทวน PR ตาม dependency แล้วกำหนด migration/flags/worker/notices/UAT target
2. **S3 operations:** production worker/monitor/dead letter/SMTP opt-in/roster และ privacy/key/retention decisions
3. **S1/S6 readiness:** แก้ task runtime access, hosted Email/two-window/revoke/tenant tests, Recovery/SMTP และ hosted restore/manual AT
4. **S4 หลังอนุมัติ:** warm referrals/recipient acceptance, outcomes/evidence, report/appeal/safeguarding และ privacy requests

รายละเอียด functions/features และเงื่อนไขอยู่ [NEXT_STEPS](NEXT_STEPS.md); ไม่ถือว่ารายการนี้อนุมัติเริ่ม Phase ใหม่
