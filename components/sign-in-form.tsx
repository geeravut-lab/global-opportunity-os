"use client";
import Link from "next/link";
import { useState, type FormEvent } from "react";
import { authErrorText, authText } from "@/lib/auth/copy";
import type { Locale } from "@/lib/i18n";
export function SignInForm({
  lang,
  mode,
  configured,
  google,
  callbackError,
}: {
  lang: Locale;
  mode: "login" | "signup" | "recover";
  configured: boolean;
  google: boolean;
  callbackError: boolean;
}) {
  const t = authText[lang],
    title =
      mode === "signup" ? t.signUp : mode === "recover" ? t.recover : t.signIn;
  const [address, setAddress] = useState(""),
    [pass, setPass] = useState(""),
    [adult, setAdult] = useState(false),
    [visible, setVisible] = useState(false),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState(callbackError ? t.callbackError : ""),
    [error, setError] = useState(callbackError);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setMessage("");
    setError(false);
    try {
      const response = await fetch(`/api/auth/${mode}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: address,
          locale: lang,
          ...(mode !== "recover" ? { password: pass } : {}),
          ...(mode === "signup" ? { adultConfirmed: adult } : {}),
        }),
      });
      const result = await response.json();
      if (!response.ok) {
        setError(true);
        setMessage(authErrorText(result.code, lang));
      } else if (result.data.redirect) {
        window.location.assign(result.data.redirect);
      } else {
        setPass("");
        setMessage(t.sent);
      }
    } catch {
      setError(true);
      setMessage(t.error);
    } finally {
      setBusy(false);
    }
  }
  async function googleSignIn() {
    setBusy(true);
    setError(false);
    setMessage("");
    try {
      const response = await fetch("/api/auth/google", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ locale: lang, adultConfirmed: adult }),
      });
      const result = await response.json();
      if (!response.ok) {
        setError(true);
        setMessage(authErrorText(result.code, lang));
      } else window.location.assign(result.data.redirect);
    } catch {
      setError(true);
      setMessage(t.error);
    } finally {
      setBusy(false);
    }
  }
  return (
    <main id="main" className="account-page auth-page">
      <section className="panel auth-card">
        <p className="eyebrow">Global Opportunity OS</p>
        <h1>{title}</h1>
        <p className="muted">{t.loginHelp}</p>
        <p className="auth-development">{t.noticeSynthetic}</p>
        {!configured && (
          <p className="status-note" role="status">
            {t.unavailable}
          </p>
        )}
        <form
          action={`/api/auth/${mode}`}
          method="post"
          onSubmit={submit}
          aria-describedby="auth-feedback"
        >
          <label htmlFor="auth-email">{t.email}</label>
          <input
            id="auth-email"
            name="email"
            type="email"
            autoComplete="email"
            maxLength={254}
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            required
            disabled={!configured || busy}
          />
          {mode !== "recover" && (
            <>
              <label htmlFor="auth-password">{t.password}</label>
              <div className="password-field">
                <input
                  id="auth-password"
                  name="password"
                  type={visible ? "text" : "password"}
                  autoComplete={
                    mode === "signup" ? "new-password" : "current-password"
                  }
                  minLength={mode === "signup" ? 12 : 1}
                  maxLength={128}
                  value={pass}
                  onChange={(e) => setPass(e.target.value)}
                  required
                  disabled={!configured || busy}
                  aria-describedby="password-help"
                />
                <button
                  type="button"
                  className="text-button"
                  aria-pressed={visible}
                  onClick={() => setVisible(!visible)}
                >
                  {visible ? t.hidePassword : t.showPassword}
                </button>
              </div>
              <p id="password-help" className="muted">
                {t.passwordHelp}
              </p>
            </>
          )}
          {mode === "signup" && (
            <label className="account-check">
              <input
                type="checkbox"
                checked={adult}
                onChange={(e) => setAdult(e.target.checked)}
                required
                disabled={!configured || busy}
              />
              <span>{t.adult}</span>
            </label>
          )}
          <button
            className="button primary"
            type="submit"
            disabled={!configured || busy}
          >
            {busy ? t.busy : title}
          </button>
        </form>
        {mode !== "recover" && (
          <div className="google-section">
            <p className="auth-or">{t.or}</p>
            {mode === "login" && (
              <label className="account-check">
                <input
                  type="checkbox"
                  checked={adult}
                  onChange={(e) => setAdult(e.target.checked)}
                  disabled={!configured || busy}
                />
                <span>{t.adult}</span>
              </label>
            )}
            <button
              className="button google-button"
              type="button"
              onClick={googleSignIn}
              disabled={!configured || !google || !adult || busy}
            >
              <span aria-hidden="true" className="google-g">
                G
              </span>
              {t.google}
            </button>
            <p className="muted">{google ? t.googleHelp : t.googleOff}</p>
          </div>
        )}
        <p
          id="auth-feedback"
          className={`account-feedback ${error ? "is-error" : ""}`}
          role={error ? "alert" : "status"}
          aria-live="polite"
        >
          {message}
        </p>
        <nav
          className="auth-links"
          aria-label={lang === "th" ? "ทางเลือกบัญชี" : "Account options"}
        >
          {mode !== "login" && (
            <Link href={`/${lang}/auth/login`}>{t.backLogin}</Link>
          )}
          {mode !== "signup" && (
            <Link href={`/${lang}/auth/signup`}>{t.signUp}</Link>
          )}
          {mode !== "recover" && (
            <Link href={`/${lang}/auth/recover`}>{t.recover}</Link>
          )}
        </nav>
        <p className="muted">{t.publicPath}</p>
        <Link className="public-auth-link" href={`/${lang}/opportunities`}>
          {t.search} ›
        </Link>
      </section>
    </main>
  );
}
