import { object, text, InputError } from "../auth/input";
export const s5Enabled = (env: NodeJS.ProcessEnv = process.env) => env.S5_ENABLED === "true";
export type NavigatorFilter = { category?: "jobs" | "skills" | "access" | "community"; country?: string; language?: "th" | "en"; remote?: "true"; free?: "true" };
export type Source = { id: string; listing_id: string; revision_id: string; title: string; quote: string; url: string; hash: string; locale: "th" | "en"; expires_at: string; reviewed_at: string };
export type NavigatorDraft = { filters: NavigatorFilter; mode: "source_guidance" | "public_information" | "urgent_information" | "clarify"; sensitive: boolean };
const injection = /ignore\s+(all\s+)?(previous|prior)|system\s*prompt|developer\s*message|reveal\s+(secrets|keys)|ลืมคำสั่ง|เพิกเฉย.*คำสั่ง|เปิดเผย.*(รหัส|กุญแจ)/iu;
export function safePublicSource(source: Source, now = Date.now()) {
  if (!source || !/^[a-f0-9]{64}$/.test(source.hash) || !Number.isFinite(Date.parse(source.expires_at)) || Date.parse(source.expires_at) <= now || injection.test(source.title + " " + source.quote)) return false;
  try { const u = new URL(source.url); return u.protocol === "https:" && !u.username && !u.password && u.hostname.includes(".") && !["localhost", "127.0.0.1"].includes(u.hostname); } catch { return false; }
}
export function parseNavigatorQuery(value: unknown): NavigatorDraft {
  const q = text(value, 1, 600).normalize("NFKC").replace(/\u0e4d\u0e32/g, "\u0e33").toLowerCase();
  const sensitive = /\b[\w.+-]+@[\w.-]+\.[a-z]{2,}\b|\b\d[\d\s()+-]{8,}\d\b|เลขบัตร|passport|address|ที่อยู่บ้าน|diagnos|วินิจฉัย/iu.test(q);
  if (/ฆ่าตัวตาย|ทำร้ายตัวเอง|suicid|immediate danger|กำลังถูกทำร้าย/iu.test(q)) return { filters: {}, mode: "urgent_information", sensitive };
  if (/\b(i am|i'm|age[d]?)\s*(?:[1-9]|1[0-7])\b|อายุ\s*(?:[1-9]|1[0-7])\s*(ปี|ขวบ)|เด็ก|minor|under\s*18/iu.test(q)) return { filters: {}, mode: "public_information", sensitive };
  if (injection.test(q)) return { filters: {}, mode: "clarify", sensitive: true };
  const filters: NavigatorFilter = {};
  const categories: [NavigatorFilter["category"], RegExp][] = [["jobs", /\bjob\b|\bwork\b|งาน|รายได้/iu], ["skills", /\bcourse\b|\bskills?\b|เรียน|หลักสูตร|ทักษะ/iu], ["access", /\bservice\b|\bhelp\b|ช่วยเหลือ|บริการ/iu], ["community", /\bcommunity\b|ชุมชน|อาสา/iu]];
  const matches = categories.filter(([, re]) => re.test(q)); if (matches.length === 1) filters.category = matches[0][0];
  if (/ประเทศไทย|\bthailand\b|\bthai\b/iu.test(q)) filters.country = "TH";
  if (/\bremote\b|\bonline\b|ออนไลน์|ทางไกล/iu.test(q)) filters.remote = "true";
  if (/\bfree\b|ฟรี|ไม่มีค่าใช้จ่าย/iu.test(q)) filters.free = "true";
  return { filters, mode: Object.keys(filters).length ? "source_guidance" : "clarify", sensitive };
}
export function navigatorInput(value: unknown) {
  const d = object(value, ["query", "locale", "confirmed", "filters"]);
  if (d.locale !== "th" && d.locale !== "en" || d.confirmed !== true) throw new InputError("invalid_input");
  const draft = parseNavigatorQuery(d.query);
  if (d.filters !== undefined) {
    const f = object(d.filters, ["category", "country", "language", "remote", "free"]);
    if (f.category !== undefined && !["jobs", "skills", "access", "community"].includes(String(f.category)) || f.country !== undefined && !/^[A-Z]{2}$/.test(String(f.country)) || f.language !== undefined && !["th", "en"].includes(String(f.language)) || f.remote !== undefined && f.remote !== "true" || f.free !== undefined && f.free !== "true") throw new InputError("invalid_input");
    draft.filters = f as NavigatorFilter;
  }
  // Never return the raw query to the provider, persistence or logs.
  if (d.filters !== undefined && draft.mode === "clarify" && Object.keys(draft.filters).length && !injection.test(String(d.query))) draft.mode = "source_guidance";
  return { draft, locale: d.locale as "th" | "en" };
}
export function resolveCitations(ids: unknown, sources: Source[], now = Date.now()) {
  if (!Array.isArray(ids) || ids.length > 5 || ids.some(id => typeof id !== "string") || new Set(ids).size !== ids.length) throw Error("INVALID_CITATIONS");
  return ids.map(id => { const s = sources.find(s => s.id === id); if (!s || !safePublicSource(s, now)) throw Error("INVALID_CITATIONS"); return s; });
}
