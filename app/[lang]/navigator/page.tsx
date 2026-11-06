import { notFound, redirect } from "next/navigation";
import { isLocale } from "@/lib/i18n";
import { s5Enabled } from "@/lib/s5/model";
import { serverClient } from "@/lib/supabase/server";
import { NavigatorPanel } from "@/components/navigator-panel";
export const dynamic = "force-dynamic";
export default async function Page({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params; if (!isLocale(lang) || !s5Enabled()) notFound();
  const c = await serverClient(); if (!c || (await c.auth.getUser()).error) redirect(`/${lang}/auth/login`);
  return <NavigatorPanel lang={lang} />;
}
