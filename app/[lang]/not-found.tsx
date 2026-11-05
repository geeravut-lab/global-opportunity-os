"use client";
import Link from "@/components/busy-link";
import { useParams } from "next/navigation";
import { copy, isLocale } from "@/lib/i18n";
export default function NotFound() {
  const params = useParams<{ lang?: string }>();
  const lang = params?.lang && isLocale(params.lang) ? params.lang : "th";
  const t = copy[lang];
  return <main id="main" className="wrap empty-state not-found"><p className="eyebrow">404</p><h1>{t.notFound}</h1><p>{t.notFoundHelp}</p><Link className="button primary" href={`/${lang}`}>{t.back}</Link></main>;
}
