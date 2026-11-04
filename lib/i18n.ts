export const locales = ["th", "en"] as const;
export type Locale = (typeof locales)[number];
export type Localized = Record<Locale, string>;
export function isLocale(value: string): value is Locale {
  return locales.some((locale) => locale === value);
}
export const copy = {
  th: {
    skip: "ข้ามไปเนื้อหาหลัก", directory: "ไดเรกทอรี", mission: "โอกาสสำหรับทุกคน ทุกที่",
    demo: "พื้นที่ตัวอย่าง · ข้อมูลสมมติทั้งหมด ไม่ใช่พันธมิตรหรือบริการจริง",
    eyebrow: "เริ่มต้นจากโอกาสเล็ก ๆ", title: "ค้นพบโอกาส", titleAccent: "ที่เหมาะกับคุณ",
    intro: "สำรวจตัวอย่างบริการและทรัพยากรจากหลากหลายพื้นที่ ออกแบบเพื่อผู้รับประโยชน์ทุกกลุ่ม โดยไม่ต้องสร้างบัญชี",
    q: "ค้นหาบริการ", placeholder: "เช่น ทักษะ หรือการเข้าถึง", category: "หมวดหมู่", region: "พื้นที่", status: "สถานะ",
    all: "ทั้งหมด", current: "ปัจจุบัน", expired: "หมดอายุ", suspended: "ระงับ", allStatuses: "ทุกสถานะ (ตัวอย่าง)",
    reset: "ล้างตัวกรอง", search: "ค้นหา", results: "รายการตัวอย่าง", empty: "ยังไม่พบรายการที่ตรงกัน",
    emptyHelp: "ลองเปลี่ยนคำค้นหรือขยายพื้นที่และหมวดหมู่ คุณสามารถล้างตัวกรองเพื่อเริ่มใหม่ได้",
    read: "ดูรายละเอียด", synthetic: "ข้อมูลสมมติ", about: "เกี่ยวกับตัวอย่างนี้", eligibility: "เงื่อนไขตัวอย่าง",
    access: "ข้อมูลการเข้าถึง", evidence: "ข้อมูลการตรวจสอบตัวอย่าง", reviewed: "วันที่ตรวจสมมติ", expires: "หมดอายุ",
    source: "ที่มาสมมติ", back: "กลับไปไดเรกทอรี", demoAction: "ดูวิธีทำงานของตัวอย่าง", noReferral: "หน้านี้ไม่รับข้อมูลส่วนบุคคลและไม่ส่งต่อเคสจริง",
    inactive: "รายการนี้ไม่เปิดให้ดำเนินการ สถานะในหน้านี้เป็นตัวอย่างเท่านั้น", exampleHelp: "ในระบบจริง ขั้นตอนต่อไปจะต้องตรวจสอบบริการและความยินยอมก่อน ขณะนี้ยังไม่มีการส่งข้อมูลใด",
    footer: "พันธกิจทั่วโลก · ผู้รับประโยชน์ทุกกลุ่ม · เป้าหมายธุรกิจที่ยั่งยืน", notice: "ตัวอย่างนี้ยังไม่ใช่บริการที่เปิดใช้งานจริง",
    privacy: "ไม่ต้องเข้าสู่ระบบ · ไม่มีการติดตามผู้ใช้", queryHelp: "ค้นหาชื่อหรือประเภทบริการ โดยไม่กรอกข้อมูลส่วนบุคคล", invalid: "ตัวกรองบางค่าไม่ถูกต้อง ระบบแสดงค่าที่รองรับแทน",
    notFound: "ไม่พบรายการนี้", notFoundHelp: "รายการอาจไม่มีอยู่ในชุดข้อมูลสมมติ ลองกลับไปค้นหาจากไดเรกทอรี",
  },
  en: {
    skip: "Skip to main content", directory: "Directory", mission: "Opportunity for everyone, everywhere",
    demo: "Demo space · All data is fictional. No real partners or services.",
    eyebrow: "A small step toward possibility", title: "Discover opportunities", titleAccent: "that work for you",
    intro: "Explore example services and resources across regions. Designed for all beneficiary groups, with no account required.",
    q: "Search services", placeholder: "For example, skills or access", category: "Category", region: "Region", status: "Status",
    all: "All", current: "Current", expired: "Expired", suspended: "Suspended", allStatuses: "All statuses (demo)",
    reset: "Clear filters", search: "Search", results: "example listings", empty: "No matching listings yet",
    emptyHelp: "Try another search or broaden the region and category. Clear filters to start again.",
    read: "View details", synthetic: "Fictional data", about: "About this example", eligibility: "Example eligibility",
    access: "Accessibility information", evidence: "Demo verification information", reviewed: "Fictional review date", expires: "Expires",
    source: "Fictional source", back: "Back to directory", demoAction: "Explore how this demo works", noReferral: "This page collects no personal data and sends no real referrals.",
    inactive: "No action is available for this listing. Its status is an example only.", exampleHelp: "A real service would first require verification and consent. No information is being sent in this demo.",
    footer: "Worldwide mission · All beneficiary groups · Sustainable business goal", notice: "This example is not a live service.",
    privacy: "No account required · No user tracking", queryHelp: "Search for a service name or type. Do not enter personal information.", invalid: "Some filters were invalid. Supported defaults are shown instead.",
    notFound: "Listing not found", notFoundHelp: "This listing may not exist in the fictional dataset. Return to the directory to explore.",
  },
} as const;
