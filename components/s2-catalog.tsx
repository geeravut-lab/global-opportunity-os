import Link from "next/link";
import type { CatalogResult, CatalogEntry } from "@/lib/s2/model";
import { categories } from "@/lib/directory";
import { BookmarkButton } from "./s2-bookmark";
import { ruleLabel } from "@/lib/s2/copy";
const text = {
  th: {
    title: "ค้นหาโอกาส",
    intro:
      "รายการสมมติจาก catalog backend เพื่อทดสอบ ไม่ใช่บริการหรือองค์กรที่ตรวจสอบจริง",
    search: "คำค้น",
    category: "หมวดหมู่",
    all: "ทั้งหมด",
    country: "ประเทศ (รหัสสองตัว เช่น TH)",
    region: "พื้นที่ให้บริการ",
    access: "สิ่งอำนวยความสะดวกที่ต้องการ",
    language: "ภาษา",
    remote: "ออนไลน์เท่านั้น",
    free: "ไม่มีค่าใช้จ่าย",
    submit: "ค้นหา",
    empty: "ไม่พบโอกาสตามเงื่อนไขนี้ ลองลดตัวกรองหรือเปลี่ยนคำค้น",
    unavailable: "ยังโหลดรายการไม่ได้ กรุณาลองใหม่ภายหลัง",
    invalid: "ตัวกรองไม่ถูกต้อง กรุณาแก้ไขคำค้นหรือเลือกตัวกรองใหม่",
    back: "กลับไปค้นหา",
    reviewed: "ตรวจรายการเมื่อ",
    expiry: "รายการใช้ได้ถึง",
    orgExpiry: "การตรวจองค์กรใช้ได้ถึง",
    source: "แหล่งข้อมูล",
    details: "รายละเอียด",
    next: "หน้าถัดไป",
    previous: "หน้าก่อนหน้า",
    cost: "ค่าใช้จ่าย",
    capacity: "จำนวนที่เปิดรับ",
    unknown: "ไม่ระบุ",
    requirements: "เกณฑ์ที่ประกาศ",
    manual:
      "ค้นหาและบันทึกได้โดยไม่ใช้ AI ไม่มีการสมัครหรือส่งข้อมูลให้องค์กรจากหน้านี้",
    workspace: "ประเมินและดูคำแนะนำ",
    pay: "ค่าตอบแทน",
    organization: "องค์กร",
    accessibility: "การเข้าถึง",
  },
  en: {
    title: "Find opportunities",
    intro:
      "Synthetic backend records for testing; these are not real services or verified partners.",
    search: "Search",
    category: "Category",
    all: "All",
    country: "Country (two letters, e.g. TH)",
    region: "Service area",
    access: "Accessibility needs",
    language: "Language",
    remote: "Online only",
    free: "No cost",
    submit: "Search",
    empty:
      "No opportunities match these filters. Try fewer filters or another search.",
    unavailable: "Catalog unavailable. Please try again later.",
    invalid: "Invalid filters. Please update your search or filters.",
    back: "Back to search",
    reviewed: "Listing reviewed",
    expiry: "Listing valid until",
    orgExpiry: "Organization review expires",
    source: "Source",
    details: "Details",
    next: "Next page",
    previous: "Previous page",
    cost: "Cost",
    capacity: "Available capacity",
    unknown: "Not specified",
    requirements: "Published criteria",
    manual:
      "Browse and save without AI. This page does not submit applications or share your information with an organization.",
    workspace: "Assessment and suggestions",
    pay: "Compensation",
    organization: "Organization",
    accessibility: "Accessibility",
  },
};
const date = (value: string, lang: "th" | "en") =>
  value
    ? new Intl.DateTimeFormat(lang === "th" ? "th-TH" : "en-GB", {
        dateStyle: "medium",
        timeZone: "UTC",
      }).format(new Date(value))
    : "—";
