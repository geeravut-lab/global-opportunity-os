"use client";
import { busyFetch } from "@/lib/ui/activity";
import Image from "next/image";
import Link from "@/components/busy-link";
import { useRef, useState, useTransition, type FormEvent } from "react";
import { useBusyRouter as useRouter } from "@/lib/ui/router";
import { platformCopy, platformSections } from "@/lib/platform/copy";
import { imageUrl, type PlatformSettings } from "@/lib/platform/settings";
interface Admin {
  id: string;
  owner: boolean;
  self: boolean;
}
interface Audit {
  id: string;
  actor_id: string;
  action: string;
  object_id: string | null;
  occurred_at: string;
}
export function PlatformPanel({
  lang,
  section,
  settings,
  admins,
  audit,
}: {
  lang: "th" | "en";
  section: (typeof platformSections)[number];
  settings: PlatformSettings;
  admins: Admin[];
  audit: Audit[];
}) {
  const t = platformCopy[lang],
    router = useRouter(),
    root = useRef<HTMLElement>(null);
  const [refreshing, startRefresh] = useTransition();
  const [busy, setBusy] = useState(false),
    [message, setMessage] = useState(""),
    [error, setError] = useState(false),
    [th, setTh] = useState<string | null>(null),
    [en, setEn] = useState<string | null>(null),
    [flags, setFlags] = useState<PlatformSettings["flags"] | null>(null),
    [target, setTarget] = useState("");
  async function run(
    body: FormData | Record<string, unknown>,
    form?: HTMLFormElement,
  ) {
    setBusy(true);
    setMessage("");
    setError(false);
    try {
      const r = await busyFetch("/api/platform", {
        method: "POST",
        ...(body instanceof FormData
          ? { body }
          : {
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(body),
            }),
      });
      const d = await r.json();
      if (!r.ok) {
        setError(true);
        setMessage(
          d.code === "INVALID_IMAGE"
            ? t.imageInvalid
            : r.status === 409
              ? t.conflict
              : t.error,
        );
        return;
      }
      if (form) {
        delete form.dataset.liveDirty;
        delete form.dataset.liveVersion;
        if (body instanceof FormData) form.reset();
        else if (body.action === "settings") {
          if (section === "branding") {
            setTh(null);
            setEn(null);
          } else setFlags(null);
        }
      }
      setMessage(t.saved);
      window.dispatchEvent(new Event("goos:saved"));
      if (!root.current?.querySelector('form[data-live-dirty="true"]'))
        startRefresh(() => router.refresh());
    } catch {
      setError(true);
      setMessage(t.error);
    } finally {
      setBusy(false);
    }
  }
  function formVersion(form: HTMLFormElement) {
    return Number(form.dataset.liveVersion ?? settings.version);
  }
  function upload(e: FormEvent<HTMLFormElement>, kind: "logo" | "favicon") {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    f.set("kind", kind);
    f.set("expectedVersion", String(formVersion(e.currentTarget)));
    void run(f, e.currentTarget);
  }
  return (
    <main
      id="main"
      ref={root}
      className="account-page platform-page"
      data-live-busy={busy || refreshing}
      onChangeCapture={(e) => {
        const form = (e.target as HTMLElement).closest("form");
        if (form) {
          if (!form.dataset.liveDirty)
            form.dataset.liveVersion = String(settings.version);
          form.dataset.liveDirty = "true";
        }
      }}
    >
      <div className="page-heading">
        <h1>{t.platform}</h1>
        <p>{t.authOnly}</p>
      </div>
      <nav className="platform-tabs" aria-label={t.platform}>
        {platformSections.map((s) => (
          <Link
            key={s}
            href={`/${lang}/admin/${s}`}
            aria-current={s === section ? "page" : undefined}
          >
            {t[s]}
          </Link>
        ))}
      </nav>
      <fieldset className="platform-fields" disabled={busy || refreshing}>
        <legend className="sr-only">{t.platform}</legend>
        <div
          role={error ? "alert" : "status"}
          className={`account-feedback ${error ? "is-error" : ""}`}
        >
          {message}
        </div>
        {section === "branding" ? (
          <>
            <section className="panel account-form-panel">
              <h2>{t.branding}</h2>
              <p>{t.imageHelp}</p>
              <form
                method="post"
                onSubmit={(e) => {
                  e.preventDefault();
                  void run(
                    {
                      action: "settings",
                      nameTh: th ?? settings.name_th,
                      nameEn: en ?? settings.name_en,
                      flags: settings.flags,
                      expectedVersion: formVersion(e.currentTarget),
                    },
                    e.currentTarget,
                  );
                }}
              >
                <label htmlFor="brand-th">{t.nameTh}</label>
                <input
                  id="brand-th"
                  value={th ?? settings.name_th}
                  onChange={(e) => setTh(e.target.value)}
                  maxLength={60}
                  required
                />
                <label htmlFor="brand-en">{t.nameEn}</label>
                <input
                  id="brand-en"
                  value={en ?? settings.name_en}
                  onChange={(e) => setEn(e.target.value)}
                  maxLength={60}
                  required
                />
                <button className="button primary" disabled={busy}>
                  {busy ? t.busy : t.save}
                </button>
              </form>
            </section>
            {(["logo", "favicon"] as const).map((kind) => (
              <section key={kind} className="panel account-form-panel">
                <h2>{t[kind]}</h2>
                <div className="brand-preview">
                  <Image
                    src={imageUrl(settings, kind)}
                    alt={t[kind]}
                    width={kind === "logo" ? 300 : 128}
                    height={kind === "logo" ? 200 : 128}
                    unoptimized
                  />
                </div>
                <form
                  method="post"
                  encType="multipart/form-data"
                  onSubmit={(e) => upload(e, kind)}
                >
                  <label htmlFor={`brand-${kind}`}>{t.upload}</label>
                  <input
                    id={`brand-${kind}`}
                    name="file"
                    type="file"
                    accept="image/png"
                    required
                    disabled={busy || settings.flags.branding === false}
                  />
                  <button
                    className="button primary"
                    disabled={busy || settings.flags.branding === false}
                  >
                    {busy ? t.busy : t.upload}
                  </button>
                </form>
                <button
                  className="button secondary"
                  type="button"
                  disabled={busy || settings.flags.branding === false}
                  onClick={() =>
                    void run({
                      action: "reset-image",
                      kind,
                      expectedVersion: settings.version,
                    })
                  }
                >
                  {t.reset}
                </button>
              </section>
            ))}
          </>
        ) : section === "features" ? (
          <section className="panel account-form-panel">
            <h2>{t.features}</h2>
            <p>{t.flagHelp}</p>
            <form
              method="post"
              onSubmit={(e) => {
                e.preventDefault();
                void run(
                  {
                    action: "settings",
                    nameTh: settings.name_th,
                    nameEn: settings.name_en,
                    flags: flags ?? settings.flags,
                    expectedVersion: formVersion(e.currentTarget),
                  },
                  e.currentTarget,
                );
              }}
            >
              {(["live_sync", "branding"] as const).map((flag) => (
                <label key={flag} className="account-check">
                  <input
                    type="checkbox"
                    checked={(flags ?? settings.flags)[flag] !== false}
                    onChange={(e) =>
                      setFlags((old) => {
                        const n = { ...(old ?? settings.flags) };
                        if (e.target.checked) delete n[flag];
                        else n[flag] = false;
                        return n;
                      })
                    }
                  />
                  <span>{flag === "branding" ? t.brandFlag : t.live_sync}</span>
                </label>
              ))}
              <button className="button primary" disabled={busy}>
                {t.save}
              </button>
            </form>
          </section>
        ) : section === "admins" ? (
          <section className="panel account-form-panel">
            <h2>{t.admins}</h2>
            <form
              method="post"
              onSubmit={(e) => {
                e.preventDefault();
                void run(
                  { action: "admin", targetId: target, grant: true },
                  e.currentTarget,
                );
              }}
            >
              <label htmlFor="admin-target">{t.target}</label>
              <input
                id="admin-target"
                value={target}
                onChange={(e) => setTarget(e.target.value)}
                minLength={36}
                maxLength={36}
                required
              />
              <button className="button primary" disabled={busy}>
                {t.grant}
              </button>
            </form>
            <ul className="account-records">
              {admins.map((a) => (
                <li key={a.id}>
                  <code>{a.id}</code>
                  <p>{a.owner ? t.owner : a.self ? t.self : ""}</p>
                  {!a.owner && !a.self && (
                    <button
                      className="button secondary"
                      type="button"
                      disabled={busy}
                      onClick={() =>
                        void run({
                          action: "admin",
                          targetId: a.id,
                          grant: false,
                        })
                      }
                    >
                      {t.revoke}
                    </button>
                  )}
                </li>
              ))}
            </ul>
          </section>
        ) : (
          <section className="panel">
            <h2>{t.audit}</h2>
            <p>{t.auditHelp}</p>
            <Link
              className="button secondary"
              href="/api/platform/audit"
              prefetch={false}
            >
              {lang === "th" ? "ดาวน์โหลด CSV" : "Download CSV"}
            </Link>
            {!audit.length && <p>{t.none}</p>}
            <ul className="account-records">
              {audit.map((a) => (
                <li key={a.id}>
                  <strong>{a.action}</strong>
                  <p>
                    <code>{a.actor_id}</code>
                  </p>
                  <time dateTime={a.occurred_at}>
                    {new Date(a.occurred_at).toLocaleString(lang, {
                      timeZone: "Asia/Bangkok",
                    })}
                  </time>
                  {a.object_id && (
                    <p>
                      <code>{a.object_id}</code>
                    </p>
                  )}
                </li>
              ))}
            </ul>
          </section>
        )}
      </fieldset>
      <p className="muted">
        {t.version}: {settings.version}
      </p>
      <Link href={`/${lang}/account`}>{t.account}</Link>
    </main>
  );
}
