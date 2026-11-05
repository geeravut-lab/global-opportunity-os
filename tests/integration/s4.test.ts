import { beforeAll, describe, expect, it } from "vitest";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import pg from "pg";
import sharp from "sharp";
import { runtime, sql, asApi } from "./helpers";
import { syntheticTotp } from "../../scripts/validation-runtime";
import { inspectEvidence } from "../../lib/maintenance/worker.mjs";
type Actor = {
  id: string;
  email: string;
  password: string;
  factorId?: string;
  totp?: string;
};
type Fixture = {
  sourceCase: string;
  sourceApplication: string;
  targetOrg: string;
  targetListing: string;
  thirdOrg: string;
  org: string;
  members: Record<string, string>;
  targetMembers: Record<string, string>;
  subjects: Record<string, string>;
  actors: Record<string, Actor>;
};
let f: Fixture;
const c: Record<string, SupabaseClient> = {};
const notice = "00000000-0000-4000-8000-000000000402";
let referral: string, caseId: string, outcome: string;
async function rpc(
  client: SupabaseClient,
  name: string,
  args: Record<string, unknown> = {},
) {
  const r = await client.rpc(name, args);
  if (r.error) throw Error(name + ": " + r.error.code + " " + r.error.message);
  return r.data;
}
const detail = (kind: string, id: string, client = c.user) =>
  rpc(client, "goos_s4_detail", { p_kind: kind, p_id: id });
const meta = async (kind: string, id: string, client = c.user) =>
  (await detail(kind, id, client)).row;
async function target() {
  const id = randomUUID(),
    revision = randomUUID();
  await sql("insert into app.opportunities(id,organization_id) values($1,$2)", [
    id,
    f.targetOrg,
  ]);
  await sql(
    "insert into app.opportunity_revisions select (jsonb_populate_record(null::app.opportunity_revisions,to_jsonb(r)||jsonb_build_object('id',$1::text,'opportunity_id',$2::text,'revision_no',1))).* from app.opportunity_revisions r join app.opportunities p on p.approved_revision_id=r.id where p.id=$3",
    [revision, id, f.targetListing],
  );
  await sql(
    "update app.opportunities set state='published',approved_revision_id=$2 where id=$1",
    [id, revision],
  );
  await sql(
    "insert into private.catalog_reviews(opportunity_id,revision_id,actor_id,decision,reason) values($1,$2,$3,'publish','Synthetic S4 fixture review')",
    [id, revision, f.actors.reviewer.id],
  );
  return id;
}
async function proposed() {
  return rpc(c.worker, "goos_s4_propose", {
    p_case: f.sourceCase,
    p_opportunity: await target(),
    p_purpose: "service_support",
  }) as Promise<string>;
}
async function preview(id: string) {
  return rpc(c.user, "goos_s4_preview", {
    p_id: id,
    p_fields: ["display_alias", "country_code"],
    p_skills: [],
    p_notice: notice,
  });
}
const submit = (p: { id: string; hash: string }, key = randomUUID()) =>
  rpc(c.user, "goos_s4_submit", {
    p_preview: p.id,
    p_hash: p.hash,
    p_notice: notice,
    p_confirmed: true,
    p_key: key,
  });