export function S2Catalog({
  lang,
  data,
  filter = {},
  error,
}: {
  lang: "th" | "en";
  data: CatalogResult | null;
  filter?: Record<string, string | number>;
  error?: "invalid" | "unavailable";
}) {
  const t = text[lang];
  const link = (page: number) =>
    `/${lang}/opportunities?` +
    new URLSearchParams(
      Object.entries({ ...filter, page }).map(([k, v]) => [k, String(v)]),
    ).toString();
  return (
    <main id="main" className="wrap s2-page">
      <h1>{t.title}</h1>
      <p className="notice">{t.intro}</p>
      <form action={`/${lang}/opportunities`} className="s2-form">
        <label>
          {t.search}
          <input
            name="q"
            type="search"
            maxLength={100}
            defaultValue={filter.q ?? ""}
          />
        </label>
        <label>
          {t.category}
          <select name="category" defaultValue={filter.category ?? ""}>
            <option value="">{t.all}</option>
            {Object.entries(categories).map(([k, v]) => (
              <option key={k} value={k}>
                {v[lang]}
              </option>
            ))}
          </select>
        </label>
        <label>
          {t.country}
          <input
            name="country"
            maxLength={2}
            pattern="[A-Z]{2}"
            defaultValue={filter.country ?? ""}
          />
        </label>
        <label>
          {t.region}
          <input
            name="region"
            maxLength={80}
            defaultValue={filter.region ?? ""}
          />
        </label>
        <label>
          {t.access}
          <input
            name="access"
            maxLength={80}
            defaultValue={filter.access ?? ""}
          />
        </label>
        <label>
          {t.language}
          <select name="language" defaultValue={filter.language ?? ""}>
            <option value="">{t.all}</option>
            <option value="th">ไทย</option>
            <option value="en">English</option>
          </select>
        </label>
        <label className="check">
          <input
            type="checkbox"
            name="remote"
            value="true"
            defaultChecked={filter.remote === "true"}
          />
          {t.remote}
        </label>
        <label className="check">
          <input
            type="checkbox"
            name="free"
            value="true"
            defaultChecked={filter.free === "true"}
          />
          {t.free}
        </label>
        <button className="button primary" type="submit">
          {t.submit}
        </button>
      </form>
      {error ? (
        <p role="alert">{t[error]}</p>
      ) : data?.items.length ? (
        <>
          <p role="status">
            {lang === "th"
              ? `พบ ${data.total} รายการ`
              : `${data.total} results`}
          </p>
          <div className="s2-grid">
            {data.items.map((e) => (
              <article className="panel" key={e.id}>
                <p>
                  {categories[e.category as keyof typeof categories]?.[lang]} ·{" "}
                  {e.country_code}
                  {e.remote ? " · Online" : ""}
                </p>
                <h2>
                  <Link href={`/${lang}/directory/${e.id}`}>
                    {lang === "th" ? e.title_th : e.title_en}
                  </Link>
                </h2>
                <p>{lang === "th" ? e.description_th : e.description_en}</p>
                <p>
                  {t.organization}: {e.organization_name}
                </p>
                <p>
                  {t.cost}: {e.cost_amount} {e.currency}
                </p>
                <p>
                  {t.expiry}: {date(e.valid_until, lang)}
                </p>
                <BookmarkButton lang={lang} id={e.id} />
              </article>
            ))}
          </div>
          <nav aria-label={lang === "th" ? "หน้าผลการค้นหา" : "Result pages"}>
            {data.page > 1 && (
              <Link className="button secondary" href={link(data.page - 1)}>
                {t.previous}
              </Link>
            )}
            {data.has_more && (
              <Link className="button secondary" href={link(data.page + 1)}>
                {t.next}
              </Link>
            )}
          </nav>
        </>
      ) : (
        <p role="status">{t.empty}</p>
      )}
      <p>{t.manual}</p>
      <Link href={`/${lang}/workspace/assessment`}>{t.workspace}</Link>
    </main>
  );
}
export function S2Detail({
  lang,
  entry: e,
}: {
  lang: "th" | "en";
  entry: CatalogEntry;
}) {
  const t = text[lang];
  return (
    <main id="main" className="wrap s2-page">
      <Link href={`/${lang}/opportunities`}>← {t.back}</Link>
      <article className="panel">
        <p className="notice">{t.intro}</p>
        <h1>{lang === "th" ? e.title_th : e.title_en}</h1>
        <p>{lang === "th" ? e.description_th : e.description_en}</p>
        <dl>
          <dt>{t.organization}</dt>
          <dd>{e.organization_name}</dd>
          <dt>{t.country}</dt>
          <dd>
            {e.country_code} {e.coarse_region}
          </dd>
          <dt>{t.language}</dt>
          <dd>{e.languages.join(", ")}</dd>
          <dt>{t.cost}</dt>
          <dd>
            {e.cost_amount} {e.currency}
          </dd>
          <dt>{t.capacity}</dt>
          <dd>{e.capacity ?? t.unknown}</dd>
          <dt>{t.reviewed}</dt>
          <dd>{date(e.reviewed_at, lang)}</dd>
          <dt>{t.expiry}</dt>
          <dd>{date(e.valid_until, lang)}</dd>
          <dt>{t.orgExpiry}</dt>
          <dd>{date(e.organization_expires_at, lang)}</dd>
          <dt>{t.accessibility}</dt>
          <dd>{lang === "th" ? e.accessibility_th : e.accessibility_en}</dd>
          {e.category === "jobs" && (
            <>
              <dt>{t.pay}</dt>
              <dd>
                {e.job_pay_min}–{e.job_pay_max} {e.currency}/{e.job_pay_unit} ·{" "}
                {e.job_contract}
              </dd>
            </>
          )}
        </dl>
        <h2>{t.requirements}</h2>
        <ul>
          {e.rules.map((r, i) => (
            <li key={i}>{ruleLabel(lang, r)}</li>
          ))}
        </ul>
        <p>
          <a href={e.source_url} rel="noreferrer noopener">
            {t.source}
          </a>
        </p>
        <BookmarkButton lang={lang} id={e.id} />
        <p>{t.manual}</p>
      </article>
    </main>
  );
}
