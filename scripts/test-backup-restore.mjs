// Restore drill: source/target are guarded loopback Supabase stacks with synthetic identities only.
import {
  readFileSync,
  existsSync,
  writeFileSync,
  mkdirSync,
  mkdtempSync,
  openSync,
  closeSync,
  chmodSync,
} from "node:fs";
import { resolve, delimiter } from "node:path";
import { spawnSync } from "node:child_process";
import { randomBytes, createHash, randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import pg from "pg";
import { localRuntime } from "./local-runtime.ts";
import {
  privateJson,
  cleanupFixtures,
  syntheticTotp,
} from "./validation-runtime.ts";
const raw = localRuntime(),
  run = "gooss1" + randomBytes(8).toString("hex");
const source = {
  mode: "local",
  origin: "http://127.0.0.1:3000",
  apiUrl: raw.apiUrl,
  key: raw.anonKey,
  serviceKey: raw.serviceRoleKey,
  dbUrl: raw.dbUrl,
  project: "global-opportunity-os-s1-local",
};
if (
  new URL(source.dbUrl).port !== "54322" ||
  new URL(source.apiUrl).port !== "54321"
)
  throw Error("Original local source port guard");
mkdirSync(".local", { recursive: true, mode: 0o700 });
const dir = resolve(mkdtempSync(".local/restore-")),
  id = "goos-s1-restore-" + randomBytes(4).toString("hex");
mkdirSync(dir + "/supabase");
const original = readFileSync("supabase/config.toml", "utf8");
if (!original.includes('project_id = "global-opportunity-os-s1-local"'))
  throw Error("Source config id guard");
writeFileSync(
  dir + "/supabase/config.toml",
  original
    .replace("global-opportunity-os-s1-local", id)
    .replaceAll("543", "573"),
  { mode: 0o600 },
);
// Restore archive ก่อนใช้ migrations ใหม่กว่า snapshot เพื่อไม่ให้ target มี FK/trigger แทรก
mkdirSync(dir + "/supabase/migrations");
const env = {
  ...process.env,
  PATH: resolve(".local/bin") + delimiter + process.env.PATH,
  SUPABASE_INTERNAL_IMAGE_REGISTRY: "ghcr.io",
};
for (const k of [
  "DOCKER_CONTEXT",
  "DOCKER_TLS",
  "DOCKER_TLS_VERIFY",
  "DOCKER_CERT_PATH",
])
  delete env[k];
env.DOCKER_HOST = "unix:///var/run/docker.sock";
const cli = resolve("node_modules/.bin/supabase"),
  sourceDb = "supabase_db_global-opportunity-os-s1-local";
function command(bin, args, label, stdio) {
  const r = spawnSync(bin, args, {
    env,
    encoding: stdio ? undefined : "utf8",
    maxBuffer: 30 * 1024 * 1024,
    ...(stdio ? { stdio } : {}),
  });
  const out = (r.stdout ?? "") + (r.stderr ?? "");
  writeFileSync(dir + "/" + label + ".log", out, { mode: 0o600 });
  chmodSync(dir + "/" + label + ".log", 0o600);
  if (r.status !== 0)
    throw Error(label + " failed; private diagnostic retained");
  return r.stdout;
}
const runCli = (args, label) =>
  command(cli, [...args, "--workdir", dir], label);
const docker = (args, label, stdio) =>
  command(
    "docker",
    ["--host=unix:///var/run/docker.sock", ...args],
    label,
    stdio,
  );
const admin = createClient(source.apiUrl, source.serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  }),
  manifest = {
    run,
    target: "local",
    project: source.project,
    apiOrigin: source.apiUrl,
    startedAt: new Date().toISOString(),
    actors: [],
    organizations: [],
  };
privateJson(dir + "/manifest.json", manifest);
const assert = (v, m) => {
  if (!v) throw Error(m);
};
const sdk = (url, key, token) =>
  createClient(url, key, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
    ...(token
      ? { global: { headers: { Authorization: "Bearer " + token } } }
      : {}),
  });
