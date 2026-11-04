import { entries } from "@/lib/fixtures";
import { publicEntry } from "@/lib/directory";
import { notFound } from "next/navigation";
import { isLocale } from "@/lib/i18n";
import { Prototype } from "@/components/prototype";
export default async function Home({ params, searchParams }: { params: Promise<{ lang: string }>; searchParams: Promise<{ section?: string }> }) {
  const { lang } = await params; if (!isLocale(lang)) notFound();
  const { section } = await searchParams;
  return <Prototype key={section ?? "home"} lang={lang} role="beneficiary" section={section ?? "home"} cards={[...entries].filter(e=>e.status==="current").sort((a,b)=>Number(b.category==="jobs")-Number(a.category==="jobs")).map(e=>publicEntry(e))} />;
}
