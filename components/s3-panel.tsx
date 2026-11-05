"use client";
import { BusyForm } from "@/components/busy-form";
import { useSyncExternalStore, useRef, useState, type FormEvent } from "react";
import Link from "./busy-link";
import { HomeMenuGrid } from "./home-menu-cards";
import { useBusyRouter } from "@/lib/ui/router";
import { busyFetch } from "@/lib/ui/activity";
import {
  shareFields,
  type Preview,
  type S3Package,
  type S3Detail,
  type S3Rule,
} from "@/lib/s3/model";
import type { S3PageData, S3Section } from "@/lib/s3/page-data";
import { s3Copy, s3Label } from "@/lib/s3/copy";
const subscribeTimezone = () => () => {};
const clientTimezone = () => Intl.DateTimeFormat().resolvedOptions().timeZone;
const serverTimezone = () => "UTC";
export function S3Panel({
  lang,
  section,
  initial: d,
}: {
  lang: "th" | "en";
  section: S3Section;
  initial: S3PageData;
}) {
  const t = s3Copy[lang],
    router = useBusyRouter(),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState(""),
    [failed, setFailed] = useState(false),
    [preview, setPreview] = useState<Preview | null>(null),
    [receipt, setReceipt] = useState<Record<string, unknown> | null>(null),
    [dry, setDry] = useState<Record<string, number> | null>(null),
    zone = useSyncExternalStore(
      subscribeTimezone,
      clientTimezone,
      serverTimezone,
    );
  const key = useRef(""),
    selectedSubject = useRef("");
  const org = d.orgs.find((o) => o.id === d.org);
  const title = t[section === "application" ? "applications" : section];
  const label = (key: string) => s3Label(lang, key);
  const dirty = (event: FormEvent<HTMLFormElement>) => {
    event.currentTarget.dataset.liveDirty = "true";
  };
  async function api<T = unknown>(
    path: string,
    body: unknown,
    form?: HTMLFormElement,
    quiet = false,
    idempotency?: string,
  ): Promise<T | null> {
    setBusy(true);
    setMessage("");
    setFailed(false);
    try {
      const r = await busyFetch("/api/s3/" + path, {
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
            ? t.conflict
            : r.status === 404 || r.status === 403
              ? t.permission
              : t.error,
        );
        return null;
      }
      if (form && !quiet) {
        form.dataset.liveDirty = "false";
        form.reset();
      }
      if (!quiet) {
        setMessage(t.saved);
        window.dispatchEvent(new Event("goos:saved"));
        router.refresh();
      }
      return (json.data ?? true) as T;
    } catch {
      setFailed(true);
      setMessage(t.error);
      return null;
    } finally {
      setBusy(false);
    }
  }
  const date = (value: string, timezone = "UTC") =>
    new Intl.DateTimeFormat(lang === "th" ? "th-TH" : "en-GB", {
      dateStyle: "medium",
      timeStyle: "short",
      timeZone: timezone,
    }).format(new Date(value));
  function packageView(p: S3Package) {
    return (
      <dl className="workflow-package">
        <dt>{t.recipient}</dt>
        <dd>{p.recipient.name}</dd>
        <dt>{t.purpose}</dt>
        <dd>
          {
            t[
              p.purpose === "application"
                ? "application"
                : "additional_information"
            ]
          }
        </dd>
        <dt>{t.fields}</dt>
        <dd>
          <dl>
            {p.fields.map((field) => (
              <div key={field}>
                <dt>{label(field)}</dt>
                <dd>
                  {Array.isArray(p.values[field])
                    ? (p.values[field] as string[]).join(", ")
                    : String(p.values[field] ?? "—")}
                </dd>
              </div>
            ))}
          </dl>
        </dd>
        {p.opportunity.category === "jobs" && (
          <>
            <dt>
              {lang === "th" ? "เงื่อนไขงานที่ตรวจแล้ว" : "Reviewed job terms"}
            </dt>
            <dd>
              {p.opportunity.job_pay_min}–{p.opportunity.job_pay_max}{" "}
              {p.opportunity.currency} /{" "}
              {label(p.opportunity.job_pay_unit ?? "")} ·{" "}
              {p.opportunity.job_contract}
            </dd>
          </>
        )}
      </dl>
    );
  }
  function previewForm(detail?: S3Detail) {
    const eligible = d.subjects.filter((s) => s.can_prepare),
      request = detail?.requests.find((r) => r.status === "open"),
      fields = request?.fields ?? shareFields;
    if (!eligible.length)
      return <Link href={"/" + lang + "/account/profile"}>{t.profile}</Link>;
    if (detail && !detail.can_submit) return null;
    return (
      <>
        <form
          className="panel s2-form"
          onChange={(event) => {
            dirty(event);
            setPreview(null);
            setReceipt(null);
          }}
          onSubmit={async (event) => {
            event.preventDefault();
            const form = event.currentTarget,
              fd = new FormData(form),
              subject = String(fd.get("subject"));
            const result = await api<Preview>(
              "previews",
              {
                subject,
                opportunity: detail?.package.opportunity.id ?? d.listing!.id,
                fields: fd.getAll("fields"),
                skills: String(fd.get("skills") ?? "")
                  .split("\n")
                  .map((s) => s.trim())
                  .filter(Boolean),
                notice: d.notice.id,
                application: detail?.id ?? null,
              },
              undefined,
              true,
            );
            if (result) {
              selectedSubject.current = subject;
              key.current = crypto.randomUUID();
              setPreview(result);
            }
          }}
        >
          <h2>{detail ? t.requests : t.apply}</h2>
          <p>{t.selectHelp}</p>
          <label>
            {t.selectSubject}
            <select
              aria-label={t.selectSubject}
              name="subject"
              defaultValue={detail?.subject_id ?? eligible[0].id}
              required
            >
              {eligible
                .filter((s) => !detail || s.id === detail.subject_id)
                .map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.own ? t.self : t.helper + " · " + s.id.slice(-8)}
                  </option>
                ))}
            </select>
          </label>
          <fieldset>
            <legend>{t.fields}</legend>
            {fields.map((field) => (
              <label className="check" key={field}>
                <input
                  type="checkbox"
                  name="fields"
                  value={field}
                  defaultChecked={
                    field === "display_alias" ||
                    field === "country_code" ||
                    Boolean(request)
                  }
                />
                {label(field)}
              </label>
            ))}
          </fieldset>
          <label>
            {t.skills}
            <textarea
              name="skills"
              maxLength={610}
              rows={3}
              aria-describedby="s3-skills-help"
            />
          </label>
          <p id="s3-skills-help">{t.skillsHelp}</p>
          <button className="button primary" disabled={busy}>
            {t.preview}
          </button>
        </form>
        {preview && (
          <section
            className="panel workflow-preview"
            aria-labelledby="s3-preview-title"
          >
            <h2 id="s3-preview-title">{t.preview}</h2>
            {packageView(preview.package)}
            <p>
              {t.expires}:{" "}
              <time dateTime={preview.expires_at}>
                {date(preview.expires_at)}
              </time>
            </p>
            <section className="privacy-notice">
              <h3>{t.notice}</h3>
              <p>{d.notice.body}</p>
            </section>
            <form
              className="s2-form"
              onChange={dirty}
              onSubmit={async (event) => {
                event.preventDefault();
                const form = event.currentTarget,
                  fd = new FormData(form),
                  result = await api<Record<string, unknown>>(
                    "applications",
                    {
                      preview: preview.id,
                      hash: preview.hash,
                      notice: d.notice.id,
                      confirmed: fd.has("confirmed"),
                      readback: fd.has("readback"),
                    },
                    form,
                    true,
                    key.current,
                  );
                if (result) {
                  form.dataset.liveDirty = "false";
                  setReceipt(result);
                  setPreview(null);
                  if (
                    d.subjects.find((s) => s.id === selectedSubject.current)
                      ?.can_progress
                  )
                    router.push(
                      "/" + lang + "/workflow/application/" + String(result.id),
                    );
                }
              }}
            >
              <label className="check">
                <input type="checkbox" name="confirmed" required />
                {t.confirm}
              </label>
              {preview.readback_required && (
                <label className="check">
                  <input type="checkbox" name="readback" required />
                  {t.readback}
                </label>
              )}
              <button className="button primary" disabled={busy}>
                {t.submit}
              </button>
            </form>
            <details>
              <summary>{t.reference}</summary>
              <code>{preview.hash}</code>
            </details>
          </section>
        )}
        {receipt && (
          <section className="panel" role="status">
            <h2>{t.receipt}</h2>
            <p>{t.receiptOnly}</p>
            <code>{String(receipt.receipt_code)}</code>
          </section>
        )}
      </>
    );
  }
  function transitionForm(a: S3Detail) {
    const job = a.package.opportunity.category === "jobs";
    const actions: string[] = [];
    if (a.can_submit) {
      if (!["withdrawn", "declined", "completed"].includes(a.state))
        actions.push("withdraw");
      if (a.state !== "withdrawn") actions.push("revoke_share");
      if (a.state === "under_review" && a.job_stage === "offer")
        actions.push("accept_offer");
    }
    if (a.can_work) {
      if (["submitted", "waitlisted"].includes(a.state))
        actions.push("start_review");
      if (a.state === "under_review") {
        actions.push("request_info", "waitlist", "decline");
        if (!job) actions.push("accept");
        else if (["review", "interview"].includes(a.job_stage)) {
          if (a.job_stage === "review") actions.push("interview");
          actions.push("offer");
        }
      }
      if (a.state === "accepted") {
        if (!job && a.case.state === "resolved") actions.push("complete");
        if (
          job &&
          a.job_stage === "offer_accepted" &&
          a.case.state === "in_progress"
        )
          actions.push("job_started");
        if (job && a.job_stage === "started" && a.case.state === "resolved")
          actions.push("job_completed");
      }
    }
    if (!actions.length) return null;
    return (
      <form
        className="panel s2-form"
        key={a.id + ":" + a.version}
        onChange={dirty}
        onSubmit={(event) => {
          event.preventDefault();
          const form = event.currentTarget,
            fd = new FormData(form);
          void api(
            "applications/" + a.id + "/transition",
            {
              action: fd.get("action"),
              version: a.version,
              reason: fd.get("reason"),
              fields: fd.getAll("fields"),
            },
            form,
          );
        }}
      >
        <h2>{t.action}</h2>
        <p>{t.reasonHelp}</p>
        {a.can_submit && <p>{t.withdrawHelp}</p>}
        <label>
          {t.action}
          <select aria-label={t.action} name="action">
            {actions.map((action) => (
              <option key={action} value={action}>
                {label(action)}
              </option>
            ))}
          </select>
        </label>
        <label>
          {t.reason}
          <select aria-label={t.reason} name="reason">
            {[
              "reviewed",
              "user_requested",
              "criteria_not_met",
              "capacity_waitlist",
              "information_needed",
              "service_recorded",
              "interview_scheduled",
              "offer_made",
              "offer_accepted",
              "started",
              "completed",
            ].map((reason) => (
              <option key={reason} value={reason}>
                {label(reason)}
              </option>
            ))}
          </select>
        </label>
        {a.can_work && a.state === "under_review" && (
          <fieldset>
            <legend>{t.requests}</legend>
            {shareFields.map((field) => (
              <label className="check" key={field}>
                <input name="fields" type="checkbox" value={field} />
                {label(field)}
              </label>
            ))}
          </fieldset>
        )}
        <label className="check">
          <input type="checkbox" required />
          {t.acknowledge}
        </label>
        <button className="button primary" disabled={busy}>
          {t.change}
        </button>
      </form>
    );
  }
  function caseForm(a: S3Detail) {
    if (!a.can_work) return null;
    const currentOrg = d.orgs.find((o) => o.id === a.package.recipient.id),
      actions = [
        "schedule",
        ...(a.case.state === "open" ? ["triage"] : []),
        ...(["triaged", "awaiting_external"].includes(a.case.state) &&
        a.state === "accepted"
          ? ["start"]
          : []),
        ...(a.case.state === "in_progress"
          ? ["await_external", "resolve"]
          : []),
        ...(a.case.state === "awaiting_external" ? ["resolve"] : []),
        ...(currentOrg?.can_assign && a.case.state === "resolved"
          ? ["close"]
          : []),
        ...(currentOrg?.can_assign && a.case.state === "closed"
          ? ["reopen"]
          : []),
      ];
    return (
      <>
        <form
          className="panel s2-form"
          key={a.case.id + ":" + a.case.version}
          onChange={dirty}
          onSubmit={(event) => {
            event.preventDefault();
            const form = event.currentTarget,
              fd = new FormData(form),
              due = String(fd.get("due") ?? "");
            void api(
              "cases/" + a.case.id + "/transition",
              {
                action: fd.get("action"),
                version: a.case.version,
                due: fd.has("clearDue")
                  ? null
                  : due
                    ? new Date(due).toISOString()
                    : a.case.due_at,
                timezone: due ? zone : a.case.timezone,
                priority: fd.get("priority"),
                resolution: fd.get("resolution") || null,
              },
              form,
            );
          }}
        >
          <h2>{t.caseAction}</h2>
          <label>
            {t.caseAction}
            <select aria-label={t.caseAction} name="action">
              {actions.map((action) => (
                <option key={action} value={action}>
                  {label(action)}
                </option>
              ))}
            </select>
          </label>
          <label>
            {t.due}
            <input name="due" type="datetime-local" />
          </label>
          <p>
            {t.dueHelp} · {zone}
          </p>
          <label className="check">
            <input name="clearDue" type="checkbox" />
            {t.clearDue}
          </label>
          <label>
            {t.priority}
            <select
              aria-label={t.priority}
              name="priority"
              defaultValue={a.case.priority}
            >
              <option value="normal">{label("normal")}</option>
              <option value="urgent">{label("urgent")}</option>
            </select>
          </label>
          <label>
            {t.resolution}
            <select
              aria-label={t.resolution}
              name="resolution"
              defaultValue={a.case.resolution_code ?? ""}
            >
              <option value="">{t.noResolution}</option>
              {["service_recorded", "not_proceeding", "administrative"].map(
                (reason) => (
                  <option value={reason} key={reason}>
                    {label(reason)}
                  </option>
                ),
              )}
            </select>
          </label>
          <button className="button primary" disabled={busy}>
            {t.save}
          </button>
        </form>
        <form
          className="panel s2-form"
          onChange={dirty}
          onSubmit={(event) => {
            event.preventDefault();
            const form = event.currentTarget,
              fd = new FormData(form);
            void api(
              "cases/" + a.case.id + "/notes",
              {
                body: fd.get("body"),
                visibility: fd.get("visibility"),
                supersedes: fd.get("supersedes") || null,
                version: a.case.version,
              },
              form,
            );
          }}
        >
          <h2>{t.notes}</h2>
          <p>{t.noteHelp}</p>
          <label>
            {t.visibility}
            <select aria-label={t.visibility} name="visibility">
              {(a.package.opportunity.category === "jobs"
                ? ["beneficiary_shared"]
                : ["beneficiary_shared", "internal"]
              ).map((visibility) => (
                <option key={visibility} value={visibility}>
                  {t[visibility as "internal" | "beneficiary_shared"]}
                </option>
              ))}
            </select>
          </label>
          <label>
            {t.noteBody}
            <textarea name="body" maxLength={2000} required />
          </label>
          <label>
            {t.supersedes}
            <select aria-label={t.supersedes} name="supersedes">
              <option value="">{t.newNote}</option>
              {a.notes
                .filter((n) => n.own)
                .map((n) => (
                  <option key={n.id} value={n.id}>
                    {date(n.created_at)} · {t[n.visibility]}
                  </option>
                ))}
            </select>
          </label>
          <button className="button primary" disabled={busy}>
            {t.save}
          </button>
        </form>
      </>
    );
  }
  function ruleForm(rule: S3Rule | null) {
    return (
      <form
        className="panel s2-form"
        key={rule?.id ?? "new"}
        onChange={dirty}
        onSubmit={(event) => {
          event.preventDefault();
          const form = event.currentTarget,
            fd = new FormData(form);
          void api(
            "rules",
            {
              org: d.org,
              id: rule?.id ?? null,
              enabled: fd.has("enabled"),
              minutes: Number(fd.get("minutes")),
              timezone: fd.get("timezone"),
              version: rule?.version ?? 0,
            },
            form,
          );
        }}
      >
        <h2>{rule ? label(rule.kind) : t.newRule}</h2>
        <label className="check">
          <input
            type="checkbox"
            name="enabled"
            defaultChecked={rule?.enabled ?? false}
          />
          {t.enabled}
        </label>
        <label>
          {t.minutes}
          <input
            name="minutes"
            type="number"
            min={0}
            max={10080}
            required
            defaultValue={rule?.minutes_before ?? 0}
          />
        </label>
        <label>
          {t.timezone}
          <input
            name="timezone"
            required
            maxLength={80}
            defaultValue={rule?.timezone ?? zone}
          />
        </label>
        <button className="button primary" disabled={busy}>
          {t.save}
        </button>
        {rule && (
          <button
            className="button secondary"
            type="button"
            disabled={busy}
            onClick={async () => {
              const result = await api<Record<string, number>>(
                "rules/" + rule.id + "/dry-run",
                {},
                undefined,
                true,
              );
              if (result) setDry(result);
            }}
          >
            {t.dryRun}
          </button>
        )}
      </form>
    );
  }
  return (
    <main
      id="main"
      className="account-page s2-page workflow-page"
      data-live-busy={busy}
    >
      <h1>{title}</h1>
      <p className="notice">{t.synthetic}</p>
      <nav className="s2-tabs" aria-label={t.home}>
        {(
          [
            "home",
            "applications",
            "queue",
            "team",
            "settings",
            "automation",
            "delivery",
          ] as const
        )
          .filter(
            (s) =>
              !["queue", "team", "automation"].includes(s) || d.orgs.length > 0,
          )
          .filter(
            (s) =>
              s !== "delivery" ||
              d.context.has_platform_role ||
              d.orgs.some((o) => o.can_route),
          )
          .map((s) => (
            <Link
              key={s}
              href={"/" + lang + "/workflow" + (s === "home" ? "" : "/" + s)}
              aria-current={s === section ? "page" : undefined}
            >
              {t[s]}
            </Link>
          ))}
      </nav>
      <p
        role={failed ? "alert" : "status"}
        className={failed ? "account-feedback is-error" : "account-feedback"}
      >
        {message}
      </p>
      {message && (
        <button
          className="button secondary"
          onClick={() => router.refresh()}
          type="button"
        >
          {t.reload}
        </button>
      )}
      {section === "home" && (
        <>
          <p>{t.intro}</p>
          <HomeMenuGrid
            label={t.home}
            items={[
              {
                href: "/" + lang + "/opportunities",
                label: t.search,
                description: t.selectHelp,
                art: 0,
                wide: true,
              },
              {
                href: "/" + lang + "/workflow/applications",
                label: t.applications,
                description: t.history,
                art: 7,
              },
              {
                href: "/" + lang + "/workflow/settings",
                label: t.settings,
                description: t.inbox,
                art: 15,
              },
              ...(d.orgs.length
                ? [
                    {
                      href: "/" + lang + "/workflow/queue",
                      label: t.queue,
                      description: t.routingHelp,
                      art: 6,
                      wide: true,
                    },
                    {
                      href: "/" + lang + "/workflow/team",
                      label: t.team,
                      description: t.roleHelp,
                      art: 10,
                    },
                  ]
                : []),
            ]}
          />
        </>
      )}
      {["queue", "team", "automation", "delivery"].includes(section) &&
        d.orgs.length > 0 && (
          <BusyForm method="get" className="s2-form">
            <label>
              {t.selectOrg}
              <select
                aria-label={t.selectOrg}
                name="org"
                defaultValue={d.org ?? ""}
              >
                {section === "delivery" && d.context.has_platform_role && (
                  <option value="">
                    {lang === "th" ? "ภาพรวมระบบ" : "Platform overview"}
                  </option>
                )}
                {d.orgs.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.name}
                  </option>
                ))}
              </select>
            </label>
            <button className="button secondary">{t.open}</button>
          </BusyForm>
        )}
      {["queue", "team", "automation"].includes(section) &&
        !d.context.staff_assured &&
        d.context.has_membership && (
          <p>
            {t.mfa}{" "}
            <Link href={"/" + lang + "/account/security"}>{t.security}</Link>
          </p>
        )}
      {section === "apply" && d.listing && (
        <>
          <section className="panel">
            <h2>{lang === "th" ? d.listing.title_th : d.listing.title_en}</h2>
            <p>{d.listing.organization_name}</p>
            <p>{d.availability?.accepting ? t.available : t.full}</p>
            <p>{t.noAuto}</p>
          </section>
          {d.availability?.accepting && previewForm()}
        </>
      )}
      {(section === "applications" || section === "queue") && (
        <>
          <p>{section === "queue" ? t.routingHelp : t.intro}</p>
          {d.rows.length ? (
            d.rows.map((r) => (
              <article className="panel" key={r.id + ":" + r.case_version}>
                <h2>{lang === "th" ? r.title_th : r.title_en}</h2>
                <p>
                  {t.status}: {label(r.state)} · {t.caseStatus}:{" "}
                  {label(r.case_state)}
                </p>
                {r.due_at && (
                  <p>
                    {t.due}: {date(r.due_at, r.timezone)} ({r.timezone})
                  </p>
                )}
                {(r.can_work || r.can_progress) && (
                  <Link
                    className="button secondary"
                    href={"/" + lang + "/workflow/application/" + r.id}
                  >
                    {t.detail}
                  </Link>
                )}
                {section === "queue" &&
                  org?.can_assign &&
                  !["closed", "cancelled"].includes(r.case_state) && (
                    <form
                      className="s2-form"
                      onChange={dirty}
                      onSubmit={(event) => {
                        event.preventDefault();
                        const form = event.currentTarget,
                          fd = new FormData(form);
                        void api(
                          "cases/" + r.case_id + "/assign",
                          { member: fd.get("member"), version: r.case_version },
                          form,
                        );
                      }}
                    >
                      <label>
                        {t.member}
                        <select
                          aria-label={t.member}
                          name="member"
                          defaultValue={r.assigned_member_id ?? ""}
                          required
                        >
                          <option value="">{t.member}</option>
                          {d.team
                            .filter((m) =>
                              m.roles.includes(
                                r.category === "jobs"
                                  ? "recruiter"
                                  : "caseworker",
                              ),
                            )
                            .map((m) => (
                              <option key={m.id} value={m.id}>
                                {m.roles.map(label).join(", ")} ·{" "}
                                {m.account_id.slice(-8)}
                              </option>
                            ))}
                        </select>
                      </label>
                      <button className="button primary" disabled={busy}>
                        {t.assign}
                      </button>
                    </form>
                  )}
                {section === "queue" &&
                  org?.can_assign &&
                  ["resolved", "closed"].includes(r.case_state) && (
                    <form
                      className="s2-form"
                      onChange={dirty}
                      onSubmit={(event) => {
                        event.preventDefault();
                        const form = event.currentTarget,
                          fd = new FormData(form);
                        void api(
                          "cases/" + r.case_id + "/transition",
                          {
                            action:
                              r.case_state === "closed" ? "reopen" : "close",
                            version: r.case_version,
                            due: r.due_at,
                            timezone: r.timezone,
                            priority: r.priority,
                            resolution: fd.get("resolution"),
                          },
                          form,
                        );
                      }}
                    >
                      <label>
                        {t.resolution}
                        <select
                          aria-label={t.resolution}
                          name="resolution"
                          defaultValue={r.resolution_code ?? "service_recorded"}
                        >
                          {[
                            "service_recorded",
                            "not_proceeding",
                            "administrative",
                          ].map((reason) => (
                            <option key={reason} value={reason}>
                              {label(reason)}
                            </option>
                          ))}
                        </select>
                      </label>
                      <button className="button secondary" disabled={busy}>
                        {label(r.case_state === "closed" ? "reopen" : "close")}
                      </button>
                    </form>
                  )}
              </article>
            ))
          ) : (
            <p>{t.empty}</p>
          )}
          <nav className="s2-tabs" aria-label={t.page}>
            {d.page > 1 && (
              <Link
                href={"?page=" + (d.page - 1) + (d.org ? "&org=" + d.org : "")}
              >
                {t.previous}
              </Link>
            )}
            {d.rows.length === 20 && d.page < 100 && (
              <Link
                href={"?page=" + (d.page + 1) + (d.org ? "&org=" + d.org : "")}
              >
                {t.next}
              </Link>
            )}
          </nav>
        </>
      )}
      {section === "application" && d.detail && (
        <>
          <section className="panel">
            <h2>
              {lang === "th"
                ? d.detail.package.opportunity.title_th
                : d.detail.package.opportunity.title_en}
            </h2>
            <p>
              {t.status}: {label(d.detail.state)}
            </p>
            <p>
              {t.caseStatus}: {label(d.detail.case.state)}
            </p>
            {d.detail.package.opportunity.category === "jobs" && (
              <p>
                {t.jobStage}: {label(d.detail.job_stage)}
              </p>
            )}
            {d.detail.case.due_at && (
              <p>
                {t.due}: {date(d.detail.case.due_at, d.detail.case.timezone)} (
                {d.detail.case.timezone})
              </p>
            )}
            <p>
              {t.reference}: <code>{d.detail.receipt_code}</code>
            </p>
            <p>{t.noAuto}</p>
          </section>
          <section className="panel">
            <h2>{t.package}</h2>
            {packageView(d.detail.package)}
          </section>
          {d.detail.responses.map((response) => (
            <section className="panel" key={response.id}>
              <h2>{t.responses}</h2>
              {packageView(response.package)}
            </section>
          ))}
          {d.detail.state === "needs_information" &&
            d.detail.can_submit &&
            previewForm(d.detail)}
          {transitionForm(d.detail)}
          {caseForm(d.detail)}
          <section className="panel">
            <h2>{t.notes}</h2>
            {d.detail.notes.length ? (
              d.detail.notes.map((note) => (
                <article key={note.id} className="workflow-note">
                  <p>
                    <strong>{t[note.visibility]}</strong> ·{" "}
                    {date(note.created_at)}
                  </p>
                  <p>{note.body}</p>
                  {note.supersedes_id && <p>{t.supersedes}</p>}
                </article>
              ))
            ) : (
              <p>{t.empty}</p>
            )}
          </section>
          <section className="panel">
            <h2>{t.history}</h2>
            <ol>
              {d.detail.events.map((event, i) => (
                <li key={i}>
                  {date(event.created_at)} · {label(event.state)} ·{" "}
                  {label(event.reason_code)}
                </li>
              ))}
            </ol>
            <h3>{t.caseHistory}</h3>
            <ol>
              {d.detail.case_events?.map((event, i) => (
                <li key={i}>
                  {date(event.created_at)} · {label(event.action)} ·{" "}
                  {label(event.reason_code)}
                </li>
              ))}
            </ol>
          </section>
        </>
      )}
      {section === "team" && (
        <>
          <p>{t.roleHelp}</p>
          <Link href={"/" + lang + "/account/organizations"}>{t.team}</Link>
          {d.team.length ? (
            d.team.map((member) => (
              <article className="panel" key={member.id}>
                <h2>
                  {t.member} · {member.account_id.slice(-8)}
                </h2>
                <code>{member.account_id}</code>
                <p>{member.roles.map(label).join(", ")}</p>
                {org?.can_manage && (
                  <form
                    className="s2-form"
                    onChange={dirty}
                    onSubmit={(event) => {
                      event.preventDefault();
                      const form = event.currentTarget,
                        fd = new FormData(form);
                      void api(
                        "team/" + d.org + "/role",
                        {
                          member: member.id,
                          role: fd.get("role"),
                          grant: fd.get("grant") === "true",
                          reason: fd.get("reason"),
                        },
                        form,
                      );
                    }}
                  >
                    <label>
                      {t.role}
                      <select aria-label={t.role} name="role">
                        {["supervisor", "caseworker", "recruiter"].map(
                          (role) => (
                            <option key={role} value={role}>
                              {label(role)}
                            </option>
                          ),
                        )}
                      </select>
                    </label>
                    <label>
                      {t.action}
                      <select aria-label={t.action} name="grant">
                        <option value="true">{t.grant}</option>
                        <option value="false">{t.revoke}</option>
                      </select>
                    </label>
                    <label>
                      {t.reason}
                      <input name="reason" maxLength={200} required />
                    </label>
                    <button className="button primary" disabled={busy}>
                      {t.save}
                    </button>
                  </form>
                )}
              </article>
            ))
          ) : (
            <p>{t.empty}</p>
          )}
        </>
      )}
      {section === "settings" && (
        <>
          <form
            className="panel s2-form"
            key={"prefs:" + d.preferences.version}
            onChange={dirty}
            onSubmit={(event) => {
              event.preventDefault();
              const form = event.currentTarget,
                fd = new FormData(form);
              void api(
                "preferences",
                {
                  inApp: fd.has("inApp"),
                  email: fd.has("email"),
                  timezone: fd.get("timezone"),
                  version: d.preferences.version,
                },
                form,
              );
            }}
          >
            <h2>{t.settings}</h2>
            <label className="check">
              <input
                type="checkbox"
                name="inApp"
                defaultChecked={d.preferences.in_app}
              />
              {t.inApp}
            </label>
            <label className="check">
              <input
                type="checkbox"
                name="email"
                defaultChecked={d.preferences.email}
              />
              {t.email}
            </label>
            <p>{t.emailHelp}</p>
            <Link href={"/" + lang + "/account/profile"}>{t.profile}</Link>
            <label>
              {t.timezone}
              <input
                name="timezone"
                required
                maxLength={80}
                defaultValue={
                  d.preferences.version ? d.preferences.timezone : zone
                }
              />
            </label>
            <button className="button primary" disabled={busy}>
              {t.save}
            </button>
          </form>
          <section className="panel">
            <h2>{t.inbox}</h2>
            {d.inbox.length ? (
              d.inbox.map((n) => (
                <article key={n.id} className="workflow-note">
                  <p>
                    {label(n.kind)} · {date(n.created_at)}
                  </p>
                  {n.resource_path && (
                    <Link href={"/" + lang + n.resource_path}>{t.open}</Link>
                  )}
                  {n.read_at ? (
                    <p>{t.read}</p>
                  ) : (
                    <button
                      type="button"
                      className="button secondary"
                      disabled={busy}
                      onClick={async () => {
                        setBusy(true);
                        try {
                          const r = await busyFetch(
                            "/api/v1/notifications/" + n.id + "/read",
                            {
                              method: "POST",
                              headers: { "Content-Type": "application/json" },
                              body: JSON.stringify({}),
                            },
                          );
                          if (!r.ok) throw Error();
                          router.refresh();
                        } catch {
                          setFailed(true);
                          setMessage(t.error);
                        } finally {
                          setBusy(false);
                        }
                      }}
                    >
                      {t.markRead}
                    </button>
                  )}
                </article>
              ))
            ) : (
              <p>{t.empty}</p>
            )}
          </section>
          <section className="panel">
            <h2>{t.delegate}</h2>
            <p>{t.delegationHelp}</p>
            <p className="privacy-notice">{d.delegationNotice.body}</p>
            {d.subjects.some((s) => s.own) && (
              <form
                className="s2-form"
                onChange={dirty}
                onSubmit={(event) => {
                  event.preventDefault();
                  const form = event.currentTarget,
                    fd = new FormData(form);
                  void api(
                    "delegations",
                    {
                      subject: d.subjects.find((s) => s.own)!.id,
                      delegate: fd.get("delegate"),
                      scopes: fd.getAll("scopes"),
                      expires: new Date(
                        String(fd.get("expires")),
                      ).toISOString(),
                      notice: d.delegationNotice.id,
                      confirmed: fd.has("confirmed"),
                    },
                    form,
                  );
                }}
              >
                <label>
                  {t.accountId}
                  <input
                    name="delegate"
                    required
                    minLength={36}
                    maxLength={36}
                  />
                </label>
                <fieldset>
                  <legend>{t.scope}</legend>
                  {[
                    ["application:prepare", t.prepareScope],
                    ["application:submit", t.submitScope],
                    ["progress:read", t.progressScope],
                  ].map(([scope, caption]) => (
                    <label className="check" key={scope}>
                      <input type="checkbox" name="scopes" value={scope} />
                      {caption}
                    </label>
                  ))}
                </fieldset>
                <label>
                  {t.grantExpiry}
                  <input name="expires" type="datetime-local" required />
                </label>
                <label className="check">
                  <input type="checkbox" name="confirmed" required />
                  {t.delegateConfirm}
                </label>
                <button className="button primary" disabled={busy}>
                  {t.grant}
                </button>
              </form>
            )}
            <h3>{t.helperGrants}</h3>
            {d.delegations.map((grant) => (
              <article key={grant.id} className="workflow-note">
                <p>
                  <code>{grant.delegate_account_id}</code> ·{" "}
                  {label(grant.status)}
                </p>
                <p>
                  {grant.scopes
                    .map((scope) =>
                      scope === "application:prepare"
                        ? t.prepareScope
                        : scope === "application:submit"
                          ? t.submitScope
                          : scope === "progress:read"
                            ? t.progressScope
                            : scope,
                    )
                    .join(", ")}
                </p>
                <p>{date(grant.expires_at)}</p>
                {grant.own && grant.status === "active" && (
                  <button
                    type="button"
                    className="button secondary"
                    disabled={busy}
                    onClick={() =>
                      void api("delegations/" + grant.id + "/revoke", {
                        version: grant.version,
                      })
                    }
                  >
                    {t.revoke}
                  </button>
                )}
              </article>
            ))}
          </section>
        </>
      )}
      {section === "automation" && (
        <>
          <p>{t.ruleHelp}</p>
          {org?.can_assign && ruleForm(null)}
          {d.rules.map((rule) =>
            org?.can_assign ? (
              ruleForm(rule)
            ) : (
              <p key={rule.id}>
                {label(rule.kind)} ·{" "}
                {rule.enabled ? t.enabled : label("cancelled")}
              </p>
            ),
          )}
          {dry && (
            <p role="status">
              {t.candidates}: {dry.candidate_count} · {t.writes}: {dry.writes}
            </p>
          )}
        </>
      )}
      {section === "delivery" && (
        <>
          <p>{t.deliveryHelp}</p>
          {d.jobs.length ? (
            d.jobs.map((job) => (
              <article className="panel" key={job.id}>
                <h2>{label(job.kind)}</h2>
                <p>
                  {t.channel}: {label(job.channel)} · {t.status}:{" "}
                  {label(job.status)} · {t.attempts}: {job.attempts}
                </p>
                <p>{date(job.created_at)}</p>
                {job.error_code && <p>{job.error_code}</p>}
                {job.status === "dead" && (
                  <form
                    className="s2-form"
                    onSubmit={(event) => {
                      event.preventDefault();
                      const form = event.currentTarget,
                        fd = new FormData(form);
                      void api(
                        "deliveries/" + job.id + "/retry",
                        { attempts: job.attempts, reason: fd.get("reason") },
                        form,
                      );
                    }}
                  >
                    <label>
                      {t.retryReason}
                      <select aria-label={t.retryReason} name="reason">
                        <option value="transport_restored">
                          {t.transport_restored}
                        </option>
                        <option value="scope_corrected">
                          {t.scope_corrected}
                        </option>
                      </select>
                    </label>
                    <button className="button secondary" disabled={busy}>
                      {t.retry}
                    </button>
                  </form>
                )}
              </article>
            ))
          ) : (
            <p>{t.empty}</p>
          )}
        </>
      )}
    </main>
  );
}
