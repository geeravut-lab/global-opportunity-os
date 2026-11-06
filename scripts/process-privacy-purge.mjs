// Explicit synthetic-only runner; never accepts a hosted URL or external Auth credentials.
import pg from "pg";
import { localRuntime } from "./local-runtime.ts";
import { purgeOne } from "../lib/maintenance/purge.mjs";
const r = localRuntime();
if (new URL(r.dbUrl).port !== "54322" || new URL(r.apiUrl).port !== "54321") throw Error("Local purge target guard");
const db = new pg.Client({ connectionString: r.dbUrl }); await db.connect();
try {
  const n = (await db.query("select count(*)::int n from auth.users where email is null or lower(email) not like '%@example.test'")).rows[0].n;
  if (n) throw Error("Purge synthetic-only account guard");
  const tx = async task => { await db.query("begin"); try { await db.query("set local role goos_worker"); const v = await task(db); await db.query("commit"); return v; } catch (e) { await db.query("rollback"); throw e; } };
  const result = await purgeOne(tx, { enabled: true, url: r.apiUrl, key: r.serviceRoleKey, local: true });
  console.log(JSON.stringify(result));
} finally { await db.end(); }
