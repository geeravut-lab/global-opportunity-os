// เครื่องมือ operator สำหรับ Project ที่เจ้าของอนุมัติแล้ว; ไม่ใช้ใน web runtime
import { readFileSync, readdirSync, mkdirSync, writeFileSync } from "node:fs";
import { createHash, randomBytes } from "node:crypto";
const action = process.argv[2];
const url = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL ?? "http://invalid");
const ref = url.hostname.split(".")[0],
  origin = new URL(process.env.APP_ORIGIN ?? "http://invalid").origin;
if (
  url.protocol !== "https:" ||
  !/^\w{20}\.supabase\.co$/.test(url.hostname) ||
  origin !== "https://opp4all.vercel.app"
)
  throw Error("Project/origin guard rejected");
const project = "prj_I54vkKfmGhOlEMUwrTSEwgX7uhdY",
  team = "team_u3ty0zsPuhWH38lbooh2hiqV";
mkdirSync(".local/hosted", { recursive: true, mode: 0o700 });
async function api(service, path, method = "GET", body) {
  const token =
    process.env[
      service === "supabase" ? "SUPABASE_ACCESS_TOKEN" : "VERCEL_TOKEN"
    ];
  if (!token) throw Error("Missing operator credential");
  const r = await fetch(`https://api.${service}.com${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(body ? { "Content-Type": "application/json" } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
    signal: AbortSignal.timeout(120000),
  });
  if (!r.ok) {
    const raw = await r.text();
    writeFileSync(".local/hosted/last-api-error.txt", raw, { mode: 0o600 });
    throw Error(
      `Operator API ${service} ${method} returned ${r.status}; diagnostic saved privately`,
    );
  }
  return r.status === 204 ? null : r.json();
}
const query = (sql, readOnly = true) =>
  api("supabase", `/v1/projects/${ref}/database/query`, "POST", {
    query: sql,
    read_only: readOnly,
  });
const literal = (s) => "'" + s.replaceAll("'", "''") + "'";
const files = readdirSync("supabase/migrations")
  .filter((n) => /^\d+_.+\.sql$/.test(n))
  .sort();
const migrations = files.map((name) => {
  const sql = readFileSync("supabase/migrations/" + name, "utf8");
  return {
    name,
    version: name.split("_")[0],
    sql,
    hash: createHash("sha256").update(sql).digest("hex"),
  };
});
const metadata = `select jsonb_build_object('schemas',(select coalesce(jsonb_agg(nspname),'[]') from pg_namespace where nspname in ('app','private')),'roles',(select coalesce(jsonb_agg(jsonb_build_object('name',rolname,'bypass',rolbypassrls,'login',rolcanlogin,'super',rolsuper)),'[]') from pg_roles where rolname in ('goos_api','goos_authz')),'functions',(select count(*) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname in ('public','private') and p.proname like 'goos_%'),'ledger',to_regclass('private.deployment_migrations') is not null,'history',to_regclass('supabase_migrations.schema_migrations') is not null) as preflight`;
if (action === "preflight") {
  const d = await query(metadata);
  writeFileSync(".local/hosted/preflight.json", JSON.stringify(d, null, 2), {
    mode: 0o600,
  });
  console.log(JSON.stringify(d));
} else if (action === "migrate") {
  const before = (await query(metadata))[0].preflight;
  let applied = [];
  if (before.ledger)
    applied = await query(
      "select version,sha256 from private.deployment_migrations order by version",
    );
  else if (before.schemas.length || before.roles.length || before.functions)
    throw Error(
      "Untracked schema/role/function conflict: inspect before migration",
    );
  for (const m of applied)
    if (!migrations.some((f) => f.version === m.version && f.hash === m.sha256))
      throw Error("Unknown migration or checksum drift");
  const pending = migrations.filter(
    (m) =>
      !applied.some((a) => a.version === m.version) &&
      m.version <=
        (process.argv.includes("--include-s4")
          ? "202611050054"
          : process.argv.includes("--include-s3")
            ? "202611050032"
            : process.argv.includes("--include-s2")
              ? "202611050018"
              : "202611040013"),
  );
  if (!pending.length) {
    console.log(
      "No pending hosted migrations in selected scope; use explicit --include-s2, --include-s3 or --include-s4 for that phase",
    );
    process.exit(0);
  }
  const guard = before.ledger
    ? ""
    : `do $$begin if exists(select 1 from pg_namespace where nspname in ('app','private')) or exists(select 1 from pg_roles where rolname in ('goos_api','goos_authz')) then raise exception 'concurrent schema conflict';end if;end $$;`;
  const ledger = `create table if not exists private.deployment_migrations(version text primary key,filename text not null,sha256 text not null,applied_at timestamptz not null default now());alter table private.deployment_migrations enable row level security;revoke all on private.deployment_migrations from public,anon,authenticated,goos_api,goos_authz;create schema if not exists supabase_migrations;create table if not exists supabase_migrations.schema_migrations(version text primary key,statements text[],name text);`;
  const sql = `begin;set local lock_timeout='5s';set local statement_timeout='90s';select pg_advisory_xact_lock(682491137);${guard}\n${pending.map((m) => m.sql).join("\n")}\n${ledger}\n${pending.map((m) => `insert into private.deployment_migrations(version,filename,sha256) values(${literal(m.version)},${literal(m.name)},${literal(m.hash)});insert into supabase_migrations.schema_migrations(version,statements,name) values(${literal(m.version)},array[${literal(m.sql)}],${literal(m.name.replace(/^\d+_|\.sql$/g, ""))});`).join("\n")}notify pgrst,'reload schema';commit;`;
  await query(sql, false);
  console.log(`Hosted migrations applied atomically: ${pending.length}`);
  writeFileSync(
    ".local/hosted/migrations-result.json",
    JSON.stringify(
      {
        at: new Date().toISOString(),
        ref,
        files: pending.map(({ name, hash }) => ({ name, hash })),
      },
      null,
      2,
    ),
    { mode: 0o600 },
  );
} else if (action === "designate-owner") {
  const email = process.env.GOOS_OWNER_EMAIL?.trim().toLowerCase();
  if (!email || !/^\S+@\S+\.\S+$/.test(email))
    throw Error("Set GOOS_OWNER_EMAIL privately");
  const salt = randomBytes(32).toString("hex");
  const hash = createHash("sha256")
    .update(salt + email)
    .digest("hex");
  await query(
    `begin;select pg_advisory_xact_lock(682491137);insert into private.platform_bootstrap(singleton,salt,email_hash) values(true,${literal(salt)},${literal(hash)}) on conflict(singleton) do nothing;commit;`,
    false,
  );
  console.log(
    "Owner designation stored privately; verified owner login and MFA still required",
  );
} else if (action === "auth") {
  const path = `/v1/projects/${ref}/config/auth`,
    old = await api("supabase", path);
  if (!old.external_google_enabled)
    throw Error("Google provider must be configured by owner");
  const callbacks = ["th", "en"].flatMap((l) => [
    `${origin}/${l}/auth/callback`,
    `${origin}/${l}/auth/callback?next=password`,
  ]);
  const settings = {
    site_url: origin,
    uri_allow_list: [
      ...new Set([
        ...(old.uri_allow_list ?? "")
          .split(",")
          .map((x) => x.trim())
          .filter(Boolean),
        ...callbacks,
      ]),
    ].join(","),
    // C-22: preserve the owner's temporary Confirm email choice; do not turn it back on implicitly.
    mailer_autoconfirm: old.mailer_autoconfirm,
    password_min_length: 12,
    security_update_password_require_reauthentication: true,
    refresh_token_rotation_enabled: true,
    security_refresh_token_reuse_interval: 10,
    mfa_totp_enroll_enabled: true,
    mfa_totp_verify_enabled: true,
  };
  const result = await api("supabase", path, "PATCH", settings);
  for (const [k, v] of Object.entries(settings))
    if (result[k] !== v) throw Error("Auth setting verification failed: " + k);
  console.log(
    "Auth verified: production Site URL + exact callbacks, email confirmation choice and Google preserved, password12, secure change, rotation and TOTP",
  );
} else if (action === "vercel-env") {
  const path = `/v9/projects/${project}`,
    p = await api("vercel", `${path}?teamId=${team}`);
  if (
    p.link?.org !== "geeravut-lab" ||
    p.link?.repo !== "global-opportunity-os"
  )
    throw Error("Vercel repository guard rejected");
  const env = {
    NEXT_PUBLIC_SUPABASE_URL: url.origin,
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    APP_ORIGIN: origin,
    AUTH_ENABLED: "true",
    AUTH_GOOGLE_ENABLED: "true",
    NEXT_PUBLIC_LIVE_REALTIME: "1",
  };
  if (!env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.startsWith("sb_publishable_"))
    throw Error("Expected publishable key");
  for (const [key, value] of Object.entries(env))
    await api("vercel", `${path}/env?teamId=${team}&upsert=true`, "POST", {
      key,
      value,
      type: "encrypted",
      target: ["production"],
    });
  const r = await api("vercel", `${path}/env?teamId=${team}`);
  const names = r.envs
    .filter((e) => e.target.includes("production"))
    .map((e) => e.key);
  if (Object.keys(env).some((k) => !names.includes(k)))
    throw Error("Vercel env verification failed");
  console.log(
    "Production app environment configured; operator credentials excluded",
  );
} else if (action === "worker-configure") {
  const pools = await api(
    "supabase",
    `/v1/projects/${ref}/config/database/pooler`,
  );
  const pool = pools.find((p) => p.pool_mode === "transaction") ?? pools[0];
  if (!pool?.db_host?.endsWith(".pooler.supabase.com"))
    throw Error("Pooler guard");
  const role = "goos_maintenance_login",
    password = randomBytes(48).toString("base64url"),
    secret = randomBytes(48).toString("base64url");
  await query(
    `begin;do $$begin if exists(select 1 from pg_roles where rolname='${role}') then if coalesce(shobj_description((select oid from pg_roles where rolname='${role}'),'pg_authid'),'')<>'Opp4All managed maintenance worker v1' then raise exception 'worker role conflict';end if;else create role ${role} login noinherit nosuperuser nocreatedb nocreaterole nobypassrls;comment on role ${role} is 'Opp4All managed maintenance worker v1';end if;end $$;alter role ${role} password ${literal(password)};grant goos_worker to ${role};commit;`,
    false,
  );
  const connection = new URL("postgresql://placeholder");
  connection.hostname = pool.db_host;
  connection.port = String(pool.db_port);
  connection.username = role + "." + ref;
  connection.password = password;
  connection.pathname = "/postgres";
  for (const [key, value] of Object.entries({
    S3_WORKER_DATABASE_URL: connection.toString(),
    MAINTENANCE_SECRET: secret,
  }))
    await api(
      "vercel",
      `/v9/projects/${project}/env?teamId=${team}&upsert=true`,
      "POST",
      { key, value, type: "encrypted", target: ["production"] },
    );
  await query(
    `begin;do $$declare v uuid;begin select id into v from vault.secrets where name='opp4all_maintenance_secret';if v is null then perform vault.create_secret(${literal(secret)},'opp4all_maintenance_secret','Opp4All authenticated maintenance dispatch');else perform vault.update_secret(v,${literal(secret)},'opp4all_maintenance_secret','Opp4All authenticated maintenance dispatch');end if;end $$;commit;`,
    false,
  );
  console.log(
    "Machine principal and encrypted production credentials configured; schedule not started",
  );
} else if (action === "worker-schedule") {
  await query(
    `begin;create extension if not exists pg_cron with schema pg_catalog;create extension if not exists pg_net with schema extensions;
  create or replace function private.dispatch_maintenance() returns bigint language plpgsql security definer set search_path='' as $$declare token text;request_id bigint;begin select decrypted_secret into strict token from vault.decrypted_secrets where name='opp4all_maintenance_secret';select net.http_post(url=>'https://opp4all.vercel.app/api/internal/maintenance',headers=>jsonb_build_object('Authorization','Bearer '||token,'Content-Type','application/json'),body=>'{}'::jsonb,timeout_milliseconds=>50000) into request_id;return request_id;end $$;
  revoke all on function private.dispatch_maintenance() from public,anon,authenticated,goos_api,goos_authz,goos_worker;
  select cron.schedule('opp4all-maintenance-minute','* * * * *','select private.dispatch_maintenance();');
  select cron.alter_job(jobid,active:=true) from cron.job where jobname='opp4all-maintenance-minute';commit;`,
    false,
  );
  console.log(
    "Existing Supabase PostgreSQL cron/net enabled and authenticated maintenance scheduled each minute",
  );
} else if (action === "verify") {
  const rows = await query(
    `select 'migrations' as check,(select count(*) from private.deployment_migrations)::text as result union all select 'unsafe_roles',count(*)::text from pg_roles where rolname in ('goos_api','goos_authz') and(rolsuper or rolbypassrls or rolcanlogin or rolinherit) union all select 'tables_without_rls',count(*)::text from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname in ('app','private') and c.relkind='r' and not c.relrowsecurity union all select 'owner_designation',count(*)::text from private.platform_bootstrap union all select 'public_settings',(select version::text from app.platform_settings where singleton) union all select 'realtime_guard',count(*)::text from pg_policies where schemaname='realtime' and policyname='goos_live_namespace_guard' union all select 'audit_immutable',count(*)::text from pg_trigger where tgname='goos_audit_immutable';`,
  );
  const expected = {
    migrations: String(
      migrations.filter(
        (m) =>
          m.version <=
          (process.argv.includes("--include-s4")
            ? "202611050054"
            : "202611050032"),
      ).length,
    ),
    unsafe_roles: "0",
    tables_without_rls: "0",
    owner_designation: "1",
    realtime_guard: "1",
    audit_immutable: "1",
  };
  for (const [k, v] of Object.entries(expected))
    if (!rows.some((r) => r.check === k && r.result === v))
      throw Error("Hosted verification failed: " + k);
  console.log(rows);
  writeFileSync(
    ".local/hosted/verification.json",
    JSON.stringify(rows, null, 2),
    { mode: 0o600 },
  );
} else
  throw Error(
    "Use preflight | migrate | designate-owner | auth | vercel-env | worker-configure | worker-schedule | verify",
  );
