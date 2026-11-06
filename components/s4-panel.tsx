"use client";
import {
  useId,
  useSyncExternalStore,
  useRef,
  useState,
  type ReactNode,
  type FormEvent,
} from "react";
import Link from "./busy-link";
import { BusyForm } from "./busy-form";
import { DownloadLink } from "./download-link";
import { HomeMenuGrid } from "./home-menu-cards";
import { busyFetch } from "@/lib/ui/activity";
import { useBusyRouter } from "@/lib/ui/router";
import { s4Text } from "@/lib/s4/copy";
import {
  kinds,
  type S4Kind,
  type S4Row,
  type S4Detail,
  type S4Source,
  type S4Staff,
  type S4Cessation,
} from "@/lib/s4/model";
import { shareFields } from "@/lib/s3/model";
import { s3Label } from "@/lib/s3/copy";
import type { AccountContext, Notice } from "@/lib/auth/types";
import type { CatalogEntry } from "@/lib/s2/model";
const subscribeTimezone = () => () => {};
const timezone = () => Intl.DateTimeFormat().resolvedOptions().timeZone;
const serverTimezone = () => "UTC";
type Data = {
  liveFingerprint?: string;
  publicIntake?: boolean;
  context: AccountContext;
  sources: S4Source[];
  notice: Notice;
  staff: S4Staff[];
  cessations: S4Cessation[];
  destinations: CatalogEntry[];
  destinationQuery?: string;
  teams: Record<
    string,
    { id: string; account_id: string; name?: string; roles: string[] }[]
  >;
  rows: S4Row[];
  detail: S4Detail | null;
  page: number;
};
function Field({
  label,
  children,
}: {
  label: string;
  children: (id: string) => ReactNode;
}) {
  const id = useId();
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      {children(id)}
    </div>
  );
}
export function S4Panel({
  lang,
  section,
  initial: d,
}: {
  lang: "th" | "en";
  section: S4Kind | "home";
  initial: Data;
}) {
  const zone = useSyncExternalStore(
    subscribeTimezone,
    timezone,
    serverTimezone,
  );
  const t = (key: string) => s4Text(lang, key),
    router = useBusyRouter(),
    lock = useRef(false),
    key = useRef("");
  const [busy, setBusy] = useState(false),
    [message, setMessage] = useState(""),
    [failed, setFailed] = useState(false),
    [preview, setPreview] = useState<{
      id: string;
      hash: string;
      package: NonNullable<S4Detail["package"]>;
    } | null>(null);
  const base = "/" + lang + "/coordination";
  async function api<T = unknown>(
    path: string,
    body: unknown,
    form?: HTMLFormElement,
    refresh = true,
    idempotency?: string,
  ): Promise<T | null> {
    if (lock.current) return null;
    lock.current = true;
    setBusy(true);
    setMessage("");
    setFailed(false);
    try {
      const r = await busyFetch("/api/s4/" + path, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(idempotency ? { "Idempotency-Key": idempotency } : {}),
        },
        body: JSON.stringify(body),
      });
      const json = await r.json();
      if (!r.ok) {
        setFailed(true);
        setMessage(
          r.status === 409
            ? t("conflict")
            : r.status === 403 || r.status === 404
              ? t("permission")
              : t("error"),
        );
        return null;
      }
      if (form && refresh) {
        form.dataset.liveDirty = "false";
        form.reset();
      }
      if (refresh) {
        setMessage(t("saved"));
        window.dispatchEvent(new Event("goos:saved"));
        if (!["proposals", "outcomes", "privacy", "reports"].includes(path))
          router.refresh();
      }
      return (json.data ?? true) as T;
    } catch {
      setFailed(true);
      setMessage(t("error"));
      return null;
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  const dirty = (e: FormEvent<HTMLFormElement>) => {
    e.currentTarget.dataset.liveDirty = "true";
    if (
      preview &&
      e.currentTarget.getAttribute("aria-label") === t("preview")
    ) {
      setPreview(null);
      key.current = "";
    }
  };
  function form(
    label: string,
    children: ReactNode,
    submit: (f: FormData, el: HTMLFormElement) => Promise<unknown>,
  ) {
    return (
      <BusyForm
        className="panel form-grid"
        aria-label={label}
        onInput={dirty}
        onSubmit={(e) => {
          e.preventDefault();
          if (lock.current) return;
          const el = e.currentTarget;
          void submit(new FormData(el), el);
        }}
      >
        <h2>{label}</h2>
        <fieldset disabled={busy}>{children}</fieldset>
      </BusyForm>
    );
  }
  function select(
    name: string,
    label: string,
    options: { value: string; label: string }[],
    required = true,
  ) {
    return (
      <Field label={label}>
        {(id) => (
          <select id={id} name={name} required={required}>
            {options.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        )}
      </Field>
    );
  }
  function text(
    name: string,
    label: string,
    required = true,
    type = "text",
    value?: string,
  ) {
    return (
      <Field label={label}>
        {(id) => (
          <input
            id={id}
            name={name}
            type={type}
            required={required}
            defaultValue={value}
          />
        )}
      </Field>
    );
  }
  function body(label = t("body")) {
    return (
      <Field label={label}>
        {(id) => (
          <textarea id={id} name="body" required maxLength={2000} rows={4} />
        )}
      </Field>
    );
  }
  function checkbox(name: string, label: string, required = false) {
    return (
      <label className="check">
        <input name={name} type="checkbox" required={required} />
        {label}
      </label>
    );
  }
  const button = (label: string) => (
    <button type="submit" disabled={busy}>
      {label}
    </button>
  );
  const sourceOptions = d.sources.map((s) => ({
    value: s.id,
    label: lang === "th" ? s.title_th : s.title_en,
  }));
  const date = (value: string) =>
    new Intl.DateTimeFormat(lang === "th" ? "th-TH" : "en-GB", {
      dateStyle: "medium",
      timeStyle: "short",
      timeZone: zone,
    }).format(new Date(value));
  async function action(
    row: S4Row,
    action: string,
    reason: string | null = null,
  ) {
    await api(row.kind + "/" + row.id + "/action", {
      action,
      version: row.version,
      ...(row.kind === "referrals"
        ? { member: null }
        : row.kind === "reports"
          ? {}
          : { reason }),
    });
  }
  function item(row: S4Row) {
    return (
      <article className="panel" key={row.id}>
        <h2>{t(row.title)}</h2>
        <p>
          {t(row.state)}
          {row.tier ? " · " + t(row.tier) : ""}
        </p>
        <p>{date(row.created_at)}</p>
        {row.can_view && (
          <Link href={base + "/" + row.kind + "/" + row.id}>{t("view")}</Link>
        )}
        {row.can_accept &&
          form(
            t("accept"),
            <>
              {select(
                "member",
                t("assignee"),
                (d.teams[row.recipient_org_id ?? ""] ?? [])
                  .filter((m) => m.roles.includes("caseworker"))
                  .map((m) => ({
                    value: m.id,
                    label:
                      m.name ??
                      d.staff.find((s) => s.account === m.account_id)?.name ??
                      m.account_id,
                  })),
              )}
              <p>{t("no_copy")}</p>
              {button(t("accept"))}
              <button
                type="button"
                disabled={busy}
                onClick={() => void action(row, "decline")}
              >
                {t("decline")}
              </button>
            </>,
            async (f, el) =>
              api(
                "referrals/" + row.id + "/action",
                {
                  action: "accept",
                  version: row.version,
                  member: String(f.get("member")),
                },
                el,
              ),
          )}
        {row.can_assign_case && caseAssignment(row)}
        {row.can_assign && assignment(row)}
      </article>
    );
  }
  function caseAssignment(row: S4Row) {
    return form(
      t("assign"),
      <>
        {select(
          "member",
          t("assignee"),
          (d.teams[row.recipient_org_id ?? ""] ?? [])
            .filter((m) => m.roles.includes("caseworker"))
            .map((m) => ({ value: m.id, label: m.name ?? m.account_id })),
        )}
        {button(t("assign"))}
      </>,
      async (f, el) =>
        api(
          "cases/" + row.case_id + "/action",
          {
            action: "assign",
            version: row.case_version,
            member: String(f.get("member")),
            body: null,
            visibility: null,
            supersedes: null,
          },
          el,
        ),
    );
  }
  function assignment(row: S4Row) {
    const scope =
      row.kind === "outcomes"
        ? "impact"
        : row.kind === "privacy"
          ? "privacy"
          : "safety";
    return form(
      t("assign"),
      <>
        {select(
          "account",
          t("account"),
          d.staff
            .filter(
              (s) => s.scope === scope && s.account !== d.context.account_id,
            )
            .map((s) => ({ value: s.account, label: s.name })),
        )}
        {text("expires", t("expires"), true, "datetime-local")}
        {button(t("assign"))}
      </>,
      async (f, el) =>
        api(
          row.kind + "/" + row.id + "/assign",
          {
            account: String(f.get("account")),
            expires: new Date(String(f.get("expires"))).toISOString(),
            version: row.version,
          },
          el,
        ),
    );
  }
  const detail = d.detail,
    row = detail?.row;
  return (
    <main
      id="main"
      className="account-page s2-page workflow-page s4-page"
      data-live-busy={busy || router.isPending}
      data-live-fingerprint={d.liveFingerprint}
    >
      <h1>{t(section)}</h1>
      <p className="notice">{t("synthetic")}</p>
      {d.publicIntake !== false && <Link href={"/" + lang + "/report"}>{t("anonymous_report")}</Link>}
      <nav className="s2-tabs" aria-label={t("home")}>
        {(["home", ...kinds] as const).map((k) => (
          <Link
            key={k}
            href={base + (k === "home" ? "" : "/" + k)}
            aria-current={k === section ? "page" : undefined}
          >
            {t(k)}
          </Link>
        ))}
      </nav>
      <p role={failed ? "alert" : "status"} aria-live="polite">
        {message}
      </p>
      {failed && (
        <button
          type="button"
          onClick={() => {
            setPreview(null);
            key.current = "";
            window.dispatchEvent(new Event("goos:saved"));
            router.refresh();
          }}
        >
          {t("reload")}
        </button>
      )}
      {section === "home" && (
        <HomeMenuGrid
          label={t("home")}
          items={kinds.map((k, i) => ({
            href: base + "/" + k,
            label: t(k),
            description: t(
              k === "referrals"
                ? "no_copy"
                : k === "privacy"
                  ? "policy"
                  : k === "reports"
                    ? "limits"
                    : "L2",
            ),
            art: [4, 10, 12, 11][i],
            tone: i,
            wide: i === 0,
          }))}
        />
      )}
      {!row && section !== "home" && (
        <>
          {d.rows.length === 0 ? <p>{t("empty")}</p> : d.rows.map(item)}
          <nav aria-label={lang === "th" ? "หน้ารายการ" : "List pages"}>
            {d.page > 1 && (
              <Link href={base + "/" + section + "?page=" + (d.page - 1)}>
                {t("previous")}
              </Link>
            )}
            {d.rows.length === 20 && d.page < 100 && (
              <Link href={base + "/" + section + "?page=" + (d.page + 1)}>
                {t("next")}
              </Link>
            )}
          </nav>
        </>
      )}
      {!row && ["home", "referrals"].includes(section) && (
        <BusyForm
          method="get"
          action={base + (section === "home" ? "" : "/" + section)}
          className="panel form-grid"
          aria-label={t("search_destination")}
        >
          <h2>{t("search_destination")}</h2>
          <Field label={t("search_destination")}>
            {(id) => (
              <input
                id={id}
                name="q"
                maxLength={100}
                defaultValue={d.destinationQuery ?? ""}
              />
            )}
          </Field>
          <button type="submit">{t("search")}</button>
        </BusyForm>
      )}
      {!row &&
        (section === "referrals" || section === "home") &&
        (d.sources.some((s) => s.type === "source" && s.can_refer !== false) &&
        d.destinations.length > 0 ? (
          form(
            t("propose"),
            <>
              {select(
                "case",
                t("source"),
                d.sources
                  .filter((s) => s.type === "source" && s.can_refer !== false)
                  .map((s) => ({
                    value: s.id,
                    label: lang === "th" ? s.title_th : s.title_en,
                  })),
              )}
              {select(
                "opportunity",
                t("destination"),
                d.destinations.map((p) => ({
                  value: p.id,
                  label:
                    (lang === "th" ? p.title_th : p.title_en) +
                    " · " +
                    p.organization_name,
                })),
              )}
              {select(
                "purpose",
                t("purpose"),
                ["service_support", "work_support"].map((x) => ({
                  value: x,
                  label: t(x),
                })),
              )}
              {button(t("propose"))}
            </>,
            async (f, el) => {
              const id = await api<string>(
                "proposals",
                {
                  case: String(f.get("case")),
                  opportunity: String(f.get("opportunity")),
                  purpose: String(f.get("purpose")),
                },
                el,
              );
              if (id) router.push(base + "/referrals/" + id);
            },
          )
        ) : (
          <section className="panel">
            <p>{t("no_referral_source")}</p>
            <Link href={"/" + lang + "/opportunities"}>
              {t("browse_opportunities")}
            </Link>
          </section>
        ))}
      {row && detail && (
        <>
          <section className="panel">
            <h2>{t(row.title)}</h2>
            <p>
              {t(row.state)}
              {row.tier ? " · " + t(row.tier) : ""}
            </p>
            {detail.body && <p className="preserve-lines">{detail.body}</p>}
            {row.hold && <p>{t(row.hold)}</p>}
            {detail.source_application && (
              <Link
                href={
                  "/" +
                  lang +
                  "/workflow/application/" +
                  detail.source_application
                }
              >
                {t("source")}
              </Link>
            )}
          </section>
          {row.can_consent &&
            form(
              t("preview"),
              <>
                <p>
                  {t("notice")}: {d.notice.body}
                </p>
                <fieldset>
                  <legend>{t("fields")}</legend>
                  {shareFields.map((f) => (
                    <label className="check" key={f}>
                      <input type="checkbox" name="fields" value={f} />
                      {s3Label(lang, f)}
                    </label>
                  ))}
                </fieldset>
                {text("skills", t("skills"), false)}
                {button(t("preview"))}
              </>,
              async (f, el) => {
                const p = await api<typeof preview>(
                  "previews",
                  {
                    id: row.id,
                    fields: f.getAll("fields"),
                    skills: String(f.get("skills") ?? "")
                      .split(",")
                      .map((s) => s.trim())
                      .filter(Boolean),
                    notice: d.notice.id,
                  },
                  el,
                  false,
                );
                if (p) {
                  key.current = crypto.randomUUID();
                  setPreview(p);
                }
              },
            )}
          {(preview?.package ?? detail.package) && (
            <section className="panel workflow-package">
              <h2>{t("fields")}</h2>
              <p>
                {(preview?.package ?? detail.package)!.recipient.name} ·{" "}
                {t((preview?.package ?? detail.package)!.purpose)}
              </p>
              <dl>
                {Object.entries(
                  (preview?.package ?? detail.package)!.values,
                ).map(([k, v]) => (
                  <div key={k}>
                    <dt>{s3Label(lang, k)}</dt>
                    <dd>{typeof v === "string" ? v : JSON.stringify(v)}</dd>
                  </div>
                ))}
              </dl>
            </section>
          )}
          {preview &&
            form(
              t("submit"),
              <>
                {checkbox("confirmed", t("consent"), true)}
                {button(t("submit"))}
              </>,
              async (f, el) => {
                const done = await api(
                  "submissions",
                  {
                    preview: preview.id,
                    hash: preview.hash,
                    notice: d.notice.id,
                    confirmed: f.get("confirmed") === "on",
                  },
                  el,
                  true,
                  key.current,
                );
                if (done) {
                  setPreview(null);
                  key.current = "";
                }
              },
            )}
          {row.can_revoke && (
            <button
              type="button"
              disabled={busy}
              onClick={() =>
                void action(row, row.state === "proposed" ? "cancel" : "revoke")
              }
            >
              {t(row.state === "proposed" ? "cancel" : "revoke")}
            </button>
          )}
          {detail.case && (
            <section className="panel">
              <h2>
                {t("case")} · {t(detail.case.state)}
              </h2>
              {detail.case.can_work && (
                <>
                  {["start", "resolve", "close"]
                    .filter(
                      (a) =>
                        ({
                          start: "open",
                          resolve: "in_progress",
                          close: "resolved",
                        })[a] === detail.case!.state,
                    )
                    .map((a) => (
                      <button
                        type="button"
                        key={a}
                        disabled={busy}
                        onClick={() =>
                          void api("cases/" + detail.case!.id + "/action", {
                            action: a,
                            version: detail.case!.version,
                            member: null,
                            body: null,
                            visibility: null,
                            supersedes: null,
                          })
                        }
                      >
                        {t(a)}
                      </button>
                    ))}
                  {form(
                    t("note"),
                    <>
                      {body()}
                      {select(
                        "visibility",
                        t("visibility"),
                        ["beneficiary_shared", "internal"].map((x) => ({
                          value: x,
                          label: t(x),
                        })),
                      )}
                      {button(t("note"))}
                    </>,
                    async (f, el) =>
                      api(
                        "cases/" + detail.case!.id + "/action",
                        {
                          action: "note",
                          version: detail.case!.version,
                          member: null,
                          body: String(f.get("body")),
                          visibility: String(f.get("visibility")),
                          supersedes: null,
                        },
                        el,
                      ),
                  )}
                </>
              )}
              {detail.notes?.map((n) => (
                <article className="workflow-note" key={n.id}>
                  <h3>{t(n.visibility)}</h3>
                  <p>{n.body}</p>
                </article>
              ))}
            </section>
          )}
          {row.kind === "outcomes" && (
            <section className="panel">
              <h2>{t("outcomes")}</h2>
              {row.own && (
                <>
                  <button
                    type="button"
                    disabled={busy || row.state === "superseded"}
                    onClick={() => void action(row, "confirm")}
                  >
                    {t("confirm")}
                  </button>
                  <button
                    type="button"
                    disabled={busy || row.state === "superseded"}
                    onClick={() => void action(row, "dispute")}
                  >
                    {t("dispute")}
                  </button>
                </>
              )}
              {row.can_review &&
                form(
                  t("verify"),
                  <>
                    {checkbox("alternate", t("alternate"))}
                    {button(t("verify"))}
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => void action(row, "reject")}
                    >
                      {t("reject")}
                    </button>
                  </>,
                  async (f) =>
                    action(
                      row,
                      "verify",
                      f.get("alternate") === "on"
                        ? "reviewed_documentary_evidence"
                        : null,
                    ),
                )}
              {row.reporter &&
                ["reported", "disputed"].includes(row.state) &&
                form(
                  t("upload"),
                  <>
                    <Field label={t("evidence")}>
                      {(id) => (
                        <input
                          type="file"
                          id={id}
                          name="file"
                          accept="image/png"
                          required
                        />
                      )}
                    </Field>
                    {button(t("upload"))}
                  </>,
                  async (f, el) => {
                    const file = f.get("file");
                    if (
                      !(file instanceof File) ||
                      file.type !== "image/png" ||
                      file.size > 1048576
                    ) {
                      setFailed(true);
                      setMessage(t("error"));
                      return;
                    }
                    const bytes = new Uint8Array(await file.arrayBuffer());
                    let binary = "";
                    for (const b of bytes) binary += String.fromCharCode(b);
                    await api(
                      "outcomes/" + row.id + "/evidence",
                      { body: btoa(binary) },
                      el,
                    );
                  },
                )}
              {detail.evidence?.map((e) => (
                <p key={e.id}>
                  {t(e.status)}{" "}
                  {e.status === "clean" && (
                    <DownloadLink
                      href={"/api/s4/evidence/" + e.id + "/download"}
                      lang={lang}
                    >
                      {t("download")}
                    </DownloadLink>
                  )}
                </p>
              ))}
            </section>
          )}
          {row.kind === "privacy" && (
            <section className="panel">
              <h2>{t("privacy")}</h2>
              <p>{t("policy")}</p>
              {row.own && (
                <>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void action(row, "stop_sharing")}
                  >
                    {t("stop_sharing")}
                  </button>
                  {row.title === "delete" && row.own && <Link href={`/${lang}/account/deletion?request=${row.id}`}>{lang === "th" ? "บันทึกรหัสติดตามก่อนบัญชีถูกลบ" : "Save a tracking key before account deletion"}</Link>}
                  {row.title === "correct" && row.state === "approved" && (
                    <>
                      <Link href={"/" + lang + "/account/profile"}>
                        {t("own_profile")}
                      </Link>
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => void action(row, "complete_correction")}
                      >
                        {t("complete_correction")}
                      </button>
                    </>
                  )}
                  {row.can_export && (
                    <DownloadLink
                      href={"/api/s4/privacy/" + row.id + "/export"}
                      lang={lang}
                    >
                      {t("download_export")}
                    </DownloadLink>
                  )}
                </>
              )}
              {row.can_review &&
                form(
                  t("privacy"),
                  <>
                    {select(
                      "action",
                      t("kind"),
                      [
                        "verify_identity",
                        "approve",
                        "hold",
                        "release_hold",
                        "decline",
                      ].map((x) => ({ value: x, label: t(x) })),
                    )}
                    {select(
                      "reason",
                      t("reason"),
                      [
                        { value: "", label: "—" },
                        ...[
                          "authenticated_session_review",
                          "assisted_verified",
                          "active_investigation",
                          "legal_obligation",
                        ].map((x) => ({ value: x, label: t(x) })),
                      ],
                      false,
                    )}
                    {button(t("submit"))}
                  </>,
                  async (f) =>
                    action(
                      row,
                      String(f.get("action")),
                      String(f.get("reason") ?? "") || null,
                    ),
                )}
            </section>
          )}
          {row.kind === "reports" && row.can_review && (
            <section className="panel">
              <h2>{t("review")}</h2>
              {(row.state === "submitted"
                ? ["review"]
                : row.state === "in_review"
                  ? ["resolve", "dismiss"]
                  : []
              ).map((a) => (
                <button
                  type="button"
                  key={a}
                  disabled={busy}
                  onClick={() => void action(row, a)}
                >
                  {t(a)}
                </button>
              ))}
            </section>
          )}
          {row.can_assign_case && caseAssignment(row)}
          {row.can_assign && assignment(row)}
          <section className="panel">
            <h2>{t("history")}</h2>
            <ol>
              {detail.events.map((e, i) => (
                <li key={i}>
                  {t(e.action)}
                  {e.reason_code ? " · " + t(e.reason_code) : ""} ·{" "}
                  {date(e.created_at)}
                </li>
              ))}
            </ol>
          </section>
        </>
      )}
      {((!row && section === "outcomes") ||
        (row?.kind === "outcomes" &&
          row.reporter &&
          row.state !== "superseded")) &&
        form(
          t(row ? "correction" : "report_outcome"),
          <>
            {row ? (
              <input type="hidden" name="case" value={row.case_id} />
            ) : (
              select("case", t("case"), sourceOptions)
            )}
            {row ? (
              <input type="hidden" name="kind" value={row.title} />
            ) : (
              select(
                "kind",
                t("kind"),
                ["service_delivered", "job_started", "skills_completed"].map(
                  (x) => ({ value: x, label: t(x) }),
                ),
              )
            )}
            {text("start", t("period_start"), true, "date", row?.period_start)}
            {text("end", t("period_end"), true, "date", row?.period_end)}
            {text("occurred", t("occurred"), true, "datetime-local")}
            {body()}
            {button(t("submit"))}
          </>,
          async (f, el) => {
            const id = await api<string>(
              "outcomes",
              {
                case: String(f.get("case")),
                kind: String(f.get("kind")),
                start: String(f.get("start")),
                end: String(f.get("end")),
                occurred: new Date(String(f.get("occurred"))).toISOString(),
                body: String(f.get("body")),
                corrects: row?.id ?? null,
              },
              el,
            );
            if (id) router.push(base + "/outcomes/" + id);
          },
        )}
      {!row && section === "privacy" && (
        <>
          <p>{t("policy")}</p>
          {form(
            t("request_privacy"),
            <>
              {select(
                "kind",
                t("kind"),
                ["access", "export", "correct", "delete"].map((x) => ({
                  value: x,
                  label: t(x),
                })),
              )}
              {body()}
              {checkbox("confirmed", t("confirmed"), true)}
              {button(t("submit"))}
            </>,
            async (f, el) => {
              const id = await api<string>(
                "privacy",
                {
                  kind: String(f.get("kind")),
                  body: String(f.get("body")),
                  confirmed: f.get("confirmed") === "on",
                },
                el,
              );
              if (id) router.push(base + "/privacy/" + id);
            },
          )}
        </>
      )}
      {((!row && section === "reports") ||
        (row?.kind === "reports" &&
          row.own &&
          ["resolved", "dismissed"].includes(row.state) &&
          !row.appeal_of)) && (
        <>
          <p>{t("limits")}</p>
          {form(
            t(row ? "appeal" : "report"),
            <>
              {select(
                "kind",
                t("kind"),
                ["service", "safety"].map((x) => ({ value: x, label: t(x) })),
              )}
              {!row &&
                select(
                  "org",
                  t("organization"),
                  [
                    { value: "", label: "—" },
                    ...Array.from(
                      new Map(
                        d.sources.map((s) => [
                          s.organization_id,
                          {
                            value: s.organization_id,
                            label: s.organization_name,
                          },
                        ]),
                      ).values(),
                    ),
                  ],
                  false,
                )}
              {body()}
              {button(t("submit"))}
            </>,
            async (f, el) => {
              const id = await api<string>(
                "reports",
                {
                  kind: String(f.get("kind")),
                  body: String(f.get("body")),
                  org: String(f.get("org") ?? "") || null,
                  accused: null,
                  appeal: row?.id ?? null,
                },
                el,
              );
              if (id) router.push(base + "/reports/" + id);
            },
          )}
        </>
      )}
      {section === "privacy" && (
        <section className="panel">
          <h2>{t("cessations")}</h2>
          {d.cessations.length === 0 ? (
            <p>{t("empty")}</p>
          ) : (
            d.cessations.map((c) => (
              <p key={c.id}>
                {t(c.resource_kind === "referral" ? "referrals" : "case")} ·{" "}
                {t(c.status)}{" "}
                {c.can_ack && c.status === "requested" && (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void api("cessations/" + c.id + "/ack", {})}
                  >
                    {t("ack")}
                  </button>
                )}
              </p>
            ))
          )}
        </section>
      )}
      {section === "home" &&
        d.context.has_platform_role &&
        d.context.staff_assured &&
        form(
          t("staff"),
          <>
            {text("account", t("account"))}
            {select(
              "scope",
              t("scope"),
              ["impact", "privacy", "safety"].map((x) => ({
                value: x,
                label: t(x),
              })),
            )}
            {text("expires", t("expires"), true, "datetime-local")}
            {select("grant", t("kind"), [
              { value: "true", label: t("grant") },
              { value: "false", label: t("revoke_scope") },
            ])}
            {button(t("submit"))}
          </>,
          async (f, el) =>
            api(
              "scope",
              {
                account: String(f.get("account")),
                scope: String(f.get("scope")),
                grant: f.get("grant") === "true",
                expires: new Date(String(f.get("expires"))).toISOString(),
              },
              el,
            ),
        )}
    </main>
  );
}
