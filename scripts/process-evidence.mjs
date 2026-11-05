// Worker ตรวจ PNG แบบ local เท่านั้น ไม่ใช่ AV ครบทุกชนิดไฟล์หรือบริการที่ deploy แล้ว
import pg from "pg";
import { createHash } from "node:crypto";
import { localRuntime } from "./local-runtime.ts";
import { validateBrandImage } from "../lib/platform/image.ts";
const r = localRuntime();
const target = process.argv[2] ?? null;
if (
  target &&
  !/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(
    target,
  )
)
  throw Error("Evidence UUID guard");
if (
  new URL(r.dbUrl).hostname !== "127.0.0.1" ||
  new URL(r.dbUrl).port !== "54322"
)
  throw Error("Local evidence worker guard");
const c = new pg.Client({ connectionString: r.dbUrl });
await c.connect();
let clean = 0,
  rejected = 0;
try {
  for (let i = 0; i < 20; i++) {
    await c.query("begin");
    try {
      const row = (
        await c.query(
          "select id,original_body from private.org_evidence where status='quarantined' and($1::uuid is null or id=$1) order by created_at for update skip locked limit 1",
          [target],
        )
      ).rows[0];
      if (!row) {
        await c.query("commit");
        break;
      }
      let safe;
      try {
        const image = await validateBrandImage(row.original_body, "logo");
        safe = Buffer.from(image.png, "base64");
      } catch {
        safe = null;
      }
      if (safe) {
        await c.query(
          "update private.org_evidence set status='clean',safe_body=$2,original_body=null,content_hash=$3,inspection='png-decoded-reencoded-v1',processed_at=now() where id=$1",
          [row.id, safe, createHash("sha256").update(safe).digest("hex")],
        );
        clean++;
      } else {
        await c.query(
          "update private.org_evidence set status='rejected',original_body=null,inspection='png-rejected-v1',processed_at=now() where id=$1",
          [row.id],
        );
        rejected++;
      }
      await c.query("commit");
    } catch (e) {
      await c.query("rollback");
      throw e;
    }
  }
  console.log(
    JSON.stringify({
      localOnly: true,
      clean,
      rejected,
      inspection: "PNG decode and re-encode; not a general malware scan",
    }),
  );
} finally {
  await c.end();
}
