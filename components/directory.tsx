"use client";
import { Arrow } from "@/components/arrow";

import Link from "next/link";
import { useState } from "react";
import { categories, regions, defaults, filterPublicEntries, filterQuery, type Filters, type PublicEntry } from "@/lib/directory";
import { copy, type Locale } from "@/lib/i18n";
export function Directory({ lang, entries, initial, invalid }: { lang: Locale; entries: PublicEntry[]; initial: Filters; invalid: boolean }) {
  const [filters, setFilters] = useState(initial);
  const t = copy[lang];
  const update = (next: Filters) => {
    const normalized = { ...next, q: next.q.slice(0, 120) };
    setFilters(normalized);
    window.history.replaceState(null, "", `/${lang}/opportunities${filterQuery(normalized)}`);
  };
  const results = filterPublicEntries(entries, filters, lang);
  return <main id="main" className="wrap">
    <section className="hero" aria-labelledby="page-title">
      <div className="hero-copy"><p className="eyebrow"><span aria-hidden="true">✳</span> {t.eyebrow}</p>
        <h1 id="page-title">{t.title}<br /><span>{t.titleAccent}</span></h1><p className="intro">{t.intro}</p>
        <p className="privacy"><span aria-hidden="true">✓</span> {t.privacy}</p>
      </div>
      <div className="hero-art" aria-hidden="true"><div className="orbit orbit-one" /><div className="orbit orbit-two" />
        <div className="art-center"><Arrow /></div><span className="art-dot dot-one" /><span className="art-dot dot-two" /><span className="art-label">OPEN POSSIBILITIES</span>
      </div>
    </section>
    <section className="directory-section" aria-labelledby="directory-title">
      <div className="section-heading"><h2 id="directory-title">{t.directory}</h2><p>{t.synthetic}</p></div>
      <form className="filters" role="search" action={`/${lang}/opportunities`} onSubmit={(event) => { event.preventDefault(); update(filters); }}>
        <div className="search-field"><label htmlFor="q">{t.q}</label><input id="q" name="q" type="search" maxLength={120} placeholder={t.placeholder} aria-describedby="query-help" value={filters.q} onChange={(event) => update({ ...filters, q: event.target.value })} /></div>
        <div><label htmlFor="category">{t.category}</label><select id="category" name="category" value={filters.category} onChange={(event) => update({ ...filters, category: event.target.value })}>
          <option value="all">{t.all}</option>{Object.entries(categories).map(([key, label]) => <option key={key} value={key}>{label[lang]}</option>)}</select></div>
        <div><label htmlFor="region">{t.region}</label><select id="region" name="region" value={filters.region} onChange={(event) => update({ ...filters, region: event.target.value })}>
          <option value="all">{t.all}</option>{Object.entries(regions).map(([key, label]) => <option key={key} value={key}>{label[lang]}</option>)}</select></div>
        <div><label htmlFor="status">{t.status}</label><select id="status" name="status" value={filters.status} onChange={(event) => update({ ...filters, status: event.target.value })}>
          <option value="current">{t.current}</option><option value="all">{t.allStatuses}</option><option value="expired">{t.expired}</option><option value="suspended">{t.suspended}</option></select></div>
        <button className="button primary search-button" type="submit">{t.search}</button>
      </form>
      <p id="query-help" className="field-help">{t.queryHelp}</p>
      {invalid && <p className="status-note">{t.invalid}</p>}
      <div className="results-bar"><p role="status" aria-live="polite" aria-atomic="true"><strong>{results.length}</strong> {t.results}</p><button type="button" className="text-button" onClick={() => update(defaults)}>{t.reset} <span aria-hidden="true">↺</span></button></div>
      {results.length ? <ul className="card-grid">{results.map((entry) => <li key={entry.slug}><article className="listing-card">
        <div className="card-top"><span className="category-label">{categories[entry.category][lang]}</span><span className={`badge ${entry.status}`}>{t[entry.status]}</span></div>
        <h3><Link href={`/${lang}/directory/${entry.slug}${filterQuery(filters)}`}>{entry.title[lang]}</Link></h3>
        <p className="card-description">{entry.description[lang]}</p><p className="region-label"><span aria-hidden="true">◎</span> {regions[entry.region][lang]}</p>
        <div className="card-bottom"><span>{t.synthetic}</span><Link href={`/${lang}/directory/${entry.slug}${filterQuery(filters)}`} aria-label={`${t.read}: ${entry.title[lang]}`}>{t.read} <Arrow /></Link></div>
      </article></li>)}</ul> : <div className="empty-state"><span className="empty-symbol" aria-hidden="true">⌕</span><h3>{t.empty}</h3><p>{t.emptyHelp}</p><button className="button primary" type="button" onClick={() => update(defaults)}>{t.reset}</button></div>}
    </section>
  </main>;
}
