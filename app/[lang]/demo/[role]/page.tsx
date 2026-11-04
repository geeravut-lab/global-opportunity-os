import { entries } from "@/lib/fixtures";
import { publicEntry } from "@/lib/directory";
import { notFound } from "next/navigation";
import { Prototype } from "@/components/prototype";
import { isLocale } from "@/lib/i18n";
import { isDemoRole } from "@/lib/prototype";
export default async function DemoPage({ params, searchParams }: { params: Promise<{ lang: string; role: string }>; searchParams: Promise<{ section?: string }> }) {
  const { lang, role } = await params; if (!isLocale(lang) || !isDemoRole(role)) notFound();
  const { section } = await searchParams;
  return <Prototype key={`${role}:${section}`} lang={lang} role={role} section={section ?? "home"} cards={[...entries].filter(e=>e.status==="current").sort((a,b)=>Number(b.category==="jobs")-Number(a.category==="jobs")).map(e=>publicEntry(e))} />;
}
