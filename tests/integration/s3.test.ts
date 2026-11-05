import { beforeAll, describe, it, expect } from "vitest";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import pg from "pg";
import { runtime, sql, asApi } from "./helpers";
import { syntheticTotp } from "../../scripts/validation-runtime";
type Actor = {
  id: string;
  email: string;
  password: string;
  factorId?: string;
  totp?: string;
};
type Fixture = {
  run: string;
  current: string;
  org: string;
  foreignOrg: string;
  actors: Record<string, Actor>;
  subjects: Record<string, string>;
  members: Record<string, string>;
  listings: Record<string, string>;
};
let f: Fixture;
const c: Record<string, SupabaseClient> = {};
const notice = "00000000-0000-4000-8000-000000000202";
let application: string, caseId: string;
async function rpc(
  client: SupabaseClient,
  name: string,
  args: Record<string, unknown> = {},
) {
  const r = await client.rpc(name, args);
  if (r.error) throw Error(name + ": " + r.error.code + " " + r.error.message);
  return r.data;
}
async function preview(
  client = c.user,
  subject = f.subjects.user,
  listing = f.listings.unlimited,
  fields = ["display_alias", "country_code"],
) {
  return rpc(client, "goos_s3_preview", {
    p_subject: subject,
    p_opportunity: listing,
    p_fields: fields,
    p_skills: [],
    p_notice: notice,
    p_application: null,
  });
}
const submitArgs = (
  p: { id: string; hash: string },
  key = randomUUID(),
  readback = false,
) => ({
  p_preview: p.id,
  p_hash: p.hash,
  p_notice: notice,
  p_confirmed: true,
  p_readback: readback,
  p_key: key,
});
const detail = (id = application, client = c.user) =>
  rpc(client, "goos_s3_detail", { p_id: id });
