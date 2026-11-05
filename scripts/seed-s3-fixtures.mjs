// S3 fixtures เฉพาะ loopback ที่ guard แล้ว; ไม่สร้าง partner claims หรือส่งอีเมลภายนอก
import { createClient } from "@supabase/supabase-js";
import pg from "pg";
import { readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import { localRuntime } from "./local-runtime.ts";
import { privateJson, syntheticTotp } from "./validation-runtime.ts";
const r = localRuntime();
if (new URL(r.apiUrl).port !== "54321" || new URL(r.dbUrl).port !== "54322")
  throw Error("S3 fixture target guard");
execFileSync(process.execPath, ["scripts/seed-s2-fixtures.mjs"], {
  stdio: "pipe",
});
const base = JSON.parse(readFileSync(".local/s2-fixtures.json", "utf8"));
const manifest = {
  run: "s3ui" + randomBytes(6).toString("hex"),
  org: base.org,
  current: base.current,
  actors: { ...base.actors },
  members: {},
  listings: {},
  subjects: {},
};
const save = () => privateJson(".local/s3-fixtures.json", manifest),
  clients = {};
const db = new pg.Client({ connectionString: r.dbUrl });
await db.connect();
const admin = createClient(r.apiUrl, r.serviceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});
async function rpc(c, n, args = {}) {
  const x = await c.rpc(n, args);
  if (x.error) throw Error(n + ": " + x.error.code + " " + x.error.message);
  return x.data;
}
try {
  save();
  for (const name of [
    "publisher",
    "reviewer",
    "user",
    "second",
    "delegate",
    "worker",
    "replacement",
    "recruiter",
    "outsider",
  ]) {
    let actor = manifest.actors[name];
    if (!actor) {
      const email = manifest.run + "-" + name + "@example.test",
        password = "S3-" + randomBytes(24).toString("base64url");
      const u = await admin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        app_metadata: { goos_s3_fixture_run: manifest.run },
      });
      if (u.error || !u.data.user) throw Error("S3 fixture creation");
      actor = { id: u.data.user.id, email, password };
      manifest.actors[name] = actor;
      save();
    }
    const c = createClient(r.apiUrl, r.anonKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    clients[name] = c;
    if (
      (
        await c.auth.signInWithPassword({
          email: actor.email,
          password: actor.password,
        })
      ).error
    )
      throw Error("S3 fixture sign-in");
    await rpc(c, "goos_bootstrap_account", { p_locale: "en" });
    const ctx = await rpc(c, "goos_context");
    if (!ctx.subject_id)
      manifest.subjects[name] = await rpc(c, "goos_create_profile", {
        p_display_alias: "Synthetic " + name,
        p_country_code: "TH",
        p_age_band: "adult",
        p_notice_id: "00000000-0000-4000-8000-000000000001",
        p_confirmed: true,
      });
    else manifest.subjects[name] = ctx.subject_id;
    if (!["user", "second", "delegate"].includes(name)) {
      if (!actor.factorId) {
        const e = await c.auth.mfa.enroll({
          factorType: "totp",
          friendlyName: "S3 synthetic",
        });
        if (e.error) throw Error("S3 fixture MFA enroll");
        actor.factorId = e.data.id;
        actor.totp = e.data.totp.secret;
        save();
      }
      if (
        (
          await c.auth.mfa.challengeAndVerify({
            factorId: actor.factorId,
            code: syntheticTotp(actor.totp),
          })
        ).error
      )
        throw Error("S3 fixture MFA verification");
    }
  }
  const members = await rpc(clients.publisher, "goos_members", {
    p_org: manifest.org,
  });
  manifest.members.publisher = members.find(
    (m) => m.account_id === manifest.actors.publisher.id,
  ).id;
  await rpc(clients.publisher, "goos_s3_role", {
    p_org: manifest.org,
    p_member: manifest.members.publisher,
    p_role: "supervisor",
    p_grant: true,
    p_reason: "Synthetic routing supervisor",
  });
  for (const name of ["worker", "replacement", "recruiter"]) {
    const invitation = await rpc(clients.publisher, "goos_invite_member", {
      p_org: manifest.org,
      p_recipient: manifest.actors[name].id,
      p_role: name === "recruiter" ? "recruiter" : "caseworker",
    });
    manifest.members[name] = await rpc(
      clients[name],
      "goos_accept_invitation",
      { p_id: invitation },
    );
    save();
  }
  manifest.foreignOrg = await rpc(
    clients.outsider,
    "goos_create_organization",
    { p_name: "Synthetic foreign " + manifest.run, p_country_code: "TH" },
  );
  const row = (
    await rpc(clients.publisher, "goos_s2_listings", { p_org: manifest.org })
  ).find((v) => v.id === base.current);
  for (const [name, category, capacity] of [
    ["service", "skills", 1],
    ["job", "jobs", 1],
    ["unlimited", "skills", null],
  ]) {
    const data = {
      ...row.revision,
      title_th: "เส้นทางสมมติ " + name + " " + manifest.run,
      title_en: "Synthetic " + name + " " + manifest.run,
      category,
      capacity,
      job_pay_min: category === "jobs" ? 100 : null,
      job_pay_max: category === "jobs" ? 200 : null,
      job_pay_unit: category === "jobs" ? "hour" : null,
      job_contract: category === "jobs" ? "part_time" : null,
      rules: [],
    };
    for (const key of [
      "id",
      "opportunity_id",
      "revision_no",
      "created_at",
      "rule_version",
      "created_by",
    ])
      delete data[key];
    const id = await rpc(clients.publisher, "goos_s2_save_listing", {
      p_org: manifest.org,
      p_id: null,
      p_data: data,
      p_expected_version: 0,
    });
    let entry = (
      await rpc(clients.publisher, "goos_s2_listings", { p_org: manifest.org })
    ).find((v) => v.id === id);
    await rpc(clients.publisher, "goos_s2_submit_listing", {
      p_id: id,
      p_expected_version: entry.version,
    });
    entry = (
      await rpc(clients.publisher, "goos_s2_listings", { p_org: manifest.org })
    ).find((v) => v.id === id);
    await rpc(clients.reviewer, "goos_s2_review_listing", {
      p_id: id,
      p_action: "publish",
      p_reason: "Synthetic independent review",
      p_expected_version: entry.version,
    });
    manifest.listings[name] = id;
    save();
  }
  console.log(
    "S3 local fixtures ready; synthetic accounts/roles/listings, private manifest only",
  );
} finally {
  save();
  await db.end();
}
