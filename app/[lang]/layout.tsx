import { Arrow } from "@/components/arrow";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { Suspense } from "react";
import { copy, isLocale } from "@/lib/i18n";
import { LanguageSwitch } from "@/components/language-switch";
import "../globals.css";
export const metadata: Metadata = { title: { default: "Global Opportunity OS · Demo", template: "%s · Global Opportunity OS" },
  description: "ไดเรกทอรีตัวอย่างไทย–อังกฤษ ใช้ข้อมูลสมมติเท่านั้น · Fictional bilingual directory demo", robots: { index: false, follow: false } };
export default async function LocaleLayout({ children, params }: { children: React.ReactNode; params: Promise<{ lang: string }> }) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();
  const t = copy[lang];
  return <html lang={lang}><body>
    <a className="skip-link" href="#main">{t.skip}</a>
    <div className="demo-bar"><span className="demo-dot" aria-hidden="true" />{t.demo}</div>
    <header className="site-header wrap">
      <Link className="brand" href={`/${lang}`} aria-label="Global Opportunity OS">
        <span className="brand-mark" aria-hidden="true"><Arrow /></span><span>Global Opportunity<span className="brand-os"> OS</span></span>
      </Link>
      <nav aria-label={lang === "th" ? "เมนูหลัก" : "Main navigation"}>
        <Link className="nav-directory" href={`/${lang}`}>{t.directory}</Link>
        <Suspense fallback={<span className="language">{lang === "th" ? "English" : "ภาษาไทย"}</span>}><LanguageSwitch lang={lang} /></Suspense>
      </nav>
    </header>
    {children}
    <footer className="site-footer wrap"><p className="footer-mission">{t.footer}</p><p>{t.notice}</p><span>Global Opportunity OS · 2026</span></footer>
  </body></html>;
}
