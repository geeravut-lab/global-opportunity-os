import { createClient } from "@supabase/supabase-js";
// The worker receives a leased approved job, never a beneficiary ID from an HTTP request.
export async function purgeOne(transaction, config) {
  if (!config.enabled || !config.key) return { configured: false, processed: false };
  const target = new URL(config.url);
  const local = ["127.0.0.1", "localhost"].includes(target.hostname) && ["54321", "57321"].includes(target.port);
  if ((!local && target.origin !== "https://fxqgvqvthrdzmgnmqgom.supabase.co") || (local && !config.local)) throw Error("Purge Auth target guard");
  await transaction(c => c.query("select private.goos_purge_tick()"));
  const job = await transaction(async c => (await c.query("select private.goos_purge_claim() as job")).rows[0].job);
  if (!job) return { configured: true, processed: false };
  const counts = await transaction(async c => (await c.query("select private.goos_purge_execute($1,$2) as counts", [job.job_id, job.lease_id])).rows[0].counts);
  if (!counts) return { configured: true, processed: false, blocked: true };
  const admin = createClient(target.origin, config.key, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false }, global: { fetch: (input, init) => fetch(input, { ...init, signal: init?.signal ?? AbortSignal.timeout(10000) }) } });
  try {
    const deleted = await admin.auth.admin.deleteUser(job.account_id, false);
    if (deleted.error && deleted.error.status !== 404 && deleted.error.code !== "user_not_found") return { configured: true, processed: false, authentication: "retry_required" };
    await transaction(c => c.query("select private.goos_purge_auth_done($1,$2)", [job.job_id, job.lease_id]));
    return { configured: true, processed: true, authentication: "deleted" };
  } finally { await admin.removeAllChannels(); }
}
