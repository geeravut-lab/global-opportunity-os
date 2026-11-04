import { type Entry, validateEntries } from "./directory";
const common = {
  tenantId: "fictional-organization", synthetic: true as const,
  groups: { th: "ผู้รับประโยชน์ทุกกลุ่ม — ตัวอย่าง", en: "All beneficiary groups — example" },
  eligibility: { th: "ตัวอย่างนี้ไม่ประเมินสิทธิ์รายบุคคล และไม่ต้องให้ข้อมูลส่วนบุคคล", en: "This example does not assess individual eligibility or require personal information." },
  accessibility: { th: "ตัวอย่างเนื้อหาแบบข้อความ รองรับคีย์บอร์ดและการขยายตัวอักษร ไม่มีบริการจริงให้ติดต่อ", en: "Text-based example supporting keyboard use and text enlargement. There is no real service to contact." },
  verifiedAt: "2026-01-01T00:00:00Z", expiresAt: "2099-01-01T00:00:00Z",
  evidence: { label: { th: "หลักฐานแต่งขึ้นสำหรับสาธิตเท่านั้น", en: "Fictional evidence for demonstration only" }, url: "https://example.invalid/evidence" },
};
export const entries: readonly Entry[] = [
  { ...common, id: "demo-01", slug: "open-path-skills", status: "current", category: "skills", region: "global",
    title: { th: "เปิดเส้นทางทักษะใหม่", en: "Open Path Skills" },
    description: { th: "ตัวอย่างพื้นที่เรียนรู้ทักษะและสำรวจเส้นทางอาชีพออนไลน์ ในจังหวะที่เหมาะกับแต่ละคน", en: "An example online space to explore practical skills and livelihood pathways, at your own pace." } },
  { ...common, id: "demo-02", slug: "bridge-access", status: "current", category: "access", region: "asia",
    title: { th: "สะพานสู่การเข้าถึง", en: "Bridge to Access" },
    description: { th: "ตัวอย่างทรัพยากรแบบข้อความที่เข้าใจง่าย ช่วยสำรวจแนวทางลดอุปสรรคในการเข้าถึงบริการ", en: "An example collection of plain-language resources exploring ways to reduce barriers to services." } },
  { ...common, id: "demo-03", slug: "community-resource-circle", status: "expired", category: "community", region: "africa", expiresAt: "2026-06-01T00:00:00Z",
    title: { th: "วงแบ่งปันทรัพยากรชุมชน", en: "Community Resource Circle" },
    description: { th: "ตัวอย่างรายการที่พ้นกำหนดตรวจสอบ แสดงให้เห็นว่ารายการหมดอายุไม่เปิดให้ดำเนินการต่อ", en: "An example past its review deadline, showing why expired listings have no available action." } },
  { ...common, id: "demo-04", slug: "shared-horizon", status: "suspended", category: "skills", region: "global",
    title: { th: "ขอบฟ้าร่วมกัน", en: "Shared Horizon" },
    description: { th: "ตัวอย่างรายการที่ถูกระงับ แม้วันหมดอายุยังไม่ถึง ก็ไม่มีปุ่มดำเนินการ", en: "An example suspended listing. Actions stay unavailable even before its expiry date." } },
];
validateEntries(entries);
