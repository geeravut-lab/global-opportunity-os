import pg from "pg";
import nodemailer from "nodemailer";
import { timingSafeEqual, createHash } from "node:crypto";
import { rootCertificates } from "node:tls";
import { supabaseProductionCa } from "./supabase-ca.mjs";
import { validateBrandImage } from "../platform/image.ts";
import { purgeOne } from "./purge.mjs";
export function authorized(header, secret) {
  if (!secret || secret.length < 32 || !header?.startsWith("Bearer "))
    return false;
  const digest = (v) => createHash("sha256").update(v).digest();
  return timingSafeEqual(digest(header.slice(7)), digest(secret));
}
export function failureReason(error) {
  const code = error?.code;
  if (
    [
      "SELF_SIGNED_CERT_IN_CHAIN",
      "UNABLE_TO_VERIFY_LEAF_SIGNATURE",
      "CERT_HAS_EXPIRED",
      "DEPTH_ZERO_SELF_SIGNED_CERT",
    ].includes(code)
  )
    return "DATABASE_TLS";
  if (["28P01", "28000"].includes(code)) return "DATABASE_AUTH";
  if (code === "42501") return "DATABASE_PRIVILEGE";
  if (
    [
      "ETIMEDOUT",
      "ECONNREFUSED",
      "ECONNRESET",
      "ENOTFOUND",
      "EHOSTUNREACH",
    ].includes(code)
  )
    return "DATABASE_CONNECTIVITY";
  if (code === "57014") return "DATABASE_TIMEOUT";
  return "INTERNAL_FAILURE";
}
export async function inspectEvidence(c, table) {
  if (!["org_evidence", "s4_evidence"].includes(table))
    throw Error("Evidence table guard");
  const row = (
    await c.query(
      `select id,original_body from private.${table} where status='quarantined' order by created_at for update skip locked limit 1`,
    )
  ).rows[0];
  if (!row) return null;
  let safe;
  try {
    safe = Buffer.from(
      (await validateBrandImage(row.original_body, "logo")).png,
      "base64",
    );
  } catch {
    safe = null;
  }
  await c.query(
    `update private.${table} set status=$2,safe_body=$3,original_body=null,content_hash=case when $3::bytea is null then null else encode(sha256($3::bytea),'hex') end,inspection=$4,processed_at=now() where id=$1`,
    [
      row.id,
      safe ? "clean" : "rejected",
      safe,
      safe ? "png-decoded-reencoded-v1" : "png-rejected-v1",
    ],
  );
  return safe ? "clean" : "rejected";
}
export async function maintain(env = process.env) {
  const url = new URL(env.S3_WORKER_DATABASE_URL ?? "http://invalid");
  if (
    !["postgres:", "postgresql:"].includes(url.protocol) ||
    !url.username.startsWith("goos_maintenance_login") ||
    !url.hostname.endsWith(".pooler.supabase.com")
  )
    throw Error("Worker configuration unavailable");
  const origin = new URL(env.APP_ORIGIN ?? "http://invalid");
  if (origin.origin !== "https://opp4all.vercel.app")
    throw Error("Worker origin guard");
  const db = new pg.Client({
    connectionString: url.toString(),
    ssl: {
      rejectUnauthorized: true,
      ca: [...rootCertificates, ...supabaseProductionCa],
    },
    connectionTimeoutMillis: 10000,
    query_timeout: 10000,
  });
  await db.connect();
  const tx = async (task) => {
    await db.query("begin");
    try {
      await db.query("set local role goos_worker");
      const result = await task(db);
      await db.query("commit");
      return result;
    } catch (e) {
      await db.query("rollback");
      throw e;
    }
  };
  const stats = {
    inApp: 0,
    email: 0,
    cancelled: 0,
    failed: 0,
    clean: 0,
    rejected: 0,
    emailConfigured: false,
  };
  const smtpReady = [
    "SMTP_HOST",
    "SMTP_PORT",
    "SMTP_USER",
    "SMTP_PASSWORD",
    "SMTP_FROM",
  ].every((k) => !!env[k]);
  let transport;
  try {
    let budget = 3;
    for (const table of env.S4_ENABLED === "true"
      ? ["org_evidence", "s4_evidence"]
      : ["org_evidence"]) {
      while (budget > 0) {
        const state = await tx((c) => inspectEvidence(c, table));
        if (!state) break;
        stats[state]++;
        budget--;
      }
    }
    await tx((c) => c.query("select private.goos_s3_tick(null)"));
    if (smtpReady) {
      const port = Number(env.SMTP_PORT);
      if (![465, 587].includes(port)) throw Error("SMTP TLS port required");
      transport = nodemailer.createTransport({
        host: env.SMTP_HOST,
        port,
        secure: port === 465,
        requireTLS: port === 587,
        auth: { user: env.SMTP_USER, pass: env.SMTP_PASSWORD },
        tls: { rejectUnauthorized: true },
        connectionTimeout: 8000,
        greetingTimeout: 8000,
        socketTimeout: 8000,
        logger: false,
        debug: false,
        disableFileAccess: true,
        disableUrlAccess: true,
      });
      stats.emailConfigured = true;
    }
    for (const channel of smtpReady ? ["in_app", "email"] : ["in_app"]) {
      const jobs = await tx(
        async (c) =>
          (
            await c.query("select private.goos_s3_claim($1,5,null) jobs", [
              channel,
            ])
          ).rows[0].jobs,
      );
      for (const job of jobs) {
        const valid = await tx(
          async (c) =>
            (
              await c.query(
                "select private.goos_s3_revalidate($1,$2) allowed",
                [job.id, job.lease_id],
              )
            ).rows[0].allowed,
        );
        if (!valid) {
          await tx((c) =>
            c.query("select private.goos_s3_ack($1,$2,true,null)", [
              job.id,
              job.lease_id,
            ]),
          );
          stats.cancelled++;
          continue;
        }
        try {
          if (channel === "email") {
            const th = job.locale === "th";
            await transport.sendMail({
              from: env.SMTP_FROM,
              to: job.email,
              messageId: "<" + job.id + "@opp4all.vercel.app>",
              subject: th
                ? "มีการอัปเดตในบัญชี Opp4All ของคุณ"
                : "Your Opp4All account has an update",
              text:
                (th
                  ? "มีการอัปเดตในบัญชีของคุณ กรุณาเข้าสู่ระบบเพื่อตรวจสอบอย่างปลอดภัย"
                  : "Your account has an update. Sign in to review it securely.") +
                "\n" +
                origin.origin +
                "/" +
                (th ? "th" : "en") +
                "/workflow",
            });
          }
          await tx((c) =>
            c.query("select private.goos_s3_ack($1,$2,true,null)", [
              job.id,
              job.lease_id,
            ]),
          );
          stats[channel === "email" ? "email" : "inApp"]++;
        } catch {
          await tx((c) =>
            c.query(
              "select private.goos_s3_ack($1,$2,false,'transport_unavailable')",
              [job.id, job.lease_id],
            ),
          );
          stats.failed++;
        }
      }
    }
    const purge = await purgeOne(tx, { enabled: env.S4_PURGE_ENABLED === "true", url: env.NEXT_PUBLIC_SUPABASE_URL ?? "", key: env.SUPABASE_PURGE_AUTH_KEY });
    return { ...stats, purge };
  } finally {
    transport?.close();
    await db.end();
  }
}
