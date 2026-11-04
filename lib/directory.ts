import { type Locale, type Localized } from "./i18n";
export const categories = {
  skills: { th: "ทักษะและอาชีพ", en: "Skills & livelihoods" },
  access: { th: "การเข้าถึงและการสนับสนุน", en: "Access & support" },
  community: { th: "ชุมชนและทรัพยากร", en: "Community & resources" },
} satisfies Record<string, Localized>;
export const regions = {
  global: { th: "ทั่วโลก (ตัวอย่างออนไลน์)", en: "Worldwide (online example)" },
  asia: { th: "เอเชีย (ตัวอย่าง)", en: "Asia (example)" },
  africa: { th: "แอฟริกา (ตัวอย่าง)", en: "Africa (example)" },
} satisfies Record<string, Localized>;
export type EntryStatus = "current" | "expired" | "suspended";
export interface Entry {
  id: string; slug: string; tenantId: string; synthetic: true;
  title: Localized; description: Localized; eligibility: Localized; accessibility: Localized;
  category: keyof typeof categories; region: keyof typeof regions;
  groups: Localized; status: EntryStatus; verifiedAt: string; expiresAt: string;
  evidence: { label: Localized; url: string };
}
export function effectiveStatus(entry: Entry, now = new Date()): EntryStatus {
  if (entry.status === "suspended") return "suspended";
  const from = Date.parse(entry.verifiedAt), until = Date.parse(entry.expiresAt);
  if (entry.status !== "current" || !entry.evidence?.label?.th || !entry.evidence?.label?.en ||
      !Number.isFinite(from) || !Number.isFinite(until) || !Number.isFinite(+now) || from > +now || until <= +now) return "expired";
  return "current";
}
export function validateEntries(entries: readonly Entry[]): void {
  const slugs = new Set<string>();
  const ids = new Set<string>();
  for (const entry of entries) {
    if (!entry.synthetic || !entry.tenantId || !/^[a-z0-9-]+$/.test(entry.slug) || ids.has(entry.id) || slugs.has(entry.slug)) throw new Error("ข้อมูลสมมติหรือรหัสไม่ถูกต้อง");
    ids.add(entry.id); slugs.add(entry.slug);
    for (const value of [entry.title, entry.description, entry.eligibility, entry.accessibility, entry.groups, entry.evidence?.label]) {
      for (const locale of ["th", "en"] as const) if (!value?.[locale]?.trim()) throw new Error("คำแปลไม่ครบ");
    }
    const url = new URL(entry.evidence.url);
    if (url.protocol !== "https:" || !url.hostname.endsWith(".invalid")) throw new Error("ต้องใช้แหล่งข้อมูลสมมติ .invalid");
    if (!Object.hasOwn(categories, entry.category) || !Object.hasOwn(regions, entry.region) || !["current", "expired", "suspended"].includes(entry.status) ||
        !Number.isFinite(Date.parse(entry.verifiedAt)) || !Number.isFinite(Date.parse(entry.expiresAt)) || Date.parse(entry.verifiedAt) >= Date.parse(entry.expiresAt)) throw new Error("รูปแบบข้อมูลไม่ถูกต้อง");
  }
}
export interface Filters { q: string; category: string; region: string; status: string }
export const defaults: Filters = { q: "", category: "all", region: "all", status: "current" };
export function normalizeFilters(input: Partial<Filters>): Filters {
  return { q: (input.q ?? "").normalize("NFKC").trim().slice(0, 120),
    category: Object.hasOwn(categories, input.category ?? "") ? input.category! : "all",
    region: Object.hasOwn(regions, input.region ?? "") ? input.region! : "all",
    status: ["all", "current", "expired", "suspended"].includes(input.status ?? "") ? input.status! : "current" };
}
export function filterEntries(entries: readonly Entry[], input: Filters, locale: Locale, now = new Date()): Entry[] {
  const publicMatches = new Set(filterPublicEntries(entries.map((e) => publicEntry(e, now)), input, locale).map((e) => e.slug));
  return entries.filter((e) => publicMatches.has(e.slug));
}
export function filterQuery(filters: Filters): string {
  const params = new URLSearchParams();
  for (const key of Object.keys(defaults) as (keyof Filters)[]) if (filters[key] !== defaults[key]) params.set(key, filters[key]);
  return params.size ? `?${params}` : "";
}
// ข้อมูลสาธารณะเลือกเฉพาะฟิลด์ที่จำเป็น ไม่ส่ง tenant ID หรือหลักฐานภายในไปยังคอมโพเนนต์ client
export function publicEntry(entry: Entry, now = new Date()) {
  return { slug: entry.slug, title: entry.title, description: entry.description, groups: entry.groups,
    category: entry.category, region: entry.region, status: effectiveStatus(entry, now) };
}
export type PublicEntry = ReturnType<typeof publicEntry>;

export function filterPublicEntries(entries: readonly PublicEntry[], input: Filters, locale: Locale): PublicEntry[] {
  const f = normalizeFilters(input), term = f.q.toLocaleLowerCase(locale);
  return entries.filter((entry) => (f.category === "all" || entry.category === f.category) &&
    (f.region === "all" || entry.region === f.region) && (f.status === "all" || entry.status === f.status) &&
    [entry.title[locale], entry.description[locale], categories[entry.category][locale], entry.groups[locale]]
      .some((s) => s.normalize("NFKC").toLocaleLowerCase(locale).includes(term)));
}
