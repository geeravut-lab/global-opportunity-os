import { NextRequest } from "next/server";
import { requestClient } from "@/lib/supabase/request";
import { publicClient } from "@/lib/platform/server";
import {
  success,
  problem,
  readBody,
  inputProblem,
  dbProblem,
} from "@/lib/auth/http";
import {
  InputError,
  object,
  uuid,
  version,
  text,
  confirmed,
} from "@/lib/auth/input";
import { s3Enabled } from "@/lib/s3/model";
import {
  previewInput,
  submitInput,
  transitionInput,
  choice,
  bool,
  integer,
  timestamp,
  timezone,
} from "@/lib/s3/input";
export const dynamic = "force-dynamic";
async function handle(
  req: NextRequest,
  { params }: { params: Promise<{ path: string[] }> },
) {
  if (!s3Enabled()) return problem(503, "S3_NOT_ENABLED");
  const { path } = await params,
    route = path.join("/");
  if (req.method === "GET" && path.length === 2 && path[0] === "availability") {
    try {
      const c = publicClient();
      if (!c) return problem(503, "SERVICE_UNAVAILABLE");
      const r = await c.rpc("goos_s3_availability", { p_id: uuid(path[1]) });
      return r.error ? dbProblem(r.error) : success(r.data);
    } catch (e) {
      return inputProblem(e);
    }
  }
  const a = requestClient(req);
  if (!a) return problem(503, "AUTH_NOT_CONFIGURED");
  const done = a.apply;
  try {
    const user = await a.client.auth.getUser();
    if (user.error || !user.data.user?.email_confirmed_at)
      return done(problem(401, "SIGN_IN_REQUIRED"));
    const context = await a.client.rpc("goos_context");
    if (context.error) return done(dbProblem(context.error));
    let fn = "",
      args: Record<string, unknown> = {};
    if (req.method === "GET") {
      if (route === "subjects") fn = "goos_s3_subjects";
      else if (route === "organizations") fn = "goos_s3_orgs";
      else if (route === "inbox") fn = "goos_s3_inbox";
      else if (route === "preferences") fn = "goos_s3_preferences";
      else if (route === "notices") {
        fn = "goos_s3_notices";
        args = {
          p_locale: choice(req.nextUrl.searchParams.get("locale") ?? "th", [
            "th",
            "en",
          ]),
          p_purpose: choice(
            req.nextUrl.searchParams.get("purpose") ?? "application",
            ["application", "application_delegation"],
          ),
        };
      } else if (route === "applications") {
        fn = "goos_s3_list";
        args = {
          p_org: req.nextUrl.searchParams.has("org")
            ? uuid(req.nextUrl.searchParams.get("org"))
            : null,
          p_page: integer(
            Number(req.nextUrl.searchParams.get("page") ?? 1),
            1,
            100,
          ),
        };
      } else if (path[0] === "applications" && path.length === 2) {
        fn = "goos_s3_detail";
        args = { p_id: uuid(path[1]) };
      } else if (path[0] === "team" && path.length === 2) {
        fn = "goos_s3_team";
        args = { p_org: uuid(path[1]) };
      } else if (path[0] === "rules" && path.length === 2) {
        fn = "goos_s3_rules";
        args = { p_org: uuid(path[1]) };
      } else if (route === "deliveries") {
        fn = "goos_s3_delivery_status";
        args = {
          p_org: req.nextUrl.searchParams.has("org")
            ? uuid(req.nextUrl.searchParams.get("org"))
            : null,
        };
      } else return done(problem(404, "NOT_FOUND"));
    } else if (req.method === "POST") {
      const raw = await readBody(req, a.config.origin, 16384);
      if (route === "previews") {
        fn = "goos_s3_preview";
        args = previewInput(raw);
      } else if (route === "applications") {
        fn = "goos_s3_submit";
        args = submitInput(raw, req.headers.get("idempotency-key"));
      } else if (
        path.length === 3 &&
        path[0] === "applications" &&
        path[2] === "transition"
      ) {
        fn = "goos_s3_transition";
        args = { p_id: uuid(path[1]), ...transitionInput(raw) };
      } else if (
        path.length === 3 &&
        path[0] === "cases" &&
        path[2] === "assign"
      ) {
        const d = object(raw, ["member", "version"]);
        fn = "goos_s3_assign";
        args = {
          p_case: uuid(path[1]),
          p_member: uuid(d.member),
          p_version: version(d.version),
        };
      } else if (
        path.length === 3 &&
        path[0] === "cases" &&
        path[2] === "transition"
      ) {
        const d = object(raw, [
          "action",
          "version",
          "due",
          "timezone",
          "priority",
          "resolution",
        ]);
        fn = "goos_s3_case";
        args = {
          p_case: uuid(path[1]),
          p_action: choice(d.action, [
            "schedule",
            "triage",
            "start",
            "await_external",
            "resolve",
            "close",
            "reopen",
          ]),
          p_version: version(d.version),
          p_due: timestamp(d.due, true),
          p_timezone: timezone(d.timezone),
          p_priority: choice(d.priority, ["normal", "urgent"]),
          p_resolution:
            d.resolution === null
              ? null
              : choice(d.resolution, [
                  "service_recorded",
                  "not_proceeding",
                  "administrative",
                ]),
        };
      } else if (
        path.length === 3 &&
        path[0] === "cases" &&
        path[2] === "notes"
      ) {
        const d = object(raw, ["body", "visibility", "supersedes", "version"]);
        fn = "goos_s3_note";
        args = {
          p_case: uuid(path[1]),
          p_body: text(d.body, 1, 2000),
          p_visibility: choice(d.visibility, [
            "internal",
            "beneficiary_shared",
          ]),
          p_supersedes: d.supersedes === null ? null : uuid(d.supersedes),
          p_version: version(d.version),
        };
      } else if (route === "delegations") {
        const d = object(raw, [
          "subject",
          "delegate",
          "scopes",
          "expires",
          "notice",
          "confirmed",
        ]);
        if (
          !Array.isArray(d.scopes) ||
          d.scopes.length < 1 ||
          d.scopes.length > 3
        )
          throw new InputError("invalid_input");
        fn = "goos_s3_delegate";
        args = {
          p_subject: uuid(d.subject),
          p_delegate: uuid(d.delegate),
          p_scopes: [
            ...new Set(
              d.scopes.map((v) =>
                choice(v, [
                  "application:prepare",
                  "application:submit",
                  "progress:read",
                ]),
              ),
            ),
          ],
          p_expires: timestamp(d.expires),
          p_notice: uuid(d.notice),
          p_confirmed: confirmed(d.confirmed),
        };
      } else if (
        path.length === 3 &&
        path[0] === "delegations" &&
        path[2] === "revoke"
      ) {
        const d = object(raw, ["version"]);
        fn = "goos_revoke_delegation";
        args = { p_id: uuid(path[1]), p_expected_version: version(d.version) };
      } else if (
        path.length === 3 &&
        path[0] === "team" &&
        path[2] === "role"
      ) {
        const d = object(raw, ["member", "role", "grant", "reason"]);
        fn = "goos_s3_role";
        args = {
          p_org: uuid(path[1]),
          p_member: uuid(d.member),
          p_role: choice(d.role, ["supervisor", "caseworker", "recruiter"]),
          p_grant: bool(d.grant),
          p_reason: text(d.reason, 1, 200),
        };
      } else if (route === "preferences") {
        const d = object(raw, ["inApp", "email", "timezone", "version"]);
        fn = "goos_s3_save_preferences";
        args = {
          p_in_app: bool(d.inApp),
          p_email: bool(d.email),
          p_timezone: timezone(d.timezone),
          p_version: integer(d.version, 0, 2147483647),
        };
      } else if (route === "rules") {
        const d = object(raw, [
          "org",
          "id",
          "enabled",
          "minutes",
          "timezone",
          "version",
        ]);
        fn = "goos_s3_save_rule";
        args = {
          p_org: uuid(d.org),
          p_id: d.id === null ? null : uuid(d.id),
          p_enabled: bool(d.enabled),
          p_minutes: integer(d.minutes, 0, 10080),
          p_timezone: timezone(d.timezone),
          p_version: integer(d.version, 0, 2147483647),
        };
      } else if (
        path.length === 3 &&
        path[0] === "rules" &&
        path[2] === "dry-run"
      ) {
        object(raw, []);
        fn = "goos_s3_dry_run";
        args = { p_rule: uuid(path[1]) };
      } else if (
        path.length === 3 &&
        path[0] === "deliveries" &&
        path[2] === "retry"
      ) {
        const d = object(raw, ["attempts", "reason"]);
        fn = "goos_s3_retry";
        args = {
          p_id: uuid(path[1]),
          p_attempts: integer(d.attempts, 0, 5),
          p_reason: choice(d.reason, ["transport_restored", "scope_corrected"]),
        };
      } else return done(problem(404, "NOT_FOUND"));
    } else return done(problem(405, "METHOD_NOT_ALLOWED"));
    const r = await a.client.rpc(fn, args);
    return done(
      r.error
        ? dbProblem(r.error)
        : success(r.data, fn === "goos_s3_submit" ? 201 : 200),
    );
  } catch (error) {
    return done(inputProblem(error));
  }
}
export const GET = handle;
export const POST = handle;
