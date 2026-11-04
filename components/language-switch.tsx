"use client";
import { Arrow } from "@/components/arrow";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { filterQuery, normalizeFilters } from "@/lib/directory";
import type { Locale } from "@/lib/i18n";
export function LanguageSwitch({ lang }: { lang: Locale }) {
  const pathname = usePathname();
  const params = useSearchParams();
  const other = lang === "th" ? "en" : "th";
  const path = pathname.replace(/^\/(th|en)(?=\/|$)/, `/${other}`);
  const query = filterQuery(normalizeFilters(Object.fromEntries(params)));
  return <Link className="language" href={`${path}${query}`} hrefLang={other} lang={other}>
    {other === "en" ? "English" : "ภาษาไทย"}<Arrow />
  </Link>;
}
