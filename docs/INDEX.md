# สารบัญโครงการฉบับปรับตาม Blueprint

ใช้ [Product Blueprint ภาษาไทย v1.0](Global-Opportunity-OS-Product-Blueprint-TH.md) เป็นฐานทิศทาง
และ [ทะเบียนการตัดสินใจ](DECISIONS.md) เป็นแหล่งสถานะอนุมัติ ห้ามถือว่าอ่านข้อเสนอแล้วเท่ากับอนุมัติระบบจริง

## เอกสารรอบปัจจุบัน

- [หลักฐานปิด S1 / blocker ของ hosted / เงื่อนไขเริ่ม S2](S1_READINESS_EXECUTION_TH.md)
- [คู่มือกู้ MFA และโอน platform owner](MFA_OWNER_RUNBOOK_TH.md)
- [คู่มือ backup/restore และ replay สิทธิ์](BACKUP_RESTORE_RUNBOOK_TH.md)
- [แผน PR S2: functions/features, schema และ tests](S2_EXECUTION_PLAN_TH.md)

- [นำ knowledge ทั้ง 15 เรื่องมาใช้: ทำแล้ว/แผนตาม Phase](KNOWLEDGE_ADOPTION_TH.md)
- [รายงาน branding/live/หน้าแรกและ hosted S1](PLATFORM_REPORT_TH.md)
- [ADR ของ branding/admin/Realtime/PWA](adr/ADR-003-PLATFORM-TH.md)

- [สถานะ push/deployment และการเชื่อม Supabase](DEPLOYMENT_STATUS_TH.md)

- [รายงาน S1 และผลทดสอบล่าสุด](S1_REPORT_TH.md)
- [ตั้งค่า Email/Google และ local development](AUTH_SETUP_TH.md)
- [ADR ฐาน Auth/DB/สิทธิ์ S1](adr/ADR-002-S1-AUTH-TH.md)
- [OpenAPI ของ BFF S1 ที่มีโค้ดแล้ว](../api/s1.openapi.json)

- [ผลเทียบ Blueprint และภาพ UX](BLUEPRINT_ALIGNMENT_TH.md)
- [แผนทุก Phase พร้อม functions/features](PHASE_PLAN_TH.md)
- [ข้อกำหนดต้นแบบและ UX ที่อิงภาพ](UX_SPEC_TH.md)
- [ADR ขอบเขตต้นแบบกับ architecture ระบบจริง](adr/ADR-001-PROTOTYPE-BOUNDARY-TH.md)
- [รายงานผลตรวจต้นแบบ](PROTOTYPE_REPORT_TH.md)
- [สิ่งที่เจ้าของต้องทำต่อ](NEXT_STEPS.md)
- [คู่มือ Vercel เดิม](VERCEL.md)

## เอกสารต้นทางจาก main ที่รักษาไว้

เอกสารเหล่านี้เป็นเนื้อหาต้นทาง บางไฟล์เป็นภาษาอังกฤษ ไม่ใช่ผลทดสอบหรือการอนุมัติใหม่
หากต่างจาก Blueprint v1.0 ให้ใช้ตารางเทียบและบันทึก disposition ไม่รวม AC คนละชุดเข้าด้วยกัน

- [SOURCE_CONTEXT](SOURCE_CONTEXT.md)
- [PROJECT_VISION](PROJECT_VISION.md)
- [BUSINESS_MODEL](BUSINESS_MODEL.md)
- [PRODUCT_REQUIREMENTS](PRODUCT_REQUIREMENTS.md)
- [USER_ROLES](USER_ROLES.md)
- [USER_JOURNEYS](USER_JOURNEYS.md)
- [SYSTEM_ARCHITECTURE](SYSTEM_ARCHITECTURE.md)
- [DATABASE_SCHEMA](DATABASE_SCHEMA.md)
- [SECURITY_PRIVACY](SECURITY_PRIVACY.md)
- [AI_SAFETY](AI_SAFETY.md)
- [ACCESSIBILITY_I18N](ACCESSIBILITY_I18N.md)
- [PARTNER_VERIFICATION](PARTNER_VERIFICATION.md)
- [IMPACT_METRICS](IMPACT_METRICS.md)
- [MVP_ROADMAP](MVP_ROADMAP.md)
- [ACCEPTANCE_CRITERIA](ACCEPTANCE_CRITERIA.md)
- [RELEASE_GATES](RELEASE_GATES.md)
- [SPRINT_0_BACKLOG](SPRINT_0_BACKLOG.md)
- [RESEARCH_VALIDATION](RESEARCH_VALIDATION.md)
- [SOURCES](SOURCES.md)

## ประวัติก่อนเห็น Blueprint บน main ล่าสุด

- [แผน Sprint 0 เดิม](SPRINT_0_PLAN.md)
- [สถาปัตยกรรมไดเรกทอรีเดิม](ARCHITECTURE.md)
- [การประเมินเทคโนโลยีเดิม](STACK_EVALUATION.md)
- [รายงานไดเรกทอรีเดิม](IMPLEMENTATION_REPORT.md)
- [ทะเบียนเซสชันเก่า](archive/PRE_BLUEPRINT_DECISIONS.md)

ข้อความว่า “ไม่มีเอกสารต้นฉบับ” ในประวัติหมายถึง checkout เดิมเท่านั้น
ตอนนี้ดึง Blueprint และ starter pack จาก main แล้ว ห้ามนำสถานะเก่ามาอ้างกับปัจจุบัน
