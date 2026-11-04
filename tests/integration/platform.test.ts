import { beforeAll, describe, it, expect } from "vitest";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
import {
  actors,
  runtime,
  login,
  mfa,
  sql,
  token,
  clientWithToken,
  profile,
} from "./helpers";
let owner: SupabaseClient, other: SupabaseClient, user: SupabaseClient;
let subject: string;
async function settings() {
  const r = await owner.rpc("goos_public_settings");
  if (r.error) throw Error("settings unavailable");
  return r.data;
}
beforeAll(async () => {
  owner = await login(actors.platformOwner);
  other = await login(actors.platformOther);
  user = await login(actors.platformUser);
  await sql("delete from private.platform_owner");
  await sql(
    "insert into private.platform_bootstrap(singleton,salt,email_hash,claimed_at) values(true,'local-test',encode(sha256(convert_to('local-test'||lower($1),'UTF8')),'hex'),null) on conflict(singleton) do update set salt=excluded.salt,email_hash=excluded.email_hash,claimed_at=null",
    [actors.platformOwner.email],
  );
  expect(
    !!(await user.rpc("goos_bootstrap_account", { p_locale: "en" })).error,
  ).toBe(false);
  expect((await user.rpc("goos_context")).data?.has_platform_role).toBe(false);
  expect(
    !!(await owner.rpc("goos_bootstrap_account", { p_locale: "en" })).error,
  ).toBe(false);
  expect((await owner.rpc("goos_context")).data?.has_platform_role).toBe(true);
  await sql(
    "update app.platform_settings set name_th='Global Opportunity OS',name_en='Global Opportunity OS',flags='{}',logo_id=null,favicon_id=null,version=version+1 where singleton",
  );
  subject = await profile(user, "Live synthetic");
});
describe("Platform admin and brand authorization", () => {
  it("anonymous can read public branding but cannot mutate settings", async () => {
    const anon = createClient(runtime.apiUrl, runtime.anonKey, {
      auth: { persistSession: false },
    });
    expect((await anon.rpc("goos_public_settings")).data?.name_en).toBe(
      "Global Opportunity OS",
    );
    expect(
      (
        await anon.rpc("goos_save_settings", {
          p_name_th: "x",
          p_name_en: "x",
          p_flags: {},
          p_expected_version: 1,
        })
      ).error?.code,
    ).toBe("42501");
  });
  it("a platform role without MFA still cannot write", async () => {
    const s = await settings();
    expect(
      (
        await owner.rpc("goos_save_settings", {
          p_name_th: s.name_th,
          p_name_en: s.name_en,
          p_flags: {},
          p_expected_version: s.version,
        })
      ).error?.code,
    ).toBe("P0002");
    await mfa(owner);
  });
  it("ordinary users and org admins cannot promote themselves", async () => {
    expect(
      (
        await user.rpc("goos_manage_admin", {
          p_target: actors.platformUser.id,
          p_grant: true,
        })
      ).error?.code,
    ).toBe("P0002");
    expect((await user.rpc("goos_admins")).error?.code).toBe("P0002");
  });
  it("version conflicts and unknown feature keys fail without a write", async () => {
    const s = await settings();
    expect(
      (
        await owner.rpc("goos_save_settings", {
          p_name_th: s.name_th,
          p_name_en: s.name_en,
          p_flags: {},
          p_expected_version: s.version - 1,
        })
      ).error?.code,
    ).toBe("40001");
    expect(
      (
        await owner.rpc("goos_save_settings", {
          p_name_th: "x",
          p_name_en: "x",
          p_flags: { unknown: false },
          p_expected_version: s.version,
        })
      ).error?.code,
    ).toBe("23514");
    expect((await settings()).version).toBe(s.version);
  });
  it("PNG publication is atomic and binds declared dimensions", async () => {
    const s = await settings(),
      png = readFileSync("public/brand-defaults/favicon.png").toString(
        "base64",
      );
    const bad = await owner.rpc("goos_save_brand", {
      p_kind: "favicon",
      p_png: png,
      p_width: 192,
      p_height: 192,
      p_expected_version: s.version,
    });
    expect(bad.error?.code).toBe("22023");
    expect((await settings()).favicon_id).toBeNull();
    const good = await owner.rpc("goos_save_brand", {
      p_kind: "favicon",
      p_png: png,
      p_width: 512,
      p_height: 512,
      p_expected_version: s.version,
    });
    expect(!!good.error).toBe(false);
    expect(!!good.data?.favicon_id).toBe(true);
    const publicImage = await user.rpc("goos_brand_image", {
      p_kind: "favicon",
    });
    expect(publicImage.data?.body.replace(/\s/g, "") === png).toBe(true);
  });
  it("disabling branding blocks direct RPC upload/reset, not just the UI", async () => {
    const s = await settings();
    expect(
      !!(
        await owner.rpc("goos_save_settings", {
          p_name_th: s.name_th,
          p_name_en: s.name_en,
          p_flags: { branding: false },
          p_expected_version: s.version,
        })
      ).error,
    ).toBe(false);
    const n = await settings();
    expect(
      (
        await owner.rpc("goos_save_brand", {
          p_kind: "favicon",
          p_png: null,
          p_width: 0,
          p_height: 0,
          p_expected_version: n.version,
        })
      ).error?.message,
    ).toBe("feature_disabled");
    await owner.rpc("goos_save_settings", {
      p_name_th: n.name_th,
      p_name_en: n.name_en,
      p_flags: {},
      p_expected_version: n.version,
    });
  });
  it("restoring the default deletes the old image only after switching the reference", async () => {
    const s = await settings();
    const r = await owner.rpc("goos_save_brand", {
      p_kind: "favicon",
      p_png: null,
      p_width: 0,
      p_height: 0,
      p_expected_version: s.version,
    });
    expect(!!r.error).toBe(false);
    expect(r.data?.favicon_id).toBeNull();
    expect(
      (
        await sql("select id from private.brand_assets where id=$1", [
          s.favicon_id,
        ])
      ).length,
    ).toBe(0);
  });
  it("grants reach only the registered target; owner and self cannot be revoked", async () => {
    expect(
      !!(
        await owner.rpc("goos_manage_admin", {
          p_target: actors.platformOther.id,
          p_grant: true,
        })
      ).error,
    ).toBe(false);
    await mfa(other);
    expect(
      (
        await other.rpc("goos_manage_admin", {
          p_target: actors.platformOwner.id,
          p_grant: false,
        })
      ).error?.message,
    ).toBe("protected_owner");
    expect(
      (
        await other.rpc("goos_manage_admin", {
          p_target: actors.platformOther.id,
          p_grant: false,
        })
      ).error?.code,
    ).toBe("P0002");
  });
  it("revoked platform access is denied using the old JWT while normal account remains usable", async () => {
    const old = clientWithToken(await token(other));
    expect(
      !!(
        await owner.rpc("goos_manage_admin", {
          p_target: actors.platformOther.id,
          p_grant: false,
        })
      ).error,
    ).toBe(false);
    expect((await old.rpc("goos_admins")).error?.code).toBe("P0002");
    expect(!!(await old.rpc("goos_context")).error).toBe(false);
  });
  it("audit history cannot be read by ordinary users or mutated even by the migration role", async () => {
    expect((await user.rpc("goos_audit_events")).error?.code).toBe("P0002");
    await expect(
      sql("update private.audit_events set action=action where false"),
    ).rejects.toMatchObject({ code: "42501" });
    expect(!!(await owner.rpc("goos_export_audit")).error).toBe(false);
  });
});
describe("Live signals and notification isolation", () => {
  it("fingerprint changes after a profile mutation without leaking profile contents", async () => {
    const before = await user.rpc("goos_live_fingerprint");
    expect(
      !!(
        await user.rpc("goos_update_profile", {
          p_subject_id: subject,
          p_display_alias: "Updated synthetic",
          p_coarse_region: "",
          p_safe_contact: "none",
          p_expected_version: 1,
        })
      ).error,
    ).toBe(false);
    const after = await user.rpc("goos_live_fingerprint");
    expect(before.data.fingerprint).not.toBe(after.data.fingerprint);
    expect(JSON.stringify(after.data).includes("synthetic")).toBe(false);
  });
  it("only own topic and safe settings topic can be listened to", async () => {
    expect(
      (
        await user.rpc("goos_live_authorized", {
          p_topic: `goos:u:${actors.platformUser.id}`,
        })
      ).data,
    ).toBe(true);
    expect(
      (
        await user.rpc("goos_live_authorized", {
          p_topic: `goos:u:${actors.platformOwner.id}`,
        })
      ).data,
    ).toBe(false);
    expect(
      (await user.rpc("goos_live_authorized", { p_topic: "goos:settings" }))
        .data,
    ).toBe(true);
    expect(
      (
        await sql(
          "select has_schema_privilege('authenticated','private','usage') allowed",
        )
      )[0].allowed,
    ).toBe(false);
  });
  it("notifications are recipient-scoped; another user cannot mark them read", async () => {
    const rows = (await other.rpc("goos_notifications")).data;
    expect(rows.some((r: { kind: string }) => r.kind === "admin.granted")).toBe(
      true,
    );
    expect(
      (await user.rpc("goos_read_notice", { p_id: rows[0].id })).error?.code,
    ).toBe("P0002");
    expect(
      !!(await other.rpc("goos_read_notice", { p_id: rows[0].id })).error,
    ).toBe(false);
    expect((await user.rpc("goos_notifications")).data).toEqual([]);
  });
});
