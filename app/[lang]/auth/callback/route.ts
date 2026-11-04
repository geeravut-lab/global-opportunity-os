import { NextRequest, NextResponse } from "next/server";
import { requestClient } from "@/lib/supabase/request";
import { callbackPath } from "@/lib/auth/config";
import { problem } from "@/lib/auth/http";
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ lang: string }> },
) {
  const { lang: raw } = await params,
    lang = raw === "en" ? "en" : "th";
  const auth = requestClient(request);
  if (!auth) return problem(503, "AUTH_NOT_CONFIGURED");
  const code = request.nextUrl.searchParams.get("code");
  if (code && code.length < 4096) {
    const exchange = await auth.client.auth.exchangeCodeForSession(code);
    if (!exchange.error && exchange.data.user?.email_confirmed_at) {
      const boot = await auth.client.rpc("goos_bootstrap_account", {
        p_locale: lang,
      });
      if (!boot.error)
        return auth.apply(
          NextResponse.redirect(
            new URL(
              callbackPath(
                lang,
                request.nextUrl.searchParams.get("next") ?? undefined,
              ),
              auth.config.origin,
            ),
          ),
        );
      await auth.client.auth.signOut({ scope: "local" });
    }
  }
  return auth.apply(
    NextResponse.redirect(
      new URL(`/${lang}/auth/login?status=callback-error`, auth.config.origin),
    ),
  );
}