const p = (r) => {
  if (r.error) throw Error("Synthetic RPC failed: " + r.error.code);
  return r.data;
};
async function fingerprint(c) {
  const tables = (
      await c.query(
        "select schemaname,tablename from pg_tables where schemaname in ('app','private') or(schemaname='auth' and tablename in ('users','sessions','identities','mfa_factors','refresh_tokens')) order by 1,2",
      )
    ).rows,
    data = {};
  for (const t of tables) {
    assert(
      /^[a-z_][a-z0-9_]*$/.test(t.schemaname) &&
        /^[a-z_][a-z0-9_]*$/.test(t.tablename),
      "Table identifier guard",
    );
    data[t.schemaname + "." + t.tablename] = (
      await c.query(
        `select count(*)::int as count,md5(coalesce(string_agg(md5(to_jsonb(t)::text),'' order by md5(to_jsonb(t)::text)),'')) as hash from ${t.schemaname}.${t.tablename} t`,
      )
    ).rows[0];
  }
  return data;
}
async function schema(c) {
  return (
    await c.query(
      "select schemaname,tablename,policyname,permissive,roles,cmd,qual,with_check from pg_policies where schemaname in ('app','private') order by 1,2,3",
    )
  ).rows;
}
async function appAcls(c) {
  const permissions = (expression) =>
    `(select coalesce(jsonb_agg(jsonb_build_object('grantee',case when x.grantee=0 then 'PUBLIC' else pg_get_userbyid(x.grantee) end,'privilege',x.privilege_type,'grantable',x.is_grantable) order by x.grantee,x.privilege_type),'[]') from aclexplode(${expression}) x)`;
  const queries = [
    `select 'SCHEMA' as kind,format('%I',n.nspname) as name,null::text as column_name,pg_get_userbyid(n.nspowner) as owner,${permissions("coalesce(n.nspacl,acldefault('n',n.nspowner))")} as grants from pg_namespace n where n.nspname in ('app','private')`,
    `select case when c.relkind='S' then 'SEQUENCE' else 'TABLE' end as kind,format('%I.%I',n.nspname,c.relname) as name,null::text as column_name,pg_get_userbyid(c.relowner) as owner,${permissions("coalesce(c.relacl,acldefault(case when c.relkind='S' then 's'::\"char\" else 'r'::\"char\" end,c.relowner))")} as grants from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname in ('app','private') and c.relkind in ('r','p','v','m','S')`,
    `select 'COLUMN' as kind,format('%I.%I',n.nspname,c.relname) as name,format('%I',a.attname) as column_name,pg_get_userbyid(c.relowner) as owner,${permissions("a.attacl")} as grants from pg_attribute a join pg_class c on c.oid=a.attrelid join pg_namespace n on n.oid=c.relnamespace where n.nspname in ('app','private') and c.relkind in ('r','p','v','m') and a.attnum>0 and not a.attisdropped`,
    `select 'FUNCTION' as kind,format('%I.%I(%s)',n.nspname,p.proname,oidvectortypes(p.proargtypes)) as name,null::text as column_name,pg_get_userbyid(p.proowner) as owner,${permissions("coalesce(p.proacl,acldefault('f',p.proowner))")} as grants from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname in ('public','private') and p.proname like 'goos_%'`,
  ];
  let rows = [];
  for (const q of queries) rows.push(...(await c.query(q)).rows);
  return rows
    .sort((a, b) =>
      (a.kind + ":" + a.name + ":" + a.column_name).localeCompare(
        b.kind + ":" + b.name + ":" + b.column_name,
      ),
    )
    .map((o) => ({
      ...o,
      grants: o.grants.sort((a, b) =>
        (a.grantee + a.privilege).localeCompare(b.grantee + b.privilege),
      ),
    }));
}
async function reconcileAppAcls(c, expected) {
  const actual = await appAcls(c),
    role = (v) =>
      v === "PUBLIC" ? "PUBLIC" : '"' + v.replaceAll('"', '""') + '"',
    key = (o) => o.kind + ":" + o.name + ":" + o.column_name;
  await c.query("begin");
  try {
    for (const o of [...expected].sort(
      (a, b) =>
        ({ SCHEMA: 0, TABLE: 1, SEQUENCE: 2, COLUMN: 3, FUNCTION: 4 })[a.kind] -
        { SCHEMA: 0, TABLE: 1, SEQUENCE: 2, COLUMN: 3, FUNCTION: 4 }[b.kind],
    )) {
      const old = actual.find((x) => key(x) === key(o));
      assert(
        old && old.owner === o.owner,
        "Restored ACL object/owner mismatch",
      );
      const grantees = [
        ...new Set([
          "PUBLIC",
          ...old.grants.map((x) => x.grantee),
          ...o.grants.map((x) => x.grantee),
        ]),
      ];
      const target =
          o.kind === "COLUMN" ? `TABLE ${o.name}` : `${o.kind} ${o.name}`,
        all = o.kind === "COLUMN" ? `ALL (${o.column_name})` : "ALL";
      for (const g of grantees)
        await c.query(`revoke ${all} on ${target} from ${role(g)} cascade`);
      for (const g of o.grants) {
        assert(/^[A-Z ]+$/.test(g.privilege), "ACL privilege token");
        const privilege =
          o.kind === "COLUMN"
            ? `${g.privilege} (${o.column_name})`
            : g.privilege;
        await c.query(
          `grant ${privilege} on ${target} to ${role(g.grantee)}${g.grantable ? " with grant option" : ""}`,
        );
      }
    }
    await c.query("commit");
  } catch (e) {
    await c.query("rollback");
    throw e;
  }
  assert(
    JSON.stringify(await appAcls(c)) === JSON.stringify(expected),
    "Exact source ACL reconciliation failed",
  );
}

