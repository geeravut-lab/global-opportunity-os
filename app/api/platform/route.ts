import { NextRequest } from "next/server";
import { requestClient } from "@/lib/supabase/request";
import {
  success,
  problem,
  readBody,
  inputProblem,
  dbProblem,
} from "@/lib/auth/http";
import { object, uuid, version, text } from "@/lib/auth/input";
import { platformFlags, validName } from "@/lib/platform/settings";
import { validateBrandImage } from "@/lib/platform/image";
export const dynamic = "force-dynamic";
export async function POST(req: NextRequest) {
  const a = requestClient(req);
  if (!a) return problem(503, "AUTH_NOT_CONFIGURED");
  const done = a.apply;
  try {
    const u = await a.client.auth.getUser();
    if (u.error || !u.data.user?.email_confirmed_at)
      return done(problem(401, "SIGN_IN_REQUIRED"));
    const ctx = await a.client.rpc("goos_context");
    if (ctx.error) return done(dbProblem(ctx.error));
    if (!ctx.data.has_platform_role) return done(problem(404, "NOT_FOUND"));
    if (!ctx.data.staff_assured) return done(problem(403, "MFA_REQUIRED"));
    if (req.headers.get("content-type")?.startsWith("multipart/form-data")) {
      if (
        req.headers.get("origin") !== a.config.origin ||
        req.headers.get("sec-fetch-site") === "cross-site"
      )
        return done(problem(403, "ORIGIN_REJECTED"));
      const size = Number(req.headers.get("content-length"));
      if (!size || size > 1100000) return done(problem(422, "INVALID_IMAGE"));
      const form = await req.formData();
      if (
        [...form.keys()].some(
          (k) => !["kind", "file", "expectedVersion"].includes(k),
        )
      )
        return done(problem(422, "INVALID_INPUT"));
      const kind = form.get("kind");
      if (kind !== "logo" && kind !== "favicon")
        return done(problem(422, "INVALID_INPUT"));
      const file = form.get("file");
      if (!(file instanceof File)) return done(problem(422, "INVALID_IMAGE"));
      const image = await validateBrandImage(
        new Uint8Array(await file.arrayBuffer()),
        kind,
      );
      const r = await a.client.rpc("goos_save_brand", {
        p_kind: kind,
        p_png: image.png,
        p_width: image.width,
        p_height: image.height,
        p_expected_version: version(Number(form.get("expectedVersion"))),
      });
      return done(r.error ? dbProblem(r.error) : success(r.data));
    }
    const raw = await readBody(req, a.config.origin);
    const d = object(raw, [
      "action",
      "nameTh",
      "nameEn",
      "flags",
      "expectedVersion",
      "kind",
      "targetId",
      "grant",
    ]);
    let r;
    if (d.action === "settings") {
      if (!validName(d.nameTh) || !validName(d.nameEn))
        return done(problem(422, "INVALID_INPUT"));
      const flags = object(d.flags, [...platformFlags]);
      if (Object.values(flags).some((v) => v !== false))
        return done(problem(422, "INVALID_INPUT"));
      r = await a.client.rpc("goos_save_settings", {
        p_name_th: d.nameTh,
        p_name_en: d.nameEn,
        p_flags: flags,
        p_expected_version: version(d.expectedVersion),
      });
    } else if (d.action === "reset-image") {
      const kind = text(d.kind);
      if (!["logo", "favicon"].includes(kind))
        return done(problem(422, "INVALID_INPUT"));
      r = await a.client.rpc("goos_save_brand", {
        p_kind: kind,
        p_png: null,
        p_width: 0,
        p_height: 0,
        p_expected_version: version(d.expectedVersion),
      });
    } else if (d.action === "admin") {
      if (typeof d.grant !== "boolean")
        return done(problem(422, "INVALID_INPUT"));
      r = await a.client.rpc("goos_manage_admin", {
        p_target: uuid(d.targetId),
        p_grant: d.grant,
      });
    } else return done(problem(404, "NOT_FOUND"));
    return done(r.error ? dbProblem(r.error) : success(r.data));
  } catch (e) {
    return done(
      e instanceof Error && e.message === "INVALID_IMAGE"
        ? problem(422, "INVALID_IMAGE")
        : inputProblem(e),
    );
  }
}
