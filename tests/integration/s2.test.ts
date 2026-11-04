import { beforeAll, afterAll, describe, it, expect } from "vitest";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { randomUUID, randomBytes } from "node:crypto";
import { readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import {
  runtime,
  sql,
  mfa,
  profile,
  token,
  clientWithToken,
  asApi,
} from "./helpers";
const noticeId = "00000000-0000-4000-8000-000000000101";
const run = "s2" + randomBytes(6).toString("hex"),
  clients: SupabaseClient[] = [],
  ids: string[] = [];
let org: string,
  orgB: string,
  evidence: string,
  listing: string,
  subject: string;
const rpc = async (
  c: SupabaseClient,
  n: string,
  args: Record<string, unknown> = {},
) => {
  const r = await c.rpc(n, args);
  if (r.error) throw Error(n + ": " + r.error.code + " " + r.error.message);
  return r.data;
};
const admin = createClient(runtime.apiUrl, runtime.serviceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const current = () => new Date(Date.now() + 86400000 * 30).toISOString();
async function organization(c = clients[0], id = org, review = false) {
  return (await rpc(c, "goos_s2_orgs", { p_review: review })).find(
    (o: { id: string }) => o.id === id,
  );
}
async function transition(
  action: string,
  c = clients[0],
  reason = "Synthetic test decision",
) {
  const o = await organization(c, org, c !== clients[0]);
  return rpc(c, "goos_s2_transition_org", {
    p_org: org,
    p_action: action,
    p_reason: reason,
    p_expires: current(),
    p_expected_version: o.version,
  });
}
async function draft(c = clients[0], orgId = org) {
  return (await rpc(c, "goos_s2_listings", { p_org: orgId })).find(
    (x: { id: string }) => x.id === listing,
  );
}
const input = () => ({
  title_th: "โอกาสทักษะ " + run,
  title_en: "Synthetic skills " + run,
  description_th: "โอกาสสมมติสำหรับทดสอบ ไม่ใช่บริการจริง",
  description_en: "Synthetic opportunity; no real service.",
  category: "skills",
  country_code: "TH",
  coarse_region: "",
  languages: ["th", "en"],
  remote: true,
  cost_amount: 0,
  currency: "THB",
  accessibility_th: "เนื้อหาอ่านด้วยคีย์บอร์ด",
  accessibility_en: "Keyboard accessible text",
  source_url: "https://example.invalid/" + run,
  valid_until: current(),
  capacity: null,
  rules: [
    { field: "country", op: "eq", value: "TH" },
    { field: "hours", op: "gte", value: 5 },
  ],
});
beforeAll(async () => {
  await sql("notify pgrst,'reload schema'");
  for (let i = 0; i < 5; i++) {
    const email = run + "-" + i + "@example.test",
      password = "S2-" + randomBytes(20).toString("base64url");
    const u = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      app_metadata: { goos_s2_fixture_run: run },
    });
    if (u.error || !u.data.user) throw Error("S2 fixture creation");
    ids.push(u.data.user.id);
    const c = createClient(runtime.apiUrl, runtime.anonKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    if ((await c.auth.signInWithPassword({ email, password })).error)
      throw Error("S2 fixture login");
    clients.push(c);
    await rpc(c, "goos_bootstrap_account", { p_locale: "th" });
    if (i > 0 && i < 4) await mfa(c);
  }
  for (const i of [2, 3])
    await sql(
      "insert into private.platform_role_grants(account_id,granted_by,role_code) values($1,$1,'platform_admin')",
      [ids[i]],
    );
  subject = await profile(clients[0], "Synthetic S2 adult");
  await profile(clients[4], "Synthetic other adult");
});
afterAll(async () => {
  if (ids.length < 4) return;
  await sql(
    "update private.platform_role_grants g set revoked_at=coalesce(g.revoked_at,now()) where g.account_id=any($1::uuid[]) and g.granted_by=g.account_id and not exists(select 1 from private.platform_owner p where p.account_id=g.account_id) and exists(select 1 from auth.users u where u.id=g.account_id and u.raw_app_meta_data->>'goos_s2_fixture_run'=$2)",
    [ids.slice(2, 4), run],
  );
});
describe("S2 lifecycle, private evidence and matching", () => {
  it("staff writes require real MFA; metadata cannot confer review authority", async () => {
    expect(
      (
        await clients[0].rpc("goos_create_organization", {
          p_name: run,
          p_country_code: "TH",
        })
      ).error?.message,
    ).toBe("mfa_required");
    await mfa(clients[0]);
    org = await rpc(clients[0], "goos_create_organization", {
      p_name: run + " A",
      p_country_code: "TH",
    });
    orgB = await rpc(clients[1], "goos_create_organization", {
      p_name: run + " B",
      p_country_code: "TH",
    });
    expect(
      (await clients[0].rpc("goos_s2_orgs", { p_review: true })).error?.code,
    ).toBe("P0002");
  });
  it("quarantine has no download and cannot be marked clean through user RPC/grants", async () => {
    evidence = await rpc(clients[0], "goos_s2_upload_intent", { p_org: org });
    expect(
      (
        await clients[1].rpc("goos_s2_upload", {
          p_id: evidence,
          p_png: readFileSync("public/brand-defaults/favicon.png").toString(
            "base64",
          ),
        })
      ).error?.code,
    ).toBe("P0002");
    await rpc(clients[0], "goos_s2_upload", {
      p_id: evidence,
      p_png: readFileSync("public/brand-defaults/favicon.png").toString(
        "base64",
      ),
    });
    expect(
      (await clients[0].rpc("goos_s2_download", { p_id: evidence })).error
        ?.code,
    ).toBe("P0002");
    await expect(
      asApi(
        clients[0],
        "update private.org_evidence set status='clean',inspection='png-decoded-reencoded-v1' where id=$1",
        [evidence],
      ),
    ).rejects.toThrow();
    await expect(transition("submit")).rejects.toThrow(
      /clean_evidence_required/,
    );
  });
  it("worker decodes/re-encodes PNG; forged PNG headers and expired intents fail closed", async () => {
    const bad = await rpc(clients[0], "goos_s2_upload_intent", { p_org: org });
    await rpc(clients[0], "goos_s2_upload", {
      p_id: bad,
      p_png: Buffer.concat([
        Buffer.from("89504e470d0a1a0a", "hex"),
        Buffer.alloc(100),
      ]).toString("base64"),
    });
    execFileSync(process.execPath, ["scripts/process-evidence.mjs", evidence], {
      stdio: "pipe",
    });
    execFileSync(process.execPath, ["scripts/process-evidence.mjs", bad], {
      stdio: "pipe",
    });
    const rows = await rpc(clients[0], "goos_s2_evidence", { p_org: org });
    expect(rows.find((x: { id: string }) => x.id === bad).status).toBe(
      "rejected",
    );
    expect(rows.find((x: { id: string }) => x.id === evidence).status).toBe(
      "clean",
    );
    expect(
      (await rpc(clients[0], "goos_s2_download", { p_id: evidence })).hash,
    ).toMatch(/^[a-f0-9]{64}$/);
    expect(
      (await clients[1].rpc("goos_s2_download", { p_id: evidence })).error
        ?.code,
    ).toBe("P0002");
    const expired = await rpc(clients[0], "goos_s2_upload_intent", {
      p_org: org,
    });
    await sql(
      "update private.org_evidence set upload_expires_at=now()-interval '1 minute' where id=$1",
      [expired],
    );
    expect(
      (
        await clients[0].rpc("goos_s2_upload", {
          p_id: expired,
          p_png: readFileSync("public/brand-defaults/favicon.png").toString(
            "base64",
          ),
        })
      ).error?.code,
    ).toBe("P0002");
  });
  it("owner cannot self-review; independent assigned verifier and optimistic versions are enforced", async () => {
    await transition("submit");
    expect(
      (
        await clients[0].rpc("goos_s2_transition_org", {
          p_org: org,
          p_action: "verify",
          p_reason: "self",
          p_expires: current(),
          p_expected_version: (await organization()).version,
        })
      ).error?.code,
    ).toBe("P0002");
    await transition("start_review", clients[2]);
    await expect(transition("verify", clients[3])).rejects.toThrow(/P0002/);
    expect(
      (
        await clients[2].rpc("goos_s2_transition_org", {
          p_org: org,
          p_action: "verify",
          p_reason: "stale",
          p_expires: current(),
          p_expected_version: 1,
        })
      ).error?.code,
    ).toBe("40001");
    await transition("verify", clients[2]);
    expect((await organization()).status).toBe("verified");
  });
  it("catalog draft/other-tenant access is denied; a reviewed revision is public", async () => {
    expect(
      (
        await clients[1].rpc("goos_s2_save_listing", {
          p_org: org,
          p_id: null,
          p_data: input(),
          p_expected_version: 0,
        })
      ).error?.code,
    ).toBe("P0002");
    listing = await rpc(clients[0], "goos_s2_save_listing", {
      p_org: org,
      p_id: null,
      p_data: input(),
      p_expected_version: 0,
    });
    const anon = createClient(runtime.apiUrl, runtime.anonKey, {
      auth: { persistSession: false },
    });
    expect(
      (await rpc(anon, "goos_s2_catalog", { p_filter: { q: run } })).items,
    ).toHaveLength(0);
    await rpc(clients[0], "goos_s2_submit_listing", {
      p_id: listing,
      p_expected_version: (await draft()).version,
    });
    expect(
      (
        await clients[0].rpc("goos_s2_review_listing", {
          p_id: listing,
          p_action: "publish",
          p_reason: "self",
          p_expected_version: (await draft()).version,
        })
      ).error?.code,
    ).toBe("P0002");
    await rpc(clients[2], "goos_s2_review_listing", {
      p_id: listing,
      p_action: "publish",
      p_reason: "Synthetic review",
      p_expected_version: (await draft()).version,
    });
    const publicRows = await rpc(anon, "goos_s2_catalog", {
      p_filter: { q: run },
    });
    expect(publicRows.items).toHaveLength(1);
    expect(publicRows.items[0].title_th).toContain("โอกาสทักษะ");
    expect(JSON.stringify(publicRows)).not.toMatch(
      /created_by|actor_id|original_body|safe_body|uploaded_by|reason/,
    );
    expect(
      (await rpc(anon, "goos_s2_catalog", { p_filter: { q: "%" } })).items,
    ).toHaveLength(0);
    expect(
      (
        await rpc(anon, "goos_s2_catalog", {
          p_filter: { q: run, country: "US" },
        })
      ).items,
    ).toHaveLength(0);
  });
  it("direct user table access and revision edits are denied", async () => {
    const id = (await draft()).revision.id;
    await expect(
      asApi(
        clients[0],
        "update app.opportunity_revisions set title_th='tamper' where id=$1",
        [id],
      ),
    ).rejects.toThrow();
    await expect(
      sql(
        "update app.opportunity_revisions set title_th='tamper' where id=$1",
        [id],
      ),
    ).rejects.toThrow(/append_only/);
    const tables = await sql(
      "select table_name from information_schema.role_table_grants where grantee in('anon','authenticated') and table_schema in('app','private') and table_name in('org_evidence','opportunities','opportunity_revisions','assessments','bookmarks')",
    );
    expect(tables).toHaveLength(0);
  });
  it("assessment is own-only, skippable, consented and versioned; rules preserve unknown", async () => {
    expect(
      (
        await clients[4].rpc("goos_s2_save_assessment", {
          p_subject: subject,
          p_data: {},
          p_notice: noticeId,
          p_confirmed: true,
          p_expected_version: 0,
        })
      ).error?.code,
    ).toBe("P0002");
    await rpc(clients[0], "goos_s2_save_assessment", {
      p_subject: subject,
      p_data: { goals: [] },
      p_notice: noticeId,
      p_confirmed: false,
      p_expected_version: 0,
    });
    expect((await clients[0].rpc("goos_s2_matches")).error?.message).toBe(
      "confirmed_assessment_required",
    );
    await rpc(clients[0], "goos_s2_save_assessment", {
      p_subject: subject,
      p_data: { goals: ["skills"], country_code: "TH" },
      p_notice: noticeId,
      p_confirmed: true,
      p_expected_version: 1,
    });
    const first = (await rpc(clients[0], "goos_s2_matches")).find(
      (x: { id: string }) => x.id === listing,
    );
    expect(first.match.status).toBe("unknown");
    expect(first.match.reasons).toContainEqual({
      field: "hours",
      op: "gte",
      expected: 5,
      status: "unknown",
    });
    await rpc(clients[0], "goos_s2_save_assessment", {
      p_subject: subject,
      p_data: {
        goals: ["skills"],
        country_code: "TH",
        available_hours_week: 8,
        remote_ok: true,
      },
      p_notice: noticeId,
      p_confirmed: true,
      p_expected_version: 2,
    });
    expect(
      (await rpc(clients[0], "goos_s2_matches")).find(
        (x: { id: string }) => x.id === listing,
      ).match.status,
    ).toBe("eligible");
    expect(
      (
        await clients[0].rpc("goos_s2_save_assessment", {
          p_subject: subject,
          p_data: {},
          p_notice: noticeId,
          p_confirmed: true,
          p_expected_version: 1,
        })
      ).error?.code,
    ).toBe("40001");
    expect(await rpc(clients[4], "goos_s2_assessment")).toBeNull();
  });
  it("bookmarks are idempotent and isolated; expired org disappears at read time", async () => {
    await rpc(clients[0], "goos_s2_bookmark", { p_id: listing, p_saved: true });
    await rpc(clients[0], "goos_s2_bookmark", { p_id: listing, p_saved: true });
    expect(await rpc(clients[0], "goos_s2_bookmarks")).toHaveLength(1);
    expect(await rpc(clients[4], "goos_s2_bookmarks")).toHaveLength(0);
    await sql(
      "update app.organizations set verification_expires_at=now()-interval '1 second' where id=$1",
      [org],
    );
    expect(
      (await rpc(clients[4], "goos_s2_catalog", { p_id: listing })).items,
    ).toHaveLength(0);
    expect((await rpc(clients[0], "goos_s2_bookmarks"))[0].available).toBe(
      false,
    );
    expect((await rpc(clients[0], "goos_s2_bookmarks"))[0].title_th).toBeNull();
    expect(
      (await rpc(clients[0], "goos_s2_matches")).find(
        (x: { id: string }) => x.id === listing,
      ),
    ).toBeUndefined();
    await sql(
      "update app.organizations set verification_expires_at=$2 where id=$1",
      [org, current()],
    );
  });
  it("review queues are paged and evidence batches cannot cross permissions or expose bytes", async () => {
    const rows = await rpc(clients[0], "goos_s2_evidence_batch", {
      p_orgs: [org, orgB],
    });
    expect(Object.keys(rows)).toEqual([org]);
    expect(JSON.stringify(rows)).not.toMatch(
      /original_body|safe_body|uploaded_by/,
    );
    expect(
      await rpc(clients[0], "goos_s2_orgs", { p_review: false, p_page: 2 }),
    ).toEqual([]);
    expect(
      (await clients[0].rpc("goos_s2_orgs", { p_page: 101 })).error?.code,
    ).toBe("22023");
    expect(
      (
        await clients[0].rpc("goos_s2_evidence_batch", {
          p_orgs: Array(21).fill(org),
        })
      ).error?.code,
    ).toBe("22023");
    expect(
      (await clients[4].rpc("goos_s2_evidence_batch", { p_orgs: [org] })).error
        ?.message,
    ).toBe("mfa_required");
  });
  it("private drafts do not change another user's fingerprint but public pause does", async () => {
    const before = (await rpc(clients[4], "goos_live_fingerprint")).fingerprint;
    await rpc(clients[0], "goos_s2_save_listing", {
      p_org: org,
      p_id: null,
      p_data: { ...input(), title_en: "Private draft " + run },
      p_expected_version: 0,
    });
    expect((await rpc(clients[4], "goos_live_fingerprint")).fingerprint).toBe(
      before,
    );
    await rpc(clients[2], "goos_s2_review_listing", {
      p_id: listing,
      p_action: "pause",
      p_reason: "Synthetic public pause",
      p_expected_version: (await draft()).version,
    });
    expect(
      (await rpc(clients[4], "goos_live_fingerprint")).fingerprint,
    ).not.toBe(before);
  });
  it("material edits require review again; job terms and executable rules are rejected", async () => {
    await rpc(clients[0], "goos_s2_save_listing", {
      p_org: org,
      p_id: listing,
      p_data: { ...input(), title_en: "Material revision " + run },
      p_expected_version: (await draft()).version,
    });
    expect(
      (await rpc(clients[4], "goos_s2_catalog", { p_id: listing })).items,
    ).toHaveLength(0);
    expect(
      (
        await clients[0].rpc("goos_s2_save_listing", {
          p_org: org,
          p_id: null,
          p_data: {
            ...input(),
            rules: [{ field: "sql", op: "eq", value: "true" }],
          },
          p_expected_version: 0,
        })
      ).error?.code,
    ).toBe("23514");
    expect(
      (
        await clients[0].rpc("goos_s2_save_listing", {
          p_org: org,
          p_id: null,
          p_data: { ...input(), category: "jobs" },
          p_expected_version: 0,
        })
      ).error?.code,
    ).toBe("23514");
  });
  it("revoked membership denies held JWT on org/evidence/catalog; appeal needs a different reviewer", async () => {
    const held = clientWithToken(await token(clients[1]));
    await sql(
      "update app.org_memberships set status='revoked' where organization_id=$1 and account_id=$2",
      [orgB, ids[1]],
    );
    expect(
      (await held.rpc("goos_s2_upload_intent", { p_org: orgB })).error?.code,
    ).toBe("P0002");
    expect(
      (await held.rpc("goos_s2_evidence", { p_org: orgB })).error?.code,
    ).toBe("P0002");
    await transition("suspend", clients[2]);
    await transition("appeal");
    await expect(transition("start_review", clients[2])).rejects.toThrow(
      /independent_appeal_required/,
    );
    await transition("start_review", clients[3]);
    await transition("verify", clients[3]);
    expect((await organization()).status).toBe("verified");
  });
  it("assessment consent uses its own immutable notice and records each confirmation version", async () => {
    expect(
      (await rpc(clients[0], "goos_notices", { p_locale: "th" })).some(
        (n: { id: string }) => n.id === noticeId,
      ),
    ).toBe(false);
    expect(
      (await rpc(clients[0], "goos_s2_notices", { p_locale: "th" }))[0].id,
    ).toBe(noticeId);
    const a = await rpc(clients[0], "goos_s2_assessment");
    expect(
      (
        await clients[0].rpc("goos_s2_save_assessment", {
          p_subject: subject,
          p_data: { goals: [] },
          p_notice: "00000000-0000-4000-8000-000000000001",
          p_confirmed: true,
          p_expected_version: a.version,
        })
      ).error?.code,
    ).toBe("22023");
    const events = await rpc(clients[0], "goos_s2_assessment_events");
    expect(events).toHaveLength(3);
    expect(events[0].version).toBe(3);
    expect(events[0].notice_id).toBe(noticeId);
    expect(await rpc(clients[4], "goos_s2_assessment_events")).toHaveLength(0);
    await expect(
      sql(
        "update private.assessment_consents set action='drafted' where subject_id=$1",
        [subject],
      ),
    ).rejects.toThrow(/append_only/);
    await expect(
      sql("update app.notice_versions set body='changed' where id=$1", [
        noticeId,
      ]),
    ).rejects.toThrow(/append_only/);
    expect(
      (
        await clients[4].rpc("goos_create_profile", {
          p_display_alias: "invalid",
          p_country_code: "TH",
          p_age_band: "adult",
          p_notice_id: noticeId,
          p_confirmed: true,
        })
      ).error?.message,
    ).toBe("notice_required");
  });
  it("null/stale versions cannot bypass concurrency and racing updates have one winner", async () => {
    const a = await rpc(clients[0], "goos_s2_assessment");
    expect(
      (
        await clients[0].rpc("goos_s2_save_assessment", {
          p_subject: subject,
          p_data: { goals: [] },
          p_notice: noticeId,
          p_confirmed: true,
          p_expected_version: null,
        })
      ).error?.code,
    ).toBe("40001");
    const args = {
      p_subject: subject,
      p_data: {
        goals: ["skills"],
        country_code: "TH",
        remote_ok: true,
        available_hours_week: 8,
      },
      p_notice: noticeId,
      p_confirmed: true,
      p_expected_version: a.version,
    };
    const race = await Promise.all([
      clients[0].rpc("goos_s2_save_assessment", args),
      clients[0].rpc("goos_s2_save_assessment", args),
    ]);
    expect(race.filter((x) => !x.error)).toHaveLength(1);
    expect(race.find((x) => x.error)?.error?.code).toBe("40001");
  });
  it("assessment scope never follows a profile delegation and unknown IDs reveal nothing", async () => {
    await rpc(clients[0], "goos_create_delegation", {
      p_subject_id: subject,
      p_delegate_id: ids[4],
      p_scopes: ["profile:read", "profile:write"],
      p_expires_at: current(),
      p_notice_id: "00000000-0000-4000-8000-000000000001",
      p_confirmed: true,
    });
    expect(
      (
        await clients[4].rpc("goos_s2_save_assessment", {
          p_subject: subject,
          p_data: { goals: ["jobs"] },
          p_notice: noticeId,
          p_confirmed: true,
          p_expected_version: 3,
        })
      ).error?.code,
    ).toBe("P0002");
    expect(
      (await clients[4].rpc("goos_s2_download", { p_id: randomUUID() })).error
        ?.code,
    ).toBe("P0002");
  });
});
