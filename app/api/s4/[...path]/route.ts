import { NextRequest, NextResponse } from "next/server";
import { requestClient } from "@/lib/supabase/request";
import {
  success,
  problem,
  readBody,
  dbProblem,
  inputProblem,
  noStore,
} from "@/lib/auth/http";
import { uuid } from "@/lib/auth/input";
import { integer } from "@/lib/s3/input";
import { s4Enabled, kinds } from "@/lib/s4/model";
import { kindInput, mutation } from "@/lib/s4/input";
export const dynamic = "force-dynamic";
async function handle(
  req: NextRequest,
  { params }: { params: Promise<{ path: string[] }> },
) {
  if (!s4Enabled()) return problem(503, "S4_NOT_ENABLED");
  const a = requestClient(req);
  if (!a) return problem(503, "AUTH_NOT_CONFIGURED");
  try {
    const u = await a.client.auth.getUser();
    if (u.error || !u.data.user?.email_confirmed_at)
      return a.apply(problem(401, "SIGN_IN_REQUIRED"));
    const context = await a.client.rpc("goos_context");
    if (context.error) return a.apply(dbProblem(context.error));
    const { path } = await params;
    let fn = "",
      args: Record<string, unknown> = {};
    let download: "image" | "export" | null = null;
    if (req.method === "GET") {
      if (
        path.length === 1 &&
        kinds.includes(path[0] as (typeof kinds)[number])
      ) {
        fn = "goos_s4_list";
        args = {
          p_kind: kindInput(path[0]),
          p_page: integer(
            Number(req.nextUrl.searchParams.get("page") ?? 1),
            1,
            100,
          ),
        };
      } else if (
        path.length === 2 &&
        kinds.includes(path[0] as (typeof kinds)[number])
      ) {
        fn = "goos_s4_detail";
        args = { p_kind: kindInput(path[0]), p_id: uuid(path[1]) };
      } else if (path.length === 1 && path[0] === "sources")
        fn = "goos_s4_sources";
      else if (path.length === 1 && path[0] === "staff") fn = "goos_s4_staff";
      else if (path.length === 1 && path[0] === "cessations")
        fn = "goos_s4_cessations";
      else if (path.length === 1 && path[0] === "notice") {
        fn = "goos_s4_notice";
        const locale = req.nextUrl.searchParams.get("locale") ?? "th";
        if (!["th", "en"].includes(locale))
          return a.apply(problem(422, "INVALID_INPUT"));
        args = { p_locale: locale };
      } else if (
        path.length === 3 &&
        path[2] === "download" &&
        path[0] === "evidence"
      ) {
        fn = "goos_s4_download";
        args = { p_id: uuid(path[1]) };
        download = "image";
      } else if (
        path.length === 3 &&
        path[2] === "export" &&
        path[0] === "privacy"
      ) {
        fn = "goos_s4_export";
        args = { p_id: uuid(path[1]) };
        download = "export";
      } else return a.apply(problem(404, "NOT_FOUND"));
    } else if (req.method === "POST") {
      const raw = await readBody(
        req,
        a.config.origin,
        path[2] === "evidence" ? 1500000 : 16384,
      );
      const m = mutation(
        path.join("/"),
        raw,
        req.headers.get("idempotency-key"),
      );
      fn = m.fn;
      args = m.args;
    } else return a.apply(problem(405, "METHOD_NOT_ALLOWED"));
    const r = await a.client.rpc(fn, args);
    if (r.error) return a.apply(dbProblem(r.error));
    if (download) {
      const image = download === "image";
      return a.apply(
        noStore(
          new NextResponse(
            image
              ? Buffer.from(r.data.body, "base64")
              : JSON.stringify(r.data, null, 2),
            {
              headers: {
                "Content-Type": image
                  ? "image/png"
                  : "application/json; charset=utf-8",
                "Content-Disposition": image
                  ? 'attachment; filename="evidence.png"'
                  : 'attachment; filename="opp4all-data.json"',
                "X-Content-Type-Options": "nosniff",
                "Content-Security-Policy": "default-src 'none'; sandbox",
              },
            },
          ),
        ),
      );
    }
    return a.apply(success(r.data));
  } catch (e) {
    return a.apply(inputProblem(e));
  }
}
export const GET = handle;
export const POST = handle;
