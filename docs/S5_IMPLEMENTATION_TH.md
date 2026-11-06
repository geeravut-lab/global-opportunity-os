# S5 — Navigator และรายงานรวมตาม C-36

ขอบเขตจาก [แผน S5](S5_SCOPE_TH.md) ใช้ Next.js/TypeScript/Supabase และ dependency รุ่นเดิม ไม่มีบริการใหม่หรือค่าใช้จ่ายโมเดล
สัมพันธ์ BP-B-501–503, BP-AC-10/11/13 และหลัก REQ consent/privacy/tenant; การผ่านชุดสังเคราะห์ไม่ใช่การปิด release gates ทุกข้อ

## Functions/features ที่มีใน implementation

| ส่วน | การทำงาน | ขอบเขต |
| --- | --- | --- |
| Corpus | public revision ที่ผ่าน independent catalog review, bounded chunk ต่อภาษา, listing/revision/review/hash/URL/expiry แบบ immutable | ไม่อ่าน profile/case/evidence หรือ crawl URL; revalidate current listing/org ก่อนส่ง citation |
| Navigator | `/th/navigator` และ `/en/navigator`, อ่านคำค้นเป็นตัวกรองที่แก้ได้, opt-in ต่อการค้นหา, quotes/แหล่งต้นฉบับ/วันตรวจ/วันหมดอายุ | โหมด rules + source guidance ตามจริง ไม่มี external LLM, ไม่ตัดสินสิทธิ์/auto-apply และไม่มี paid ranking |
| ทางเลือก | ค้นหาปกติแบบ guest, needs assessment เดิม, หน้ารายการ/ช่องทางผู้ให้บริการ | ไม่สมมติว่ามีเจ้าหน้าที่รับเคสหรือบริการฉุกเฉินแล้ว |
| ความปลอดภัยคำค้น | ไม่เก็บ transcript/raw query, ตรวจข้อมูลส่วนตัว/ข้อความเร่งด่วน/ผู้เยาว์, provider prompt interface รับเฉพาะ structured filters + public chunks | heuristic ยังมีข้อจำกัด ต้องทดสอบมนุษย์ก่อนเรียกเป็น safety/relevance benchmark |
| Gateway | adapter interface ปิด default, ID-only output/citation validation, timeout/circuit breaker/fallback, DB budget30คำขอต่อชั่วโมงต่อบัญชี | ยังไม่มี live provider/model/key/terms; ไม่อ้างว่าเป็น production LLM gateway พร้อมใช้ |
| Impact | `/th/impact`, fixed closed UTC months ย้อนหลังไม่เกิน24เดือน, distinct people/current independent L2, snapshots รุ่น1 | ไม่ใช่ causal impact/L3 certification; counts ของแต่ละประเภทบวกเป็นจำนวนคนทั้งหมดไม่ได้ |
| Privacy | k10, ซ่อน complementary/exact membership patterns ทั้งประเภทและองค์กร, snapshot เปลี่ยนแล้ว invalidate และไม่ออกรุ่นย่อยของ cohort เดิม | ไม่มี arbitrary personal filters/raw drilldown; ไม่ใช่ differential privacy และไม่รับประกันป้องกัน auxiliary information ทุกชนิด |
| Report grants | `/th/admin/reporting`, exact-email lookup ของบัญชีที่มีจริง/MFA, current organization owner/admin/supervisor + expiring grant, platform เฉพาะ internal impact staff | ไม่สร้าง CSR buyer/contract แทนเจ้าของ; CSR external portal ยังไม่เปิด |
| Export/Live | JSON ใช้ DTO ที่ซ่อนข้อมูลชุดเดียวกับหน้าเว็บ ตรวจ grant/tenant/MFA ใหม่ทุกครั้ง; private revision signals + background revalidation และ grant revocation | ไม่ส่ง count/เคสเข้า Realtime; สัญญาณ/polling ไม่เรียกโมเดลซ้ำหรือทับ query draft |
| Lifecycle | ลบ usage metadata เมื่อ purge, invalidate snapshot; worker มี cleanup budget metadata ที่เกิน1วันเมื่อ S5 เปิด | ไม่มี query history; worker cleanup ไม่ใช่การรับรอง retention ของ provider/backup ภายนอก |

## Setup/test commands ที่มีอยู่จริง

```sh
npm ci
npm run db:start
npm run db:prepare-s5
npm run dev:s5
```

เปิด `http://127.0.0.1:3000/th/navigator` หรือ `/th/impact` ใช้ข้อมูลสมมติจาก `.local/s5-fixtures.json`
ไฟล์ credentials ถูก ignored/mode600 ห้ามส่งในแชต local launcher บังคับ loopback และตัด operator/worker/SMTP/Auth purge keys ออกจาก web process
seed สร้างบัญชี/องค์กร/เคส/consent/outcomes สังเคราะห์เพื่อทดสอบรายงาน ไม่ใช่การอ้างว่ามี partner หรือ human-verified impact จริง ห้ามใช้ seed กับ hosted และห้ามรัน suite ที่เปลี่ยน fixtures เดียวกันพร้อมกัน

