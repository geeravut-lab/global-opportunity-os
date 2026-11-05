import { Arrow } from "@/components/arrow";
import Link from "@/components/busy-link";
import { notFound } from "next/navigation";
import { entries } from "@/lib/fixtures";
import {
  categories,
  regions,
  effectiveStatus,
  normalizeFilters,
  filterQuery,
} from "@/lib/directory";
import { copy, isLocale } from "@/lib/i18n";
import { s3Enabled } from "@/lib/s3/model";
import { s2Enabled } from "@/lib/s2/model";
import { readCatalog } from "@/lib/s2/server";
import { S2Catalog, S2Detail } from "@/components/s2-catalog";
export const dynamic = "force-dynamic";
export default async function DetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ lang: string; slug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { lang, slug } = await params;
  if (!isLocale(lang)) notFound();
  if (s2Enabled()) {
    if (
      !/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(
        slug,
      )
    )
      notFound();
    let result;
    try {
      result = await readCatalog({}, slug);
    } catch {
      return <S2Catalog lang={lang} data={null} error="unavailable" />;
    }
    if (!result.items[0]) notFound();
    return <S2Detail lang={lang} entry={result.items[0]} applications={s3Enabled()} />;
  }
  const entry = entries.find((item) => item.slug === slug);
  if (!entry) notFound();
  const query = await searchParams;
  const strings = Object.fromEntries(
    Object.entries(query).filter(
      (pair): pair is [string, string] => typeof pair[1] === "string",
    ),
  );
  const t = copy[lang],
    status = effectiveStatus(entry);
  const format = (date: string) =>
    new Intl.DateTimeFormat(lang === "th" ? "th-TH" : "en-GB", {
      dateStyle: "long",
      timeZone: "UTC",
    }).format(new Date(date));
  return (
    <main id="main" className="wrap detail-main">
      <Link
        className="back-link"
        href={`/${lang}/opportunities${filterQuery(normalizeFilters(strings))}`}
      >
        ← {t.back}
      </Link>
      <article className="detail-article">
        <p className="eyebrow">
          {categories[entry.category][lang]} · {t.synthetic}
        </p>
        <h1>{entry.title[lang]}</h1>
        <div className="detail-meta">
          <span className={`badge ${status}`}>{t[status]}</span>
          <span>{regions[entry.region][lang]}</span>
        </div>
        <p className="detail-intro">{entry.description[lang]}</p>
        <div className="detail-columns">
          <div>
            <section>
              <h2>{t.about}</h2>
              <p>{entry.groups[lang]}</p>
              <h3>{t.eligibility}</h3>
              <p>{entry.eligibility[lang]}</p>
              <h3>{t.access}</h3>
              <p>{entry.accessibility[lang]}</p>
            </section>
            <section id="demo-info" className="demo-info" tabIndex={-1}>
              <h2>{t.noReferral}</h2>
              <p>{status === "current" ? t.exampleHelp : t.inactive}</p>
            </section>
          </div>
          <aside className="evidence-panel" aria-labelledby="evidence-title">
            <h2 id="evidence-title">{t.evidence}</h2>
            <dl>
              <dt>{t.reviewed}</dt>
              <dd>
                <time dateTime={entry.verifiedAt}>
                  {format(entry.verifiedAt)}
                </time>
              </dd>
              <dt>{t.expires}</dt>
              <dd>
                <time dateTime={entry.expiresAt}>
                  {format(entry.expiresAt)}
                </time>
              </dd>
              <dt>{t.source}</dt>
              <dd>{entry.evidence.label[lang]}</dd>
            </dl>
            {status === "current" ? (
              <a className="button primary" href="#demo-info">
                {t.demoAction} <Arrow />
              </a>
            ) : (
              <p className="status-note">{t.inactive}</p>
            )}
          </aside>
        </div>
      </article>
    </main>
  );
}