let sourceConnection,
  targetConnection,
  snapshot,
  targetStarted = false,
  stopped = [];
const started = Date.now();
try {
  sourceConnection = new pg.Client({ connectionString: source.dbUrl });
  await sourceConnection.connect();
  assert(
    Number(
      (
        await sourceConnection.query(
          "select count(*) from auth.users where email not like '%@example.test'",
        )
      ).rows[0].count,
    ) === 0,
    "Non-synthetic source identities found: do not back up real data in this drill",
  );
  let s3Client,
    s3Application,
    s3ExpectedHash,
    s3Ledger = [];
  let s4Client, s4Referral, s4ExpectedHash;
  let s4Ledger = [];
  if (existsSync(".local/s3-fixtures.json")) {
    const f = JSON.parse(readFileSync(".local/s3-fixtures.json", "utf8"));
    s3Client = sdk(source.apiUrl, source.key);
    assert(
      !(
        await s3Client.auth.signInWithPassword({
          email: f.actors.outsider.email,
          password: f.actors.outsider.password,
        })
      ).error,
      "S3 restore fixture login",
    );
    // Resume only this exact synthetic subject/listing after an interrupted drill.
    const pending = (
      await sourceConnection.query(
        "select id from app.applications where subject_id=$1 and opportunity_id=$2 and state='submitted'",
        [f.subjects.outsider, f.listings.unlimited],
      )
    ).rows;
    assert(pending.length <= 1, "Unexpected duplicate restore fixture");
    if (pending.length) s3Application = pending[0].id;
    else {
      const preview = p(
        await s3Client.rpc("goos_s3_preview", {
          p_subject: f.subjects.outsider,
          p_opportunity: f.listings.unlimited,
          p_fields: ["display_alias", "country_code"],
          p_skills: [],
          p_notice: "00000000-0000-4000-8000-000000000202",
          p_application: null,
        }),
      );
      s3Application = p(
        await s3Client.rpc("goos_s3_submit", {
          p_preview: preview.id,
          p_hash: preview.hash,
          p_notice: "00000000-0000-4000-8000-000000000202",
          p_confirmed: true,
          p_readback: false,
          p_key: randomUUID(),
        }),
      ).id;
    }
    manifest.s3Application = s3Application;
    privateJson(dir + "/manifest.json", manifest);
    s3ExpectedHash = (
      await sourceConnection.query(
        "select md5(private.goos_s3_decrypt(encrypted_payload)::text) as hash from private.application_packages where application_id=$1",
        [s3Application],
      )
    ).rows[0].hash;
  }
  if (existsSync(".local/s4-fixtures.json")) {
    const f = JSON.parse(readFileSync(".local/s4-fixtures.json", "utf8"));
    s4Client = sdk(source.apiUrl, source.key);
    assert(
      !(
        await s4Client.auth.signInWithPassword({
          email: f.actors.user.email,
          password: f.actors.user.password,
        })
      ).error,
      "S4 restore fixture login",
    );
    const listing = randomUUID(),
      revision = randomUUID();
    await sourceConnection.query(
      "insert into app.opportunities(id,organization_id) values($1,$2)",
      [listing, f.targetOrg],
    );
    await sourceConnection.query(
      "insert into app.opportunity_revisions select (jsonb_populate_record(null::app.opportunity_revisions,to_jsonb(r)||jsonb_build_object('id',$1::text,'opportunity_id',$2::text,'revision_no',1))).* from app.opportunity_revisions r join app.opportunities o on o.approved_revision_id=r.id where o.id=$3",
      [revision, listing, f.targetListing],
    );
    await sourceConnection.query(
      "update app.opportunities set state='published',approved_revision_id=$2 where id=$1",
      [listing, revision],
    );
    await sourceConnection.query(
      "insert into private.catalog_reviews(opportunity_id,revision_id,actor_id,decision,reason) values($1,$2,$3,'publish','Synthetic restore fixture only')",
      [listing, revision, f.actors.reviewer.id],
    );
    s4Referral = p(
      await s4Client.rpc("goos_s4_propose", {
        p_case: f.sourceCase,
        p_opportunity: listing,
        p_purpose: "service_support",
      }),
    );
    const preview = p(
      await s4Client.rpc("goos_s4_preview", {
        p_id: s4Referral,
        p_fields: ["display_alias"],
        p_skills: [],
        p_notice: "00000000-0000-4000-8000-000000000402",
      }),
    );
    p(
      await s4Client.rpc("goos_s4_submit", {
        p_preview: preview.id,
        p_hash: preview.hash,
        p_notice: "00000000-0000-4000-8000-000000000402",
        p_confirmed: true,
        p_key: randomUUID(),
      }),
    );
    s4ExpectedHash = (
      await sourceConnection.query(
        "select md5(private.goos_s3_decrypt(encrypted_payload)::text) hash from private.s4_packages where referral_id=$1",
        [s4Referral],
      )
    ).rows[0].hash;
  }
  const clients = [];
  for (const label of ["a", "b"]) {
    const email = run + "-" + label + "@example.test",
      password = "S1-Restore-" + randomBytes(18).toString("base64url"),
      created = await admin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        app_metadata: { goos_fixture_run: run },
      });
    assert(!created.error && created.data.user, "Restore fixture creation");
    const actor = { id: created.data.user.id, email, password };
    manifest.actors.push(actor);
    privateJson(dir + "/manifest.json", manifest);
    const c = sdk(source.apiUrl, source.key);
    assert(
      !(await c.auth.signInWithPassword({ email, password })).error,
      "Source synthetic password",
    );
    p(await c.rpc("goos_bootstrap_account", { p_locale: "th" }));
    actor.subject = p(
      await c.rpc("goos_create_profile", {
        p_display_alias: "ข้อมูลสมมติกู้คืน " + label,
        p_country_code: "TH",
        p_age_band: "adult",
        p_notice_id: "00000000-0000-4000-8000-000000000001",
        p_confirmed: true,
      }),
    );
    clients.push(c);
  }
  const a = manifest.actors[0],
    b = manifest.actors[1],
    enrollment = await clients[0].auth.mfa.enroll({
      factorType: "totp",
      friendlyName: "Restore fixture only",
    });
  assert(!enrollment.error, "Source fixture MFA enrollment");
  a.factorId = enrollment.data.id;
  a.totp = enrollment.data.totp.secret;
  assert(
    !(
      await clients[0].auth.mfa.challengeAndVerify({
        factorId: a.factorId,
        code: syntheticTotp(a.totp),
      })
    ).error,
    "Source fixture MFA verification",
  );
  const grant = p(
      await clients[0].rpc("goos_create_delegation", {
        p_subject_id: a.subject,
        p_delegate_id: b.id,
        p_scopes: ["profile:read"],
        p_expires_at: new Date(Date.now() + 3600000).toISOString(),
        p_notice_id: "00000000-0000-4000-8000-000000000001",
        p_confirmed: true,
      }),
    ),
    held = (await clients[1].auth.getSession()).data.session.access_token;
  privateJson(dir + "/manifest.json", manifest);
  // Ensure at least one binary asset is in the backup without changing the published branding.
  const png = readFileSync("public/brand-defaults/favicon.png"),
    asset = randomUUID();
  await sourceConnection.query(
    "insert into private.brand_assets(id,kind,body,width,height,created_by) values($1,'favicon',$2,512,512,$3)",
    [asset, png, a.id],
  );
  snapshot = new pg.Client({ connectionString: source.dbUrl });
  await snapshot.connect();
  await snapshot.query("begin isolation level repeatable read read only");
  const snapshotId = (await snapshot.query("select pg_export_snapshot() as id"))
    .rows[0].id;
  assert(/^[a-f0-9-]+$/i.test(snapshotId), "Exported snapshot identifier");
  const expected = await fingerprint(snapshot),
    expectedPolicies = await schema(snapshot);
  const expectedAcls = await appAcls(snapshot);
  privateJson(dir + "/app-acls.json", expectedAcls);
  const archive = dir + "/database.dump",
    out = openSync(archive, "wx", 0o600);
  try {
    docker(
      [
        "exec",
        sourceDb,
        "pg_dump",
        "--username=supabase_admin",
        "--dbname=postgres",
        "--format=custom",
        "--snapshot=" + snapshotId,
      ],
      "dump",
      ["ignore", out, "pipe"],
    );
  } finally {
    closeSync(out);
  }
  await snapshot.query("commit");
  await snapshot.end();
  snapshot = undefined;
  const rolesFd = openSync(dir + "/roles-without-passwords.sql", "wx", 0o600);
  try {
    docker(
      [
        "exec",
        sourceDb,
        "pg_dumpall",
        "--username=supabase_admin",
        "--roles-only",
        "--no-role-passwords",
      ],
      "roles",
      ["ignore", rolesFd, "pipe"],
    );
  } finally {
    closeSync(rolesFd);
  }
  // A later withdrawal and session revoke must not be resurrected by restoring an older snapshot.
  p(
    await clients[0].rpc("goos_revoke_delegation", {
      p_id: grant,
      p_expected_version: 1,
    }),
  );
  p(await clients[1].rpc("goos_revoke_current_session"));
  if (s3Application) {
    p(
      await s3Client.rpc("goos_s3_transition", {
        p_id: s3Application,
        p_action: "withdraw",
        p_version: 1,
        p_reason: "user_requested",
        p_fields: [],
      }),
    );
    s3Ledger = (
      await sourceConnection.query(
        "select application_id,subject_id,action,created_at from private.s3_withdrawals where application_id=$1",
        [s3Application],
      )
    ).rows;
  }
  if (s4Referral) {
    p(
      await s4Client.rpc("goos_s4_referral_action", {
        p_id: s4Referral,
        p_action: "revoke",
        p_version: 2,
        p_member: null,
      }),
    );
    s4Ledger = (
      await sourceConnection.query(
        "select referral_id,subject_id,actor_id,created_at from private.s4_withdrawals where referral_id=$1",
        [s4Referral],
      )
    ).rows;
    assert(s4Ledger.length === 1, "S4 withdrawal ledger missing");
  }
  const ledger = {
    s4: s4Ledger,
    s3: s3Ledger,
    delegations: (
      await sourceConnection.query(
        "select * from app.delegations where id=$1",
        [grant],
      )
    ).rows,
    consents: (
      await sourceConnection.query(
        "select * from private.consent_events where delegation_id=$1 and action='withdrawn'",
        [grant],
      )
    ).rows,
    sessions: (
      await sourceConnection.query(
        "select * from private.revoked_sessions where account_id=$1",
        [b.id],
      )
    ).rows,
    audit: (
      await sourceConnection.query(
        "select * from private.audit_events where object_id=$1 and action like '%revoke%'",
        [grant],
      )
    ).rows,
  };
  privateJson(dir + "/replay-ledger.json", ledger);
  targetStarted = true;
  runCli(
    [
      "start",
      "-x",
      "realtime,storage-api,imgproxy,postgres-meta,studio,edge-runtime,logflare,vector,supavisor",
    ],
    "start",
  );
  const target = JSON.parse(runCli(["status", "-o", "json"], "status"));
  assert(
    new URL(target.API_URL).hostname === "127.0.0.1" &&
      new URL(target.API_URL).port === "57321" &&
      new URL(target.DB_URL).hostname === "127.0.0.1" &&
      new URL(target.DB_URL).port === "57322",
    "Restore target port guard",
  );
  for (const service of ["auth", "rest"]) {
    const name = "supabase_" + service + "_" + id;
    docker(["stop", "--time", "10", name], "stop-" + service);
    stopped.push(name);
  }
  // pg_restore --clean cannot drop a partition child's inherited PK before its parent.
  // This is ONLY the generated, isolated restore target. Drop its Realtime root first.
  assert(
    /^goos-s1-restore-[a-f0-9]{8}$/.test(id),
    "Restore container identity guard",
  );
  docker(
    [
      "exec",
      "supabase_db_" + id,
      "psql",
      "--username=supabase_admin",
      "--dbname=postgres",
      "--set=ON_ERROR_STOP=1",
      "--command=DROP TABLE IF EXISTS realtime.messages CASCADE;",
    ],
    "prepare-partitioned-target",
  );
  docker(
    [
      "exec",
      "supabase_db_" + id,
      "psql",
      "--username=supabase_admin",
      "--dbname=postgres",
      "--set=ON_ERROR_STOP=1",
      "--command=CREATE ROLE goos_api NOLOGIN NOINHERIT NOBYPASSRLS; CREATE ROLE goos_authz NOLOGIN NOINHERIT NOBYPASSRLS; CREATE ROLE goos_worker NOLOGIN NOINHERIT NOBYPASSRLS; CREATE ROLE goos_reporter NOLOGIN NOINHERIT NOBYPASSRLS; GRANT goos_api,goos_authz,goos_worker,goos_reporter TO postgres;",
    ],
    "prepare-app-roles",
  );
  const input = openSync(archive, "r");
  try {
    docker(
      [
        "exec",
        "-i",
        "supabase_db_" + id,
        "pg_restore",
        "--username=supabase_admin",
        "--dbname=postgres",
        "--clean",
        "--if-exists",
        "--exit-on-error",
      ],
      "restore",
      [input, "ignore", "pipe"],
    );
  } finally {
    closeSync(input);
  }
  targetConnection = new pg.Client({ connectionString: target.DB_URL });
  await targetConnection.connect();
  const actual = await fingerprint(targetConnection);
  assert(
    JSON.stringify(actual) === JSON.stringify(expected),
    "Backup data fingerprint mismatch",
  );
  assert(
    JSON.stringify(await schema(targetConnection)) ===
      JSON.stringify(expectedPolicies),
    "Restored RLS policy mismatch",
  );
  await reconcileAppAcls(targetConnection, expectedAcls);
  const boundary = (
    await targetConnection.query(
      "select has_schema_privilege('authenticated','app','usage') as app_access,has_schema_privilege('authenticated','private','usage') as private_access,(select count(*) from pg_proc p join pg_namespace n on n.oid=p.pronamespace join pg_roles r on r.oid=p.proowner where n.nspname='public' and p.proname like 'goos_%' and(r.rolbypassrls or (r.rolname<>'goos_api' and not(p.proname='goos_s4_guest_report' and r.rolname='goos_reporter')))) as unsafe_rpc_owners,has_function_privilege('anon','public.goos_save_settings(text,text,jsonb,bigint)','execute') as guest_write",
    )
  ).rows[0];
  privateJson(dir + "/restore-boundary.json", boundary);
  assert(
    !boundary.app_access &&
      !boundary.private_access &&
      !boundary.guest_write &&
      Number(boundary.unsafe_rpc_owners) === 0,
    "Restored schema/RPC/ACL boundary",
  );
  const unsafe = (
    await targetConnection.query(
      "select count(*) from pg_roles where rolname in ('goos_api','goos_authz','goos_worker','goos_reporter') and(rolsuper or rolbypassrls or rolcanlogin or rolinherit)",
    )
  ).rows[0].count;
  assert(Number(unsafe) === 0, "Restored app role attributes");
  assert(
    (
      await targetConnection.query(
        "select encode(sha256(body),'hex') as hash from private.brand_assets where id=$1",
        [asset],
      )
    ).rows[0].hash === createHash("sha256").update(png).digest("hex"),
    "Binary asset changed",
  );
  if (s3Application) {
    assert(
      (
        await targetConnection.query(
          "select md5(private.goos_s3_decrypt(encrypted_payload)::text) as hash from private.application_packages where application_id=$1",
          [s3Application],
        )
      ).rows[0].hash === s3ExpectedHash,
      "Restored encrypted S3 payload/key mismatch",
    );
    assert(
      (
        await targetConnection.query(
          "select count(*)::int as n from app.resource_shares where application_id=$1 and status='active'",
          [s3Application],
        )
      ).rows[0].n === 1,
      "Snapshot must predate withdrawal",
    );
  }
  if (s4Referral) {
    const r = (
      await targetConnection.query(
        "select r.share_active,md5(private.goos_s3_decrypt(p.encrypted_payload)::text) hash from private.s4_referrals r join private.s4_packages p on p.referral_id=r.id where r.id=$1",
        [s4Referral],
      )
    ).rows[0];
    assert(
      r.share_active && r.hash === s4ExpectedHash,
      "S4 restored snapshot/package/key must predate withdrawal",
    );
  }
  let auditDenied = false;
  try {
    await targetConnection.query(
      "update private.audit_events set action=action where false",
    );
  } catch (e) {
    auditDenied = e.code === "42501";
  }
  assert(auditDenied, "Restored append-only audit guard");
  async function replay() {
    await targetConnection.query("begin");
    try {
      await targetConnection.query(
        "update app.delegations d set status='revoked',revoked_at=l.revoked_at,version=greatest(d.version,l.version) from jsonb_populate_recordset(null::app.delegations,$1::jsonb) l where d.id=l.id and d.subject_id=l.subject_id and d.delegate_account_id=l.delegate_account_id and l.status='revoked' and(d.status<>'revoked' or d.version<l.version)",
        [JSON.stringify(ledger.delegations)],
      );
      for (const [table, rows, key] of [
        ["private.consent_events", ledger.consents, "id"],
        ["private.audit_events", ledger.audit, "id"],
        ["private.revoked_sessions", ledger.sessions, "session_id"],
      ])
        await targetConnection.query(
          `insert into ${table} select * from jsonb_populate_recordset(null::${table},$1::jsonb) on conflict(${key}) do nothing`,
          [JSON.stringify(rows)],
        );
      if (s3Application)
        await targetConnection.query(
          "select private.goos_s3_replay_withdrawals($1::jsonb)",
          [JSON.stringify(ledger.s3)],
        );
      if (s4Referral)
        await targetConnection.query(
          "select private.goos_s4_replay_withdrawals($1::jsonb)",
          [JSON.stringify(ledger.s4)],
        );
      await targetConnection.query("commit");
    } catch (e) {
      await targetConnection.query("rollback");
      throw e;
    }
  }
  await replay();
  const once = await fingerprint(targetConnection);
  await replay();
  assert(
    JSON.stringify(await fingerprint(targetConnection)) ===
      JSON.stringify(once),
    "Withdrawal replay not idempotent",
  );
  if (s4Referral) {
    const r = (
      await targetConnection.query(
        "select share_active,(select count(*)::int from private.s4_cessations where resource_id=r.id) cessations from private.s4_referrals r where id=$1",
        [s4Referral],
      )
    ).rows[0];
    assert(
      !r.share_active && r.cessations === 1,
      "S4 restored share must stay revoked with one cessation",
    );
  }
  if (s3Application) {
    assert(
      (
        await targetConnection.query(
          "select state from app.applications where id=$1",
          [s3Application],
        )
      ).rows[0].state === "withdrawn",
      "S3 withdrawal state resurrected",
    );
    assert(
      (
        await targetConnection.query(
          "select count(*)::int as n from app.resource_shares where application_id=$1 and status='active'",
          [s3Application],
        )
      ).rows[0].n === 0,
      "S3 consent share resurrected",
    );
  }
  for (const name of stopped)
    docker(["start", name], "resume-" + name.split("_")[1]);
  stopped = [];
  await new Promise((done) => setTimeout(done, 2500));
  const restored = sdk(target.API_URL, target.ANON_KEY);
  let login;
  for (let i = 0; i < 12; i++) {
    login = await restored.auth.signInWithPassword({
      email: a.email,
      password: a.password,
    });
    if (!login.error) break;
    await new Promise((done) => setTimeout(done, 1000));
  }
  assert(
    !login.error && login.data.user.id === a.id,
    "Restored Auth password login",
  );
  assert(
    p(await restored.rpc("goos_profile", { p_subject_id: a.subject }))
      .display_alias === "ข้อมูลสมมติกู้คืน a",
    "Restored profile read",
  );
  await new Promise((done) =>
    setTimeout(done, Math.max(1000, 31000 - (Date.now() % 30000))),
  );
  assert(
    !(
      await restored.auth.mfa.challengeAndVerify({
        factorId: a.factorId,
        code: syntheticTotp(a.totp),
      })
    ).error,
    "Restored encrypted MFA secret unusable",
  );
  assert(
    p(await restored.rpc("goos_context")).staff_assured === true,
    "Restored MFA assurance",
  );
  const old = sdk(target.API_URL, target.ANON_KEY, held);
  assert(
    !(await old.auth.getUser(held)).error,
    "Old signed fixture JWT not independently valid",
  );
  assert(
    (await old.rpc("goos_profile", { p_subject_id: a.subject })).error,
    "Withdrawn access returned after restore",
  );
  const bLogin = sdk(target.API_URL, target.ANON_KEY);
  assert(
    !(
      await bLogin.auth.signInWithPassword({
        email: b.email,
        password: b.password,
      })
    ).error,
    "Restored delegate own login",
  );
  assert(
    (await bLogin.rpc("goos_profile", { p_subject_id: a.subject })).error
      ?.code === "P0002",
    "Revoked delegation resurrected for new session",
  );
  privateJson(dir + "/result.json", {
    passed: true,
    source: "local54322",
    target: "isolated57322",
    tableFingerprints: Object.keys(expected).length,
    rlsPolicies: expectedPolicies.length,
    schemaRpcAcl: true,
    binaryAsset: true,
    passwordLogin: true,
    mfa: true,
    auditImmutable: true,
    sessionRevokeReplay: true,
    delegationWithdrawalReplay: true,
    idempotentReplay: true,
    s3EncryptedPayload: !!s3Application,
    s3WithdrawalReplay: !!s3Application,
    seconds: Math.round((Date.now() - started) / 1000),
    archiveSha256: createHash("sha256")
      .update(readFileSync(archive))
      .digest("hex"),
  });
  console.log(
    "Restore drill passed: exact data, binary assets, RLS, password/MFA, immutable audit and idempotent withdrawal/session replay on an isolated stack.",
  );
} finally {
  if (snapshot) {
    await snapshot.query("rollback").catch(() => {});
    await snapshot.end();
  }
  if (targetConnection) await targetConnection.end();
  if (sourceConnection) {
    for (const a of manifest.actors)
      await sourceConnection.query(
        "delete from private.brand_assets where created_by=$1 and id not in(select logo_id from app.platform_settings where logo_id is not null union all select favicon_id from app.platform_settings where favicon_id is not null)",
        [a.id],
      );
    await sourceConnection.end();
  }
  try {
    if (manifest.actors.length) await cleanupFixtures(source, manifest, admin);
  } finally {
    privateJson(dir + "/manifest.json", manifest);
    if (targetStarted) runCli(["stop"], "stop");
  }
}
