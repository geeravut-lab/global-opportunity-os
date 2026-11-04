# ผลพัฒนา S2 — องค์กร catalog และคำแนะนำ

วันที่ 5 พฤศจิกายน 2026 ตามเวลาไทย อนุมัติเริ่มงานตาม C-28 หลังคำสั่ง “เริ่มทำ S2 ได้เลย”
เริ่มจาก main `152ff94` โดยเก็บ S1 hosted เป็น blocked และ Recovery/SMTP เลื่อนตาม C-24
ไม่เปลี่ยน P/G/นโยบาย Blueprint ที่ยังไม่อนุมัติให้เป็น accepted และไม่อ้างว่า full MVP/pilot พร้อมแล้ว

## Functions/features ที่มีโค้ดแล้ว

| กลุ่มงาน | สิ่งที่ใช้ได้ใน local | เส้นทาง |
| --- | --- | --- |
| S2.1 องค์กรที่ตรวจสอบแล้ว | สร้าง draft, submit/start review/request changes/verify/reject/suspend/appeal, expiry และ expected version; ผู้ตรวจไม่ใช่ creator/member และผู้ตัดสินเดิมรับ appeal เองไม่ได้ | `/th/workspace/organizations`, `/th/workspace/review` |
| S2.2 หลักฐานส่วนตัว | PNG upload intent/quarantine, decode/re-encode worker, reject malformed/oversize/MIME mismatch; download เฉพาะ safe bytes ด้วย current JWT/MFA/tenant checks และ attachment/no-store/nosniff | หน้าองค์กร, `/api/s2/evidence/{id}`, local worker |
| S2.3 Catalog lifecycle | immutable revisions, draft/submit/independent publish/request changes/pause/archive; material edit หยุด public จนอนุมัติใหม่; paid job ต้องมี compensation/contract และ cost0 | `/th/workspace/catalog`, หน้า review |
| S2.4 Public directory | backend search ไทย–อังกฤษ, category/country/area/language/accessibility/online/free, pagination20; safe detail/source/review/expiry/cost/capacity; no-results กับ backend unavailable แยกกัน | `/th/opportunities`, `/th/directory/{UUID}` |
| S2.5 ผู้ใช้ | assessment ที่ข้ามคำถามได้, draft/confirm/version lock, notice เฉพาะ purpose และประวัติยืนยัน append-only; own-only bookmarks แบบ idempotent, unavailable ไม่แสดงชื่อเก่า | `/th/workspace/assessment`, `/th/workspace/bookmarks` |
| S2.6 จับคู่ด้วยกฎ | coverage + allowlisted rules, eligible/ineligible/unknown พร้อมเหตุผลและ rule version; ยืนยัน assessment ก่อนใช้ ไม่ส่งข้อมูลให้องค์กร ไม่ auto-apply และค้นหาเองต่อได้ | `/th/workspace/matches` |
| Live/UX | private own signals, public-only catalog digest/signal และ deadline wake; dirty form ไม่ถูกทับ, stale save409; queue pagination/batch evidence ลด N+1; หน้าแรกสาธารณะ/พื้นที่ S2 ใช้ Opp4All cards และ smartphone bottom menu | บัญชี/ผู้ดูแลเชื่อม workspace ใหม่ทั้งไทย–อังกฤษ |

URL `/en/...` มีคู่กับภาษาไทยทุกหน้า Demo roles เดิมยังเป็น demo ไม่ให้สิทธิ์องค์กรหรือผู้ตรวจจริง
ข้อมูลที่ seed เป็นสมมติทั้งหมด ไม่มีองค์กร/partner claims/beneficiary ที่ตรวจจริงจากการรันทดสอบ

## ขอบเขตไฟล์และการทบทวน

แบ่งเป็น3 review slices ที่ต่อกัน แทนการรวมทั้ง Phase เป็น diff เดียว:

1. `feat/s2-data-foundation`: migrations14–17, worker/fixtures local, consent/permissions tests, ADR และ C-28
2. `feat/s2-catalog-api`: BFF S2/validators/OpenAPI, public backend directory/detail/bookmarks และ input tests
3. `feat/s2-verified-directory`: workspace/role menus/Live sync, queue batch migration18, browser tests, CI และคู่มือ

