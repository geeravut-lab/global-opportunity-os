"use client";
import { busyFetch } from "@/lib/ui/activity";
import { useState, type FormEvent } from "react";
import Link from "@/components/busy-link";
import { useBusyRouter as useRouter } from "@/lib/ui/router";
import type { AccountData, Notice } from "@/lib/auth/types";
import type {
  S2Org,
  Evidence,
  DraftListing,
  Assessment,
  Bookmark,
  Match,
  Rule,
} from "@/lib/s2/model";
import {
  s2Text,
  s2Sections,
  stateLabel,
  ruleLabel,
  type S2Section,
} from "@/lib/s2/copy";
import { categories } from "@/lib/directory";
import { DownloadLink } from "./download-link";
import { BookmarkButton } from "./s2-bookmark";
import { S2HomeMenus } from "./home-menu-cards";
export function S2Panel({
  lang,
  section,
  account,
  orgs,
  listings,
  assessment,
  bookmarks,
  matches,
  needsConfirmed,
  initialEvidence,
  assessmentNotice,
  consentEvents,
  page,
}: {
  lang: "th" | "en";
  section: S2Section;
  account: AccountData;
  orgs: S2Org[];
  listings: DraftListing[];
  assessment: Assessment | null;
  bookmarks: Bookmark[];
  matches: Match[];
  needsConfirmed: boolean;
  initialEvidence: Record<string, Evidence[]>;
  assessmentNotice: Notice;
  consentEvents: {
    version: number;
    action: string;
    notice_id: string;
    occurred_at: string;
  }[];
  page: number;
}) {
  const t = s2Text[lang],
    router = useRouter(),
    [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false),
    refreshing = router.isPending,
    [editing, setEditing] = useState<DraftListing | null>(null);
  const dirty = (e: FormEvent<HTMLFormElement>) => {
    e.currentTarget.dataset.liveDirty = "true";
  };
  async function send(
    path: string,
    data: unknown,
    form?: HTMLFormElement,
    multipart = false,
    quiet = false,
  ) {
    setBusy(true);
    setMessage("");
    try {
      const r = await busyFetch(
          path.startsWith("/api/") ? path : "/api/s2/" + path,
          {
            method: "POST",
            headers: multipart ? {} : { "Content-Type": "application/json" },
            body: multipart ? (data as FormData) : JSON.stringify(data),
          },
        ),
        d = await r.json();
      if (!r.ok) {
        setMessage(
          r.status === 409
            ? t.conflict
            : r.status === 403 || r.status === 404
              ? t.permission
              : t.error,
        );
        return { ok: false, data: null };
      }
      if (form) {
        form.dataset.liveDirty = "false";
        form.reset();
      }
      if (!quiet) {
        setMessage(t.saved);
        window.dispatchEvent(new Event("goos:saved"));
        router.refresh();
      }
      return { ok: true, data: d.data };
    } catch {
      setMessage(t.error);
      return { ok: false, data: null };
    } finally {
      setBusy(false);
    }
  }
  const orgAction = (e: FormEvent<HTMLFormElement>, o: S2Org) => {
    e.preventDefault();
    const f = e.currentTarget,
      d = new FormData(f);
    void send(
      `organizations/${o.id}/transition`,
      {
        action: d.get("action"),
        reason: d.get("reason"),
        expires: d.get("expires")
          ? new Date(String(d.get("expires"))).toISOString()
          : null,
        expectedVersion: o.version,
      },
      f,
    );
  };
  function organizationCard(o: S2Org) {
    const actions = o.can_review
      ? o.status === "in_review"
        ? ["verify", "request_changes", "reject"]
        : o.status === "verified"
          ? ["suspend"]
          : ["submitted", "appealed"].includes(o.status)
            ? ["start_review"]
            : []
      : o.can_manage
        ? ["draft", "changes_requested", "expired"].includes(o.status)
          ? ["submit"]
          : ["rejected", "suspended"].includes(o.status)
            ? ["appeal"]
            : []
        : [];
    return (
      <article className="panel" key={o.id + ":" + o.version}>
        <h2>{o.display_name}</h2>
        <p>
          {t.status}: {stateLabel(lang, o.status)}
        </p>
        {o.verification_expires_at && (
          <p>
            {t.expiry}:{" "}
            {new Date(o.verification_expires_at).toLocaleDateString(
              lang === "th" ? "th-TH" : "en-GB",
              { timeZone: "UTC" },
            )}
          </p>
        )}
        {(o.can_manage || o.can_review) && (
          <>
            <button
              type="button"
              className="button secondary"
              onClick={() => router.refresh()}
            >
              {t.evidence}
            </button>
            <ul>
              {initialEvidence[o.id]?.map((x) => (
                <li key={x.id}>
                  {stateLabel(lang, x.status)}{" "}
                  {x.status === "clean" && (
                    <DownloadLink href={`/api/s2/evidence/${x.id}`} lang={lang}>
                      {t.download}
                    </DownloadLink>
                  )}
                </li>
              ))}
            </ul>
          </>
        )}
        {o.can_manage && (
          <form
            className="s2-form"
            onChange={dirty}
            onSubmit={async (e) => {
              e.preventDefault();
              const f = e.currentTarget,
                upload = new FormData(f);
              const intent = await send(
                `organizations/${o.id}/intent`,
                {},
                undefined,
                false,
                true,
              );
              if (intent.ok) {
                await send("evidence/" + intent.data, upload, f, true);
              }
            }}
          >
            <p>{t.evidenceHelp}</p>
            <label>
              {t.evidence}
              <input name="file" type="file" accept="image/png" required />
            </label>
            <button disabled={busy || refreshing} className="button secondary">
              {t.upload}
            </button>
          </form>
        )}
        {actions.length > 0 && (
          <form
            className="s2-form"
            onChange={dirty}
            onSubmit={(e) => orgAction(e, o)}
          >
            <label>
              {t.status}
              <select name="action">
                {actions.map((a) => (
                  <option key={a} value={a}>
                    {t[a as keyof typeof t]}
                  </option>
                ))}
              </select>
            </label>
            <label>
              {t.reason}
              <textarea name="reason" maxLength={500} required />
            </label>
            {o.can_review && o.status === "in_review" && (
              <label>
                {t.expiry}
                <input type="date" name="expires" />
              </label>
            )}
            <button disabled={busy || refreshing} className="button primary">
              {t.save}
            </button>
          </form>
        )}
      </article>
    );
  }
  const draftForm = (d: DraftListing | null) => {
    const r = d?.revision;
    return (
      <form
        key={d?.id ?? "new"}
        className="panel s2-form"
        onChange={dirty}
        onSubmit={(e) => {
          e.preventDefault();
          const f = e.currentTarget,
            v = new FormData(f),
            string = (k: string) => String(v.get(k) ?? ""),
            num = (k: string) => (string(k) === "" ? null : Number(string(k))),
            rules: Rule[] = [];
          if (string("required_country"))
            rules.push({
              field: "country",
              op: "eq",
              value: string("required_country"),
            });
          if (string("required_language"))
            rules.push({
              field: "language",
              op: "eq",
              value: string("required_language"),
            });
          if (num("min_hours") !== null)
            rules.push({ field: "hours", op: "gte", value: num("min_hours")! });
          rules.push(
            ...(r?.rules ?? []).filter(
              (x) =>
                !(
                  ((x.field === "country" || x.field === "language") &&
                    x.op === "eq") ||
                  (x.field === "hours" && x.op === "gte")
                ),
            ),
          );
          const data = {
            title_th: string("title_th"),
            title_en: string("title_en"),
            description_th: string("description_th"),
            description_en: string("description_en"),
            category: string("category"),
            country_code: string("country_code"),
            coarse_region: string("coarse_region"),
            languages: v.getAll("languages"),
            remote: v.has("remote"),
            cost_amount: num("cost_amount"),
            currency: string("currency"),
            accessibility_th: string("accessibility_th"),
            accessibility_en: string("accessibility_en"),
            source_url: string("source_url"),
            valid_until: new Date(string("valid_until")).toISOString(),
            capacity: num("capacity"),
            job_pay_min: num("job_pay_min"),
            job_pay_max: num("job_pay_max"),
            job_pay_unit: string("job_pay_unit") || null,
            job_contract: string("job_contract") || null,
            rules,
          };
          void send(
            "listings",
            {
              org: d?.organization_id ?? v.get("org"),
              id: d?.id ?? null,
              data,
              expectedVersion: d?.version ?? 0,
            },
            f,
          ).then((x) => {
            if (x.ok) setEditing(null);
          });
        }}
      >
        <h2>{d ? t.edit : t.newListing}</h2>
        {!d && (
          <label>
            {t.org}
            <select name="org" required>
              {orgs
                .filter((o) => o.status === "verified")
                .map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.display_name}
                  </option>
                ))}
            </select>
          </label>
        )}
        {(
          [
            ["title_th", t.titleTh],
            ["title_en", t.titleEn],
          ] as const
        ).map(([k, label]) => (
          <label key={k}>
            {label}
            <input
              name={k}
              maxLength={160}
              required
              defaultValue={r?.[k] ?? ""}
            />
          </label>
        ))}
        {(
          [
            ["description_th", t.descriptionTh],
            ["description_en", t.descriptionEn],
            ["accessibility_th", t.accessTh],
            ["accessibility_en", t.accessEn],
          ] as const
        ).map(([k, label]) => (
          <label key={k}>
            {label}
            <textarea
              name={k}
              maxLength={k.startsWith("description") ? 2000 : 500}
              required
              defaultValue={r?.[k] ?? ""}
            />
          </label>
        ))}
        <label>
          {t.category}
          <select name="category" defaultValue={r?.category ?? "skills"}>
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
            name="country_code"
            required
            maxLength={2}
            pattern="[A-Z]{2}"
            defaultValue={r?.country_code ?? "TH"}
          />
        </label>
        <label>
          {t.region}
          <input
            name="coarse_region"
            maxLength={80}
            defaultValue={r?.coarse_region ?? ""}
          />
        </label>
        <fieldset>
          <legend>{t.languages}</legend>
          {["th", "en"].map((l) => (
            <label key={l} className="check">
              <input
                name="languages"
                type="checkbox"
                value={l}
                defaultChecked={r ? r.languages.includes(l) : true}
              />
              {l === "th" ? "ไทย" : "English"}
            </label>
          ))}
        </fieldset>
        <label className="check">
          <input
            type="checkbox"
            name="remote"
            defaultChecked={r?.remote ?? false}
          />
          {t.remote}
        </label>
        <label>
          {t.cost}
          <input
            name="cost_amount"
            type="number"
            min="0"
            step="0.01"
            required
            defaultValue={r?.cost_amount ?? 0}
          />
        </label>
        <label>
          {t.currency}
          <input
            name="currency"
            required
            pattern="[A-Z]{3}"
            maxLength={3}
            defaultValue={r?.currency ?? "THB"}
          />
        </label>
        <label>
          {t.validUntil}
          <input
            name="valid_until"
            type="date"
            required
            defaultValue={r?.valid_until.slice(0, 10) ?? ""}
          />
        </label>
        <label>
          {t.source}
          <input
            name="source_url"
            type="url"
            required
            maxLength={500}
            defaultValue={r?.source_url ?? ""}
          />
        </label>
        <label>
          {t.capacity}
          <input
            name="capacity"
            type="number"
            min="0"
            defaultValue={r?.capacity ?? ""}
          />
        </label>
        <fieldset>
          <legend>{categories.jobs[lang]}</legend>
          <label>
            {t.payMin}
            <input
              name="job_pay_min"
              type="number"
              min="0"
              step="0.01"
              defaultValue={r?.job_pay_min ?? ""}
            />
          </label>
          <label>
            {t.payMax}
            <input
              name="job_pay_max"
              type="number"
              min="0"
              step="0.01"
              defaultValue={r?.job_pay_max ?? ""}
            />
          </label>
          <label>
            {t.payUnit}
            <select name="job_pay_unit" defaultValue={r?.job_pay_unit ?? ""}>
              <option value="">{t.unknown}</option>
              {["hour", "day", "month"].map((u) => (
                <option key={u} value={u}>
                  {lang === "th"
                    ? { hour: "ชั่วโมง", day: "วัน", month: "เดือน" }[u]
                    : u}
                </option>
              ))}
            </select>
          </label>
          <label>
            {t.contract}
            <input
              name="job_contract"
              maxLength={80}
              defaultValue={r?.job_contract ?? ""}
            />
          </label>
        </fieldset>
        <fieldset>
          <legend>{t.rules}</legend>
          <label>
            {t.requiredCountry}
            <input
              name="required_country"
              pattern="[A-Z]{2}"
              maxLength={2}
              defaultValue={String(
                r?.rules.find((x) => x.field === "country")?.value ?? "",
              )}
            />
          </label>
          <label>
            {t.requiredLanguage}
            <select
              name="required_language"
              defaultValue={String(
                r?.rules.find((x) => x.field === "language")?.value ?? "",
              )}
            >
              <option value="">{t.unknown}</option>
              <option value="th">ไทย</option>
              <option value="en">English</option>
            </select>
          </label>
          <label>
            {t.minHours}
            <input
              name="min_hours"
              type="number"
              min="0"
              max="168"
              defaultValue={String(
                r?.rules.find((x) => x.field === "hours")?.value ?? "",
              )}
            />
          </label>
        </fieldset>
        <button className="button primary" disabled={busy || refreshing}>
          {t.save}
        </button>
      </form>
    );
  };
  return (
    <main
      id="main"
      className="account-page s2-page"
      data-live-busy={busy || refreshing}
    >
      <h1>{t[section]}</h1>
      <p className="notice">{t.demo}</p>
      <nav
        className="s2-tabs"
        aria-label={lang === "th" ? "เมนูโอกาส" : "Opportunity workspace"}
      >
        {s2Sections
          .filter((s) => s !== "review" || account.context.has_platform_role)
          .map((s) => (
            <Link
              key={s}
              href={`/${lang}/workspace${s === "home" ? "" : "/" + s}`}
              aria-current={section === s ? "page" : undefined}
            >
              {t[s]}
            </Link>
          ))}
      </nav>
      <p role="status" aria-live="polite">
        {message}
      </p>
      {message && (
        <button
          type="button"
          className="button secondary"
          onClick={() => router.refresh()}
        >
          {t.reload}
        </button>
      )}
      {section === "home" && (
        <S2HomeMenus
          lang={lang}
          canReview={account.context.has_platform_role}
        />
      )}
      {["organizations", "catalog", "review"].includes(section) &&
      !account.context.staff_assured ? (
        <p>
          {t.mfa} <Link href={`/${lang}/account/security`}>{t.security}</Link>
        </p>
      ) : (
        <>
          {section === "organizations" && (
            <form
              className="panel s2-form"
              onChange={dirty}
              onSubmit={(e) => {
                e.preventDefault();
                const f = e.currentTarget,
                  d = new FormData(f);
                void send(
                  "/api/v1/organizations",
                  { name: d.get("name"), country: d.get("country") },
                  f,
                );
              }}
            >
              <label>
                {t.name}
                <input name="name" required maxLength={100} />
              </label>
              <label>
                {t.country}
                <input
                  name="country"
                  required
                  pattern="[A-Z]{2}"
                  maxLength={2}
                  defaultValue="TH"
                />
              </label>
              <button className="button primary" disabled={busy || refreshing}>
                {t.create}
              </button>
            </form>
          )}
          {(section === "organizations" || section === "review") &&
            (orgs.length ? (
              <div className="s2-grid">{orgs.map(organizationCard)}</div>
            ) : (
              <p>{t.empty}</p>
            ))}
          {section === "catalog" &&
            orgs.some((o) => o.status === "verified") &&
            draftForm(editing)}
          {(section === "catalog" || section === "review") &&
            (listings.length ? (
              listings.map((l) => (
                <article className="panel" key={l.id + ":" + l.version}>
                  <h2>
                    {lang === "th" ? l.revision.title_th : l.revision.title_en}
                  </h2>
                  <p>
                    {stateLabel(lang, l.state)} ·{" "}
                    {lang === "th" ? "ฉบับ" : "Revision"}{" "}
                    {l.revision.revision_no}
                  </p>
                  <p>
                    {lang === "th"
                      ? l.revision.description_th
                      : l.revision.description_en}
                  </p>
                  <ul>
                    {l.revision.rules.map((r, i) => (
                      <li key={i}>{ruleLabel(lang, r)}</li>
                    ))}
                  </ul>
                  {section === "catalog" &&
                    l.state !== "in_review" &&
                    l.state !== "archived" && (
                      <button
                        className="button secondary"
                        type="button"
                        onClick={() => setEditing(l)}
                      >
                        {t.edit}
                      </button>
                    )}
                  {section === "catalog" &&
                    ["draft", "changes_requested", "paused"].includes(
                      l.state,
                    ) && (
                      <button
                        type="button"
                        disabled={busy || refreshing}
                        className="button primary"
                        onClick={() =>
                          void send(`listings/${l.id}/submit`, {
                            expectedVersion: l.version,
                          })
                        }
                      >
                        {t.submit}
                      </button>
                    )}
                  {section === "review" &&
                    [
                      "in_review",
                      "published",
                      "paused",
                      "draft",
                      "changes_requested",
                    ].includes(l.state) && (
                      <form
                        className="s2-form"
                        onChange={dirty}
                        onSubmit={(e) => {
                          e.preventDefault();
                          const f = e.currentTarget,
                            d = new FormData(f);
                          void send(
                            `listings/${l.id}/review`,
                            {
                              action: d.get("action"),
                              reason: d.get("reason"),
                              expectedVersion: l.version,
                            },
                            f,
                          );
                        }}
                      >
                        <label>
                          {t.status}
                          <select name="action">
                            {(l.state === "in_review"
                              ? ["publish", "request_changes"]
                              : l.state === "published"
                                ? ["pause", "archive"]
                                : ["archive"]
                            ).map((a) => (
                              <option value={a} key={a}>
                                {t[a as keyof typeof t]}
                              </option>
                            ))}
                          </select>
                        </label>
                        <label>
                          {t.reason}
                          <textarea name="reason" required maxLength={500} />
                        </label>
                        <button
                          className="button primary"
                          disabled={busy || refreshing}
                        >
                          {t.save}
                        </button>
                      </form>
                    )}
                </article>
              ))
            ) : (
              <p>{t.empty}</p>
            ))}
        </>
      )}
      {section === "assessment" &&
        (!account.profile ? (
          <Link href={`/${lang}/account/profile`}>{t.profile}</Link>
        ) : (
          <form
            key={assessment?.version ?? 0}
            className="panel s2-form"
            onChange={dirty}
            onSubmit={(e) => {
              e.preventDefault();
              const f = e.currentTarget,
                d = new FormData(f),
                s = (k: string) => String(d.get(k) ?? "");
              void send(
                "assessment",
                {
                  subject: account.profile!.id,
                  data: {
                    goals: d.getAll("goals"),
                    country_code: s("country_code") || null,
                    coarse_region: s("coarse_region") || null,
                    preferred_language: s("preferred_language") || null,
                    remote_ok:
                      s("remote_ok") === "" ? null : s("remote_ok") === "true",
                    available_hours_week:
                      s("hours") === "" ? null : Number(s("hours")),
                  },
                  notice: assessmentNotice.id,
                  confirmed: d.has("confirmed"),
                  expectedVersion: assessment?.version ?? 0,
                },
                f,
              );
            }}
          >
            <p>{t.optional}</p>
            <fieldset>
              <legend>{t.goal}</legend>
              {Object.entries(categories).map(([k, v]) => (
                <label className="check" key={k}>
                  <input
                    type="checkbox"
                    name="goals"
                    value={k}
                    defaultChecked={assessment?.goals.includes(k) ?? false}
                  />
                  {v[lang]}
                </label>
              ))}
            </fieldset>
            <label>
              {t.country}
              <input
                name="country_code"
                maxLength={2}
                pattern="[A-Z]{2}"
                defaultValue={assessment?.country_code ?? ""}
              />
            </label>
            <label>
              {t.region}
              <input
                name="coarse_region"
                maxLength={80}
                defaultValue={assessment?.coarse_region ?? ""}
              />
            </label>
            <label>
              {t.language}
              <select
                name="preferred_language"
                defaultValue={assessment?.preferred_language ?? ""}
              >
                <option value="">{t.unknown}</option>
                <option value="th">ไทย</option>
                <option value="en">English</option>
              </select>
            </label>
            <label>
              {t.remotePreference}
              <select
                name="remote_ok"
                defaultValue={
                  assessment?.remote_ok === null || !assessment
                    ? ""
                    : String(assessment.remote_ok)
                }
              >
                <option value="">{t.unknown}</option>
                <option value="true">{t.yes}</option>
                <option value="false">{t.no}</option>
              </select>
            </label>
            <label>
              {t.hours}
              <input
                name="hours"
                type="number"
                min="0"
                max="168"
                defaultValue={assessment?.available_hours_week ?? ""}
              />
            </label>
            <details>
              <summary>{t.notice}</summary>
              <p>{assessmentNotice.body}</p>
              <p>{assessmentNotice.version}</p>
            </details>
            <label className="check">
              <input
                name="confirmed"
                type="checkbox"
                defaultChecked={!!assessment?.confirmed_at}
              />
              {t.confirm}
            </label>
            <details>
              <summary>
                {lang === "th"
                  ? "ประวัติยืนยัน 20 รายการล่าสุด"
                  : "Latest 20 confirmation events"}
              </summary>
              <ul>
                {consentEvents.map((e) => (
                  <li key={e.version}>
                    {lang === "th" ? "ฉบับ" : "Version"} {e.version} ·{" "}
                    {e.action === "confirmed"
                      ? lang === "th"
                        ? "ยืนยันแล้ว"
                        : "Confirmed"
                      : lang === "th"
                        ? "กลับเป็นฉบับร่าง"
                        : "Returned to draft"}{" "}
                    ·{" "}
                    {new Date(e.occurred_at).toLocaleString(
                      lang === "th" ? "th-TH" : "en-GB",
                      { timeZone: "UTC" },
                    )}
                  </li>
                ))}
              </ul>
            </details>
            <button disabled={busy || refreshing} className="button primary">
              {t.save}
            </button>
          </form>
        ))}
      {section === "bookmarks" &&
        (bookmarks.length ? (
          bookmarks.map((b) => (
            <article className="panel" key={b.id}>
              {b.available ? (
                <Link href={`/${lang}/directory/${b.id}`}>
                  {(lang === "th" ? b.title_th : b.title_en) ??
                    (lang === "th"
                      ? "เปิดโอกาสที่บันทึก"
                      : "Open saved opportunity")}
                </Link>
              ) : (
                <p>{t.unavailable}</p>
              )}
              <BookmarkButton lang={lang} id={b.id} remove />
            </article>
          ))
        ) : (
          <p>{t.empty}</p>
        ))}
      {section === "matches" && (
        <>
          <p>{t.matchHelp}</p>
          {needsConfirmed ? (
            <Link href={`/${lang}/workspace/assessment`}>
              {t.needsConfirmed}
            </Link>
          ) : matches.length ? (
            matches.map((m) => (
              <article className="panel" key={m.id}>
                <h2>
                  <Link href={`/${lang}/directory/${m.id}`}>
                    {lang === "th" ? m.title_th : m.title_en}
                  </Link>
                </h2>
                <p>
                  {m.match.status === "eligible"
                    ? t.eligible
                    : m.match.status === "ineligible"
                      ? t.ineligible
                      : t.matchUnknown}
                </p>
                <ul>
                  {m.match.reasons.map((r, i) => (
                    <li key={i}>
                      {ruleLabel(lang, r)} —{" "}
                      {r.status === "eligible"
                        ? t.eligible
                        : r.status === "ineligible"
                          ? t.ineligible
                          : t.matchUnknown}
                    </li>
                  ))}
                </ul>
              </article>
            ))
          ) : (
            <p>{t.empty}</p>
          )}
        </>
      )}
      {["organizations", "catalog", "review"].includes(section) && (
        <nav
          className="s2-tabs"
          aria-label={lang === "th" ? "หน้าคิวงาน" : "Queue pages"}
        >
          {page > 1 && (
            <Link href={`/${lang}/workspace/${section}?page=${page - 1}`}>
              {lang === "th" ? "หน้าก่อนหน้า" : "Previous page"}
            </Link>
          )}
          <span>
            {lang === "th" ? "หน้า" : "Page"} {page}
          </span>
          {page < 100 && (orgs.length === 20 || listings.length === 20) && (
            <Link href={`/${lang}/workspace/${section}?page=${page + 1}`}>
              {lang === "th" ? "หน้าถัดไป" : "Next page"}
            </Link>
          )}
        </nav>
      )}
      <Link href={`/${lang}/opportunities`}>{t.search}</Link>
    </main>
  );
}
