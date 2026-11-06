// Bounded local invocation of the same quarantine inspector used by production maintenance.
import pg from "pg";
import { localRuntime } from "./local-runtime.ts";
import { inspectEvidence } from "../lib/maintenance/worker.mjs";
const r = localRuntime();
if (new URL(r.dbUrl).port !== "54322") throw Error("S4 local worker guard");
const db = new pg.Client({ connectionString: r.dbUrl });
await db.connect();
const counts = { clean: 0, rejected: 0 };
try {
  for (let i = 0; i < 20; i++) {
    await db.query("begin");
    try {
      await db.query("set local role goos_worker");
      const state = await inspectEvidence(db, "s4_evidence");
      await db.query("commit");
      if (!state) break;
      counts[state]++;
    } catch (e) {
      await db.query("rollback");
      throw e;
    }
  }
  console.log(counts);
} finally {
  await db.end();
}
