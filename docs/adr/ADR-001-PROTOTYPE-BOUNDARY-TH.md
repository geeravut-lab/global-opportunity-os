# ADR-001: ขอบเขตต้นแบบและทางไปสู่ architecture ของ Blueprint

วันที่ 2026-11-04 สถานะ: ใช้สำหรับต้นแบบตาม C-10; ไม่เลือก database region/plan หรือ production auth model

บริบท: main มีเอกสารและ proposed monorepo layout แต่ไม่มี runtime ภายใน apps/web
เซสชันนี้มี Next.js ที่ root ทำงานและทดสอบแล้ว การย้าย package boundaries พร้อมทำ UI ทุกหน้าจะเพิ่มงาน
โดยไม่พิสูจน์ auth/RLS หรือ UX มากขึ้นในรอบ prototype

การเลือก: ใช้ Next/React/TypeScript/npm เดิม เพิ่ม shared UI components และ CSS tokens โทนภาพอ้างอิง
ไม่เพิ่ม framework/บริการ ไม่ย้าย root แอปไป apps/web ในรอบนี้ ใช้ SVG assets ในโครงการ
ส่วน Tailwind และ apps/web/packages/domain/packages/ai เป็น reference proposal ที่จะ disposition ใน S0 ก่อน S1
หากย้ายต้องแก้ Vercel Root Directory, CI paths, lockfile/workspaces และตรวจ setup/test ใหม่พร้อมกัน

ผล: รันต้นแบบและ public directory ต่อได้ ไม่สร้าง backend ปลอม role switch เป็น demo เท่านั้น
จุดต่างที่ยังอยู่: plain CSS/root app ไม่ใช่ Tailwind/monorepo ตาม reference; ไม่อ้างว่า architecture ครบแล้ว
ก่อนทำระบบจริง ต้อง spike BFF user-scoped JWT/transaction/RLS/revocation กับ Supabase ที่ได้รับอนุมัติ
และทำ OpenAPI/constraints/storage/worker designs ไม่ใช้ service_role เป็นทางลัด

หลักฐานอนุมัติ: เจ้าของเลือกต้นแบบ 3 มุมมองและแผนทุก Phase ก่อน ไม่ได้อนุมัติ migration
provisioning, model provider, contracts, retention, minor workflows หรือ deployment