async function pending() {
  const id = await proposed();
  await submit(await preview(id));
  return id;
}
async function accept(id: string) {
  const v = (await meta("referrals", id)).version;
  return rpc(c.outsider, "goos_s4_referral_action", {
    p_id: id,
    p_action: "accept",
    p_version: v,
    p_member: f.targetMembers.replacement,
  });
}
async function reportOutcome(id = caseId) {
  return rpc(c.replacement, "goos_s4_outcome_create", {
    p_case: id,
    p_kind: "service_delivered",
    p_start: "2026-11-01",
    p_end: "2026-11-03",
    p_occurred: "2026-11-03T08:00:00Z",
    p_body: "Synthetic service report",
    p_corrects: null,
  }) as Promise<string>;
}
async function assign(
  kind: string,
  id: string,
  account: string,
  version: number,
) {
  return rpc(c.reviewer, "goos_s4_assign", {
    p_kind: kind,
    p_id: id,
    p_account: account,
    p_expires: new Date(Date.now() + 86400000).toISOString(),
    p_version: version,
  });
}
async function outcomeAction(id: string, action: string, client = c.user) {
  return rpc(client, "goos_s4_outcome_action", {
    p_id: id,
    p_action: action,
    p_version: (await meta("outcomes", id, client)).version,
    p_alternate: null,
  });
}
async function privacyAction(
  id: string,
  action: string,
  reason: string | null = null,
  client = c.privacy,
) {
  return rpc(client, "goos_s4_privacy_action", {
    p_id: id,
    p_action: action,
    p_version: (await meta("privacy", id, client)).version,
    p_reason: reason,
  });
}
beforeAll(async () => {
  execFileSync(process.execPath, ["scripts/seed-s4-fixtures.mjs"], {
    stdio: "pipe",
    timeout: 180000,
  });
  f = JSON.parse(readFileSync(".local/s4-fixtures.json", "utf8"));
  for (const [name, a] of Object.entries(f.actors)) {
    const cl = createClient(runtime.apiUrl, runtime.anonKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const r = await cl.auth.signInWithPassword({
      email: a.email,
      password: a.password,
    });
    if (r.error) throw Error("S4 login");
    if (a.factorId) {
      const m = await cl.auth.mfa.challengeAndVerify({
        factorId: a.factorId,
        code: syntheticTotp(a.totp!),
      });
      if (m.error) throw Error("S4 MFA");
    }
    c[name] = cl;
  }
}, 200000);
describe("S4 referral isolation and explicit consent", () => {
  it("proposes without sharing; source worker and helper cannot consent for the beneficiary", async () => {
    referral = await proposed();
    expect(
      (
        await c.outsider.rpc("goos_s4_detail", {
          p_kind: "referrals",
          p_id: referral,
        })
      ).error?.code,
    ).toBe("P0002");
    for (const client of [c.worker, c.delegate, c.second])
      expect(
        (
          await client.rpc("goos_s4_preview", {
            p_id: referral,
            p_fields: ["display_alias"],
            p_skills: [],
            p_notice: notice,
          })
        ).error?.code,
      ).toBe("P0002");
    expect(
      (
        await sql(
          "select count(*)::int n from private.s4_packages where referral_id=$1",
          [referral],
        )
      )[0].n,
    ).toBe(0);
  });
  it("freezes the exact values and notice hash; rejects stale, forged and unconfirmed previews", async () => {
    const p = await preview(referral);
    expect(Object.keys(p.package.values).sort()).toEqual([
      "country_code",
      "display_alias",
    ]);
    expect(p.package.recipient.id).toBe(f.targetOrg);
    expect(JSON.stringify(p.package)).not.toContain("encrypted_body");
    const encrypted = (
      await sql(
        "select position(convert_to($2,'UTF8') in encrypted_payload)=0 encrypted from private.s4_previews where id=$1",
        [p.id, p.package.values.display_alias],
      )
    )[0];
    expect(encrypted.encrypted).toBe(true);
    const args = {
      p_preview: p.id,
      p_hash: p.hash,
      p_notice: notice,
      p_confirmed: true,
      p_key: randomUUID(),
    };
    expect(
      (await c.user.rpc("goos_s4_submit", { ...args, p_confirmed: false }))
        .error?.code,
    ).toBe("22023");
    expect(
      (await c.user.rpc("goos_s4_submit", { ...args, p_hash: "0".repeat(64) }))
        .error?.code,
    ).toBe("40001");
    await sql(
      "update private.s4_previews set expires_at=now()-interval '1 second' where id=$1",
      [p.id],
    );
    expect((await c.user.rpc("goos_s4_submit", args)).error?.code).toBe(
      "40001",
    );
  });
  it("a changed current notice invalidates an otherwise valid exact-field preview", async () => {
    const p = await preview(referral),
      next = randomUUID();
    await sql(
      "insert into app.notice_versions select (jsonb_populate_record(null::app.notice_versions,to_jsonb(n)||jsonb_build_object('id',$1::text,'version_label','synthetic-notice-change-'||$1::text))).* from app.notice_versions n where id=$2",
      [next, notice],
    );
    try {
      await sql(
        "update private.s4_current_notices set notice_id=$1 where locale='en'",
        [next],
      );
      expect(
        (
          await c.user.rpc("goos_s4_submit", {
            p_preview: p.id,
            p_hash: p.hash,
            p_notice: notice,
            p_confirmed: true,
            p_key: randomUUID(),
          })
        ).error?.code,
      ).toBe("40001");
      expect(
        (
          await c.user.rpc("goos_s4_preview", {
            p_id: referral,
            p_fields: ["display_alias"],
            p_skills: [],
            p_notice: notice,
          })
        ).error?.code,
      ).toBe("22023");
      expect((await rpc(c.user, "goos_s4_notice", { p_locale: "en" })).id).toBe(
        next,
      );
    } finally {
      await sql(
        "update private.s4_current_notices set notice_id=$1 where locale='en'",
        [notice],
      );
    }
  });
  it("ten retries create one consent package and no destination case before acceptance", async () => {
    const p = await preview(referral),
      key = randomUUID();
    const receipts = await Promise.all(
      Array.from({ length: 10 }, () => submit(p, key)),
    );
    expect(new Set(receipts.map((x) => x.id)).size).toBe(1);
    expect(
      (
        await sql(
          "select count(*)::int n from private.s4_packages where referral_id=$1",
          [referral],
        )
      )[0].n,
    ).toBe(1);
    expect(
      (
        await sql(
          "select count(*)::int n from private.s4_cases where referral_id=$1",
          [referral],
        )
      )[0].n,
    ).toBe(0);
    expect(
      (
        await c.outsider.rpc("goos_s4_detail", {
          p_kind: "referrals",
          p_id: referral,
        })
      ).error?.code,
    ).toBe("P0002");
  });
  it("accepts once, denies foreign assignment and keeps source internal notes out of the destination", async () => {
    const v = (await meta("referrals", referral)).version;
    expect(
      (
        await c.outsider.rpc("goos_s4_referral_action", {
          p_id: referral,
          p_action: "accept",
          p_version: v,
          p_member: f.members.worker,
        })
      ).error?.code,
    ).toBe("22023");
    const result = await Promise.all(
      Array.from({ length: 6 }, () => accept(referral)),
    );
    caseId = result[0].case_id;
    expect(new Set(result.map((x) => x.case_id)).size).toBe(1);
    expect(
      (
        await sql(
          "select count(*)::int n from private.s4_cases where referral_id=$1",
          [referral],
        )
      )[0].n,
    ).toBe(1);
    const d = await detail("referrals", referral, c.replacement);
    expect(d.package.values.country_code).toBe("TH");
    expect(d.source_application).toBeNull();
    expect(d.notes).toEqual([]);
    expect((await detail("referrals", referral, c.worker)).package).toBeNull();
    expect(
      (
        await c.second.rpc("goos_s4_detail", {
          p_kind: "referrals",
          p_id: referral,
        })
      ).error?.code,
    ).toBe("P0002");
  });
  it("destination internal notes stay out of source and beneficiary channels and exports", async () => {
    const d = await detail("referrals", referral, c.replacement);
    await rpc(c.replacement, "goos_s4_case_action", {
      p_id: caseId,
      p_action: "note",
      p_version: d.case.version,
      p_member: null,
      p_body: "S4 INTERNAL DESTINATION CANARY",
      p_visibility: "internal",
      p_supersedes: null,
    });
    expect(
      JSON.stringify(await detail("referrals", referral, c.user)),
    ).not.toContain("S4 INTERNAL DESTINATION CANARY");
    expect(
      JSON.stringify(await detail("referrals", referral, c.worker)),
    ).not.toContain("S4 INTERNAL DESTINATION CANARY");
    expect(
      JSON.stringify(await detail("referrals", referral, c.replacement)),
    ).toContain("S4 INTERNAL DESTINATION CANARY");
    expect((await detail("referrals", referral, c.user)).case.version).toBe(
      d.case.version,
    );
  });
  it("routing staff can reassign without package access; the old worker immediately loses the case", async () => {
    const d = await detail("referrals", referral, c.replacement);
    await rpc(c.outsider, "goos_s4_case_action", {
      p_id: caseId,
      p_action: "assign",
      p_version: d.case.version,
      p_member: f.targetMembers.recruiter,
      p_body: null,
      p_visibility: null,
      p_supersedes: null,
    });
    expect(
      (
        await c.replacement.rpc("goos_s4_detail", {
          p_kind: "referrals",
          p_id: referral,
        })
      ).error?.code,
    ).toBe("P0002");
    expect(
      (await detail("referrals", referral, c.recruiter)).package.values
        .country_code,
    ).toBe("TH");
    const rows = await rpc(c.outsider, "goos_s4_list", {
      p_kind: "referrals",
      p_page: 1,
    });
    const row = rows.find((r: { id: string }) => r.id === referral);
    await rpc(c.outsider, "goos_s4_case_action", {
      p_id: caseId,
      p_action: "assign",
      p_version: row.case_version,
      p_member: f.targetMembers.replacement,
      p_body: null,
      p_visibility: null,
      p_supersedes: null,
    });
  });
  it("membership removal denies an old still-valid token, including private DB rows", async () => {
    await sql("update app.org_memberships set status='revoked' where id=$1", [
      f.targetMembers.replacement,
    ]);
    expect(
      (
        await c.replacement.rpc("goos_s4_detail", {
          p_kind: "referrals",
          p_id: referral,
        })
      ).error?.code,
    ).toBe("P0002");
    expect(
      await asApi(
        c.replacement,
        "select referral_id from private.s4_packages where referral_id=$1",
        [referral],
      ),
    ).toEqual([]);
    await sql("update app.org_memberships set status='active' where id=$1", [
      f.targetMembers.replacement,
    ]);
  });
  it("revocation beats subsequent reads and creates recipient cessation; accept/revoke race never duplicates cases", async () => {
    const id = await pending();
    const v = (await meta("referrals", id)).version;
    await Promise.allSettled([
      accept(id),
      rpc(c.user, "goos_s4_referral_action", {
        p_id: id,
        p_action: "revoke",
        p_version: v,
        p_member: null,
      }),
    ]);
    const latest = await meta("referrals", id);
    if (latest.share_active)
      await rpc(c.user, "goos_s4_referral_action", {
        p_id: id,
        p_action: "revoke",
        p_version: latest.version,
        p_member: null,
      });
    expect(
      (
        await c.replacement.rpc("goos_s4_detail", {
          p_kind: "referrals",
          p_id: id,
        })
      ).error?.code,
    ).toBe("P0002");
    expect(
      (
        await sql(
          "select count(*)::int n from private.s4_cases where referral_id=$1",
          [id],
        )
      )[0].n,
    ).toBeLessThanOrEqual(1);
    expect(
      (
        await sql(
          "select count(*)::int n from private.s4_cessations where resource_id=$1",
          [id],
        )
      )[0].n,
    ).toBe(1);
  });
  it("expired and suspended recipients stop new handoffs and pending consent reads", async () => {
    const id = await proposed(),
      p = await preview(id);
    await sql("update app.organizations set status='suspended' where id=$1", [
      f.targetOrg,
    ]);
    const r = await c.user.rpc("goos_s4_submit", {
      p_preview: p.id,
      p_hash: p.hash,
      p_notice: notice,
      p_confirmed: true,
      p_key: randomUUID(),
    });
    expect(r.error?.code).toBe("40001");
    expect(
      (
        await c.replacement.rpc("goos_s4_detail", {
          p_kind: "referrals",
          p_id: referral,
        })
      ).error?.code,
    ).toBe("P0002");
    await sql("update app.organizations set status='verified' where id=$1", [
      f.targetOrg,
    ]);
  });
});
describe("S4 outcomes, evidence and independent review", () => {
  it("provider reports are L1 and cannot self-verify; administrators route without reading the body", async () => {
    outcome = await reportOutcome();
    expect((await meta("outcomes", outcome)).tier).toBe("L1");
    expect(
      (
        await c.replacement.rpc("goos_s4_outcome_action", {
          p_id: outcome,
          p_action: "verify",
          p_version: 1,
          p_alternate: null,
        })
      ).error?.code,
    ).toBe("P0002");
    expect(
      (
        await c.reviewer.rpc("goos_s4_detail", {
          p_kind: "outcomes",
          p_id: outcome,
        })
      ).error?.code,
    ).toBe("P0002");
    await assign("outcomes", outcome, f.actors.impact.id, 1);
    expect((await detail("outcomes", outcome, c.impact)).body).toBe(
      "Synthetic service report",
    );
  });
  it("assigned staff with a valid AAL1 session still cannot read protected outcome data", async () => {
    const low = createClient(runtime.apiUrl, runtime.anonKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const a = f.actors.impact;
    expect(
      (
        await low.auth.signInWithPassword({
          email: a.email,
          password: a.password,
        })
      ).error,
    ).toBeNull();
    expect(
      (await low.rpc("goos_s4_detail", { p_kind: "outcomes", p_id: outcome }))
        .error?.code,
    ).toBe("P0002");
  });
  it("requires quarantined evidence to be decoded/re-encoded by the restricted production worker function", async () => {
    const png = await sharp({
      create: { width: 64, height: 64, channels: 3, background: "#ffffff" },
    })
      .png()
      .toBuffer();
    const id = await rpc(c.replacement, "goos_s4_evidence", {
      p_id: outcome,
      p_body: png.toString("base64"),
    });
    expect(
      (await c.impact.rpc("goos_s4_download", { p_id: id })).error?.code,
    ).toBe("P0002");
    const bad = Buffer.concat([
      Buffer.from("89504e470d0a1a0a", "hex"),
      Buffer.alloc(70),
    ]);
    const rejected = await rpc(c.replacement, "goos_s4_evidence", {
      p_id: outcome,
      p_body: bad.toString("base64"),
    });
    const beforeSignal = Number(
      (
        await sql(
          "select revision from private.live_revisions where account_id=$1",
          [f.actors.replacement.id],
        )
      )[0]?.revision ?? 0,
    );
    const db = new pg.Client({ connectionString: runtime.dbUrl });
    await db.connect();
    try {
      await db.query("begin");
      await db.query("set local role goos_worker");
      while (await inspectEvidence(db, "s4_evidence")) {
        /* bounded by fixture rows */
      }
      await db.query("commit");
      await db.query("begin");
      await db.query("set local role goos_worker");
      await expect(
        db.query("select * from private.application_packages"),
      ).rejects.toMatchObject({ code: "42501" });
      await db.query("rollback");
    } finally {
      await db.end();
    }
    expect(
      Number(
        (
          await sql(
            "select revision from private.live_revisions where account_id=$1",
            [f.actors.replacement.id],
          )
        )[0]?.revision ?? 0,
      ),
    ).toBeGreaterThan(beforeSignal);
    const clean = await rpc(c.impact, "goos_s4_download", { p_id: id });
    expect(clean.hash).toMatch(/^[a-f0-9]{64}$/);
    expect(
      Buffer.from(clean.body, "base64")
        .subarray(0, 8)
        .equals(png.subarray(0, 8)),
    ).toBe(true);
    expect(
      (
        await sql(
          "select status,original_body,safe_body from private.s4_evidence where id=$1",
          [rejected],
        )
      )[0],
    ).toMatchObject({
      status: "rejected",
      original_body: null,
      safe_body: null,
    });
  });
  it("requires beneficiary confirmation or explicit reviewed alternative; dispute immediately removes verification", async () => {
    let v = (await meta("outcomes", outcome, c.impact)).version;
    expect(
      (
        await c.impact.rpc("goos_s4_outcome_action", {
          p_id: outcome,
          p_action: "verify",
          p_version: v,
          p_alternate: null,
        })
      ).error?.code,
    ).toBe("22023");
    await outcomeAction(outcome, "confirm");
    await outcomeAction(outcome, "verify", c.impact);
    expect((await meta("outcomes", outcome)).tier).toBe("L2");
    await outcomeAction(outcome, "dispute");
    expect(await meta("outcomes", outcome)).toMatchObject({
      state: "disputed",
      confirmed: false,
    });
    v = (await meta("outcomes", outcome, c.impact)).version;
    expect(
      (
        await c.impact.rpc("goos_s4_outcome_action", {
          p_id: outcome,
          p_action: "verify",
          p_version: v,
          p_alternate: null,
        })
      ).error?.code,
    ).toBe("22023");
  });
  it("current reviewer scope is checked on downloads; revocation denies an old session", async () => {
    await rpc(c.reviewer, "goos_s4_scope", {
      p_account: f.actors.impact.id,
      p_scope: "impact",
      p_grant: false,
      p_expires: new Date(Date.now() + 86400000).toISOString(),
    });
    expect(
      (
        await c.impact.rpc("goos_s4_detail", {
          p_kind: "outcomes",
          p_id: outcome,
        })
      ).error?.code,
    ).toBe("P0002");
    const id = (
      await sql(
        "select id from private.s4_evidence where outcome_id=$1 and status=$2",
        [outcome, "clean"],
      )
    )[0].id;
    expect(
      (await c.impact.rpc("goos_s4_download", { p_id: id })).error?.code,
    ).toBe("P0002");
    await rpc(c.reviewer, "goos_s4_scope", {
      p_account: f.actors.impact.id,
      p_scope: "impact",
      p_grant: true,
      p_expires: new Date(Date.now() + 86400000).toISOString(),
    });
  });
  it("corrections supersede instead of overwriting and duplicate service-period reports are rejected", async () => {
    const args = {
      p_case: caseId,
      p_kind: "service_delivered",
      p_start: "2026-11-01",
      p_end: "2026-11-03",
      p_occurred: "2026-11-03T08:00:00Z",
      p_body: "Synthetic corrected service report",
      p_corrects: null,
    };
    expect(
      (await c.replacement.rpc("goos_s4_outcome_create", args)).error?.code,
    ).toBe("23505");
    const id = await rpc(c.replacement, "goos_s4_outcome_create", {
      ...args,
      p_corrects: outcome,
    });
    expect((await meta("outcomes", outcome)).state).toBe("superseded");
    expect((await meta("outcomes", id)).tier).toBe("L1");
    expect(
      (
        await sql("select corrects_id from private.s4_outcomes where id=$1", [
          id,
        ])
      )[0].corrects_id,
    ).toBe(outcome);
  });
});
describe("S4 report provenance", () => {
  it("independent rejection and dispute preserve the L0 self-reported origin", async () => {
    const id = await rpc(c.user, "goos_s4_outcome_create", {
      p_case: f.sourceCase,
      p_kind: "skills_completed",
      p_start: "2026-11-01",
      p_end: "2026-11-03",
      p_occurred: "2026-11-03T08:00:00Z",
      p_body: "Synthetic self report",
      p_corrects: null,
    });
    await assign("outcomes", id, f.actors.impact.id, 1);
    await outcomeAction(id, "reject", c.impact);
    expect((await meta("outcomes", id)).tier).toBe("L0");
    await outcomeAction(id, "dispute", c.user);
    expect((await meta("outcomes", id)).tier).toBe("L0");
  });
});
describe("S4 privacy, restricted safety and release gates", () => {
  it("exports require identity review and owner access; excludes destination internal notes and other-user data", async () => {
    const id = await rpc(c.user, "goos_s4_privacy_create", {
      p_kind: "export",
      p_body: "Synthetic export request",
      p_confirmed: true,
    });
    expect((await c.user.rpc("goos_s4_export", { p_id: id })).error?.code).toBe(
      "P0002",
    );
    await assign("privacy", id, f.actors.privacy.id, 1);
    await privacyAction(id, "verify_identity", "authenticated_session_review");
    await privacyAction(id, "approve");
    const result = await rpc(c.user, "goos_s4_export", { p_id: id });
    expect(result.subject.display_alias).toContain("Synthetic");
    const exportedOutcome = result.outcomes.find(
      (row: { id: string }) => row.id === outcome,
    );
    expect(exportedOutcome).toMatchObject({
      body: "Synthetic service report",
      reporter_kind: "provider",
      organization_id: f.targetOrg,
    });
    expect(new Date(exportedOutcome.occurred_at).toISOString()).toBe(
      "2026-11-03T08:00:00.000Z",
    );
    expect(JSON.stringify(result)).not.toContain(
      "S4 INTERNAL DESTINATION CANARY",
    );
    for (const client of [c.privacy, c.second, c.reviewer, c.worker])
      expect(
        (await client.rpc("goos_s4_export", { p_id: id })).error?.code,
      ).toBe("P0002");
  });
  it("holds and delete approvals never perform physical purge or mark deletion completed", async () => {
    const id = await rpc(c.user, "goos_s4_privacy_create", {
      p_kind: "delete",
      p_body: "Synthetic deletion request",
      p_confirmed: true,
    });
    await assign("privacy", id, f.actors.privacy.id, 1);
    await privacyAction(id, "verify_identity", "assisted_verified");
    await privacyAction(id, "hold", "legal_obligation");
    const r = await c.privacy.rpc("goos_s4_privacy_action", {
      p_id: id,
      p_action: "approve",
      p_version: (await meta("privacy", id, c.privacy)).version,
      p_reason: null,
    });
    expect(r.error?.code).toBe("40001");
    await privacyAction(id, "release_hold");
    await privacyAction(id, "approve");
    expect((await meta("privacy", id)).state).toBe("awaiting_policy");
    const events = (await detail("privacy", id)).events;
    expect(
      events.some(
        (e: { action: string; reason_code: string }) =>
          e.action === "hold" && e.reason_code === "legal_obligation",
      ),
    ).toBe(true);
    expect(
      events.some(
        (e: { action: string; reason_code: string }) =>
          e.action === "release_hold" && e.reason_code === "legal_obligation",
      ),
    ).toBe(true);

    expect(
      (
        await c.privacy.rpc("goos_s4_privacy_action", {
          p_id: id,
          p_action: "purge",
          p_version: (await meta("privacy", id, c.privacy)).version,
          p_reason: null,
        })
      ).error?.code,
    ).toBe("22023");
    expect(
      (
        await sql("select status from app.subjects where id=$1", [
          f.subjects.user,
        ])
      )[0].status,
    ).toBe("active");
  });
  it("restricted reports require an independent assigned officer; accused and general admins receive no narrative", async () => {
    const id = await rpc(c.user, "goos_s4_report_create", {
      p_kind: "safety",
      p_body: "S4 SAFETY PRIVATE CANARY",
      p_org: f.targetOrg,
      p_accused: f.actors.outsider.id,
      p_appeal: null,
    });
    for (const client of [c.outsider, c.worker, c.reviewer, c.privacy])
      expect(
        (await client.rpc("goos_s4_detail", { p_kind: "reports", p_id: id }))
          .error?.code,
      ).toBe("P0002");
    await assign("reports", id, f.actors.safety.id, 1);
    expect((await detail("reports", id, c.safety)).body).toBe(
      "S4 SAFETY PRIVATE CANARY",
    );
    for (const action of ["review", "resolve"])
      await rpc(c.safety, "goos_s4_report_action", {
        p_id: id,
        p_action: action,
        p_version: (await meta("reports", id, c.safety)).version,
      });
    const appeal = await rpc(c.user, "goos_s4_report_create", {
      p_kind: "safety",
      p_body: "Synthetic appeal",
      p_org: null,
      p_accused: null,
      p_appeal: id,
    });
    expect((await meta("reports", appeal)).state).toBe("submitted");
  });
  it("replays withdrawal metadata after simulated restore and prevents unauthorized helper execution", async () => {
    const id = await pending();
    await accept(id);
    await rpc(c.user, "goos_s4_referral_action", {
      p_id: id,
      p_action: "revoke",
      p_version: (await meta("referrals", id)).version,
      p_member: null,
    });
    const ledger = await sql(
      "select referral_id,subject_id,actor_id,created_at from private.s4_withdrawals where referral_id=$1",
      [id],
    );
    await sql("update private.s4_referrals set share_active=true where id=$1", [
      id,
    ]);
    await expect(
      asApi(c.user, "select private.goos_s4_replay_withdrawals($1::jsonb)", [
        JSON.stringify(ledger),
      ]),
    ).rejects.toMatchObject({ code: "42501" });
    expect(
      (
        await sql("select private.goos_s4_replay_withdrawals($1::jsonb) n", [
          JSON.stringify(ledger),
        ])
      )[0].n,
    ).toBe(1);
    expect(
      (
        await c.replacement.rpc("goos_s4_detail", {
          p_kind: "referrals",
          p_id: id,
        })
      ).error?.code,
    ).toBe("P0002");
  });
  it("anonymous intake is write-only, status needs the opaque receipt and narratives stay private", async () => {
    const guest = createClient(runtime.apiUrl, runtime.anonKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const r = await rpc(guest, "goos_s4_guest_report", {
      p_kind: "safety",
      p_body: "S4 ANONYMOUS PRIVATE CANARY",
      p_appeal: null,
      p_receipt: null,
    });
    expect(r.receipt).toMatch(/^[a-f0-9]{64}$/);
    expect(
      (
        await guest.rpc("goos_s4_guest_status", {
          p_id: r.id,
          p_receipt: "0".repeat(64),
        })
      ).error?.code,
    ).toBe("P0002");
    const status = await rpc(guest, "goos_s4_guest_status", {
      p_id: r.id,
      p_receipt: r.receipt,
    });
    expect(Object.keys(status).sort()).toEqual([
      "created_at",
      "id",
      "kind",
      "state",
    ]);
    expect(
      (await guest.rpc("goos_s4_detail", { p_kind: "reports", p_id: r.id }))
        .error?.code,
    ).toBe("42501");
    expect(
      (
        await c.reviewer.rpc("goos_s4_detail", {
          p_kind: "reports",
          p_id: r.id,
        })
      ).error?.code,
    ).toBe("P0002");
    await assign("reports", r.id, f.actors.safety.id, 1);
    expect((await detail("reports", r.id, c.safety)).body).toBe(
      "S4 ANONYMOUS PRIVATE CANARY",
    );
    for (const action of ["review", "resolve"])
      await rpc(c.safety, "goos_s4_report_action", {
        p_id: r.id,
        p_action: action,
        p_version: (await meta("reports", r.id, c.safety)).version,
      });
    const appeal = await rpc(guest, "goos_s4_guest_report", {
      p_kind: "safety",
      p_body: "Synthetic anonymous appeal",
      p_appeal: r.id,
      p_receipt: r.receipt,
    });
    expect(appeal.id).not.toBe(r.id);
    const row = (
      await sql(
        "select reporter_id,receipt_hash from private.s4_reports where id=$1",
        [r.id],
      )
    )[0];
    expect(row.reporter_id).toBeNull();
    expect(row.receipt_hash).not.toBe(r.receipt);
    expect(
      (
        await guest.rpc("goos_s4_guest_report", {
          p_kind: "safety",
          p_body: "x".repeat(2001),
          p_appeal: null,
          p_receipt: null,
        })
      ).error?.code,
    ).toBe("22023");
    const boundary = (
      await sql(
        "select has_table_privilege('goos_reporter','private.s4_reports','select') reads,has_function_privilege('goos_reporter','private.goos_s3_decrypt(bytea)','execute') decrypts,rolcanlogin,rolbypassrls,rolsuper,rolinherit from pg_roles where rolname='goos_reporter'",
      )
    )[0];
    expect(Object.values(boundary).every((v) => v === false)).toBe(true);
  });
  it("privacy stop-sharing revokes source/derived access and records cessation requests without external messages", async () => {
    const id = await rpc(c.user, "goos_s4_privacy_create", {
      p_kind: "delete",
      p_body: "Synthetic stop sharing",
      p_confirmed: true,
    });
    await privacyAction(id, "stop_sharing", null, c.user);
    expect(
      (
        await c.replacement.rpc("goos_s4_detail", {
          p_kind: "referrals",
          p_id: referral,
        })
      ).error?.code,
    ).toBe("P0002");
    expect(
      (await c.worker.rpc("goos_s3_detail", { p_id: f.sourceApplication }))
        .error?.code,
    ).toBe("P0002");
    expect(
      (
        await c.impact.rpc("goos_s4_detail", {
          p_kind: "outcomes",
          p_id: outcome,
        })
      ).error?.code,
    ).toBe("P0002");
    const rows = await rpc(c.outsider, "goos_s4_cessations");
    expect(
      rows.some((r: { resource_id: string }) => r.resource_id === referral),
    ).toBe(true);
    expect(
      (
        await c.user.rpc("goos_s4_propose", {
          p_case: f.sourceCase,
          p_opportunity: await target(),
          p_purpose: "service_support",
        })
      ).error?.code,
    ).toBe("22023");
  });
  it("default DB release gate denies direct RPCs even when a browser bypasses the BFF", async () => {
    await sql("update private.s4_release set enabled=false where singleton");
    try {
      expect((await c.user.rpc("goos_s4_sources")).error?.code).toBe("42501");
      expect(
        (await c.user.rpc("goos_s4_list", { p_kind: "referrals", p_page: 1 }))
          .error?.code,
      ).toBe("42501");
    } finally {
      await sql("update private.s4_release set enabled=true where singleton");
    }
  });
});
