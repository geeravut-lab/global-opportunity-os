"use client";
import Link from "next/link";
import Image from "next/image";
import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { accountSections, authErrorText, authText } from "@/lib/auth/copy";
import type { Locale } from "@/lib/i18n";
import type {
  AccountData,
  Member,
  Profile,
  OutgoingInvitation,
} from "@/lib/auth/types";
export function AccountPanel({
  lang,
  section,
  initial,
}: {
  lang: Locale;
  section: (typeof accountSections)[number];
  initial: AccountData;
}) {
  const t = authText[lang],
    router = useRouter();
  const [busy, setBusy] = useState(false),
    [message, setMessage] = useState(""),
    [failed, setFailed] = useState(false);
  const [alias, setAlias] = useState(initial.profile?.display_alias ?? ""),
    [region, setRegion] = useState(initial.profile?.coarse_region ?? ""),
    [safeContact, setSafeContact] = useState(
      initial.profile?.safe_contact ?? "none",
    ),
    [adult, setAdult] = useState(false),
    [consent, setConsent] = useState(false);
  const [enrollment, setEnrollment] = useState<{
      id: string;
      qr_code: string;
      secret: string;
    } | null>(null),
    [factorId, setFactorId] = useState(initial.factors[0]?.id ?? ""),
    [code, setCode] = useState(""),
    [newPass, setNewPass] = useState(""),
    [repeatPass, setRepeatPass] = useState("");
  const [delegateId, setDelegateId] = useState(""),
    [write, setWrite] = useState(false),
    [days, setDays] = useState("7"),
    [grantConsent, setGrantConsent] = useState(false),
    [shared, setShared] = useState<Profile | null>(null),
    [sharedAlias, setSharedAlias] = useState(""),
    [sharedRegion, setSharedRegion] = useState("");
  const [orgName, setOrgName] = useState(""),
    [orgId, setOrgId] = useState(""),
    [recipient, setRecipient] = useState(""),
    [role, setRole] = useState("catalog_editor"),
    [members, setMembers] = useState<Member[]>([]),
    [outgoing, setOutgoing] = useState<OutgoingInvitation[]>([]);
  const notice = initial.notices[0],
    context = initial.context;
  async function api<T>(
    path: string,
    body?: unknown,
    method = body === undefined ? "GET" : "POST",
  ): Promise<T> {
    const result = await fetch(path, {
      method,
      headers:
        body === undefined ? undefined : { "Content-Type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
      cache: "no-store",
    });
    const json = await result.json();
    if (!result.ok) throw Error(json.code ?? "SERVICE_UNAVAILABLE");
    return json.data as T;
  }
  async function run(
    task: () => Promise<void>,
    successMessage: string = t.success,
  ) {
    setBusy(true);
    setFailed(false);
    setMessage("");
    try {
      await task();
      setMessage(successMessage);
      router.refresh();
    } catch (error) {
      setFailed(true);
      setMessage(
        authErrorText(error instanceof Error ? error.message : "", lang),
      );
    } finally {
      setBusy(false);
    }
  }
  async function saveProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await run(async () => {
      if (initial.profile)
        await api(
          `/api/v1/subjects/${initial.profile.id}`,
          {
            displayAlias: alias,
            coarseRegion: region,
            safeContact,
            expectedVersion: initial.profile.version,
          },
          "PATCH",
        );
      else
        await api("/api/v1/subjects", {
          displayAlias: alias,
          country: "TH",
          ageBand: adult ? "adult" : "unknown",
          noticeId: notice.id,
          confirmed: consent,
        });
      setConsent(false);
    });
  }
  const title = t[section];
  return (
    <main id="main" className="account-page">
      <div className="page-heading">
        <p className="eyebrow">S1 · Global Opportunity OS</p>
        <h1>{title}</h1>
        <p className="auth-development">{t.noticeSynthetic}</p>
      </div>
      <div
        className={`account-feedback ${failed ? "is-error" : ""}`}
        role={failed ? "alert" : "status"}
        aria-live="polite"
      >
        {message}
      </div>
      {section === "home" ? (
        <>
          <section className="panel">
            <h2>{t.accountId}</h2>
            <code className="account-id">{context.account_id}</code>
            <p className="muted">{t.accountIdHelp}</p>
            <p>
              {t.session}: <strong>{context.aal}</strong>
            </p>
            <p>
              {initial.profile ? initial.profile.display_alias : t.noProfile}
            </p>
            <div className="account-actions">
              <Link
                className="button primary"
                href={`/${lang}/account/profile`}
              >
                {t.profile}
              </Link>
              <Link
                className="button secondary"
                href={`/${lang}/account/security`}
              >
                {t.security}
              </Link>
              <Link href={`/${lang}/opportunities`}>{t.search}</Link>
            </div>
          </section>
          <section className="panel">
            <h2>{t.delegations}</h2>
            <p>{t.manualAssistOff}</p>
          </section>
        </>
      ) : section === "profile" ? (
        <section className="panel account-form-panel">
          <h2>{initial.profile ? t.profile : t.createProfile}</h2>
          <form method="post" action="/api/v1/subjects" onSubmit={saveProfile}>
            <label htmlFor="profile-alias">{t.alias}</label>
            <input
              id="profile-alias"
              name="displayAlias"
              value={alias}
              onChange={(e) => setAlias(e.target.value)}
              maxLength={60}
              required
            />
            <label htmlFor="profile-country">{t.country}</label>
            <input id="profile-country" value="TH" readOnly />
            {initial.profile ? (
              <>
                <label htmlFor="profile-region">{t.region}</label>
                <input
                  id="profile-region"
                  value={region}
                  onChange={(e) => setRegion(e.target.value)}
                  maxLength={80}
                />
                <label htmlFor="safe-contact">{t.safeContact}</label>
                <select
                  id="safe-contact"
                  value={safeContact}
                  onChange={(e) =>
                    setSafeContact(e.target.value as "none" | "email")
                  }
                >
                  <option value="none">{t.noContact}</option>
                  <option value="email">{t.emailContact}</option>
                </select>
                <p className="muted">
                  {t.dataVersion}: {initial.profile.version}
                </p>
              </>
            ) : (
              <>
                <label className="account-check">
                  <input
                    type="checkbox"
                    checked={adult}
                    onChange={(e) => setAdult(e.target.checked)}
                    required
                  />
                  <span>{t.adult}</span>
                </label>
                {notice && (
                  <section className="privacy-notice" aria-label={t.notice}>
                    <h3>
                      {t.notice} · {notice.version}
                    </h3>
                    <p>{notice.body}</p>
                  </section>
                )}
                <label className="account-check">
                  <input
                    type="checkbox"
                    checked={consent}
                    onChange={(e) => setConsent(e.target.checked)}
                    required
                  />
                  <span>{t.consent}</span>
                </label>
              </>
            )}
            <button
              className="button primary"
              type="submit"
              disabled={busy || !notice}
            >
              {initial.profile ? t.updateProfile : t.createProfile}
            </button>
          </form>
          <p className="muted">{t.publicPath}</p>
        </section>
      ) : section === "security" ? (
        <>
          <section className="panel">
            <h2>{t.mfa}</h2>
            <p>{t.mfaHelp}</p>
            <p className="status-note">
              {context.staff_assured
                ? t.verified
                : `${t.session}: ${context.aal}`}
            </p>
            {!initial.factors.length && !enrollment && (
              <button
                className="button primary"
                type="button"
                disabled={busy}
                onClick={() =>
                  run(async () => {
                    const data = await api<{
                      id: string;
                      qr_code: string;
                      secret: string;
                    }>("/api/auth/mfa-enroll", {});
                    setEnrollment(data);
                    setFactorId(data.id);
                  })
                }
              >
                {t.enroll}
              </button>
            )}
            {enrollment && (
              <div className="mfa-enrollment">
                <Image
                  src={
                    enrollment.qr_code.startsWith("data:")
                      ? enrollment.qr_code
                      : `data:image/svg+xml;charset=utf-8,${encodeURIComponent(enrollment.qr_code)}`
                  }
                  width={220}
                  height={220}
                  unoptimized
                  alt={t.qr}
                />
                <p>{t.secret}</p>
                <code className="mfa-secret">{enrollment.secret}</code>
              </div>
            )}
            {(initial.factors.length > 0 || enrollment) &&
              !context.staff_assured && (
                <form
                  className="mfa-form"
                  method="post"
                  action="/api/auth/mfa-verify"
                  onSubmit={(e) => {
                    e.preventDefault();
                    run(async () => {
                      await api("/api/auth/mfa-verify", { factorId, code });
                      setCode("");
                      setEnrollment(null);
                    });
                  }}
                >
                  {initial.factors.length > 1 && (
                    <>
                      <label htmlFor="factor">{t.mfa}</label>
                      <select
                        id="factor"
                        value={factorId}
                        onChange={(e) => setFactorId(e.target.value)}
                      >
                        {initial.factors.map((f) => (
                          <option key={f.id} value={f.id}>
                            {f.friendly_name ?? f.id}
                          </option>
                        ))}
                      </select>
                    </>
                  )}
                  <label htmlFor="mfa-code">{t.mfaCode}</label>
                  <input
                    id="mfa-code"
                    value={code}
                    onChange={(e) => setCode(e.target.value)}
                    pattern="[0-9]{6}"
                    minLength={6}
                    maxLength={6}
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    required
                  />
                  <button
                    className="button primary"
                    type="submit"
                    disabled={busy || !factorId}
                  >
                    {t.verifyMfa}
                  </button>
                </form>
              )}
            {initial.factors
              .filter((f) => f.status === "unverified")
              .map((f) => (
                <button
                  key={f.id}
                  className="button secondary"
                  type="button"
                  disabled={busy}
                  onClick={() =>
                    run(async () => {
                      await api("/api/auth/mfa-cancel-enrollment", {
                        factorId: f.id,
                      });
                      setEnrollment(null);
                      setFactorId("");
                    })
                  }
                >
                  {t.enrollAgain}
                </button>
              ))}
          </section>
          <section className="panel account-form-panel">
            <h2>{t.changePassword}</h2>
            <form
              method="post"
              action="/api/auth/password"
              onSubmit={(e) => {
                e.preventDefault();
                if (newPass !== repeatPass) {
                  setFailed(true);
                  setMessage(t.passwordMismatch);
                  return;
                }
                run(async () => {
                  await api("/api/auth/password", { password: newPass });
                  setNewPass("");
                  setRepeatPass("");
                  window.location.assign(`/${lang}/auth/login`);
                });
              }}
            >
              <label htmlFor="new-password">{t.passwordNew}</label>
              <input
                id="new-password"
                type="password"
                autoComplete="new-password"
                minLength={12}
                maxLength={128}
                value={newPass}
                onChange={(e) => setNewPass(e.target.value)}
                required
              />
              <label htmlFor="repeat-password">{t.passwordRepeat}</label>
              <input
                id="repeat-password"
                type="password"
                autoComplete="new-password"
                minLength={12}
                maxLength={128}
                value={repeatPass}
                onChange={(e) => setRepeatPass(e.target.value)}
                required
              />
              <button className="button primary" type="submit" disabled={busy}>
                {t.changePassword}
              </button>
            </form>
          </section>
        </>
      ) : section === "delegations" ? (
        <>
          {initial.profile && (
            <section className="panel account-form-panel">
              <h2>{t.grant}</h2>
              <form
                method="post"
                action="/api/v1/delegations"
                onSubmit={(e) => {
                  e.preventDefault();
                  run(async () => {
                    await api("/api/v1/delegations", {
                      subjectId: initial.profile!.id,
                      delegateId,
                      scopes: write
                        ? ["profile:read", "profile:write"]
                        : ["profile:read"],
                      expiresAt: new Date(
                        Date.now() + Number(days) * 86400000,
                      ).toISOString(),
                      noticeId: notice.id,
                      confirmed: grantConsent,
                    });
                    setGrantConsent(false);
                  });
                }}
              >
                <label htmlFor="delegate-id">{t.delegateId}</label>
                <input
                  id="delegate-id"
                  value={delegateId}
                  onChange={(e) => setDelegateId(e.target.value)}
                  minLength={36}
                  maxLength={36}
                  required
                />
                <p className="muted">{t.profileScope}</p>
                <label className="account-check">
                  <input
                    type="checkbox"
                    checked={write}
                    onChange={(e) => setWrite(e.target.checked)}
                  />
                  <span>{t.writeScope}</span>
                </label>
                <label htmlFor="delegation-days">{t.expiry}</label>
                <select
                  id="delegation-days"
                  value={days}
                  onChange={(e) => setDays(e.target.value)}
                >
                  {[7, 30, 90].map((n) => (
                    <option value={n} key={n}>
                      {n} {t.days}
                    </option>
                  ))}
                </select>
                <section className="privacy-notice">
                  <h3>{t.readBack}</h3>
                  <p>
                    {t.recipient}: <code>{delegateId || "—"}</code>
                  </p>
                  <p>
                    {t.scopes}: {t.profileScope}
                    {write ? ` + ${t.writeScope}` : ""}
                  </p>
                  <p>
                    {t.expiry}: {days} {t.days}
                  </p>
                  <p>{notice?.body}</p>
                </section>
                <label className="account-check">
                  <input
                    type="checkbox"
                    checked={grantConsent}
                    onChange={(e) => setGrantConsent(e.target.checked)}
                    required
                  />
                  <span>{t.delegationConsent}</span>
                </label>
                <button
                  className="button primary"
                  type="submit"
                  disabled={busy || !notice}
                >
                  {t.grant}
                </button>
              </form>
            </section>
          )}
          <section className="panel">
            <h2>{t.delegations}</h2>
            {!initial.delegations.length && <p>{t.noDelegations}</p>}
            <ul className="account-records">
              {initial.delegations.map((d) => (
                <li key={d.id}>
                  <p>
                    <strong>{d.own ? t.own : t.sharedProfile}</strong> ·{" "}
                    {t.status}: {d.status}
                  </p>
                  <code>{d.delegate_account_id}</code>
                  <p>
                    {t.scopes}: {d.scopes.join(", ")}
                  </p>
                  <p>
                    {t.ends}:{" "}
                    {new Date(d.expires_at).toLocaleString(lang, {
                      timeZone: "Asia/Bangkok",
                    })}{" "}
                    · Asia/Bangkok
                  </p>
                  {d.own && d.status === "active" ? (
                    <button
                      className="button secondary"
                      type="button"
                      disabled={busy}
                      onClick={() =>
                        run(async () => {
                          await api(`/api/v1/delegations/${d.id}/revoke`, {
                            expectedVersion: d.version,
                          });
                        })
                      }
                    >
                      {t.revoke}
                    </button>
                  ) : !d.own && d.status === "active" ? (
                    <button
                      className="button secondary"
                      type="button"
                      disabled={busy}
                      onClick={() =>
                        run(async () => {
                          const profile = await api<Profile>(
                            `/api/v1/subjects/${d.subject_id}`,
                          );
                          setShared(profile);
                          setSharedAlias(profile.display_alias);
                          setSharedRegion(profile.coarse_region);
                        })
                      }
                    >
                      {t.sharedProfile}
                    </button>
                  ) : null}
                </li>
              ))}
            </ul>
          </section>
          {shared && (
            <section className="panel account-form-panel">
              <h2>{t.sharedProfile}</h2>
              <p>{t.noContactForDelegate}</p>
              <form
                method="post"
                action={`/api/v1/subjects/${shared.id}`}
                onSubmit={(e) => {
                  e.preventDefault();
                  run(async () => {
                    const profile = await api<Profile>(
                      `/api/v1/subjects/${shared.id}`,
                      {
                        displayAlias: sharedAlias,
                        coarseRegion: sharedRegion,
                        expectedVersion: shared.version,
                      },
                      "PATCH",
                    );
                    setShared(profile);
                  });
                }}
              >
                <label htmlFor="shared-alias">{t.alias}</label>
                <input
                  id="shared-alias"
                  value={sharedAlias}
                  onChange={(e) => setSharedAlias(e.target.value)}
                  readOnly={!shared.can_write}
                  maxLength={60}
                  required
                />
                <label htmlFor="shared-region">{t.region}</label>
                <input
                  id="shared-region"
                  value={sharedRegion}
                  onChange={(e) => setSharedRegion(e.target.value)}
                  readOnly={!shared.can_write}
                  maxLength={80}
                />
                {shared.can_write ? (
                  <button
                    className="button primary"
                    type="submit"
                    disabled={busy}
                  >
                    {t.updateProfile}
                  </button>
                ) : (
                  <p>{t.readonly}</p>
                )}
              </form>
            </section>
          )}
        </>
      ) : section === "organizations" ? (
        <>
          <section className="panel account-form-panel">
            <h2>{t.createOrg}</h2>
            <p>{t.orgHelp}</p>
            {!context.staff_assured && (
              <p className="status-note">
                <Link href={`/${lang}/account/security`}>{t.mfaRequired}</Link>
              </p>
            )}
            <form
              method="post"
              action="/api/v1/organizations"
              onSubmit={(e) => {
                e.preventDefault();
                run(async () => {
                  await api("/api/v1/organizations", {
                    name: orgName,
                    country: "TH",
                  });
                  setOrgName("");
                });
              }}
            >
              <label htmlFor="organization-name">{t.organizationName}</label>
              <input
                id="organization-name"
                value={orgName}
                onChange={(e) => setOrgName(e.target.value)}
                maxLength={100}
                required
                disabled={!context.staff_assured}
              />
              <button
                className="button primary"
                type="submit"
                disabled={busy || !context.staff_assured}
              >
                {t.createOrg}
              </button>
            </form>
          </section>
          <section className="panel">
            <h2>{t.organizations}</h2>
            {!initial.organizations.length && <p>{t.noOrganizations}</p>}
            <ul className="account-records">
              {initial.organizations.map((org) => (
                <li key={org.id}>
                  <h3>{org.display_name}</h3>
                  <p>
                    {t.status}: {org.status} · {org.country_code}
                  </p>
                  {org.can_manage && (
                    <button
                      className="button secondary"
                      type="button"
                      disabled={busy}
                      onClick={() =>
                        run(async () => {
                          const rows = await api<Member[]>(
                            `/api/v1/organizations/${org.id}/members`,
                          );
                          setMembers(rows);
                          setOrgId(org.id);
                          setOutgoing(
                            await api<OutgoingInvitation[]>(
                              `/api/v1/organizations/${org.id}/invitations`,
                            ),
                          );
                        })
                      }
                    >
                      {t.members}
                    </button>
                  )}
                </li>
              ))}
            </ul>
          </section>
          {orgId && (
            <section className="panel">
              <h2>{t.members}</h2>
              <ul className="account-records">
                {members.map((m) => (
                  <li key={m.id}>
                    <code>{m.account_id}</code>
                    <p>
                      {t.role}: {m.roles.join(", ")} · {t.memberStatus}:{" "}
                      {m.status}
                    </p>
                    {m.status === "active" && (
                      <button
                        className="button secondary"
                        type="button"
                        disabled={busy}
                        onClick={() =>
                          run(async () => {
                            await api(
                              `/api/v1/organizations/${orgId}/members/${m.id}/revoke`,
                              { expectedVersion: m.version },
                            );
                            setMembers(
                              await api<Member[]>(
                                `/api/v1/organizations/${orgId}/members`,
                              ),
                            );
                          }, t.membersChanged)
                        }
                      >
                        {t.revoke}
                      </button>
                    )}
                  </li>
                ))}
              </ul>
              <form
                method="post"
                action={`/api/v1/organizations/${orgId}/invitations`}
                onSubmit={(e) => {
                  e.preventDefault();
                  run(async () => {
                    await api(`/api/v1/organizations/${orgId}/invitations`, {
                      recipientId: recipient,
                      role,
                    });
                    setRecipient("");
                    setOutgoing(
                      await api<OutgoingInvitation[]>(
                        `/api/v1/organizations/${orgId}/invitations`,
                      ),
                    );
                  }, t.inviteCreated);
                }}
              >
                <label htmlFor="recipient-id">{t.recipientId}</label>
                <input
                  id="recipient-id"
                  value={recipient}
                  onChange={(e) => setRecipient(e.target.value)}
                  minLength={36}
                  maxLength={36}
                  required
                />
                <label htmlFor="member-role">{t.role}</label>
                <select
                  id="member-role"
                  value={role}
                  onChange={(e) => setRole(e.target.value)}
                >
                  {[
                    "catalog_editor",
                    "caseworker",
                    "supervisor",
                    "recruiter",
                    "admin",
                  ].map((r) => (
                    <option key={r}>{r}</option>
                  ))}
                </select>
                <button
                  className="button primary"
                  type="submit"
                  disabled={busy}
                >
                  {t.invite}
                </button>
              </form>
              <ul className="account-records">
                {outgoing.map((i) => (
                  <li key={i.id}>
                    <code>{i.recipient_account_id}</code>
                    <p>
                      {t.role}: {i.role}
                    </p>
                    <button
                      className="button secondary"
                      type="button"
                      disabled={busy}
                      onClick={() =>
                        run(async () => {
                          await api(`/api/v1/invitations/${i.id}/cancel`, {});
                          setOutgoing(
                            await api<OutgoingInvitation[]>(
                              `/api/v1/organizations/${orgId}/invitations`,
                            ),
                          );
                        })
                      }
                    >
                      {t.cancel}
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </>
      ) : section === "invitations" ? (
        <section className="panel">
          <h2>{t.invitations}</h2>
          <p>{t.mfaHelp}</p>
          {!initial.invitations.length && <p>{t.noInvites}</p>}
          <ul className="account-records">
            {initial.invitations.map((i) => (
              <li key={i.id}>
                <h3>{i.organization_name}</h3>
                <p>
                  {t.role}: {i.role}
                </p>
                <p>
                  {t.ends}:{" "}
                  {new Date(i.expires_at).toLocaleString(lang, {
                    timeZone: "Asia/Bangkok",
                  })}
                </p>
                <button
                  className="button primary"
                  type="button"
                  disabled={busy || !context.staff_assured}
                  onClick={() =>
                    run(async () => {
                      await api(`/api/v1/invitations/${i.id}/accept`, {});
                    })
                  }
                >
                  {t.accept}
                </button>
                <button
                  className="button secondary"
                  type="button"
                  disabled={busy}
                  onClick={() =>
                    run(async () => {
                      await api(`/api/v1/invitations/${i.id}/cancel`, {});
                    })
                  }
                >
                  {t.cancel}
                </button>
                {!context.staff_assured && (
                  <Link href={`/${lang}/account/security`}>
                    {t.mfaRequired}
                  </Link>
                )}
              </li>
            ))}
          </ul>
        </section>
      ) : (
        <section className="panel">
          <h2>{t.privacy}</h2>
          {initial.notices.map((n) => (
            <section className="privacy-notice" key={n.id}>
              <h3>
                {n.version} · {n.environment}
              </h3>
              <p>{n.body}</p>
              <p className="muted">
                SHA-256: <code>{n.hash}</code>
              </p>
            </section>
          ))}
          {!initial.consents.length && <p>{t.noConsents}</p>}
          <ul className="account-records">
            {initial.consents.map((c) => (
              <li key={c.id}>
                <p>
                  <strong>
                    {c.purpose === "profile_processing"
                      ? t.processing
                      : t.profileDelegation}
                  </strong>{" "}
                  · {c.action === "granted" ? t.grantEvent : t.withdrawEvent}
                </p>
                <p>
                  {new Date(c.occurred_at).toLocaleString(lang, {
                    timeZone: "Asia/Bangkok",
                  })}{" "}
                  · Asia/Bangkok
                </p>
                {c.recipient_account_id && (
                  <p>
                    {t.recipient}: <code>{c.recipient_account_id}</code>
                  </p>
                )}
                <p>
                  {t.scopes}: {c.scopes.join(", ") || "—"}
                </p>
              </li>
            ))}
          </ul>
          <p className="muted">{t.futurePrivacy}</p>
        </section>
      )}
      <div className="account-actions">
        <button
          className="button secondary"
          type="button"
          disabled={busy}
          onClick={() => router.refresh()}
        >
          {t.refresh}
        </button>
        <button
          className="button secondary"
          type="button"
          disabled={busy}
          onClick={() =>
            run(async () => {
              await api("/api/auth/logout", {});
              window.location.assign(`/${lang}/auth/login`);
            })
          }
        >
          {t.logout}
        </button>
      </div>
    </main>
  );
}
