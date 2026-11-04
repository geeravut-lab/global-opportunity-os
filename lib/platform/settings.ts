export const defaultNames = {
  th: "Global Opportunity OS",
  en: "Global Opportunity OS",
} as const;
export const platformFlags = ["live_sync", "branding"] as const;
export type PlatformFlag = (typeof platformFlags)[number];
export interface PlatformSettings {
  name_th: string;
  name_en: string;
  version: number;
  logo_id: string | null;
  favicon_id: string | null;
  flags: Partial<Record<PlatformFlag, false>>;
}
export const defaultSettings: PlatformSettings = {
  name_th: defaultNames.th,
  name_en: defaultNames.en,
  version: 0,
  logo_id: null,
  favicon_id: null,
  flags: {},
};
export function validName(v: unknown): v is string {
  return (
    typeof v === "string" &&
    v.trim().length >= 1 &&
    v.length <= 60 &&
    !/[<>\p{Cc}]/u.test(v)
  );
}
export function parseSettings(raw: unknown): PlatformSettings {
  const r = (raw && typeof raw === "object" ? raw : {}) as Record<
    string,
    unknown
  >;
  const flags: PlatformSettings["flags"] = {};
  for (const k of platformFlags)
    if (
      r.flags &&
      typeof r.flags === "object" &&
      (r.flags as Record<string, unknown>)[k] === false
    )
      flags[k] = false;
  const id = (v: unknown) =>
    typeof v === "string" && /^[a-f0-9-]{36}$/i.test(v) ? v : null;
  return {
    name_th: validName(r.name_th) ? r.name_th : defaultNames.th,
    name_en: validName(r.name_en) ? r.name_en : defaultNames.en,
    version:
      Number.isSafeInteger(r.version) && Number(r.version) > 0
        ? Number(r.version)
        : 0,
    logo_id: id(r.logo_id),
    favicon_id: id(r.favicon_id),
    flags,
  };
}
export function imageUrl(s: PlatformSettings, kind: "logo" | "favicon") {
  return `/brand/${kind}?v=${kind === "logo" ? (s.logo_id ?? "default") : (s.favicon_id ?? "default")}`;
}
export function brandText(
  text: string,
  s: PlatformSettings,
  lang: "th" | "en",
) {
  return text.replace(/Global Opportunity OS/g, () =>
    lang === "th" ? s.name_th : s.name_en,
  );
}
