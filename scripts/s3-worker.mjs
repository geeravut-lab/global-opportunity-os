// Local machine worker: no browser/service-role CRUD, no external mail target.
import pg from "pg";
import nodemailer from "nodemailer";
import { localRuntime } from "./local-runtime.ts";
const r = localRuntime();
if (new URL(r.dbUrl).port !== "54322" || new URL(r.apiUrl).port !== "54321")
  throw Error("S3 worker local target guard");
const args = process.argv.slice(2),
  allowed = new Set([
    "--watch",
    "--email",
    "--tick",
    "--dry-run",
    "--org",
    "--ids",
    "--origin",
  ]);
if (
  args.some(
    (v, i) =>
      (v.startsWith("--") && !allowed.has(v)) ||
      (!v.startsWith("--") &&
        !["--org", "--ids", "--origin"].includes(args[i - 1])),
  )
)
  throw Error("Unknown worker argument");
const option = (name) =>
  args.includes(name) ? args[args.indexOf(name) + 1] : null;
const workerOrigin = new URL(option("--origin") ?? "http://127.0.0.1:3000");
if (
  workerOrigin.protocol !== "http:" ||
  workerOrigin.hostname !== "127.0.0.1" ||
  !["3000", "3300"].includes(workerOrigin.port) ||
  workerOrigin.pathname !== "/" ||
  workerOrigin.search ||
  workerOrigin.hash
)
  throw Error("Worker origin guard");
const org = option("--org"),
  ids = option("--ids")?.split(",") ?? null;
const isId = (v) =>
  /^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/i.test(v ?? "");
if (
  (org && !isId(org)) ||
  (ids && (ids.length > 100 || ids.some((v) => !isId(v))))
)
  throw Error("Worker scope guard");
const transport = nodemailer.createTransport({
  host: "127.0.0.1",
  port: 54325,
  secure: false,
  connectionTimeout: 10000,
  greetingTimeout: 10000,
  socketTimeout: 10000,
  logger: false,
  debug: false,
  disableFileAccess: true,
  disableUrlAccess: true,
});
let stopped = false;
for (const signal of ["SIGINT", "SIGTERM"])
  process.on(signal, () => {
    stopped = true;
    transport.close();
  });
async function transaction(task) {
  const db = new pg.Client({ connectionString: r.dbUrl });
  await db.connect();
  try {
    await db.query("begin");
    await db.query("set local role goos_worker");
    const result = await task(db);
    await db.query("commit");
    return result;
  } catch (error) {
    await db.query("rollback");
    throw error;
  } finally {
    await db.end();
  }
}
async function cycle() {
  const scope =
    ids ??
    (org
      ? await (async () => {
          const db = new pg.Client({ connectionString: r.dbUrl });
          await db.connect();
          try {
            return (
              await db.query(
                "select id from private.outbox where organization_id=$1 and status in('pending','inflight') order by created_at limit 100",
                [org],
              )
            ).rows.map((v) => v.id);
          } finally {
            await db.end();
          }
        })()
      : null);
  if (args.includes("--dry-run")) {
    const db = new pg.Client({ connectionString: r.dbUrl });
    await db.connect();
    try {
      const rows = (
        await db.query(
          "select channel,status,count(*)::int count from private.outbox where($1::uuid[] is null or id=any($1)) group by channel,status",
          [scope],
        )
      ).rows;
      console.log(JSON.stringify({ dryRun: true, writes: 0, counts: rows }));
      return;
    } finally {
      await db.end();
    }
  }
  if (args.includes("--tick"))
    await transaction((db) =>
      db.query("select private.goos_s3_tick($1)", [org]),
    );
  let delivered = 0,
    cancelled = 0,
    failed = 0;
  for (const channel of args.includes("--email")
    ? ["in_app", "email"]
    : ["in_app"]) {
    const jobs = await transaction(
      async (db) =>
        (
          await db.query(
            "select private.goos_s3_claim($1,20,$2::uuid[]) jobs",
            [channel, scope],
          )
        ).rows[0].jobs,
    );
    for (const job of jobs) {
      const valid = await transaction(
        async (db) =>
          (
            await db.query("select private.goos_s3_revalidate($1,$2) allowed", [
              job.id,
              job.lease_id,
            ])
          ).rows[0].allowed,
      );
      if (!valid) {
        await transaction((db) =>
          db.query("select private.goos_s3_ack($1,$2,true,null)", [
            job.id,
            job.lease_id,
          ]),
        );
        cancelled++;
        continue;
      }
      try {
        if (channel === "email") {
          if (
            typeof job.email !== "string" ||
            !job.email.endsWith("@example.test")
          )
            throw Error("smtp_rejected");
          const th = job.locale === "th",
            origin = workerOrigin.origin,
            lang = th ? "th" : "en";
          await transport.sendMail({
            from: "Opp4All <notifications@opp4all.example.test>",
            to: job.email,
            messageId: "<" + job.id + "@opp4all.example.test>",
            subject: th
              ? "มีการอัปเดตในบัญชี Opp4All ของคุณ"
              : "Your Opp4All account has an update",
            text:
              (th
                ? "มีการอัปเดตในบัญชีของคุณ กรุณาเข้าสู่ระบบเพื่อตรวจสอบข้อมูลอย่างปลอดภัย"
                : "Your account has an update. Sign in to review it securely.") +
              "\n" +
              origin +
              "/" +
              lang +
              "/workflow\n" +
              (th
                ? "อีเมลทดสอบด้วยข้อมูลสมมติ ไม่ใช่บริการจริง"
                : "Synthetic test email. No real service."),
          });
        }
        await transaction((db) =>
          db.query("select private.goos_s3_ack($1,$2,true,null)", [
            job.id,
            job.lease_id,
          ]),
        );
        delivered++;
      } catch (error) {
        const code =
          error?.message === "smtp_rejected"
            ? "smtp_rejected"
            : "transport_unavailable";
        await transaction((db) =>
          db.query("select private.goos_s3_ack($1,$2,false,$3)", [
            job.id,
            job.lease_id,
            code,
          ]),
        );
        failed++;
      }
    }
  }
  console.log(
    JSON.stringify({ worker: "local", delivered, cancelled, failed }),
  );
}
try {
  do {
    await cycle();
    if (!args.includes("--watch")) break;
    await new Promise((resolve) => setTimeout(resolve, 3000));
  } while (!stopped);
} finally {
  transport.close();
}