เปิด PR สำหรับ review แล้ว: [#3 ฐานข้อมูล](https://github.com/geeravut-lab/global-opportunity-os/pull/3) → [#4 API](https://github.com/geeravut-lab/global-opportunity-os/pull/4) → [#5 UX/tests](https://github.com/geeravut-lab/global-opportunity-os/pull/5); ยังไม่ merge/rollout S2

กลุ่ม functions6เรื่องในแผนเดิมยังครบ การแบ่ง PR เป็นการเลือกทางเทคนิคสำหรับ review ไม่ใช่การอนุมัติ scope เพิ่ม
ไม่มี dependency ของแอปเพิ่ม `package-lock.json` คงเดิม ใช้ formatter Prettier3.9.10 ชั่วคราวจาก npm โดยไม่เพิ่ม runtime dependency
สถาปัตยกรรมและข้อจำกัดอยู่ [ADR-004](adr/ADR-004-S2-TH.md); สัญญา BFF อยู่ [OpenAPI](../api/s2.openapi.json)

## Checks ที่รันจริง

| คำสั่ง/target | ผลที่ตรวจ |
| --- | --- |
| `npm run typecheck`, `npm run lint`, `npm run build` | ผ่านสำหรับชุด S2 |
| `npm run test:unit` | ผ่าน74กรณี รวม payload/rule bounds, unknown/zero hours, paid job terms, URL/PII field rejection และ expiry scheduling |
| `npm run test:integration` / Auth+PostgREST+DB local | ผ่าน60กรณี:45เดิม+15 S2; actor/tenant/MFA/reviewer conflict, current/expired/suspended, immutable revisions/notices/consent, metadata batch, null/racing versions, own-only assessment/bookmarks, public-vs-private fingerprints |
| `npm run test:s2` / Chromium/local3200 | ผ่าน13กรณี รวม UI login/MFA, search/detail/stale scenarios, bookmark persistence, assessment draft/confirm/unknown, independent UI publish พร้อมข้อความไทยขนาดใหญ่, CSRF/MIME, two-window draft/conflict, public pause Live sync และ accessibility |
| accessibility ใน `test:s2` | axe tags WCAG2/2.1/2.2 AA, keyboard/skip และ320px reflow รวม20 language/path combinations ของ public/profile-workspace/องค์กร/review; ไม่อ้าง NVDA/VoiceOver/Thai human UAT หรือรับรอง WCAG ครบ |
| `npm run test:auth` | ชุดฐาน S1ผ่าน28กรณีในรอบพัฒนา; รวม local Mailpit/PKCE ไม่ใช่ hosted Recovery/SMTP |
| `npm run test:validation:local` | ผ่าน10กรณีบน stack563xx ที่ใช้ migrations18: Confirm email Off, private WebSocket ACL/payload, tenant/revoke/MFA/session, two-window draft/conflict และ exact fixture cleanup; ไม่ใช่ผล hosted |
| `npm run test:e2e`, `npm run test:a11y` | ค่าเริ่มต้น S2ปิด ผ่าน25และ24กรณีในรอบพัฒนา ไม่ทำให้ prototype กลายเป็น backend จริงโดยไม่เปิด flag |
| `npm run db:test:fresh` | ผ่าน migrations ทั้ง18ไฟล์บน fresh stack แยกจากต้นทาง รวม Auth/bootstrap/profile/consent และตรวจ S2 catalog/assessment RPC |
| `npm run test:backup-restore` | ผ่านบน schema18ไฟล์:34 table fingerprints/74 policies/exact ACL/PNG/password/MFA/audit/revoke replay บน target แยก ใช้102วินาที |

`npm run dev:s2` เปิด local3000 และ `/api/s2/catalog` ตอบ200/no-store; production launcher local3200 ผ่าน smoke2กรณี; ตรวจภาพหน้าแรก anonymous ที่390px/1280px ใน local โดยไม่ถ่ายข้อมูลบัญชี/OTP
GitHub CI ของ PR S2 ต้องอ่านตาม run จริง ไม่ใช้ผล local แทน CI และไม่แนบ private fixture manifests/backup/OTP/QR เป็น artifact
fixtures/credentials อยู่ `.local/` ที่ ignored/private และ Docker local เท่านั้น ไม่มี fixture hosted ที่ต้องลบในงานนี้
fixtures local คงไว้เพื่อทบทวน ไม่อ้างว่าได้ purge immutable history แล้ว; รอบ seed ใหม่ถอนเฉพาะสิทธิ์ reviewer สมมติจาก manifest เดิม และ integration teardown ถอนสิทธิ์ reviewer ของรอบนั้น เพื่อลด signal fanout โดยไม่ลบบัญชี/ประวัติ

## ข้อผิดพลาดที่พบและแก้ระหว่างตรวจ

- หน้าแรก/เมนู S2 เชื่อมกับ backend/workspace จริงและไม่นำ mock detail IDs ไปยังไดเรกทอรี UUID; ค่าเริ่มต้น S2ปิดคงต้นแบบเดิม
- expired upload ถูก RLS ปฏิเสธเป็น not-found เพื่อไม่เผยข้อมูล ปรับการทดสอบให้ตรวจ deny ตามขอบเขตจริง
- คิว review เดิมเรียก evidence แยกตามองค์กรจนหน้า refresh ช้าเมื่อ fixtures สะสม แก้ด้วย batch RPC และหน้าละ20รายการ; UI รอ refresh หลังบันทึกเพื่อกันกดซ้ำ และทดสอบหลังรอผล POST ที่ยืนยันสำเร็จ
- เมื่อ RPC ของหน้าส่วนตัวขัดข้องแสดงข้อผิดพลาด ไม่แปลงเป็นผลว่าง; ไม่เรียก staff listing queue ก่อน MFA
- แยก notice/confirmation history ของ assessment ออกจาก profile และปิดการใช้ notice ข้าม purpose
- ตรวจ null expected version และ concurrent save ให้มีผู้ชนะคนเดียว; ไม่ใช้การซ่อนปุ่มแทน DB tests
- แยก public catalog fingerprint ออกจาก private drafts/reviews และปลุก polling ตาม deadline เพื่อไม่ค้างสถานะเก่าบน bookmark
- CI ของ PR#5 รอบ `3db8731` ผ่าน check:s1/test:s2/fresh แต่เริ่ม validation stack ไม่สำเร็จ; local เริ่ม/หยุดซ้ำไม่พบปัญหาเดียวกัน โลกรอบนั้นอยู่บน host ที่ Network ของ task อ่านไม่ได้ จึงยังไม่สรุปสาเหตุ เพิ่ม diagnostic เฉพาะ phase/exit/reason enum โดยไม่ส่ง private logs/keys และไม่ข้าม tests; ผล head ใหม่ให้อ่านจาก CI จริง
- restore ลง target ที่ apply app schema ใหม่กว่า archive พบ FK constraint conflict จึงเตรียม provider base+app roles เท่านั้น แล้ว restore schema จาก archive; ไม่เปลี่ยนต้นทาง/live และไม่ปิด audit/RLS เพื่อให้ผ่าน

## สิ่งที่ยังไม่ได้ทำบนระบบจริง

ยังไม่ apply migrations14–18, ไม่ seed partner/beneficiary fixtures และไม่เปิด S2 flag บน Supabase/Vercel production ในรอบพัฒนานี้
production เดิมจาก S1 ยังใช้13 migrations; การ push feature branches/PR preview ไม่เท่ากับเปิด S2 ให้ผู้ใช้จริง
Network ของ task ยังบล็อก frontend/provider hosts จึงยังไม่ผ่าน hosted browser/HTTPS/Realtime/tenant smoke; C-28 อนุญาตพัฒนา ไม่ใช่หลักฐานว่า S1ผ่าน

PNG inspector ไม่ใช่ antivirus สำหรับ PDF/Office และ worker นี้รัน local แบบ operator ไม่ใช่ production service/cron
ก่อนใช้หลักฐานจริงต้องกำหนดชนิดเอกสาร/scan policy/worker/retention และผู้ตรวจอิสระจริง ไม่ให้ status clean จากคำยืนยัน client
ไม่มี approved production processing/retention notices, staffed support/SOP หรือ backup policy ที่ครบจากการเขียน dev notice; provider backup0/PITRfalse ยังเป็นช่องว่างก่อนข้อมูลจริง

## ขั้นถัดไปตาม Phase

1. **S2 review/rollout:** ทบทวน PRทั้ง3ส่วน, migration checksums/CI, เลือกขอบเขต environment/worker/ผู้ตรวจ แล้วนำขึ้นระบบด้วยแผนย้อนกลับที่รักษาข้อมูลเดิม
2. **S2 เอกสารจริง:** ยืนยัน PNG-only หรือเพิ่ม PDF/Office และ AV/quarantine path ที่มีหลักฐาน, production worker/monitoring/revalidation; ไม่รับรอง scanner ที่ยังไม่ได้ติดตั้ง
3. **S1 hosted:** ให้ task ใช้ Network รุ่นใหม่แล้วรัน Email/session/สองหน้าต่าง/Realtime/permissions/cleanup จริง; Recovery/SMTP ยังคงเลื่อนไม่บล็อกการพัฒนา S2
4. **ก่อนผู้ใช้จริง:** approved privacy/retention, recovery/owner/ops roster, backup/RPO/RTO, manual device/AT/UAT และ Recovery/SMTP ตาม gate ที่เกี่ยวข้อง
5. **S3 ที่ยังเป็นแผน:** consent preview→atomic application/share/event/outbox, case queue/assignment/progress และ notification delivery; ไม่ถือว่าเริ่ม S3 จากคำสั่งเริ่ม S2
