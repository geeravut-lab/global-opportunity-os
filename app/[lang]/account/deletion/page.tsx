import { notFound, redirect } from "next/navigation";
import { isLocale } from "@/lib/i18n";
import { serverClient } from "@/lib/supabase/server";
import { DeletionReceipt } from "@/components/deletion-receipt";
export const dynamic = "force-dynamic";
export default async function Deletion({ params, searchParams }: { params: Promise<{ lang: string }>; searchParams: Promise<{ request?: string }> }) {
  const { lang } = await params, q = await searchParams; if (!isLocale(lang) || !q.request || !/^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/i.test(q.request)) notFound();
  const c = await serverClient(); if (!c) redirect(`/${lang}/auth/login`); const u = await c.auth.getUser(); if (u.error || !u.data.user) redirect(`/${lang}/auth/login`);
  return <DeletionReceipt lang={lang} request={q.request} />;
}
