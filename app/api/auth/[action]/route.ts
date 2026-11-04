import { NextRequest } from "next/server";
import { requestClient } from "@/lib/supabase/request";
import {
  object,
  email,
  password,
  locale,
  confirmed,
  text,
  uuid,
} from "@/lib/auth/input";
import {
  readBody,
  success,
  problem,
  inputProblem,
  dbProblem,
  rateLimited,
} from "@/lib/auth/http";
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ action: string }> },
) {
  const auth = requestClient(request);
  if (!auth) return problem(503, "AUTH_NOT_CONFIGURED");
  const done = auth.apply;
  try {
    const { action } = await params;
    const input = await readBody(request, auth.config.origin);
    if (["login", "signup", "recover"].includes(action)) {
      const data = object(
        input,
        action === "signup"
          ? ["email", "password", "locale", "adultConfirmed"]
          : action === "recover"
            ? ["email", "locale"]
            : ["email", "password", "locale"],
      );
      const address = email(data.email),
        lang = locale(data.locale);
      if (rateLimited(action, address)) return done(problem(429, "TRY_LATER"));
      if (action === "recover") {
        const { error } = await auth.client.auth.resetPasswordForEmail(
          address,
          {
            redirectTo: `${auth.config.origin}/${lang}/auth/callback?next=password`,
          },
        );
        if (error && error.status && error.status >= 500)
          return done(problem(503, "SERVICE_UNAVAILABLE"));
        return done(success({ accepted: true }));
      }
      const pass = password(data.password, action === "login" ? 1 : 12);
      if (action === "signup") {
        confirmed(data.adultConfirmed);
        const { error } = await auth.client.auth.signUp({
          email: address,
          password: pass,
          options: {
            emailRedirectTo: `${auth.config.origin}/${lang}/auth/callback`,
          },
        });
        if (error && error.status && error.status >= 500)
          return done(problem(503, "SERVICE_UNAVAILABLE"));
        // ไม่เปิดเผยว่ามี email นี้แล้วหรือไม่
        return done(success({ accepted: true }));
      }
      const { data: signed, error } = await auth.client.auth.signInWithPassword(
        { email: address, password: pass },
      );
      if (error || !signed.user?.email_confirmed_at)
        return done(problem(401, "CREDENTIALS_REJECTED"));
      const result = await auth.client.rpc("goos_bootstrap_account", {
        p_locale: lang,
      });
      if (result.error) {
        await auth.client.auth.signOut({ scope: "local" });
        return done(dbProblem(result.error));
      }
      return done(success({ redirect: `/${lang}/account` }));
    }
    if (action === "google") {
      const data = object(input, ["locale", "adultConfirmed"]),
        lang = locale(data.locale);
      confirmed(data.adultConfirmed);
      if (!auth.config.google)
        return done(problem(503, "GOOGLE_NOT_CONFIGURED"));
      const { data: oauth, error } = await auth.client.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: `${auth.config.origin}/${lang}/auth/callback`,
          scopes: "openid email profile",
          skipBrowserRedirect: true,
          queryParams: { prompt: "select_account" },
        },
      });
      if (error || !oauth.url) return done(problem(503, "SERVICE_UNAVAILABLE"));
      const target = new URL(oauth.url);
      if (
        target.origin !== new URL(auth.config.url).origin ||
        target.pathname !== "/auth/v1/authorize"
      )
        return done(problem(503, "SERVICE_UNAVAILABLE"));
      return done(success({ redirect: oauth.url }));
    }
    const verified = await auth.client.auth.getUser();
    if (verified.error || !verified.data.user?.email_confirmed_at)
      return done(problem(401, "SIGN_IN_REQUIRED"));
    if (action === "logout") {
      object(input, []);
      const revoked = await auth.client.rpc("goos_revoke_current_session");
      const signedOut = await auth.client.auth.signOut({ scope: "global" });
      if (revoked.error || signedOut.error)
        return done(problem(503, "SIGN_OUT_INCOMPLETE"));
      return done(success({ signed_out: true }));
    }
    if (action === "password") {
      const d = object(input, [
        "password",
        "currentPassword",
        "factorId",
        "code",
      ]);
      const next = password(d.password);
      const before = await auth.client.rpc("goos_context");
      if (before.error) return done(dbProblem(before.error));
      if (!before.data.can_reset_password) {
        if (!before.data.has_password || !verified.data.user.email)
          return done(problem(422, "PASSWORD_CHANGE_REJECTED"));
        const current = password(d.currentPassword, 1);
        if (current === next) return done(problem(422, "INVALID_INPUT"));
        if (rateLimited("password", verified.data.user.id))
          return done(problem(429, "TRY_LATER"));
        const proof = await auth.client.auth.signInWithPassword({
          email: verified.data.user.email,
          password: current,
        });
        if (proof.error || proof.data.user?.id !== verified.data.user.id)
          return done(problem(401, "CREDENTIALS_REJECTED"));
      }
      const factors = await auth.client.auth.mfa.listFactors();
      if (factors.error) return done(problem(503, "SERVICE_UNAVAILABLE"));
      if (factors.data.totp.length) {
        const factorId = uuid(d.factorId),
          code = text(d.code, 6, 6);
        if (
          !factors.data.totp.some((f) => f.id === factorId) ||
          !/^\d{6}$/.test(code)
        )
          return done(problem(422, "INVALID_INPUT"));
        const mfa = await auth.client.auth.mfa.challengeAndVerify({
          factorId,
          code,
        });
        if (mfa.error) return done(problem(401, "MFA_CODE_REJECTED"));
      }
      const changed = await auth.client.auth.updateUser({ password: next });
      if (changed.error) return done(problem(422, "PASSWORD_CHANGE_REJECTED"));
      await auth.client.rpc("goos_security_notice");
      await auth.client.rpc("goos_revoke_current_session");
      const out = await auth.client.auth.signOut({ scope: "global" });
      return done(
        out.error
          ? problem(503, "SIGN_OUT_INCOMPLETE")
          : success({ signed_out: true }),
      );
    }
    const context = await auth.client.rpc("goos_context");
    if (context.error) return done(dbProblem(context.error));
    if (action === "mfa-enroll") {
      object(input, []);
      const { data, error } = await auth.client.auth.mfa.enroll({
        factorType: "totp",
        friendlyName: "Global Opportunity OS",
      });
      if (error || !data) return done(problem(422, "MFA_REQUEST_REJECTED"));
      return done(
        success({
          id: data.id,
          qr_code: data.totp.qr_code,
          secret: data.totp.secret,
        }),
      );
    }
    if (action === "mfa-cancel-enrollment") {
      const data = object(input, ["factorId"]),
        factorId = uuid(data.factorId);
      const factors = await auth.client.auth.mfa.listFactors();
      if (
        factors.error ||
        !factors.data.all.some(
          (f) => f.id === factorId && f.status === "unverified",
        )
      )
        return done(problem(404, "NOT_FOUND"));
      const result = await auth.client.auth.mfa.unenroll({ factorId });
      return done(
        result.error
          ? problem(422, "MFA_REQUEST_REJECTED")
          : success({ cancelled: true }),
      );
    }
    if (action === "mfa-verify") {
      const data = object(input, ["factorId", "code"]),
        factorId = uuid(data.factorId),
        code = text(data.code, 6, 6);
      if (!/^\d{6}$/.test(code)) return done(problem(422, "INVALID_INPUT"));
      const result = await auth.client.auth.mfa.challengeAndVerify({
        factorId,
        code,
      });
      return done(
        result.error
          ? problem(401, "MFA_CODE_REJECTED")
          : success({ verified: true }),
      );
    }
    return done(problem(404, "NOT_FOUND"));
  } catch (error) {
    return done(inputProblem(error));
  }
}
