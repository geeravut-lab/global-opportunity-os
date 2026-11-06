// Synthetic local fixtures เท่านั้น; ไม่ link/migrate/เขียน hosted
import { createClient } from "@supabase/supabase-js";
import pg from "pg";
import { randomBytes, randomUUID } from "node:crypto";
import { readFileSync, existsSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { localRuntime } from "./local-runtime.ts";
import { privateJson, syntheticTotp } from "./validation-runtime.ts";
const r = localRuntime();
if (new URL(r.apiUrl).port !== "54321" || new URL(r.dbUrl).port !== "54322")
  throw Error("S2 fixture local target guard");
const db = new pg.Client({ connectionString: r.dbUrl });
await db.connect();
const run = "s2ui" + randomBytes(6).toString("hex"),
  manifest = {
    run,
    actors: {},
    org: null,
    suspendedOrg: null,
    current: null,
    expired: null,
    suspended: null,
  };
const save = () => privateJson(".local/s2-fixtures.json", manifest);
const admin = createClient(r.apiUrl, r.serviceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});
async function rpc(c, n, args = {}) {
  const x = await c.rpc(n, args);
  if (x.error) throw Error(n + ": " + x.error.code);
  return x.data;
}
const clients = {};
try {
  await db.query("update private.s4_release set enabled=false where singleton");
  // Rotate only earlier, explicitly tagged local synthetic publications; preserve rows/history and never touch hosted data.
  await db.query(
    "update app.opportunities p set state='paused' from app.opportunity_revisions r,auth.users u where r.id=p.approved_revision_id and u.id=r.created_by and p.state='published' and lower(u.email) like '%@example.test' and (u.raw_app_meta_data ? 'goos_s2_fixture_run' or u.raw_app_meta_data ? 'goos_s3_fixture_run')",
  );
  if (existsSync(".local/s2-fixtures.json")) {
    const previous = JSON.parse(
        readFileSync(".local/s2-fixtures.json", "utf8"),
      ),
      actor = previous.actors?.reviewer;
    if (
      /^s2ui[0-9a-f]{12}$/.test(previous.run) &&
      actor?.email === previous.run + "-reviewer@example.test" &&
      /^[a-f0-9-]{36}$/i.test(actor.id)
    )
      await db.query(
        "update private.platform_role_grants g set revoked_at=coalesce(g.revoked_at,now()) where g.account_id=$1 and g.granted_by=$1 and not exists(select 1 from private.platform_owner p where p.account_id=$1) and exists(select 1 from auth.users u where u.id=$1 and lower(u.email)=$2 and u.raw_app_meta_data->>'goos_s2_fixture_run'=$3)",
        [actor.id, actor.email, previous.run],
      );
  }
  save();
  for (const name of ["publisher", "reviewer", "user"]) {
    const email = run + "-" + name + "@example.test",
      password = "S2-" + randomBytes(24).toString("base64url"),
      u = await admin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        app_metadata: { goos_s2_fixture_run: run },
      });
    if (u.error || !u.data.user) throw Error("S2 fixture creation");
    const actor = { id: u.data.user.id, email, password };
    manifest.actors[name] = actor;
    save();
    const c = createClient(r.apiUrl, r.anonKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    clients[name] = c;
    if ((await c.auth.signInWithPassword({ email, password })).error)
      throw Error("S2 fixture sign-in");
    await rpc(c, "goos_bootstrap_account", { p_locale: "en" });
    await rpc(c, "goos_create_profile", {
      p_display_alias: "Synthetic " + name,
      p_country_code: "TH",
      p_age_band: "adult",
      p_notice_id: "00000000-0000-4000-8000-000000000001",
      p_confirmed: true,
    });
    if (name !== "user") {
      const e = await c.auth.mfa.enroll({
        factorType: "totp",
        friendlyName: "S2 synthetic",
      });
      if (e.error) throw Error("MFA enroll");
      actor.factorId = e.data.id;
      actor.totp = e.data.totp.secret;
      save();
      if (
        (
          await c.auth.mfa.challengeAndVerify({
            factorId: actor.factorId,
            code: syntheticTotp(actor.totp),
          })
        ).error
      )
        throw Error("MFA verify");
    }
  }
  await db.query(
    "insert into private.platform_role_grants(account_id,granted_by,role_code) values($1,$1,'platform_admin')",
    [manifest.actors.reviewer.id],
  );
  const future = new Date(Date.now() + 30 * 86400000).toISOString();
  const orgRow = async (id) =>
    (await rpc(clients.publisher, "goos_s2_orgs")).find((o) => o.id === id);
  async function organization(name) {
    const id = await rpc(clients.publisher, "goos_create_organization", {
      p_name: name,
      p_country_code: "TH",
    });
    const evidence = await rpc(clients.publisher, "goos_s2_upload_intent", {
      p_org: id,
    });
    await rpc(clients.publisher, "goos_s2_upload", {
      p_id: evidence,
      p_png: readFileSync("public/brand-defaults/favicon.png").toString(
        "base64",
      ),
    });
    execFileSync(process.execPath, ["scripts/process-evidence.mjs", evidence], {
      stdio: "pipe",
    });
    for (const action of ["submit", "start_review", "verify"])
      await rpc(
        action === "submit" ? clients.publisher : clients.reviewer,
        "goos_s2_transition_org",
        {
          p_org: id,
          p_action: action,
          p_reason: "Synthetic fixture setup",
          p_expires: future,
          p_expected_version: (await orgRow(id)).version,
        },
      );
    return id;
  }
  manifest.org = await organization("Synthetic " + run);
  save();
  manifest.suspendedOrg = await organization("Synthetic suspended " + run);
  save();
  const data = {
    title_th: "เส้นทางทักษะ " + run,
    title_en: "Skills pathway " + run,
    description_th: "ข้อมูลสมมติสำหรับทดสอบ ไม่ใช่บริการจริง",
    description_en: "Synthetic test opportunity; no real service.",
    category: "skills",
    country_code: "TH",
    coarse_region: "",
    languages: ["th", "en"],
    remote: true,
    cost_amount: 0,
    currency: "THB",
    accessibility_th: "คีย์บอร์ดและข้อความอ่านง่าย",
    accessibility_en: "Keyboard and plain text",
    source_url: "https://example.invalid/" + run,
    valid_until: future,
    capacity: 20,
    rules: [
      { field: "country", op: "eq", value: "TH" },
      { field: "hours", op: "gte", value: 5 },
    ],
  };
  async function listing(org, title) {
    const id = await rpc(clients.publisher, "goos_s2_save_listing", {
      p_org: org,
      p_id: null,
      p_data: {
        ...data,
        title_th: title + " " + run,
        title_en: title + " " + run,
      },
      p_expected_version: 0,
    });
    let row = (
      await rpc(clients.publisher, "goos_s2_listings", { p_org: org })
    ).find((x) => x.id === id);
    await rpc(clients.publisher, "goos_s2_submit_listing", {
      p_id: id,
      p_expected_version: row.version,
    });
    row = (
      await rpc(clients.publisher, "goos_s2_listings", { p_org: org })
    ).find((x) => x.id === id);
    await rpc(clients.reviewer, "goos_s2_review_listing", {
      p_id: id,
      p_action: "publish",
      p_reason: "Synthetic review",
      p_expected_version: row.version,
    });
    return id;
  }
  manifest.current = await listing(manifest.org, "เส้นทางทักษะ Skills pathway");
  save();
  manifest.suspended = await listing(
    manifest.suspendedOrg,
    "Suspended synthetic",
  );
  save();
  await rpc(clients.reviewer, "goos_s2_transition_org", {
    p_org: manifest.suspendedOrg,
    p_action: "suspend",
    p_reason: "Synthetic suspension",
    p_expires: null,
    p_expected_version: (await orgRow(manifest.suspendedOrg)).version,
  });
  // Immutable historical revision: สร้างประวัติหมดอายุเฉพาะ fixture ด้วย operator local
  const expired = randomUUID(),
    rev = randomUUID();
  await db.query(
    "insert into app.opportunities(id,organization_id) values($1,$2)",
    [expired, manifest.org],
  );
  await db.query(
    "insert into app.opportunity_revisions(id,opportunity_id,revision_no,created_by,title_th,title_en,description_th,description_en,category,country_code,coarse_region,languages,remote,cost_amount,currency,accessibility_th,accessibility_en,source_url,valid_until,created_at,rules) select $1,$2,1,created_by,'Expired '||title_th,'Expired '||title_en,description_th,description_en,category,country_code,coarse_region,languages,remote,cost_amount,currency,accessibility_th,accessibility_en,source_url,now()-interval '1 day',now()-interval '2 days',rules from app.opportunity_revisions where id=(select approved_revision_id from app.opportunities where id=$3)",
    [rev, expired, manifest.current],
  );
  await db.query(
    "update app.opportunities set state='published',approved_revision_id=$2 where id=$1",
    [expired, rev],
  );
  manifest.expired = expired;
  save();
  console.log(
    "S2 local fixtures ready: current, expired and suspended; credentials kept privately in .local",
  );
} finally {
  save();
  await db.end();
}
