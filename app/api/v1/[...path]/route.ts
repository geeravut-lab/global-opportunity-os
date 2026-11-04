import { NextRequest } from "next/server";
import { requestClient } from "@/lib/supabase/request";
import {
  readBody,
  success,
  problem,
  inputProblem,
  dbProblem,
} from "@/lib/auth/http";
import { object, text, uuid, version, confirmed } from "@/lib/auth/input";
import { loadAccount } from "@/lib/auth/account";
import type { PostgrestError } from "@supabase/supabase-js";
export const dynamic = "force-dynamic";
async function handle(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> },
) {
  const auth = requestClient(request);
  if (!auth) return problem(503, "AUTH_NOT_CONFIGURED");
  const done = auth.apply;
  try {
    const user = await auth.client.auth.getUser();
    if (user.error || !user.data.user?.email_confirmed_at)
      return done(problem(401, "SIGN_IN_REQUIRED"));
    const context = await auth.client.rpc("goos_context");
    if (context.error) return done(dbProblem(context.error));
    const { path } = await params;
    const route = path.join("/");
    const lang =
      request.nextUrl.searchParams.get("locale") === "en" ? "en" : "th";
    let result: { data: unknown; error: PostgrestError | null };
    if (request.method === "GET") {
      if (route === "me") {
        const loaded = await loadAccount(auth.client, lang);
        return done(
          loaded.error ? dbProblem(loaded.error) : success(loaded.data),
        );
      }
      if (path.length === 2 && path[0] === "subjects")
        result = await auth.client.rpc("goos_profile", {
          p_subject_id: uuid(path[1]),
        });
      else if (route === "organizations")
        result = await auth.client.rpc("goos_organizations");
      else if (route === "delegations")
        result = await auth.client.rpc("goos_delegations");
      else if (route === "consents")
        result = await auth.client.rpc("goos_consents");
      else if (route === "invitations")
        result = await auth.client.rpc("goos_my_invitations");
      else if (route === "notices")
        result = await auth.client.rpc("goos_notices", { p_locale: lang });
      else if (
        path.length === 3 &&
        path[0] === "organizations" &&
        path[2] === "invitations"
      )
        result = await auth.client.rpc("goos_org_invitations", {
          p_org: uuid(path[1]),
        });
      else if (
        path.length === 3 &&
        path[0] === "organizations" &&
        path[2] === "members"
      )
        result = await auth.client.rpc("goos_members", {
          p_org: uuid(path[1]),
        });
      else return done(problem(404, "NOT_FOUND"));
    } else {
      const input = await readBody(request, auth.config.origin);
      if (request.method === "POST" && route === "subjects") {
        const data = object(input, [
          "displayAlias",
          "country",
          "ageBand",
          "noticeId",
          "confirmed",
        ]);
        result = await auth.client.rpc("goos_create_profile", {
          p_display_alias: text(data.displayAlias, 1, 60),
          p_country_code: text(data.country, 2, 2),
          p_age_band: text(data.ageBand),
          p_notice_id: uuid(data.noticeId),
          p_confirmed: confirmed(data.confirmed),
        });
      } else if (
        request.method === "PATCH" &&
        path.length === 2 &&
        path[0] === "subjects"
      ) {
        const data = object(input, [
          "displayAlias",
          "coarseRegion",
          "safeContact",
          "expectedVersion",
        ]);
        const safeContact =
          data.safeContact === undefined ? null : text(data.safeContact);
        if (safeContact !== null && !["none", "email"].includes(safeContact))
          return done(problem(422, "INVALID_INPUT"));
        result = await auth.client.rpc("goos_update_profile", {
          p_subject_id: uuid(path[1]),
          p_display_alias: text(data.displayAlias, 1, 60),
          p_coarse_region: text(data.coarseRegion, 0, 80),
          p_safe_contact: safeContact,
          p_expected_version: version(data.expectedVersion),
        });
      } else if (request.method === "POST" && route === "delegations") {
        const data = object(input, [
          "subjectId",
          "delegateId",
          "scopes",
          "expiresAt",
          "noticeId",
          "confirmed",
        ]);
        if (
          !Array.isArray(data.scopes) ||
          !data.scopes.every(
            (s) => s === "profile:read" || s === "profile:write",
          )
        )
          return done(problem(422, "INVALID_INPUT"));
        result = await auth.client.rpc("goos_create_delegation", {
          p_subject_id: uuid(data.subjectId),
          p_delegate_id: uuid(data.delegateId),
          p_scopes: data.scopes,
          p_expires_at: text(data.expiresAt, 10, 50),
          p_notice_id: uuid(data.noticeId),
          p_confirmed: confirmed(data.confirmed),
        });
      } else if (
        request.method === "POST" &&
        path.length === 3 &&
        path[0] === "delegations" &&
        path[2] === "revoke"
      ) {
        const data = object(input, ["expectedVersion"]);
        result = await auth.client.rpc("goos_revoke_delegation", {
          p_id: uuid(path[1]),
          p_expected_version: version(data.expectedVersion),
        });
      } else if (request.method === "POST" && route === "organizations") {
        const data = object(input, ["name", "country"]);
        result = await auth.client.rpc("goos_create_organization", {
          p_name: text(data.name, 1, 100),
          p_country_code: text(data.country, 2, 2),
        });
      } else if (
        request.method === "POST" &&
        path.length === 3 &&
        path[0] === "organizations" &&
        path[2] === "invitations"
      ) {
        const data = object(input, ["recipientId", "role"]);
        result = await auth.client.rpc("goos_invite_member", {
          p_org: uuid(path[1]),
          p_recipient: uuid(data.recipientId),
          p_role: text(data.role),
        });
      } else if (
        request.method === "POST" &&
        path.length === 3 &&
        path[0] === "invitations" &&
        path[2] === "cancel"
      ) {
        object(input, []);
        result = await auth.client.rpc("goos_cancel_invitation", {
          p_id: uuid(path[1]),
        });
      } else if (
        request.method === "POST" &&
        path.length === 3 &&
        path[0] === "invitations" &&
        path[2] === "accept"
      ) {
        object(input, []);
        result = await auth.client.rpc("goos_accept_invitation", {
          p_id: uuid(path[1]),
        });
      } else if (
        request.method === "POST" &&
        path.length === 5 &&
        path[0] === "organizations" &&
        path[2] === "members" &&
        path[4] === "revoke"
      ) {
        const data = object(input, ["expectedVersion"]);
        result = await auth.client.rpc("goos_revoke_member", {
          p_org: uuid(path[1]),
          p_member: uuid(path[3]),
          p_expected_version: version(data.expectedVersion),
        });
      } else return done(problem(404, "NOT_FOUND"));
    }
    return done(result.error ? dbProblem(result.error) : success(result.data));
  } catch (error) {
    return done(inputProblem(error));
  }
}
export const GET = handle;
export const POST = handle;
export const PATCH = handle;