async function row(id: string) {
  return (
    await sql(
      "select a.*,c.id as case_id,c.version as case_version from app.applications a join app.cases c on c.application_id=a.id where a.id=$1",
      [id],
    )
  )[0];
}
async function assign(id: string, member = f.members.worker) {
  const r = await row(id);
  await rpc(c.publisher, "goos_s3_assign", {
    p_case: r.case_id,
    p_member: member,
    p_version: r.case_version,
  });
}
async function transition(
  id: string,
  action: string,
  client = c.worker,
  fields: string[] = [],
) {
  return rpc(client, "goos_s3_transition", {
    p_id: id,
    p_action: action,
    p_version: (await row(id)).version,
    p_reason: action === "withdraw" ? "user_requested" : "reviewed",
    p_fields: fields,
  });
}
async function machine(query: string, args: unknown[] = []) {
  const db = new pg.Client({ connectionString: runtime.dbUrl });
  await db.connect();
  try {
    await db.query("begin");
    await db.query("set local role goos_worker");
    const r = await db.query(query, args);
    await db.query("commit");
    return r.rows;
  } finally {
    await db.end();
  }
}
beforeAll(async () => {
  execFileSync(process.execPath, ["scripts/seed-s3-fixtures.mjs"], {
    stdio: "pipe",
    timeout: 110000,
  });
  f = JSON.parse(readFileSync(".local/s3-fixtures.json", "utf8"));
  for (const [name, a] of Object.entries(f.actors)) {
    const client = createClient(runtime.apiUrl, runtime.anonKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    if (
      (
        await client.auth.signInWithPassword({
          email: a.email,
          password: a.password,
        })
      ).error
    )
      throw Error("S3 fixture login");
    if (
      a.factorId &&
      (
        await client.auth.mfa.challengeAndVerify({
          factorId: a.factorId,
          code: syntheticTotp(a.totp!),
        })
      ).error
    )
      throw Error("S3 fixture MFA");
    c[name] = client;
  }
}, 120000);
describe("S3 consent and transactional workflow", () => {
  it("exact fields and notice hashes are frozen in an encrypted preview; no sharing before confirmation", async () => {
    const p = await preview();
    expect(Object.keys(p.package.values).sort()).toEqual([
      "country_code",
      "display_alias",
    ]);
    expect(p.package.recipient.id).toBe(f.org);
    const check = (
      await sql(
        "select position(convert_to($2,'UTF8') in encrypted_payload)=0 encrypted from private.s3_previews where id=$1",
        [p.id, p.package.values.display_alias],
      )
    )[0];
    expect(check.encrypted).toBe(true);
    expect(
      (
        await sql(
          "select count(*)::int n from app.notice_versions where purpose in('application','application_delegation') and content_hash<>encode(sha256(convert_to(body,'UTF8')),'hex')",
        )
      )[0].n,
    ).toBe(0);
    expect(
      (
        await c.user.rpc("goos_s3_submit", {
          ...submitArgs(p),
          p_confirmed: false,
        })
      ).error?.code,
    ).toBe("22023");
    expect(
      (
        await sql(
          "select count(*)::int n from app.applications where subject_id=$1",
          [f.subjects.user],
        )
      )[0].n,
    ).toBe(0);
  });
  it("ten concurrent identical submissions produce one stable receipt/application/package/share/event/outbox set", async () => {
    const p = await preview(),
      args = submitArgs(p);
    const results = await Promise.all(
      Array.from({ length: 10 }, () => c.user.rpc("goos_s3_submit", args)),
    );
    expect(
      results.every((r) => !r.error),
      JSON.stringify(results.map((r) => r.error?.code)),
    ).toBe(true);
    expect(new Set(results.map((r) => JSON.stringify(r.data))).size).toBe(1);
    application = results[0].data.id;
    caseId = results[0].data.case_id;
    const checks = (
      await sql(
        "select (select count(*) from private.application_packages where application_id=$1)::int packages,(select count(*) from app.resource_shares where application_id=$1)::int shares,(select count(*) from app.application_events where application_id=$1)::int events,(select count(*) from app.cases where application_id=$1)::int cases",
        [application],
      )
    )[0];
    expect(checks).toEqual({ packages: 1, shares: 1, events: 1, cases: 1 });
    const jobs = await sql(
      "select dedupe_key from private.outbox where case_id=$1",
      [caseId],
    );
    expect(jobs.length).toBeGreaterThan(0);
    expect(new Set(jobs.map((j) => j.dedupe_key)).size).toBe(jobs.length);
    expect(
      (await c.user.rpc("goos_s3_submit", { ...args, p_hash: "0".repeat(64) }))
        .error?.code,
    ).toBe("40001");
    expect(
      (await c.user.rpc("goos_s3_submit", submitArgs(p))).error?.code,
    ).toBe("40001");
    expect(
      (await c.user.rpc("goos_s3_submit", submitArgs(await preview()))).error
        ?.code,
    ).toBe("40001");
  });
  it("queue metadata is tenant-bound and owner/admin/platform role alone cannot read a package", async () => {
    const queue = await rpc(c.publisher, "goos_s3_list", {
      p_org: f.org,
      p_page: 1,
    });
    expect(
      queue.find((x: { id: string }) => x.id === application),
    ).toBeTruthy();
    expect(JSON.stringify(queue)).not.toMatch(
      /display_alias|contact_email|subject_id|package/,
    );
    for (const who of ["publisher", "reviewer", "outsider", "replacement"])
      expect(
        (await c[who].rpc("goos_s3_detail", { p_id: application })).error?.code,
      ).toBe("P0002");
    expect(
      (await c.outsider.rpc("goos_s3_list", { p_org: f.org, p_page: 1 })).error
        ?.code,
    ).toBe("P0002");
  });
  it("assignment enables only the current MFA worker; no full assessment/contact data is shared", async () => {
    await assign(application);
    const d = await detail(application, c.worker);
    expect(d.can_work).toBe(true);
    expect(Object.keys(d.package.values).sort()).toEqual([
      "country_code",
      "display_alias",
    ]);
    const fresh = createClient(runtime.apiUrl, runtime.anonKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    await fresh.auth.signInWithPassword({
      email: f.actors.worker.email,
      password: f.actors.worker.password,
    });
    expect(
      (await fresh.rpc("goos_s3_detail", { p_id: application })).error?.code,
    ).toBe("P0002");
    expect(
      (
        await c.publisher.rpc("goos_s3_assign", {
          p_case: caseId,
          p_member: f.members.publisher,
          p_version: (await row(application)).case_version,
        })
      ).error?.code,
    ).toBe("P0002");
  });
  it("internal notes do not appear in beneficiary views/fingerprints; shared notes do and old notes cannot be overwritten", async () => {
    const before = (await rpc(c.user, "goos_live_fingerprint")).fingerprint;
    let version = (await row(application)).case_version;
    const privateNote = await rpc(c.worker, "goos_s3_note", {
      p_case: caseId,
      p_body: "Synthetic internal context",
      p_visibility: "internal",
      p_supersedes: null,
      p_version: version,
    });
    expect((await detail()).notes).toHaveLength(0);
    expect((await rpc(c.user, "goos_live_fingerprint")).fingerprint).toBe(
      before,
    );
    expect(
      await asApi(
        c.worker,
        "update private.case_notes set visibility=$1 where id=$2",
        ["beneficiary_shared", privateNote],
      ).catch(() => []),
    ).toEqual([]);
    version = (await row(application)).case_version;
    const shared = await rpc(c.worker, "goos_s3_note", {
      p_case: caseId,
      p_body: "Synthetic next step",
      p_visibility: "beneficiary_shared",
      p_supersedes: null,
      p_version: version,
    });
    expect((await detail()).notes[0].body).toBe("Synthetic next step");
    expect((await rpc(c.user, "goos_live_fingerprint")).fingerprint).not.toBe(
      before,
    );
    expect(
      (
        await c.worker.rpc("goos_s3_note", {
          p_case: caseId,
          p_body: "Correction",
          p_visibility: "internal",
          p_supersedes: shared,
          p_version: (await row(application)).case_version,
        })
      ).error?.code,
    ).toBe("P0002");
  });
  it("reassignment removes a still-valid worker token and subsequent private signals", async () => {
    await assign(application, f.members.replacement);
    expect(
      (await c.worker.rpc("goos_s3_detail", { p_id: application })).error?.code,
    ).toBe("P0002");
    const fingerprint = (await rpc(c.worker, "goos_live_fingerprint"))
      .fingerprint;
    await rpc(c.replacement, "goos_s3_note", {
      p_case: caseId,
      p_body: "Synthetic replacement note",
      p_visibility: "internal",
      p_supersedes: null,
      p_version: (await row(application)).case_version,
    });
    expect((await rpc(c.worker, "goos_live_fingerprint")).fingerprint).toBe(
      fingerprint,
    );
    await assign(application);
  });
  it("request-info uses a new exact-field preview/consent and immutable response without changing the original package", async () => {
    await transition(application, "start_review");
    await transition(application, "request_info", c.worker, ["coarse_region"]);
    expect(
      (
        await c.user.rpc("goos_s3_preview", {
          p_subject: f.subjects.user,
          p_opportunity: f.listings.unlimited,
          p_fields: ["country_code"],
          p_skills: [],
          p_notice: notice,
          p_application: application,
        })
      ).error?.code,
    ).toBe("22023");
    const p = await rpc(c.user, "goos_s3_preview", {
      p_subject: f.subjects.user,
      p_opportunity: f.listings.unlimited,
      p_fields: ["coarse_region"],
      p_skills: [],
      p_notice: notice,
      p_application: application,
    });
    const result = await rpc(c.user, "goos_s3_submit", submitArgs(p));
    expect(result.id).toBe(application);
    expect(result.state).toBe("under_review");
    const d = await detail(application, c.worker);
    expect(Object.keys(d.package.values).sort()).toEqual([
      "country_code",
      "display_alias",
    ]);
    expect(Object.keys(d.responses[0].package.values)).toEqual([
      "coarse_region",
    ]);
    expect(d.requests[0].status).toBe("answered");
  });
  it("stale/null application and case versions cannot mutate", async () => {
    for (const version of [null, 0]) {
      expect(
        (
          await c.worker.rpc("goos_s3_transition", {
            p_id: application,
            p_action: "waitlist",
            p_version: version,
            p_reason: "reviewed",
            p_fields: [],
          })
        ).error?.code,
      ).toBe("40001");
      expect(
        (
          await c.publisher.rpc("goos_s3_assign", {
            p_case: caseId,
            p_member: f.members.worker,
            p_version: version,
          })
        ).error?.code,
      ).toBe("40001");
    }
  });
  it("last-seat accept is serialized across two applicants and withdrawal releases an unstarted reservation", async () => {
    const ids: string[] = [];
    for (const who of ["user", "second"]) {
      const p = await preview(c[who], f.subjects[who], f.listings.service);
      const receipt = await rpc(c[who], "goos_s3_submit", submitArgs(p));
      ids.push(receipt.id);
      await assign(receipt.id);
      await transition(receipt.id, "start_review");
    }
    const rows = await Promise.all(ids.map(row));
    const results = await Promise.all(
      ids.map((id, i) =>
        c.worker.rpc("goos_s3_transition", {
          p_id: id,
          p_action: "accept",
          p_version: rows[i].version,
          p_reason: "reviewed",
          p_fields: [],
        }),
      ),
    );
    expect(results.filter((r) => !r.error)).toHaveLength(1);
    expect(results.filter((r) => r.error?.code === "40001")).toHaveLength(1);
    expect(
      (
        await sql("select filled_count from app.opportunities where id=$1", [
          f.listings.service,
        ])
      )[0].filled_count,
    ).toBe(1);
    const winner = results.findIndex((r) => !r.error);
    await transition(
      ids[winner],
      "withdraw",
      c[winner === 0 ? "user" : "second"],
    );
    expect(
      (
        await sql("select filled_count from app.opportunities where id=$1", [
          f.listings.service,
        ])
      )[0].filled_count,
    ).toBe(0);
  });
  it("job recruiter sees only the chosen skills/contact package; only the beneficiary can accept an offer", async () => {
    const p = await rpc(c.second, "goos_s3_preview", {
      p_subject: f.subjects.second,
      p_opportunity: f.listings.job,
      p_fields: ["display_alias", "skills"],
      p_skills: ["Digital basics"],
      p_notice: notice,
      p_application: null,
    });
    const receipt = await rpc(c.second, "goos_s3_submit", submitArgs(p));
    await assign(receipt.id, f.members.recruiter);
    const d = await detail(receipt.id, c.recruiter);
    expect(Object.keys(d.package.values).sort()).toEqual([
      "display_alias",
      "skills",
    ]);
    expect(JSON.stringify(d)).not.toMatch(
      /disability|poverty|internal context|coarse_region/,
    );
    await transition(receipt.id, "start_review", c.recruiter);
    expect(
      (
        await c.recruiter.rpc("goos_s3_transition", {
          p_id: receipt.id,
          p_action: "accept",
          p_version: (await row(receipt.id)).version,
          p_reason: "reviewed",
          p_fields: [],
        })
      ).error?.code,
    ).toBe("40001");
    await transition(receipt.id, "interview", c.recruiter);
    await transition(receipt.id, "offer", c.recruiter);
    expect(
      (
        await c.recruiter.rpc("goos_s3_transition", {
          p_id: receipt.id,
          p_action: "accept_offer",
          p_version: (await row(receipt.id)).version,
          p_reason: "offer_accepted",
          p_fields: [],
        })
      ).error?.code,
    ).toBe("P0002");
    await transition(receipt.id, "accept_offer", c.second);
    const jobCase = await row(receipt.id);
    for (const action of ["triage", "start"]) {
      await rpc(c.recruiter, "goos_s3_case", {
        p_case: jobCase.case_id,
        p_action: action,
        p_version: (await row(receipt.id)).case_version,
        p_due: null,
        p_timezone: "UTC",
        p_priority: "normal",
        p_resolution: null,
      });
    }
    await transition(receipt.id, "job_started", c.recruiter);
    await rpc(c.recruiter, "goos_s3_case", {
      p_case: jobCase.case_id,
      p_action: "resolve",
      p_version: (await row(receipt.id)).case_version,
      p_due: null,
      p_timezone: "UTC",
      p_priority: "normal",
      p_resolution: "service_recorded",
    });
    await transition(receipt.id, "job_completed", c.recruiter);
    expect((await detail(receipt.id, c.second)).job_stage).toBe("completed");
  });
  it("prepare/submit/progress are separate authority; revoked authority invalidates pending previews and idempotent replay", async () => {
    const scopes = ["application:prepare"];
    let delegation = await rpc(c.second, "goos_s3_delegate", {
      p_subject: f.subjects.second,
      p_delegate: f.actors.delegate.id,
      p_scopes: scopes,
      p_expires: new Date(Date.now() + 3600000).toISOString(),
      p_notice: "00000000-0000-4000-8000-000000000204",
      p_confirmed: true,
    });
    const p = await preview(
      c.delegate,
      f.subjects.second,
      f.listings.unlimited,
    );
    expect(
      (
        await c.delegate.rpc(
          "goos_s3_submit",
          submitArgs(p, randomUUID(), true),
        )
      ).error?.code,
    ).toBe("P0002");
    await rpc(c.second, "goos_revoke_delegation", {
      p_id: delegation,
      p_expected_version: 1,
    });
    delegation = await rpc(c.second, "goos_s3_delegate", {
      p_subject: f.subjects.second,
      p_delegate: f.actors.delegate.id,
      p_scopes: ["application:prepare", "application:submit", "progress:read"],
      p_expires: new Date(Date.now() + 3600000).toISOString(),
      p_notice: "00000000-0000-4000-8000-000000000204",
      p_confirmed: true,
    });
    const valid = await preview(
      c.delegate,
      f.subjects.second,
      f.listings.unlimited,
    );
    expect(
      (await c.delegate.rpc("goos_s3_submit", submitArgs(valid))).error?.code,
    ).toBe("40001");
    const args = submitArgs(valid, randomUUID(), true),
      receipt = await rpc(c.delegate, "goos_s3_submit", args);
    expect((await detail(receipt.id, c.delegate)).id).toBe(receipt.id);
    await rpc(c.second, "goos_revoke_delegation", {
      p_id: delegation,
      p_expected_version: 1,
    });
    expect(
      (await c.delegate.rpc("goos_s3_detail", { p_id: receipt.id })).error
        ?.code,
    ).toBe("P0002");
    expect((await c.delegate.rpc("goos_s3_submit", args)).error?.code).toBe(
      "P0002",
    );
  });
  it("stale preview expiry/profile/revision and unsafe fields fail without partial creation", async () => {
    const p = await preview(
      c.outsider,
      f.subjects.outsider,
      f.listings.unlimited,
    );
    await sql(
      "update private.s3_previews set expires_at=now()-interval '1 second' where id=$1",
      [p.id],
    );
    expect(
      (await c.outsider.rpc("goos_s3_submit", submitArgs(p))).error?.code,
    ).toBe("40001");
    expect(
      (
        await c.user.rpc("goos_s3_preview", {
          p_subject: f.subjects.user,
          p_opportunity: f.listings.unlimited,
          p_fields: ["disability"],
          p_skills: [],
          p_notice: notice,
          p_application: null,
        })
      ).error?.code,
    ).toBe("22023");
    expect(
      (
        await c.user.rpc("goos_s3_preview", {
          p_subject: f.subjects.second,
          p_opportunity: f.listings.unlimited,
          p_fields: ["display_alias"],
          p_skills: [],
          p_notice: notice,
          p_application: null,
        })
      ).error?.code,
    ).toBe("P0002");
  });
  it("outbox lease/duplicate acknowledgments deliver one generic inbox entry without business changes", async () => {
    const rows = await sql(
      "select id from private.outbox where case_id=$1 and account_id=$2 and channel='in_app'",
      [caseId, f.actors.user.id],
    );
    const before = (await row(application)).version;
    const claim = (
      await machine(
        "select private.goos_s3_claim('in_app',20,$1::uuid[]) jobs",
        [rows.map((r) => r.id)],
      )
    )[0].jobs;
    expect(claim.length).toBeGreaterThan(0);
    for (const [index, j] of claim.entries()) {
      if (index === 0) {
        const oldLease = j.lease_id;
        await sql(
          "update private.outbox set lease_until=now()-interval '1 second' where id=$1",
          [j.id],
        );
        const reclaimed = (
          await machine(
            "select private.goos_s3_claim('in_app',1,$1::uuid[]) jobs",
            [[j.id]],
          )
        )[0].jobs[0];
        expect(reclaimed.lease_id).not.toBe(oldLease);
        await expect(
          machine("select private.goos_s3_ack($1,$2,true,null)", [
            j.id,
            oldLease,
          ]),
        ).rejects.toMatchObject({ code: "40001" });
        j.lease_id = reclaimed.lease_id;
      }
      await machine("select private.goos_s3_ack($1,$2,true,null)", [
        j.id,
        j.lease_id,
      ]);
      await machine("select private.goos_s3_ack($1,$2,true,null)", [
        j.id,
        j.lease_id,
      ]);
      expect(
        (
          await sql(
            "select count(*)::int n from app.notifications where source_event_id=$1",
            [j.id],
          )
        )[0].n,
      ).toBe(1);
    }
    expect((await row(application)).version).toBe(before);
    expect(JSON.stringify(await rpc(c.user, "goos_s3_inbox"))).not.toMatch(
      /Synthetic internal|package|display_alias|contact_email/,
    );
    await expect(
      asApi(c.user, "select private.goos_s3_claim('in_app',1,null)"),
    ).rejects.toThrow();
  });
  it("dry-run does not enqueue; a typed follow-up tick is idempotent and dead-letter retries do not alter case state", async () => {
    const r = await row(application);
    await rpc(c.worker, "goos_s3_case", {
      p_case: caseId,
      p_action: "schedule",
      p_version: r.case_version,
      p_due: new Date(Date.now() - 60000).toISOString(),
      p_timezone: "Asia/Bangkok",
      p_priority: "normal",
      p_resolution: null,
    });
    const rule = await rpc(c.publisher, "goos_s3_save_rule", {
      p_org: f.org,
      p_id: null,
      p_enabled: true,
      p_minutes: 10,
      p_timezone: "Asia/Bangkok",
      p_version: 0,
    });
    const count = (
      await sql("select count(*)::int n from private.outbox where case_id=$1", [
        caseId,
      ])
    )[0].n;
    expect(
      (await rpc(c.publisher, "goos_s3_dry_run", { p_rule: rule })).writes,
    ).toBe(0);
    expect(
      (
        await sql(
          "select count(*)::int n from private.outbox where case_id=$1",
          [caseId],
        )
      )[0].n,
    ).toBe(count);
    await machine("select private.goos_s3_tick($1)", [f.org]);
    const first = (
      await sql("select count(*)::int n from private.outbox where case_id=$1", [
        caseId,
      ])
    )[0].n;
    await machine("select private.goos_s3_tick($1)", [f.org]);
    expect(
      (
        await sql(
          "select count(*)::int n from private.outbox where case_id=$1",
          [caseId],
        )
      )[0].n,
    ).toBe(first);
    const job = (
      await sql(
        "select id from private.outbox where case_id=$1 and account_id=$2 and channel='in_app' and kind='followup.due' limit 1",
        [caseId, f.actors.user.id],
      )
    )[0];
    const version = (await row(application)).case_version;
    for (let i = 0; i < 5; i++) {
      await sql("update private.outbox set available_at=now() where id=$1", [
        job.id,
      ]);
      const j = (
        await machine(
          "select private.goos_s3_claim('in_app',1,$1::uuid[]) jobs",
          [[job.id]],
        )
      )[0].jobs[0];
      await machine("select private.goos_s3_ack($1,$2,false,'worker_failed')", [
        j.id,
        j.lease_id,
      ]);
    }
    expect(
      (
        await sql("select status,attempts from private.outbox where id=$1", [
          job.id,
        ])
      )[0],
    ).toEqual({ status: "dead", attempts: 5 });
    const retry = {
      p_id: job.id,
      p_attempts: 5,
      p_reason: "transport_restored",
    };
    expect((await c.outsider.rpc("goos_s3_retry", retry)).error?.code).toBe(
      "P0002",
    );
    for (let i = 0; i < 3; i++) {
      await rpc(c.publisher, "goos_s3_retry", retry);
      expect(
        (
          await sql("select status,attempts from private.outbox where id=$1", [
            job.id,
          ])
        )[0],
      ).toEqual({ status: "pending", attempts: 0 });
      expect((await c.publisher.rpc("goos_s3_retry", retry)).error?.code).toBe(
        "40001",
      );
      // Simulate the next transport failure without changing business state.
      await sql(
        "update private.outbox set status='dead',attempts=5 where id=$1",
        [job.id],
      );
    }
    expect((await c.publisher.rpc("goos_s3_retry", retry)).error?.code).toBe(
      "22023",
    );
    expect((await row(application)).case_version).toBe(version);
  });
  it("withdrawal revokes all base/additional shares immediately and operator replay is identity-bound/idempotent", async () => {
    await transition(application, "withdraw", c.user);
    expect(
      (await c.worker.rpc("goos_s3_detail", { p_id: application })).error?.code,
    ).toBe("P0002");
    expect((await detail()).state).toBe("withdrawn");
    const shares = await sql(
      "select status from app.resource_shares where application_id=$1",
      [application],
    );
    expect(shares.every((s) => s.status === "revoked")).toBe(true);
    const ledger = await sql(
      "select application_id,subject_id,action,created_at from private.s3_withdrawals where application_id=$1",
      [application],
    );
    await sql("select private.goos_s3_replay_withdrawals($1::jsonb)", [
      JSON.stringify(ledger),
    ]);
    await sql("select private.goos_s3_replay_withdrawals($1::jsonb)", [
      JSON.stringify(ledger),
    ]);
    expect((await row(application)).state).toBe("withdrawn");
    await expect(
      asApi(c.user, "select private.goos_s3_replay_withdrawals($1::jsonb)", [
        JSON.stringify(ledger),
      ]),
    ).rejects.toThrow();
  });
  it("profile changes, suspension and idempotency expiry reject stale intent without partial package", async () => {
    const expiredPreview = await preview();
    const expiredKey = randomUUID();
    await sql(
      "insert into private.idempotency_records(actor_id,route,key,request_hash,application_id,receipt,expires_at) select $1,'s3.submit',$2,encode(sha256(convert_to(jsonb_build_array($3::uuid,$4::text,$5::uuid,true,false)::text,'UTF8')),'hex'),$6,receipt,now()-interval '1 second' from private.idempotency_records where application_id=$6 limit 1",
      [
        f.actors.user.id,
        expiredKey,
        expiredPreview.id,
        expiredPreview.hash,
        notice,
        application,
      ],
    );
    expect(
      (
        await c.user.rpc(
          "goos_s3_submit",
          submitArgs(expiredPreview, expiredKey),
        )
      ).error?.code,
    ).toBe("40001");
    const p = await preview(
      c.outsider,
      f.subjects.outsider,
      f.current ?? f.listings.service,
    );
    const profile = await rpc(c.outsider, "goos_profile", {
      p_subject_id: f.subjects.outsider,
    });
    await rpc(c.outsider, "goos_update_profile", {
      p_subject_id: f.subjects.outsider,
      p_display_alias: profile.display_alias,
      p_coarse_region: "Synthetic region",
      p_safe_contact: "none",
      p_expected_version: profile.version,
    });
    expect(
      (await c.outsider.rpc("goos_s3_submit", submitArgs(p))).error?.code,
    ).toBe("40001");
    const q = await preview(
      c.outsider,
      f.subjects.outsider,
      f.current ?? f.listings.service,
    );
    await sql("update app.opportunities set state='paused' where id=$1", [
      f.current ?? f.listings.service,
    ]);
    expect(
      (await c.outsider.rpc("goos_s3_submit", submitArgs(q))).error?.code,
    ).toBe("40001");
    expect(
      (
        await sql(
          "select count(*)::int n from app.applications where subject_id=$1",
          [f.subjects.outsider],
        )
      )[0].n,
    ).toBe(0);
  });
  it("SMTP Mailpit delivery is generic, opt-in only, repeat-safe and opt-out cancels queued email", async () => {
    const p = await rpc(c.user, "goos_profile", {
      p_subject_id: f.subjects.user,
    });
    await rpc(c.user, "goos_update_profile", {
      p_subject_id: f.subjects.user,
      p_display_alias: p.display_alias,
      p_coarse_region: p.coarse_region,
      p_safe_contact: "email",
      p_expected_version: p.version,
    });
    const prefs = await rpc(c.user, "goos_s3_preferences");
    await rpc(c.user, "goos_s3_save_preferences", {
      p_in_app: true,
      p_email: true,
      p_timezone: "Asia/Bangkok",
      p_version: prefs.version,
    });
    const receipt = await rpc(
      c.user,
      "goos_s3_submit",
      submitArgs(await preview()),
    );
    const jobs = await sql(
      "select id from private.outbox where case_id=$1 and account_id=$2",
      [receipt.case_id, f.actors.user.id],
    );
    const run = () =>
      execFileSync(
        process.execPath,
        [
          "scripts/s3-worker.mjs",
          "--email",
          "--ids",
          jobs.map((r) => r.id).join(","),
        ],
        { stdio: "pipe", timeout: 30000 },
      );
    run();
    const search = async () => {
      const r = await fetch(
        runtime.mailUrl +
          "/api/v1/search?query=" +
          encodeURIComponent("to:" + f.actors.user.email),
      );
      if (!r.ok) throw Error("Mailpit search unavailable");
      return (await r.json()).messages as { ID: string }[];
    };
    const mail = await search();
    expect(mail).toHaveLength(1);
    const body = await (
      await fetch(runtime.mailUrl + "/api/v1/message/" + mail[0].ID)
    ).json();
    expect(body.Text).toContain("/workflow");
    expect(body.Text).not.toContain(f.run);
    expect(body.Text).not.toContain(p.display_alias);
    expect(body.Text).not.toMatch(/package|skills|country_code/);
    run();
    expect(await search()).toHaveLength(1);
    expect((await row(receipt.id)).state).toBe("submitted");
    await sql("select private.goos_s3_emit($1,'case.updated',$2)", [
      receipt.case_id,
      randomUUID(),
    ]);
    const pending = await sql(
      "select id from private.outbox where case_id=$1 and account_id=$2 and channel='email' and status='pending'",
      [receipt.case_id, f.actors.user.id],
    );
    const current = await rpc(c.user, "goos_s3_preferences");
    await rpc(c.user, "goos_s3_save_preferences", {
      p_in_app: true,
      p_email: false,
      p_timezone: "Asia/Bangkok",
      p_version: current.version,
    });
    execFileSync(
      process.execPath,
      [
        "scripts/s3-worker.mjs",
        "--email",
        "--ids",
        pending.map((r) => r.id).join(","),
      ],
      { stdio: "pipe", timeout: 30000 },
    );
    expect(
      (
        await sql("select status from private.outbox where id=$1", [
          pending[0].id,
        ])
      )[0].status,
    ).toBe("cancelled");
    expect(await search()).toHaveLength(1);
  });
});
