"use client";
import { Arrow } from "@/components/arrow";

import Link from "@/components/busy-link";
import { usePathname, useSearchParams } from "next/navigation";
import { filterQuery, normalizeFilters } from "@/lib/directory";
import type { Locale } from "@/lib/i18n";
export function LanguageSwitch({ lang }: { lang: Locale }) {
  const pathname = usePathname();
  const params = useSearchParams();
  const other = lang === "th" ? "en" : "th";
  const path = pathname.replace(/^\/(th|en)(?=\/|$)/, `/${other}`);
  const filter = filterQuery(normalizeFilters(Object.fromEntries(params)));
  const safe = new URLSearchParams(filter);
  const section = params.get("section");
  if (section && /^[a-z-]{1,30}$/.test(section)) safe.set("section", section);
  const query = safe.size ? `?${safe}` : "";
  return <Link className="language" href={`${path}${query}`} hrefLang={other} lang={other}>
    {other === "en" ? "English" : "ภาษาไทย"}<Arrow />
  </Link>;
}
