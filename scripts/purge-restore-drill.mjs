import { readFileSync } from "node:fs";
import { randomBytes } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { syntheticTotp, privateJson } from "./validation-runtime.ts";
import { signDeletionLedger, verifyDeletionLedger, resolveExecutedReceipts } from "../lib/maintenance/deletion-ledger.mjs";
import { purgeOne } from "../lib/maintenance/purge.mjs";
const defaults = { draft_days: 30, case_days: 365, audit_days: 730, verification_days: 90, backup_target_days: 30, request_days: 7, share_days: 30 };
const call = async (c, fn, args = {}) => { const r = await c.rpc(fn, args); if (r.error) throw Error("Purge restore " + fn + ":" + r.error.code); return r.data; };
export async function preparePurgeRestore(source, db, targetActor, ownerClient, dir) {
  if (new URL(source.apiUrl).port !== "54321" || new URL(source.dbUrl).port !== "54322") throw Error("Purge restore source guard");
  const f = JSON.parse(readFileSync(".local/s4-fixtures.json", "utf8")), actors = {};
  await db.query("update private.purge_jobs set state='blocked',last_error_code='SYNTHETIC_DRILL_RESET' where state in('awaiting_ledger','approved','ready','executing','db_purged');update private.purge_settings set enabled=false where singleton");
  await db.query("update private.s4_release set enabled=true,mode='synthetic' where singleton");
  for (const name of ["reviewer", "privacy"]) {
    const a = f.actors[name], c = createClient(source.apiUrl, source.key, { auth: { persistSession: false, autoRefreshToken: false } });
    if ((await c.auth.signInWithPassword({ email: a.email, password: a.password })).error) throw Error("Purge restore staff login");
    if ((await c.auth.mfa.challengeAndVerify({ factorId: a.factorId, code: syntheticTotp(a.totp) })).error) throw Error("Purge restore staff MFA");
    actors[name] = c;
  }
  const policy = await call(actors.reviewer, "goos_policy_save", { p_id: null, p_version: null, p_definition: { controller_name: "Synthetic restore operator", country_codes: ["TH"], privacy_contact: "privacy@example.test", service_hours: "Synthetic test hours only", notice_th: "ประกาศทดสอบกู้คืนข้อมูลสมมติเท่านั้น ผู้รับ วัตถุประสงค์ และฟิลด์จะแสดงก่อนแชร์ ถอนความยินยอมและขอลบได้ งานลบต้องตรวจ hold และมีหลักฐานนอก backup เพื่อไม่ให้ข้อมูลกลับมาหลัง restore", notice_en: "Synthetic restore drill only. Review recipients, purpose and fields before sharing. Withdrawal and deletion require review of holds and externally retained execution receipts before restoring an old backup.", legal_review_ack: true, retention: defaults } });
  const v = (await call(actors.reviewer, "goos_policy_read")).versions.find(x => x.id === policy);
  await call(actors.reviewer, "goos_policy_publish", { p_id: policy, p_hash: v.content_hash });
  for (const scope of ["privacy", "impact", "safety"]) await call(actors.reviewer, "goos_policy_scope", { p_account: f.actors[scope].id, p_scope: scope, p_grant: true, p_expires: new Date(Date.now() + 86400000).toISOString() });
  const request = await call(ownerClient, "goos_s4_privacy_create", { p_kind: "delete", p_body: "Synthetic restore deletion", p_confirmed: true });
  await call(actors.reviewer, "goos_s4_assign", { p_kind: "privacy", p_id: request, p_account: f.actors.privacy.id, p_expires: new Date(Date.now() + 86400000).toISOString(), p_version: 1 });
  const version = async () => (await db.query("select version from private.s4_privacy where id=$1", [request])).rows[0].version;
  await call(actors.privacy, "goos_s4_privacy_action", { p_id: request, p_action: "verify_identity", p_version: await version(), p_reason: "authenticated_session_review" });
  await call(actors.privacy, "goos_s4_privacy_action", { p_id: request, p_action: "approve", p_version: await version(), p_reason: null });
  const key = randomBytes(32).toString("hex"); let artifacts;
  return {
    async execute() {
      const p = await call(actors.privacy, "goos_purge_preview", { p_request: request });
      if (p.blockers.length) throw Error("Purge restore blocked");
      const job = await call(actors.reviewer, "goos_purge_approve", { p_request: request, p_hash: p.hash });
      const intent = await call(actors.reviewer, "goos_purge_ledger", { p_job: job });
      const signedIntent = signDeletionLedger(intent, key); privateJson(dir + "/purge-intent.json", signedIntent);
      await call(actors.reviewer, "goos_purge_ledger_saved", { p_job: job, p_hash: intent.hash });
      await call(actors.reviewer, "goos_purge_enable", { p_enabled: true });
      const tx = async task => { await db.query("begin"); try { await db.query("set local role goos_worker"); const v = await task(db); await db.query("commit"); return v; } catch (e) { await db.query("rollback"); throw e; } };
      const done = await purgeOne(tx, { enabled: true, local: true, url: source.apiUrl, key: source.serviceKey });
      if (!done.processed) throw Error("Purge restore worker did not complete");
      const executed = await call(actors.reviewer, "goos_purge_ledger", { p_job: job });
      const signedExecuted = signDeletionLedger(executed, key); privateJson(dir + "/purge-executed.json", signedExecuted);
      await call(actors.reviewer, "goos_purge_ledger_saved", { p_job: job, p_hash: executed.hash });
      artifacts = [signedIntent, signedExecuted];
      await db.query("update private.purge_settings set enabled=false where singleton");
    },
    async replay(targetDb, target) {
      if (new URL(target.API_URL).port !== "57321" || new URL(target.DB_URL).port !== "57322") throw Error("Purge restore target guard");
      const receipts = resolveExecutedReceipts(artifacts.map(a => verifyDeletionLedger(a, { "maintenance-v1": key })));
      await targetDb.query("select private.goos_purge_replay($1::jsonb)", [JSON.stringify(receipts)]);
      const auth = createClient(target.API_URL, target.SERVICE_ROLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
      const r = await auth.auth.admin.deleteUser(targetActor.id, false);
      if (r.error && r.error.status !== 404 && r.error.code !== "user_not_found") throw Error("Restored Auth purge failed");
      const row = (await targetDb.query("select a.auth_user_id,s.display_alias,a.status from app.accounts a join app.subjects s on s.account_id=a.id where a.id=$1", [targetActor.id])).rows[0];
      if (row.auth_user_id || row.status !== "deletion_pending" || row.display_alias.includes("กู้คืน")) throw Error("Deleted identity resurrected");
    },
  };
}
