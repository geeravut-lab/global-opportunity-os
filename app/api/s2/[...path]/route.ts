import { NextRequest, NextResponse } from "next/server";
import { requestClient } from "@/lib/supabase/request";
import { publicClient } from "@/lib/platform/server";
import {
  readBody,
  success,
  problem,
  inputProblem,
  dbProblem,
  noStore,
} from "@/lib/auth/http";
import { object, text, uuid, version } from "@/lib/auth/input";
import { s2Enabled } from "@/lib/s2/model";
import {
  assessmentInput,
  listingInput,
  revision,
  catalogFilters,
} from "@/lib/s2/input";
export const dynamic = "force-dynamic";
async function handle(
  req: NextRequest,
  { params }: { params: Promise<{ path: string[] }> },
) {
  if (!s2Enabled()) return problem(503, "S2_NOT_ENABLED");
  const { path } = await params,
    route = path.join("/");
  if (req.method === "GET" && path[0] === "catalog") {
    try {
      if (path.length > 2) return problem(404, "NOT_FOUND");
      const c = publicClient();
      if (!c) return problem(503, "CATALOG_UNAVAILABLE");
      const r = await c.rpc("goos_s2_catalog", {
        p_filter: catalogFilters(req.nextUrl.searchParams),
        p_id: path[1] ? uuid(path[1]) : null,
      });
      return r.error ? dbProblem(r.error) : success(r.data);
    } catch (e) {
      return inputProblem(e);
    }
  }
  const a = requestClient(req);
  if (!a) return problem(503, "AUTH_NOT_CONFIGURED");
  const done = a.apply;
  try {
    const u = await a.client.auth.getUser();
    if (u.error || !u.data.user?.email_confirmed_at)
      return done(problem(401, "SIGN_IN_REQUIRED"));
    const ctx = await a.client.rpc("goos_context");
    if (ctx.error) return done(dbProblem(ctx.error));
    let fn = "",
      args: Record<string, unknown> = {};
    if (req.method === "GET") {
      if (route === "organizations") {
        fn = "goos_s2_orgs";
        args = { p_review: req.nextUrl.searchParams.get("review") === "true" };
      } else if (route === "listings") {
        fn = "goos_s2_listings";
        args = {
          p_org: req.nextUrl.searchParams.get("org")
            ? uuid(req.nextUrl.searchParams.get("org"))
            : null,
          p_review: req.nextUrl.searchParams.get("review") === "true",
        };
      } else if (
        path.length === 3 &&
        path[0] === "organizations" &&
        path[2] === "evidence"
      ) {
        fn = "goos_s2_evidence";
        args = { p_org: uuid(path[1]) };
      } else if (path.length === 2 && path[0] === "evidence") {
        const r = await a.client.rpc("goos_s2_download", {
          p_id: uuid(path[1]),
        });
        if (r.error) return done(dbProblem(r.error));
        const response = new NextResponse(Buffer.from(r.data.png, "base64"), {
          headers: {
            "Content-Type": "image/png",
            "Content-Disposition":
              'attachment; filename="organization-evidence.png"',
            "X-Content-Type-Options": "nosniff",
            "Content-Security-Policy": "default-src 'none'; sandbox",
          },
        });
        return done(noStore(response));
      } else if (route === "notices") {
        fn = "goos_s2_notices";
        args = {
          p_locale:
            req.nextUrl.searchParams.get("locale") === "th" ? "th" : "en",
        };
      } else if (route === "assessment-events")
        fn = "goos_s2_assessment_events";
      else if (["assessment", "bookmarks", "matches"].includes(route))
        fn = "goos_s2_" + route;
      else return done(problem(404, "NOT_FOUND"));
    } else if (
      req.method === "POST" &&
      path.length === 2 &&
      path[0] === "evidence"
    ) {
      if (
        req.headers.get("origin") !== a.config.origin ||
        req.headers.get("sec-fetch-site") === "cross-site"
      )
        return done(problem(403, "ORIGIN_REJECTED"));
      const size = Number(req.headers.get("content-length"));
      if (
        !size ||
        size > 1100000 ||
        !req.headers.get("content-type")?.startsWith("multipart/form-data")
      )
        return done(problem(422, "INVALID_IMAGE"));
      const f = await req.formData();
      if (
        [...f.keys()].some((k) => k !== "file") ||
        f.getAll("file").length !== 1
      )
        return done(problem(422, "INVALID_IMAGE"));
      const file = f.get("file");
      if (
        !(file instanceof File) ||
        file.type !== "image/png" ||
        file.size > 1048576 ||
        file.size < 45
      )
        return done(problem(422, "INVALID_IMAGE"));
      fn = "goos_s2_upload";
      args = {
        p_id: uuid(path[1]),
        p_png: Buffer.from(await file.arrayBuffer()).toString("base64"),
      };
    } else if (req.method === "POST") {
      const raw = await readBody(req, a.config.origin, 16384);
      if (
        path.length === 3 &&
        path[0] === "organizations" &&
        path[2] === "intent"
      ) {
        object(raw, []);
        fn = "goos_s2_upload_intent";
        args = { p_org: uuid(path[1]) };
      } else if (
        path.length === 3 &&
        path[0] === "organizations" &&
        path[2] === "transition"
      ) {
        const d = object(raw, [
          "action",
          "reason",
          "expires",
          "expectedVersion",
        ]);
        fn = "goos_s2_transition_org";
        args = {
          p_org: uuid(path[1]),
          p_action: text(d.action),
          p_reason: text(d.reason, 1, 500),
          p_expires: d.expires ? text(d.expires, 10, 50) : null,
          p_expected_version: version(d.expectedVersion),
        };
      } else if (route === "listings") {
        const d = object(raw, ["org", "id", "data", "expectedVersion"]);
        fn = "goos_s2_save_listing";
        args = {
          p_org: uuid(d.org),
          p_id: d.id ? uuid(d.id) : null,
          p_data: listingInput(d.data),
          p_expected_version: revision(d.expectedVersion),
        };
      } else if (
        path.length === 3 &&
        path[0] === "listings" &&
        path[2] === "submit"
      ) {
        const d = object(raw, ["expectedVersion"]);
        fn = "goos_s2_submit_listing";
        args = {
          p_id: uuid(path[1]),
          p_expected_version: version(d.expectedVersion),
        };
      } else if (
        path.length === 3 &&
        path[0] === "listings" &&
        path[2] === "review"
      ) {
        const d = object(raw, ["action", "reason", "expectedVersion"]);
        fn = "goos_s2_review_listing";
        args = {
          p_id: uuid(path[1]),
          p_action: text(d.action),
          p_reason: text(d.reason, 1, 500),
          p_expected_version: version(d.expectedVersion),
        };
      } else if (route === "assessment") {
        const d = object(raw, [
          "subject",
          "data",
          "notice",
          "confirmed",
          "expectedVersion",
        ]);
        if (typeof d.confirmed !== "boolean")
          return done(problem(422, "INVALID_INPUT"));
        fn = "goos_s2_save_assessment";
        args = {
          p_subject: uuid(d.subject),
          p_data: assessmentInput(d.data),
          p_notice: uuid(d.notice),
          p_confirmed: d.confirmed,
          p_expected_version: revision(d.expectedVersion),
        };
      } else if (path.length === 2 && path[0] === "bookmarks") {
        const d = object(raw, ["saved"]);
        if (typeof d.saved !== "boolean")
          return done(problem(422, "INVALID_INPUT"));
        fn = "goos_s2_bookmark";
        args = { p_id: uuid(path[1]), p_saved: d.saved };
      } else return done(problem(404, "NOT_FOUND"));
    } else return done(problem(405, "METHOD_NOT_ALLOWED"));
    const r = await a.client.rpc(fn, args);
    return done(r.error ? dbProblem(r.error) : success(r.data));
  } catch (e) {
    return done(inputProblem(e));
  }
}
export const GET = handle;
export const POST = handle;
