# งานถัดไปตามคำสั่งปิด S1 และดำเนิน S2

วันที่ 2026-11-04 ใช้ C-18 และ C-23–C-25; ทุกคำตอบจบ prompt ต้องแจ้งงานถัดไปในแชตด้วย
ดู [หลักฐานรอบล่าสุด](S1_READINESS_EXECUTION_TH.md), [แผนทุก Phase](PHASE_PLAN_TH.md) และ [PR ของ S2](S2_EXECUTION_PLAN_TH.md)

## สิ่งที่ดำเนินการในรอบนี้

- เพิ่ม stack ทดสอบ Confirm email Off พร้อม Realtime แยกจาก hosted และ stack local เดิม
- เพิ่ม browser suite ใช้ Auth/session/PostgREST/WebSocket จริง ครอบคลุมสองหน้าต่าง, user/tenant isolation, revoke, MFA และ guarded cleanup
- พบและแก้ signal fan-out ที่ยังแจ้งกิจกรรมให้ผู้ถูกถอนสิทธิ์ด้วย migration0013 โดยไม่เปลี่ยน SQL ที่ apply แล้ว
- จัดทำคู่มือกู้ MFA/โอน owner และซ้อม backup/restore ลง target แยก รวม exact ACL, login/MFA, audit และ replay ถอนสิทธิ์
- ทดสอบ headful Chromium/Orca มีเสียงอ่าน controls จริงและตรวจ axe/keyboard/reflow8เส้นทางภาษา; ไม่อ้าง NVDA/VoiceOver ผ่าน
- Email Recovery/SMTP เลื่อนตาม C-24; ไม่ถือเป็น blocker ของ S2 รอบนี้
- PR #1 merge เข้า main และ production Ready แล้ว; CI ของ PR ผ่านทั้ง check/s1-local ดู [หลักฐานส่งขึ้นระบบและวิธีทดสอบต่อ](S1_HOSTED_HANDOFF_TH.md)
- C-27 เจ้าของยืนยันรอ S1 hosted ผ่านก่อนเริ่ม S2 ไม่เริ่ม S2 local คู่ขนานระหว่าง Network ถูกบล็อก

## ขั้นถัดไปที่ยังเหลือ

| ลำดับ / Phase | Functions/features และสิ่งที่จะทำ | เงื่อนไข/สถานะ |
| --- | --- | --- |
| 1 / S1 hosted | Email signup/login/logout/session, สองหน้าต่าง Live sync, private Broadcast, cross-user/tenant, ถอน delegation/member และ MFA | เจ้าของแจ้ง Publish/apply แล้ว แต่ runtime ที่ตรวจยังใช้ allowlist เดิม ต้องให้ task ใช้ Network รุ่นใหม่จริง; หาก task นี้ยังผูกเวอร์ชันเก่าให้เริ่ม task จาก Environment รุ่นล่าสุดตามคู่มือ handoff; ไม่ต้องสร้าง Project/token ใหม่ |
| 2 / S1 readiness ก่อนผู้ใช้จริง | ระบุผู้ตรวจสอบ MFA/owner transfer, backup policy/ผู้รับผิดชอบ/RPO/RTO และ manual NVDA/VoiceOver/UAT ตามอุปกรณ์เป้าหมาย | คู่มือ/การซ้อม local ทำแล้ว; hosted backup metadata ไม่มี snapshot/PITR และยังไม่อ้างว่ากู้ production ผ่าน |
| 3 / S2.1–S2.2 | onboarding/independent verification/expiry/suspend/appeal และ private evidence quarantine/scan | **อนุมัติแล้วตาม C-25 หลังปิด S1 ที่ระบุ**; ตอนนี้เตรียมแผน ไม่เริ่ม runtime/schema ระหว่าง hosted test blocked |
| 4 / S2.3–S2.4 | catalog draft/review/publish/revision/expiry, public backend search/filter/detail ไทย–อังกฤษ | ต่อจาก org verification; ไม่เผยข้อมูล draft/PII/expired/suspended |
| 5 / S2.5–S2.6 | needs assessment ข้ามคำถามได้, preferences/bookmarks, rule matching พร้อม eligible/ineligible/unknown และเหตุผล | ต่อจาก catalog และ S1 consent/authority; ไม่ auto-apply, ไม่ใช้ AI ตัดสินสิทธิ์ |
| 6 / ก่อน real-user production launch | Email Recovery/SMTP ที่เลื่อนไว้, operational/privacy/safety/backup release evidence | คงเป็นงานค้างตาม C-24 ไม่เปลี่ยนสถานะว่าเสร็จหรือถอด gate ทิ้ง |

C-17 อนุญาต Supabase/push/deploy แล้ว และ C-25 อนุมัติ S2 ตามเงื่อนไขแล้ว ไม่ขออนุมัติเรื่องเดิมซ้ำ
S3 applications/cases/outbox, S4 referrals/outcomes/privacy, S5 AI/impact, S6 pilot readiness ยังเป็นแผน
การ deploy ทางเทคนิคที่มีอยู่ไม่เท่ากับเปิดรับข้อมูลจริงหรือผ่าน release gates

## ส่งต่อบริบท

อ่าน AGENTS.md, README.md, INDEX.md, DECISIONS.md และ S1_READINESS_EXECUTION_TH.md
รักษาต้นฉบับ Blueprint/knowledge, P/G/D ที่ยังไม่ accepted, ภาษาไทย และ C-18
แยกผล local/hosted และคำสั่งที่รัน/ยังไม่รัน ห้ามนับการ Publish environment แทน network/browser evidence