```sh
npm run typecheck
npm run lint
npm run test:unit
npm run build
npx --no-install vitest run --config vitest.integration.config.ts tests/integration/s5.test.ts
npm run test:s5
npm run db:test:fresh
npm run test:backup-restore
```

`test:s5` seed และเปิด/ปิด server3400 เอง; integration seed ด้วย user JWT/MFA และ DB/RLS ในเครื่อง
restore ใช้ target แยก ไม่ restore ทับฐานจริง; commands ด้านบนมีอยู่จริง แต่ผลรันแต่ละรายการต้องดูตารางด้านล่าง ไม่ถือว่ารายการคำสั่งแปลว่าผ่านแล้วทั้งหมด

## ผลที่รันจริงก่อนเปิด PR S5

| การตรวจ | ผล |
| --- | --- |
| typecheck/lint/production build | ผ่าน รวม production build หลังเพิ่ม mobile navigation |
| unit | 349/349 รวม200 bilingual synthetic contracts และ50 adversarial contracts; ไม่ใช่ human-labelled Recall/precision |
| S5 integration | 11/11 ผ่าน รวม source injection, cross-organization overlap, UTC boundary และ distinct-person duplicate |
| browser | 7/7: filters/citations/fallback/spinner/no duplicate, minor/urgent/personal details, report/export DTO/grant revoke Live sync, Thai/English mobile/axe และ guest manual search |
| fresh1–70 | ผ่าน source ล่าสุด รวม metadata authorization helpers และ indexes |
| public browser/axe | 31/31 และ24/24 ผ่าน; mobile selected-menu6/6 แยกหลักฐานตาม C-37 |
| policy/purge บน schema67 | 10/10 ผ่านหลังเพิ่ม S5 purge hooks |
| restore67 | ผ่าน stack แยก รวม signed deletion/Auth replay และ idempotency |
| CI S5 / integration รวม | ยังรอรอบ PR แยก; ผล local แยก suite ไม่แทน CI ล่าสุด |

## Rollout และสิ่งที่ยังไม่อนุมัติ/ยังไม่ผ่าน

S5 ใช้ migrations66–70 เฉพาะ local และ `S5_ENABLED`/`private.s5_release` ปิด default
script hosted `--include-policy` หยุดที่65 ไม่มีการใช้ migrations S5 หรือเปิด flag S5 บน production ในงานนี้
ต้องตรวจ PR/CI แยกและได้รับอนุมัติ rollout S5; provider/key/model/vendor terms, human relevance/safety benchmark, external CSR contract/recipient process และ hosted privacy/restore UAT ยังไม่ผ่าน

การเลือก provider ครั้งถัดไปต้องคง raw query/PII/private cases นอก prompt, ไม่เพิ่ม model write tools และใช้ manual search ได้เมื่อ provider ล่ม/งบหมด
ประเมิน corpus retrieval ด้วย labels ของมนุษย์ก่อนเลือก embeddings/vector service หรืออ้าง KPI ใน Blueprint ไม่ใช้250 synthetic contracts แทนหลักฐานคุณภาพดังกล่าว

เพิ่ม CI `test:s5` และให้ job ฐานข้อมูล45นาทีรองรับ suite ที่เพิ่ม โดยคง SQL/API budget เดิม ไม่ถือว่าเวลาที่เพิ่มเป็นการผ่าน test

## Regression เมื่อข้อมูลสมมติสะสม

ชุดรวมก่อนแก้ performance ผ่าน112/124 ไม่ถือว่าผ่านทั้งหมด พบ note INSERT ของ S3 timeout8วินาทีจาก RLS join metadata ซ้อนกัน และมีผลต่อเนื่องใน scenario ถัดไป
migrations68เพิ่ม child-row indexes;69ให้ note RLS เรียก narrow boolean helpers ที่อ่านเฉพาะ metadata ตาม case UUID แล้วใช้ current progress/work/author/job visibility เดิม ไม่ให้ client อ่าน payload ผ่าน helper
rollback diagnostic ด้วยบัญชี/MFA สมมติ: เดิม statement timeout8วินาที หลังแก้123ms (เป็นการวัด DB ในเครื่อง ไม่ใช่ latency เว็บจริง)
กำลังตรวจ S2/S3/purge ซ้ำ; scenario S2 ที่ทำหลาย RPC ให้ test harness45วินาที โดยคง SQL/API timeout เดิม

ผลหลังแก้ performance: S2/S3/purge รวม42/42 ผ่านในรอบเดียว97.43วินาที เทียบกับรอบก่อน69ที่ผ่าน40/42ใน498.47วินาที (เวลานี้รวม setup/test หลายรายการ ไม่ใช่ SLA เว็บ)
migration70จำกัด historical revision metadata candidates และคง `goos_s3_visible` เดิม ตรวจ transition rollback ภายใต้ budget1วินาทีได้ผล invalid-state ที่คาดไว้ใน654ms แทนการ timeoutที่จุดอ่านrevision
ชุดรวม124และbrowserรอบสุดท้ายยังรอผล; ห้ามนำ42/42ไปเขียนว่าชุดรวม124ผ่านแล้ว
