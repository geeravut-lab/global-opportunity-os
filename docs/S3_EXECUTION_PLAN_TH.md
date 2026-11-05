# แผนดำเนิน S3 ตาม C-29

วันที่ 5 พฤศจิกายน 2026 ตามเวลาไทย เจ้าของอนุมัติ “ดำเนินการ S3 ทั้งหมดต่อเลย”
ฐานคือ S2 `8fdd573` และ PR #3–5 ที่ผ่าน CI แต่ยังไม่ merge/rollout งาน S1 hosted ยัง blocked
ขอบเขตนี้เลือกวิธีทางเทคนิคให้ทดสอบได้ ไม่รับรอง P/G/นโยบายข้อมูลจริงหรือราคา/retention แทนเจ้าของ

| ส่วน | Functions/features | Acceptance และหลักฐานที่จะตรวจ |
| --- | --- | --- |
| BP-B-301 | เลือก exact fields/recipient/purpose/notice → preview hash/expiry → explicit confirmation; atomic application/package/share/event/outbox/receipt; request-info พร้อม consent ใหม่; withdraw; delegation แยก prepare/submit/progress | BP-AC-04/05/06/09; submit พร้อมกัน10ครั้ง, key/body conflict, stale preview/profile/revision/role, null versions, unique active application/cycle, one last seat และ rollback ไม่มี partial share |
| BP-B-302 | routing metadata, assign/reassign, worker/recruiter ที่ได้รับมอบหมาย, encrypted internal/shared notes และ corrections, triage/progress/due date/timezone/closure/reopen; job interview/offer/decline และผู้ใช้ accept offer/started/completed | BP-AC-08/09 และส่วนของ07; owner/admin ไม่อ่าน package เอง, foreign/revoked/unassigned deny, reassign ถอนสิทธิ์เดิม, recruiter ไม่เห็น NGO/internal notes, human-only transitions |
| BP-B-303 | generic inbox/deep links/settings, transactional outbox/worker leases/dedupe/backoff/dead-letter/monitoring, SMTP adapter ทดสอบ Mailpit, typed follow-up rule/dry-run/timezone | BP-AC-19; duplicate jobs/ack, lost lease/reclaim, opt-out/revoke/withdraw ก่อนส่ง, generic email ไม่มีชื่อรายการ/ข้อมูลเคส, retry ไม่เปลี่ยนธุรกิจซ้ำ |
| UX/operations | ไทย–อังกฤษ, Opp4All cards/mobile bottom bar, private signals/dirty draft, OpenAPI, fixtures/CI, fresh schema/restore/withdrawal replay | REQ-06/07/10/13/15; AC-05/06/10/14/16 ของ starter เป็น subset แยกจาก BP-AC; keyboard/axe/reflow และ local restore ไม่แทน hosted/human UAT |

แบ่ง review เป็น data/API/permissions → typography/loading ที่ใช้ร่วมทุกหน้า → workflow UI/tests/docs โดยต่อจาก branch S2 ไม่ overwrite main
เลือก SMTP library จาก metadata/เอกสารทางการและ pin exact version ก่อนใช้ ไม่ provision vendor/paid service
Email ทดสอบเฉพาะ local Mailpit และ fake addresses; external delivery/provider webhook/LINE ไม่ถูกเปิดจากคำสั่งนี้
preview15นาที, share30วัน, idempotency24ชั่วโมง, retry5ครั้งเป็นค่าทดสอบทางเทคนิค ไม่ใช่นโยบาย production ที่อนุมัติ
key encryption อยู่ private DB ใน local; ไม่อ้างว่าแยก KMS/backup trust boundary แล้ว

S4 warm referral/outcomes/safety/privacy request lifecycle และ S5 AI/aggregate impact ยังไม่เริ่ม
ข้อจำกัดและผลจริงจะบันทึกในรายงาน S3 หลังรัน ไม่ใช้ตารางนี้เป็นผล passing tests
