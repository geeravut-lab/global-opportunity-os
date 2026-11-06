import { beforeAll, afterAll, describe, it, expect } from "vitest";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import pg from "pg";
import sharp from "sharp";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { runtime, sql } from "./helpers";
import { privateJson, syntheticTotp } from "../../scripts/validation-runtime";
import { retentionDefaults } from "../../lib/policy/model";
import { purgeOne } from "../../lib/maintenance/purge.mjs";
type Actor = { id: string; email: string; password: string; factorId?: string; totp?: string };
type Fixture = { actors: Record<string, Actor>; subjects: Record<string, string>; sourceCase: string; sourceApplication: string; targetListing: string; targetMembers: Record<string, string> };
let f: Fixture, policy = "", request = "", job = "", receipt = "", note = "", outcome = "", evidence = "", destination = "", helperJob = "";
let intent: { ledger: Record<string, unknown>; hash: string }, executed: typeof intent;
const c: Record<string, SupabaseClient> = {};
const guest = createClient(runtime.apiUrl, runtime.anonKey, { auth: { persistSession: false, autoRefreshToken: false } });
const admin = createClient(runtime.apiUrl, runtime.serviceRoleKey, { auth: { persistSession: false, autoRefreshToken: false } });
const rpc = async (actor: SupabaseClient, name: string, args: Record<string, unknown> = {}) => { const r = await actor.rpc(name, args); if (r.error) throw Error(name + ":" + r.error.code); return r.data; };
const rowVersion = async (id: string) => (await sql("select version from private.s4_privacy where id=$1", [id]))[0].version;
const tx = async <T>(task: (db: pg.Client) => Promise<T>) => { const db = new pg.Client({ connectionString: runtime.dbUrl }); await db.connect(); try { await db.query("begin"); await db.query("set local role goos_worker"); const v = await task(db); await db.query("commit"); return v; } catch (e) { await db.query("rollback"); throw e; } finally { await db.end(); } };
async function identity(id: string) {
  await rpc(c.reviewer, "goos_s4_assign", { p_kind: "privacy", p_id: id, p_account: f.actors.privacy.id, p_expires: new Date(Date.now() + 86400000).toISOString(), p_version: 1 });
  await rpc(c.privacy, "goos_s4_privacy_action", { p_id: id, p_action: "verify_identity", p_version: await rowVersion(id), p_reason: "authenticated_session_review" });
  await rpc(c.privacy, "goos_s4_privacy_action", { p_id: id, p_action: "approve", p_version: await rowVersion(id), p_reason: null });
}
beforeAll(async () => {
  execFileSync(process.execPath, ["scripts/seed-s4-fixtures.mjs"], { stdio: "pipe", timeout: 200000 });
  f = JSON.parse(readFileSync(".local/s4-fixtures.json", "utf8"));
  for (const [name, a] of Object.entries(f.actors)) {
    c[name] = createClient(runtime.apiUrl, runtime.anonKey, { auth: { persistSession: false, autoRefreshToken: false } });
    if ((await c[name].auth.signInWithPassword({ email: a.email, password: a.password })).error) throw Error("Purge fixture login");
    if (a.factorId && (await c[name].auth.mfa.challengeAndVerify({ factorId: a.factorId, code: syntheticTotp(a.totp!) })).error) throw Error("Purge fixture MFA");
  }
}, 240000);
afterAll(async () => { await sql("update private.purge_settings set enabled=false where singleton;update private.s4_release set enabled=false where singleton"); });
describe("Versioned policy and bounded rollout", () => {
  it("denies guest/beneficiary policy writes and rejects incomplete legal publication", async () => {
    expect((await guest.rpc("goos_policy_read")).error?.code).toBe("42501");
    expect((await c.user.rpc("goos_policy_read")).error?.code).toBe("P0002");
    const definition = { controller_name: "", country_codes: [], privacy_contact: "", service_hours: "", notice_th: "", notice_en: "", legal_review_ack: false, retention: retentionDefaults };
    policy = await rpc(c.reviewer, "goos_policy_save", { p_id: null, p_version: null, p_definition: definition });
    const p = (await rpc(c.reviewer, "goos_policy_read")).versions.find((v: { id: string }) => v.id === policy);
    expect((await c.reviewer.rpc("goos_policy_publish", { p_id: policy, p_hash: p.content_hash })).error?.code).toBe("22023");
    expect((await c.reviewer.rpc("goos_policy_save", { p_id: null, p_version: null, p_definition: { ...definition, country_codes: [null] } })).error?.code).toBe("22023");
  });
  it("publishes only a reviewed immutable policy and returns a safe public notice", async () => {
    const definition = { controller_name: "Synthetic policy operator", country_codes: ["TH"], privacy_contact: "privacy@example.test", service_hours: "Synthetic staffed hours for tests only", notice_th: "ประกาศสำหรับทดสอบข้อมูลสมมติเท่านั้น ระบุผู้รับ วัตถุประสงค์ และฟิลด์ก่อนแชร์ ใช้อายุการเก็บตาม policy รุ่นนี้ ผู้ใช้ถอนแชร์และยื่นคำขอลบได้โดยตรวจ hold และสำเนาภายนอก", notice_en: "Synthetic policy only. Review recipients, purpose and exact fields before sharing. Retention follows this policy version. Withdrawal and deletion include holds, recipient copies and restore replay.", legal_review_ack: true, retention: retentionDefaults };
    await rpc(c.reviewer, "goos_policy_save", { p_id: policy, p_version: 1, p_definition: definition });
    const p = (await rpc(c.reviewer, "goos_policy_read")).versions.find((v: { id: string }) => v.id === policy);
    await rpc(c.reviewer, "goos_policy_publish", { p_id: policy, p_hash: p.content_hash });
    const publicPolicy = await rpc(guest, "goos_policy_public", { p_locale: "th" });
    expect(publicPolicy.controller).toBe(definition.controller_name); expect(publicPolicy.retention.case_days).toBe(365); expect(publicPolicy).not.toHaveProperty("created_by");
    await expect(sql("update private.policy_versions set definition='{}'::jsonb where id=$1", [policy])).rejects.toMatchObject({ code: "42501" });
  });
  it("owner preview blocks public intake; policy setup can repair a missing roster without bypassing MFA", async () => {
    await rpc(c.reviewer, "goos_policy_release", { p_mode: "owner_preview" });
    expect((await c.user.rpc("goos_s4_sources")).error?.code).toBe("42501");
    expect((await guest.rpc("goos_s4_guest_report", { p_kind: "service", p_body: "Synthetic preview intake", p_appeal: null, p_receipt: null })).error?.code).toBe("42501");
    for (const scope of ["impact", "privacy", "safety"]) await rpc(c.reviewer, "goos_policy_scope", { p_account: f.actors[scope].id, p_scope: scope, p_grant: true, p_expires: new Date(Date.now() + 86400000).toISOString() });
    await rpc(c.reviewer, "goos_policy_release", { p_mode: "enabled" });
    await rpc(c.reviewer, "goos_policy_scope", { p_account: f.actors.safety.id, p_scope: "safety", p_grant: false, p_expires: new Date(Date.now() + 86400000).toISOString() });
    expect((await c.user.rpc("goos_s4_sources")).error?.code).toBe("42501");
    await rpc(c.reviewer, "goos_policy_scope", { p_account: f.actors.safety.id, p_scope: "safety", p_grant: true, p_expires: new Date(Date.now() + 86400000).toISOString() });
    expect((await c.user.rpc("goos_s4_sources")).error).toBeNull();
    expect((await c.user.rpc("goos_policy_lookup", { p_email: f.actors.privacy.email })).error?.code).toBe("P0002");
    const lookup = await rpc(c.reviewer, "goos_policy_lookup", { p_email: f.actors.privacy.email }); expect(lookup.account_id).toBe(f.actors.privacy.id); expect(lookup.mfa).toBe(true);
    await sql("update private.s4_release set mode='synthetic' where singleton");
  });
});
describe("Independent targeted deletion and real Auth hard deletion", () => {
  it("prepares encrypted case/referral/evidence canaries and an owner-confirmed request", async () => {
    const version = (await sql("select version from app.cases where id=$1", [f.sourceCase]))[0].version;
    note = await rpc(c.worker, "goos_s3_note", { p_case: f.sourceCase, p_body: "PURGE SOURCE PRIVATE CANARY", p_visibility: "internal", p_supersedes: null, p_version: version });
    const referral = await rpc(c.user, "goos_s4_propose", { p_case: f.sourceCase, p_opportunity: f.targetListing, p_purpose: "service_support" });
    const notice = await rpc(c.user, "goos_s4_notice", { p_locale: "en" });
    const preview = await rpc(c.user, "goos_s4_preview", { p_id: referral, p_fields: ["display_alias"], p_skills: [], p_notice: notice.id });
    await rpc(c.user, "goos_s4_submit", { p_preview: preview.id, p_hash: preview.hash, p_notice: notice.id, p_confirmed: true, p_key: crypto.randomUUID() });
    const accepted = await rpc(c.outsider, "goos_s4_referral_action", { p_id: referral, p_action: "accept", p_version: 2, p_member: f.targetMembers.replacement }); destination = accepted.case_id;
    outcome = await rpc(c.replacement, "goos_s4_outcome_create", { p_case: destination, p_kind: "service_delivered", p_start: "2026-11-01", p_end: "2026-11-03", p_occurred: "2026-11-03T08:00:00Z", p_body: "PURGE OUTCOME PRIVATE CANARY", p_corrects: null });
    const png = await sharp({ create: { width: 64, height: 64, channels: 3, background: "#ffffff" } }).png().toBuffer();
    evidence = await rpc(c.replacement, "goos_s4_evidence", { p_id: outcome, p_body: png.toString("base64") });
    request = await rpc(c.user, "goos_s4_privacy_create", { p_kind: "delete", p_body: "Synthetic owner-confirmed deletion", p_confirmed: true });
    receipt = await rpc(c.user, "goos_purge_receipt", { p_request: request }); expect(receipt).toMatch(/^[a-f0-9]{64}$/);
    expect((await c.delegate.rpc("goos_purge_receipt", { p_request: request })).error?.code).toBe("P0002");
    await identity(request);
  });
  it("requires assigned MFA identity review, independent approval and a current snapshot", async () => {
    expect((await c.user.rpc("goos_purge_preview", { p_request: request })).error?.code).toBe("P0002");
    expect((await c.outsider.rpc("goos_purge_preview", { p_request: request })).error?.code).toBe("P0002");
    const p = await rpc(c.privacy, "goos_purge_preview", { p_request: request }); expect(p.blockers).toEqual([]);
    expect((await c.privacy.rpc("goos_purge_approve", { p_request: request, p_hash: p.hash })).error?.code).toBe("P0002");
    await sql("update app.subjects set display_alias='Synthetic changed alias',version=version+1 where account_id=$1", [f.actors.user.id]);
    expect((await c.reviewer.rpc("goos_purge_approve", { p_request: request, p_hash: p.hash })).error?.code).toBe("40001");
  });
  it("holds remain blocking until explicitly reviewed, even after their review date", async () => {
    await rpc(c.privacy, "goos_purge_hold", { p_request: request, p_reason: "legal_obligation", p_expires: new Date(Date.now() + 86400000).toISOString(), p_release: null });
    const h = (await rpc(c.reviewer, "goos_purge_list")).holds.find((v: { subject_id: string }) => v.subject_id === f.subjects.user);
    await sql("update private.retention_holds set expires_at=now()-interval '1 hour' where id=$1", [h.id]);
    const p = await rpc(c.reviewer, "goos_purge_preview", { p_request: request }); expect(p.blockers).toContain("ACTIVE_HOLD");
    expect((await c.reviewer.rpc("goos_purge_approve", { p_request: request, p_hash: p.hash })).error?.code).toBe("40001");
    await rpc(c.privacy, "goos_purge_hold", { p_request: request, p_reason: null, p_expires: null, p_release: h.id });
  });
  it("requires external ledger acknowledgement and blocks changed scope before execution", async () => {
    const p = await rpc(c.reviewer, "goos_purge_preview", { p_request: request }); job = await rpc(c.reviewer, "goos_purge_approve", { p_request: request, p_hash: p.hash });
    await rpc(c.reviewer, "goos_purge_enable", { p_enabled: true });
    expect(await tx(async db => (await db.query("select private.goos_purge_claim() j")).rows[0].j)).toBeNull();
    intent = await rpc(c.reviewer, "goos_purge_ledger", { p_job: job }); expect(intent.ledger.stage).toBe("intent"); privateJson(".local/purge-intent-receipt.json", intent);
    await expect(sql("select private.goos_purge_replay($1::jsonb)", [JSON.stringify([intent])])).rejects.toMatchObject({ code: "42501" });
    expect((await c.reviewer.rpc("goos_purge_ledger_saved", { p_job: job, p_hash: "0".repeat(64) })).error?.code).toBe("40001");
    await rpc(c.reviewer, "goos_purge_ledger_saved", { p_job: job, p_hash: intent.hash });
    await sql("update app.subjects set version=version+1 where account_id=$1", [f.actors.user.id]);
    expect(await tx(async db => (await db.query("select private.goos_purge_claim() j")).rows[0].j)).toBeNull();
    expect((await sql("select state from private.purge_jobs where id=$1", [job]))[0].state).toBe("blocked");
    const fresh = await rpc(c.reviewer, "goos_purge_preview", { p_request: request }); await rpc(c.reviewer, "goos_purge_approve", { p_request: request, p_hash: fresh.hash });
    intent = await rpc(c.reviewer, "goos_purge_ledger", { p_job: job }); await rpc(c.reviewer, "goos_purge_ledger_saved", { p_job: job, p_hash: intent.hash });
  });
  it("scrubs live content atomically, blocks a queued writer and keeps audit/other users intact", async () => {
    const other = (await rpc(c.second, "goos_profile", { p_subject_id: f.subjects.second })).display_alias;
    const audit = Number((await sql("select count(*) n from private.audit_events"))[0].n);
    const lease = await tx(async db => (await db.query("select private.goos_purge_claim() j")).rows[0].j); expect(lease.job_id).toBe(job);
    const db = new pg.Client({ connectionString: runtime.dbUrl }); await db.connect();
    try {
      await db.query("begin"); await db.query("set local role goos_worker");
      const counts = (await db.query("select private.goos_purge_execute($1,$2) c", [job, lease.lease_id])).rows[0].c; expect(counts.source_notes).toBeGreaterThan(0);
      let finished = false;
      const currentVersion = (await sql("select version from app.cases where id=$1", [f.sourceCase]))[0].version;
      const writing = c.worker.rpc("goos_s3_note", { p_case: f.sourceCase, p_body: "LATE WRITE MUST NOT SURVIVE", p_visibility: "internal", p_supersedes: null, p_version: currentVersion }).then(v => { finished = true; return v; });
      await new Promise(resolve => setTimeout(resolve, 120)); expect(finished).toBe(false);
      await db.query("commit"); expect(["42501", "P0002"]).toContain((await writing).error?.code);
      expect((await sql("select private.goos_s3_decrypt(encrypted_body) d from private.case_notes where id=$1", [note]))[0].d).toEqual({});
      expect((await sql("select original_body is null and safe_body is null cleared from private.s4_evidence where id=$1", [evidence]))[0].cleared).toBe(true);
      expect((await sql("select private.goos_s3_decrypt(encrypted_body) d from private.s4_outcomes where id=$1", [outcome]))[0].d).toEqual({});
      expect((await rpc(c.second, "goos_profile", { p_subject_id: f.subjects.second })).display_alias).toBe(other);
      expect(Number((await sql("select count(*) n from private.audit_events"))[0].n)).toBeGreaterThanOrEqual(audit);
      await expect(sql("update private.audit_events set action=action where false")).rejects.toMatchObject({ code: "42501" });
      const deleted = await admin.auth.admin.deleteUser(f.actors.user.id, false); expect(deleted.error).toBeNull();
      await tx(t => t.query("select private.goos_purge_auth_done($1,$2)", [job, lease.lease_id]));
    } catch (e) { await db.query("rollback"); throw e; } finally { await db.end(); }
  }, 30000);
  it("requires executed receipts for restore; deleted accounts lose old sessions and have anonymous tracking only", async () => {
    expect((await sql("select count(*)::int n from auth.users where id=$1", [f.actors.user.id]))[0].n).toBe(0);
    expect((await c.user.rpc("goos_context")).error?.code).toBe("28000");
    executed = await rpc(c.reviewer, "goos_purge_ledger", { p_job: job }); expect(executed.ledger.stage).toBe("executed"); privateJson(".local/purge-executed-receipt.json", executed);
    await rpc(c.reviewer, "goos_purge_ledger_saved", { p_job: job, p_hash: executed.hash });
    expect((await sql("select private.goos_purge_replay($1::jsonb) n", [JSON.stringify([executed])]))[0].n).toBe(0);
    expect((await sql("select private.goos_purge_replay($1::jsonb) n", [JSON.stringify([executed])]))[0].n).toBe(0);
    const status = await rpc(guest, "goos_purge_status", { p_receipt: receipt }); expect(status.live_database).toBe("scrubbed"); expect(status.authentication).toBe("deleted"); expect(status).not.toHaveProperty("subject_id");
    expect((await guest.rpc("goos_purge_status", { p_receipt: "0".repeat(64) })).error?.code).toBe("P0002");
    const grants = await sql("select has_function_privilege(r,f,'execute') allowed from unnest(array['anon','authenticated','goos_api']) r cross join unnest(array['private.goos_purge_execute(uuid,uuid)','private.goos_purge_scrub(uuid,uuid,uuid)','private.goos_purge_replay(jsonb)']) f"); expect(grants.every(r => r.allowed === false)).toBe(true);
  });
  it("runs the real leased worker and hard-deletes a separate consenting helper account", async () => {
    if (!f.subjects.delegate) { const p = await c.delegate.rpc("goos_profile", { p_subject_id: null }); if (p.error) await rpc(c.delegate, "goos_create_profile", { p_display_alias: "Synthetic helper own profile", p_country_code: "TH", p_age_band: "adult", p_notice_id: "00000000-0000-4000-8000-000000000002", p_confirmed: true }); }
    const id = await rpc(c.delegate, "goos_s4_privacy_create", { p_kind: "delete", p_body: "Synthetic helper own deletion", p_confirmed: true }); await identity(id);
    const p = await rpc(c.reviewer, "goos_purge_preview", { p_request: id }); expect(p.blockers).toEqual([]);
    helperJob = await rpc(c.reviewer, "goos_purge_approve", { p_request: id, p_hash: p.hash }); const ledger = await rpc(c.reviewer, "goos_purge_ledger", { p_job: helperJob }); await rpc(c.reviewer, "goos_purge_ledger_saved", { p_job: helperJob, p_hash: ledger.hash });
    const result = await purgeOne(tx, { enabled: true, url: runtime.apiUrl, key: runtime.serviceRoleKey, local: true }); expect(result.processed).toBe(true);
    expect((await sql("select count(*)::int n from auth.users where id=$1", [f.actors.delegate.id]))[0].n).toBe(0);
    expect((await admin.auth.admin.getUserById(f.actors.second.id)).error).toBeNull();
  }, 30000);
});
