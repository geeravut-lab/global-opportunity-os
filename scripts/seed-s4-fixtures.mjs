// Local synthetic S4 actors. Never runs against a hosted database.
import { createClient } from "@supabase/supabase-js";
import pg from "pg";
import { readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { randomUUID, randomBytes } from "node:crypto";
import { localRuntime } from "./local-runtime.ts";
import { privateJson, syntheticTotp } from "./validation-runtime.ts";
const runtime = localRuntime();
if (
  new URL(runtime.dbUrl).port !== "54322" ||
  new URL(runtime.apiUrl).port !== "54321"
)
  throw Error("S4 local fixture guard");
execFileSync(process.execPath, ["scripts/seed-s3-fixtures.mjs"], {
  stdio: "pipe",
  timeout: 120000,
});
const f = JSON.parse(readFileSync(".local/s3-fixtures.json", "utf8"));
f.run = "s4" + randomBytes(6).toString("hex");
f.targetOrg = f.foreignOrg;
f.targetMembers = {};
const save = () => privateJson(".local/s4-fixtures.json", f);
const clients = {};
const admin = createClient(runtime.apiUrl, runtime.serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  }),
  db = new pg.Client({ connectionString: runtime.dbUrl });
await db.connect();
async function rpc(c, n, a = {}) {
  const r = await c.rpc(n, a);
  if (r.error) throw Error(n + ": " + r.error.code + " " + r.error.message);
  return r.data;
}
try {
  for (const name of ["impact", "privacy", "safety"]) {
    const email = f.run + "-" + name + "@example.test",
      password = "S4-" + randomBytes(24).toString("base64url");
    const r = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      app_metadata: { goos_s4_fixture_run: f.run },
    });
    if (r.error) throw Error("S4 fixture account");
    f.actors[name] = { id: r.data.user.id, email, password };
    save();
  }
  for (const [name, a] of Object.entries(f.actors)) {
    const c = createClient(runtime.apiUrl, runtime.anonKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    clients[name] = c;
    const login = await c.auth.signInWithPassword({
      email: a.email,
      password: a.password,
    });
    if (login.error) throw Error("S4 fixture login");
    await rpc(c, "goos_bootstrap_account", { p_locale: "en" });
    if (["impact", "privacy", "safety"].includes(name)) {
      await rpc(c, "goos_create_profile", {
        p_display_alias: "Synthetic " + name,
        p_country_code: "TH",
        p_age_band: "adult",
        p_notice_id: "00000000-0000-4000-8000-000000000001",
        p_confirmed: true,
      });
      const e = await c.auth.mfa.enroll({
        factorType: "totp",
        friendlyName: "S4 synthetic",
      });
      if (e.error) throw Error("S4 fixture MFA");
      a.factorId = e.data.id;
      a.totp = e.data.totp.secret;
      save();
    }
    if (a.factorId) {
      const r = await c.auth.mfa.challengeAndVerify({
        factorId: a.factorId,
        code: syntheticTotp(a.totp),
      });
      if (r.error) throw Error("S4 fixture MFA verify");
    }
  }
  await db.query("update private.s4_release set enabled=true where singleton");
  // Fixed synthetic organization state; core scenarios below use real user JWTs.
  await db.query(
    "update app.organizations set status='verified',verification_expires_at=now()+interval '30 days' where id=$1 and created_by=$2",
    [f.targetOrg, f.actors.outsider.id],
  );
  const members = await rpc(clients.outsider, "goos_members", {
    p_org: f.targetOrg,
  });
  f.targetMembers.supervisor = members.find(
    (m) => m.account_id === f.actors.outsider.id,
  ).id;
  await rpc(clients.outsider, "goos_s3_role", {
    p_org: f.targetOrg,
    p_member: f.targetMembers.supervisor,
    p_role: "supervisor",
    p_grant: true,
    p_reason: "Synthetic S4 destination routing",
  });
  for (const name of ["replacement", "recruiter"]) {
    const invitation = await rpc(clients.outsider, "goos_invite_member", {
      p_org: f.targetOrg,
      p_recipient: f.actors[name].id,
      p_role: "caseworker",
    });
    f.targetMembers[name] = await rpc(clients[name], "goos_accept_invitation", {
      p_id: invitation,
    });
  }
  f.thirdOrg = await rpc(clients.safety, "goos_create_organization", {
    p_name: "Synthetic S4 third " + f.run,
    p_country_code: "TH",
  });
  const id = randomUUID(),
    revision = randomUUID();
  await db.query(
    "insert into app.opportunities(id,organization_id) values($1,$2)",
    [id, f.targetOrg],
  );
  await db.query(
    "insert into app.opportunity_revisions select (jsonb_populate_record(null::app.opportunity_revisions,to_jsonb(r)||jsonb_build_object('id',$1::text,'opportunity_id',$2::text,'revision_no',1,'title_th',$3::text,'title_en',$3::text))).* from app.opportunity_revisions r join app.opportunities p on p.approved_revision_id=r.id where p.id=$4",
    [revision, id, "Synthetic S4 destination " + f.run, f.listings.unlimited],
  );
  await db.query(
    "update app.opportunities set state='published',approved_revision_id=$2 where id=$1",
    [id, revision],
  );
  await db.query(
    "insert into private.catalog_reviews(opportunity_id,revision_id,actor_id,decision,reason) values($1,$2,$3,'publish','Synthetic S4 fixture review')",
    [id, revision, f.actors.reviewer.id],
  );
  f.targetListing = id;
  const p = await rpc(clients.user, "goos_s3_preview", {
    p_subject: f.subjects.user,
    p_opportunity: f.listings.unlimited,
    p_fields: ["display_alias", "country_code"],
    p_skills: [],
    p_notice: "00000000-0000-4000-8000-000000000202",
    p_application: null,
  });
  const a = await rpc(clients.user, "goos_s3_submit", {
    p_preview: p.id,
    p_hash: p.hash,
    p_notice: "00000000-0000-4000-8000-000000000202",
    p_confirmed: true,
    p_readback: false,
    p_key: randomUUID(),
  });
  f.sourceCase = a.case_id;
  f.sourceApplication = a.id;
  const v = (
    await db.query("select version from app.cases where id=$1", [f.sourceCase])
  ).rows[0].version;
  await rpc(clients.publisher, "goos_s3_assign", {
    p_case: f.sourceCase,
    p_member: f.members.worker,
    p_version: v,
  });
  for (const action of ["start_review", "accept"]) {
    const version = (
      await db.query("select version from app.applications where id=$1", [a.id])
    ).rows[0].version;
    await rpc(clients.worker, "goos_s3_transition", {
      p_id: a.id,
      p_action: action,
      p_version: version,
      p_reason: "reviewed",
      p_fields: [],
    });
  }
  for (const scope of ["impact", "privacy", "safety"])
    await rpc(clients.reviewer, "goos_s4_scope", {
      p_account: f.actors[scope].id,
      p_scope: scope,
      p_grant: true,
      p_expires: new Date(Date.now() + 7 * 86400000).toISOString(),
    });
  save();
  console.log(
    "S4 synthetic fixture ready; credentials retained in ignored local manifest",
  );
} finally {
  await db.end();
}
