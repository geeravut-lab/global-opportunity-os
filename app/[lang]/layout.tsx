import { AppShell } from "@/components/app-shell";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { copy, isLocale } from "@/lib/i18n";
import "../globals.css";
export const metadata: Metadata = { title: { default: "Global Opportunity OS · Demo", template: "%s · Global Opportunity OS" },
  description: "ไดเรกทอรีตัวอย่างไทย–อังกฤษ ใช้ข้อมูลสมมติเท่านั้น · Fictional bilingual directory demo", robots: { index: false, follow: false } };
export default async function LocaleLayout({ children, params }: { children: React.ReactNode; params: Promise<{ lang: string }> }) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();
  const t = copy[lang];
  return <html lang={lang}><body><a className="skip-link" href="#main">{t.skip}</a><AppShell lang={lang}>{children}</AppShell></body></html>;
}
