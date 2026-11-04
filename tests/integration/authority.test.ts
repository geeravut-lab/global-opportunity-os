import { beforeAll, describe, expect, it } from "vitest";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import {
  actors,
  runtime,
  login,
  mfa,
  profile,
  noticeId,
  token,
  clientWithToken,
  sql,
  asApi,
} from "./helpers";
let a: SupabaseClient,
  b: SupabaseClient,
  helper: SupabaseClient,
  outsider: SupabaseClient,
  member: SupabaseClient,
  stale: SupabaseClient;
let subjectA: string,
  subjectB: string,
  orgA: string,
  orgB: string,
  readGrant: string,
  writeGrant: string,
  memberInvite: string,
  memberId: string,
  staleFactor: string;
beforeAll(async () => {
  [a, b, helper, outsider, member, stale] = await Promise.all(
    [
      actors.ownerA,
      actors.ownerB,
      actors.helper,
      actors.outsider,
      actors.member,
      actors.staleMfa,
    ].map(login),
  );
  subjectA = await profile(a, "Synthetic Owner A");
  subjectB = await profile(b, "Synthetic Owner B");
  await mfa(a);
  await mfa(b);
  staleFactor = await mfa(stale);
  const oa = await a.rpc("goos_create_organization", {
      p_name: "Synthetic Org A",
      p_country_code: "TH",
    }),
    ob = await b.rpc("goos_create_organization", {
      p_name: "Synthetic Org B",
      p_country_code: "TH",
    });
  if (oa.error || ob.error)
    throw Error(
      "fixture organization rejected: " +
        (oa.error?.message ?? ob.error?.message),
    );
  orgA = oa.data;
  orgB = ob.data;
}, 60000);
describe("Auth metadata และบทบาทฐานข้อมูลจริง", () => {
  it("API/authz roles ไม่เป็น superuser หรือ BYPASSRLS", async () => {
    const rows = await sql(
      "select rolname,rolsuper,rolbypassrls from pg_roles where rolname=any($1)",
      [["goos_api", "goos_authz"]],
    );
    expect(rows).toHaveLength(2);
    for (const r of rows) {
      expect(r.rolsuper).toBe(false);
      expect(r.rolbypassrls).toBe(false);
    }
  });
  it("ทุก domain/private table เปิด RLS", async () => {
    const rows = await sql(
      "select relname from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname in ('app','private') and c.relkind='r' and not c.relrowsecurity",
    );
    expect(rows).toHaveLength(0);
  });
  it("auth predicate แคบไม่เปิด EXECUTE ให้ browser", async () => {
    const rows = await sql(
      "select has_function_privilege('authenticated','private.goos_auth_identity()','execute') allowed, has_function_privilege('anon','private.goos_auth_identity()','execute') guest,pronargs from pg_proc where oid='private.goos_auth_identity()'::regprocedure",
    );
    expect(rows[0].allowed).toBe(false);
    expect(rows[0].guest).toBe(false);
    expect(rows[0].pronargs).toBe(0);
  });
  it("public goos RPC ทั้งหมดเป็นของบทบาท NOBYPASSRLS", async () => {
    const rows = await sql(
      "select p.proname from pg_proc p join pg_namespace n on n.oid=p.pronamespace join pg_roles r on r.oid=p.proowner where n.nspname='public' and p.proname like 'goos_%' and (r.rolname<>'goos_api' or r.rolbypassrls or r.rolsuper)",
    );
    expect(rows).toHaveLength(0);
  });
  it("guest เรียก bootstrap RPC ไม่ได้", async () => {
    const guest = createClient(runtime.apiUrl, runtime.anonKey, {
      auth: { persistSession: false },
    });
    const r = await guest.rpc("goos_bootstrap_account", { p_locale: "th" });
    expect(r.error?.code).toBe("42501");
  });
  it("JWT ที่แก้ payload โดยไม่มีลายเซ็นใหม่ถูกปฏิเสธ", async () => {
    const parts = (await token(outsider)).split(".");
    const claims = JSON.parse(Buffer.from(parts[1], "base64url").toString());
    claims.role = "service_role";
    parts[1] = Buffer.from(JSON.stringify(claims)).toString("base64url");
    const response = await fetch(runtime.apiUrl + "/rest/v1/rpc/goos_context", {
      method: "POST",
      headers: {
        apikey: runtime.anonKey,
        Authorization: "Bearer " + parts.join("."),
        "Content-Type": "application/json",
      },
      body: "{}",
    });
    expect(response.status).toBe(401);
  });
  it("แก้ user_metadata ไม่ได้ platform role", async () => {
    const update = await outsider.auth.updateUser({
      data: { role: "platform_admin", organization_id: orgA },
    });
    expect(!!update.error).toBe(false);
    await outsider.auth.refreshSession();
    const r = await outsider.rpc("goos_context");
    expect(r.data?.has_platform_role).toBe(false);
    const memberRows = await outsider.rpc("goos_members", { p_org: orgA });
    expect(memberRows.error?.code).toBe("P0002");
  });
});
describe("โปรไฟล์/consent/การมอบสิทธิ์", () => {
  it("เจ้าของอ่านได้ แต่ต่างคนและ org owner อื่นอ่านไม่ได้", async () => {
    expect(
      (await a.rpc("goos_profile", { p_subject_id: subjectA })).data?.own,
    ).toBe(true);
    expect(
      (await b.rpc("goos_profile", { p_subject_id: subjectA })).error?.code,
    ).toBe("P0002");
  });
  it("RLS จริงใน API role เห็น own row และไม่เห็นอีกคน แม้ไม่ผ่าน RPC", async () => {
    expect(
      await asApi(a, "select id from app.subjects where id=$1", [subjectA]),
    ).toHaveLength(1);
    expect(
      await asApi(a, "select id from app.subjects where id=$1", [subjectB]),
    ).toHaveLength(0);
  });
  it("authenticated ไม่มี direct table CRUD", async () => {
    const rows = await sql(
      "select has_schema_privilege('authenticated','app','usage') schema_access,has_table_privilege('authenticated','app.subjects','update') table_write",
    );
    expect(rows[0].schema_access).toBe(false);
    expect(rows[0].table_write).toBe(false);
  });
  it("API role เปลี่ยนเจ้าของโปรไฟล์ทางคอลัมน์ไม่ได้", async () => {
    await expect(
      asApi(a, "update app.subjects set account_id=$1 where id=$2", [
        actors.ownerB.id,
        subjectA,
      ]),
    ).rejects.toMatchObject({ code: "42501" });
  });
  it("minor/unknown และไม่ยืนยัน consent ไม่สร้าง subject", async () => {
    for (const age of ["minor", "unknown"]) {
      const r = await outsider.rpc("goos_create_profile", {
        p_display_alias: "Blocked synthetic",
        p_country_code: "TH",
        p_age_band: age,
        p_notice_id: noticeId,
        p_confirmed: true,
      });
      expect(r.error?.code).toBe("22023");
    }
    const r = await outsider.rpc("goos_create_profile", {
      p_display_alias: "Blocked synthetic",
      p_country_code: "TH",
      p_age_band: "adult",
      p_notice_id: noticeId,
      p_confirmed: false,
    });
    expect(r.error?.code).toBe("22023");
    expect((await outsider.rpc("goos_context")).data?.subject_id).toBeNull();
  });
  it("แก้โปรไฟล์ใช้ expected_version และไม่รัน HTML", async () => {
    const r = await a.rpc("goos_update_profile", {
      p_subject_id: subjectA,
      p_display_alias: "<script>synthetic</script>",
      p_coarse_region: "Test province",
      p_safe_contact: "none",
      p_expected_version: 1,
    });
    expect(r.data?.version).toBe(2);
    const staleWrite = await a.rpc("goos_update_profile", {
      p_subject_id: subjectA,
      p_display_alias: "Lost update",
      p_coarse_region: "",
      p_safe_contact: "none",
      p_expected_version: 1,
    });
    expect(staleWrite.error?.code).toBe("40001");
  });
  it("helper สร้าง grant ให้ตนเองบน subject คนอื่นไม่ได้", async () => {
    const r = await helper.rpc("goos_create_delegation", {
      p_subject_id: subjectA,
      p_delegate_id: actors.helper.id,
      p_scopes: ["profile:read"],
      p_expires_at: new Date(Date.now() + 3600000).toISOString(),
      p_notice_id: noticeId,
      p_confirmed: true,
    });
    expect(r.error?.code).toBe("P0002");
  });
  it("owner ให้ read-only ได้ โดยไม่เผย safe contact", async () => {
    const grant = await a.rpc("goos_create_delegation", {
      p_subject_id: subjectA,
      p_delegate_id: actors.helper.id,
      p_scopes: ["profile:read"],
      p_expires_at: new Date(Date.now() + 3600000).toISOString(),
      p_notice_id: noticeId,
      p_confirmed: true,
    });
    expect(!!grant.error).toBe(false);
    readGrant = grant.data;
    const p = await helper.rpc("goos_profile", { p_subject_id: subjectA });
    expect(p.data?.can_write).toBe(false);
    expect(p.data?.safe_contact).toBeNull();
  });
  it("read-only helper แก้ไขไม่ได้", async () => {
    const r = await helper.rpc("goos_update_profile", {
      p_subject_id: subjectA,
      p_display_alias: "Denied",
      p_coarse_region: "",
      p_safe_contact: null,
      p_expected_version: 2,
    });
    expect(r.error?.code).toBe("P0002");
  });
  it("ถอน grant ทำให้ token เดิมอ่านไม่ได้ทันที แต่ Auth token ยังใช้ได้", async () => {
    const old = clientWithToken(await token(helper));
    const revoked = await a.rpc("goos_revoke_delegation", {
      p_id: readGrant,
      p_expected_version: 1,
    });
    expect(!!revoked.error).toBe(false);
    expect(!!(await helper.auth.getUser()).error).toBe(false);
    expect(
      (await old.rpc("goos_profile", { p_subject_id: subjectA })).error?.code,
    ).toBe("P0002");
  });
  it("write grant แก้เฉพาะขอบเขตได้ ไม่เปลี่ยน contact", async () => {
    const g = await a.rpc("goos_create_delegation", {
      p_subject_id: subjectA,
      p_delegate_id: actors.helper.id,
      p_scopes: ["profile:read", "profile:write"],
      p_expires_at: new Date(Date.now() + 3600000).toISOString(),
      p_notice_id: noticeId,
      p_confirmed: true,
    });
    expect(!!g.error).toBe(false);
    writeGrant = g.data;
    const p = await helper.rpc("goos_update_profile", {
      p_subject_id: subjectA,
      p_display_alias: "Delegated alias",
      p_coarse_region: "Test area",
      p_safe_contact: null,
      p_expected_version: 2,
    });
    expect(p.data?.version).toBe(3);
    const bad = await helper.rpc("goos_update_profile", {
      p_subject_id: subjectA,
      p_display_alias: "Denied",
      p_coarse_region: "",
      p_safe_contact: "email",
      p_expected_version: 3,
    });
    expect(bad.error?.code).toBe("P0002");
  });
  it("grant ที่หมดอายุปฏิเสธโดยไม่รอ background job", async () => {
    const g = await a.rpc("goos_create_delegation", {
      p_subject_id: subjectA,
      p_delegate_id: actors.outsider.id,
      p_scopes: ["profile:read"],
      p_expires_at: new Date(Date.now() + 3600000).toISOString(),
      p_notice_id: noticeId,
      p_confirmed: true,
    });
    expect(!!g.error).toBe(false);
    await sql(
      "update app.delegations set expires_at=starts_at+interval '1 millisecond' where id=$1",
      [g.data],
    );
    expect(
      (await outsider.rpc("goos_profile", { p_subject_id: subjectA })).error
        ?.code,
    ).toBe("P0002");
  });
  it("ไม่รับ scope/expiry ที่อยู่นอกขอบเขต", async () => {
    const r = await a.rpc("goos_create_delegation", {
      p_subject_id: subjectA,
      p_delegate_id: actors.outsider.id,
      p_scopes: ["platform:admin"],
      p_expires_at: new Date(Date.now() + 3600000).toISOString(),
      p_notice_id: noticeId,
      p_confirmed: true,
    });
    expect(r.error?.code).toBe("22023");
  });
  it("consent append-only มี grant/withdraw แต่ helper ไม่เห็นประวัติเจ้าของ", async () => {
    const r = await a.rpc("goos_consents");
    expect(
      r.data.some((event: { action: string }) => event.action === "withdrawn"),
    ).toBe(true);
    expect((await helper.rpc("goos_consents")).data).toHaveLength(0);
    const grants = await sql(
      "select has_table_privilege('goos_api','private.consent_events','update') can_update,has_table_privilege('goos_api','private.audit_events','delete') can_delete",
    );
    expect(grants[0].can_update).toBe(false);
    expect(grants[0].can_delete).toBe(false);
  });
  it("helper ถอน grant ของ owner ไม่ได้", async () => {
    const r = await helper.rpc("goos_revoke_delegation", {
      p_id: writeGrant,
      p_expected_version: 1,
    });
    expect(r.error?.code).toBe("P0002");
  });
});
describe("องค์กรและ MFA/สมาชิกปัจจุบัน", () => {
  it("AAL1 สร้างองค์กรไม่ได้", async () => {
    const r = await member.rpc("goos_create_organization", {
      p_name: "Denied org",
      p_country_code: "TH",
    });
    expect(r.error?.message).toBe("mfa_required");
  });
  it("องค์กรใหม่เป็น draft และ owner คนละ tenant เปิด roster ไม่ได้", async () => {
    const r = await a.rpc("goos_organizations");
    expect(r.data.find((org: { id: string }) => org.id === orgA)?.status).toBe(
      "draft",
    );
    expect((await b.rpc("goos_members", { p_org: orgA })).error?.code).toBe(
      "P0002",
    );
    expect((await a.rpc("goos_members", { p_org: orgB })).error?.code).toBe(
      "P0002",
    );
  });
  it("ปฏิเสธ role escalation และยังไม่ให้สิทธิ์ก่อนรับ invitation", async () => {
    const denied = await a.rpc("goos_invite_member", {
      p_org: orgA,
      p_recipient: actors.member.id,
      p_role: "platform_admin",
    });
    expect(denied.error?.code).toBe("22023");
    const r = await a.rpc("goos_invite_member", {
      p_org: orgA,
      p_recipient: actors.member.id,
      p_role: "caseworker",
    });
    expect(!!r.error).toBe(false);
    memberInvite = r.data;
    expect((await member.rpc("goos_organizations")).data).toHaveLength(0);
  });
  it("invitation ต้องผู้รับที่ตรงและ MFA ก่อนยอมรับ", async () => {
    expect(
      (await b.rpc("goos_accept_invitation", { p_id: memberInvite })).error
        ?.code,
    ).toBe("P0002");
    expect(
      (await member.rpc("goos_accept_invitation", { p_id: memberInvite })).error
        ?.message,
    ).toBe("mfa_required");
    await mfa(member);
    const r = await member.rpc("goos_accept_invitation", {
      p_id: memberInvite,
    });
    expect(!!r.error).toBe(false);
    memberId = r.data;
  });
  it("caseworker ไม่มี roster/admin authority และไม่ได้ profile ผู้รับประโยชน์", async () => {
    expect(
      (await member.rpc("goos_members", { p_org: orgA })).error?.code,
    ).toBe("P0002");
    expect(
      (
        await member.rpc("goos_invite_member", {
          p_org: orgA,
          p_recipient: actors.outsider.id,
          p_role: "admin",
        })
      ).error?.code,
    ).toBe("P0002");
    expect(
      (await member.rpc("goos_profile", { p_subject_id: subjectA })).error
        ?.code,
    ).toBe("P0002");
  });
  it("revoked membership ถูกปฏิเสธด้วย JWT เดิมทันที", async () => {
    const old = clientWithToken(await token(member));
    const r = await a.rpc("goos_revoke_member", {
      p_org: orgA,
      p_member: memberId,
      p_expected_version: 1,
    });
    expect(!!r.error).toBe(false);
    expect((await old.rpc("goos_organizations")).data).toHaveLength(0);
    expect((await old.rpc("goos_members", { p_org: orgA })).error?.code).toBe(
      "P0002",
    );
    expect(!!(await member.auth.getUser()).error).toBe(false);
  });
  it("ถอน owner คนสุดท้ายไม่ได้", async () => {
    const rows = await a.rpc("goos_members", { p_org: orgA });
    const owner = rows.data.find(
      (m: { account_id: string }) => m.account_id === actors.ownerA.id,
    );
    const r = await a.rpc("goos_revoke_member", {
      p_org: orgA,
      p_member: owner.id,
      p_expected_version: owner.version,
    });
    expect(r.error?.message).toBe("last_owner");
  });
  it("ยกเลิก invitation แล้วผู้รับรับไม่ได้", async () => {
    const i = await a.rpc("goos_invite_member", {
      p_org: orgA,
      p_recipient: actors.ownerB.id,
      p_role: "catalog_editor",
    });
    expect(!!i.error).toBe(false);
    const c = await a.rpc("goos_cancel_invitation", { p_id: i.data });
    expect(!!c.error).toBe(false);
    expect(
      (await b.rpc("goos_accept_invitation", { p_id: i.data })).error?.code,
    ).toBe("P0002");
  });
  it("stale AAL2 หลังถอด factor ใช้สิทธิ์เจ้าหน้าที่ไม่ได้", async () => {
    const old = clientWithToken(await token(stale));
    const removed = await stale.auth.mfa.unenroll({ factorId: staleFactor });
    expect(!!removed.error).toBe(false);
    const r = await old.rpc("goos_create_organization", {
      p_name: "Denied stale MFA",
      p_country_code: "TH",
    });
    expect(["42501", "28000"]).toContain(r.error?.code);
  });
  it("session denylist ปฏิเสธ access token ที่ Auth ยังยืนยันได้", async () => {
    const current = await login(actors.logout),
      old = clientWithToken(await token(current));
    expect(!!(await current.rpc("goos_context")).error).toBe(false);
    expect(!!(await current.rpc("goos_revoke_current_session")).error).toBe(
      false,
    );
    expect(!!(await current.auth.getUser()).error).toBe(false);
    expect((await old.rpc("goos_context")).error?.code).toBe("28000");
  });
});
