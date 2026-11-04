import { notFound } from "next/navigation";
import { entries } from "@/lib/fixtures";
import { normalizeFilters, publicEntry, type Filters } from "@/lib/directory";
import { isLocale } from "@/lib/i18n";
import { Directory } from "@/components/directory";
export const dynamic = "force-dynamic";
export default async function DirectoryPage({ params, searchParams }: {
  params: Promise<{ lang: string }>; searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();
  const query = await searchParams;
  const raw: Partial<Filters> = {};
  for (const key of ["q", "category", "region", "status"] as const) if (typeof query[key] === "string") raw[key] = query[key];
  const filters = normalizeFilters(raw);
  const invalid = ["category", "region", "status"].some((key) => typeof query[key] === "string" && query[key] !== filters[key as keyof Filters]);
  const items = entries.map((e) => publicEntry(e));
  return <Directory key={JSON.stringify(filters)} lang={lang} entries={items} initial={filters} invalid={invalid} />;
}
