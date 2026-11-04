import {
  mkdtempSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
  cpSync,
  chmodSync,
} from "node:fs";
import { resolve, delimiter } from "node:path";
import { spawnSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import pg from "pg";
// สร้าง stack ใหม่แยก id/port; ไม่ reset หรือ link ฐานข้อมูลเดิม
if (
  !readFileSync("supabase/config.toml", "utf8").includes(
    'project_id = "global-opportunity-os-s1-local"',
  )
)
  throw Error("local config guard failed");
mkdirSync(".local", { recursive: true, mode: 0o700 });
const dir = resolve(mkdtempSync(".local/fresh-"));
mkdirSync(dir + "/supabase");
const id = "goos-s1-fresh-" + randomBytes(4).toString("hex");
const config = readFileSync("supabase/config.toml", "utf8")
  .replace("global-opportunity-os-s1-local", id)
  .replaceAll("543", "553");
writeFileSync(dir + "/supabase/config.toml", config);
cpSync("supabase/migrations", dir + "/supabase/migrations", {
  recursive: true,
});
const env = {
  ...process.env,
  PATH: resolve(".local/bin") + delimiter + process.env.PATH,
  SUPABASE_INTERNAL_IMAGE_REGISTRY: "ghcr.io",
};
for (const name of [
  "DOCKER_CONTEXT",
  "DOCKER_TLS",
  "DOCKER_TLS_VERIFY",
  "DOCKER_CERT_PATH",
])
  delete env[name];
env.DOCKER_HOST = "unix:///var/run/docker.sock";
const cli = resolve("node_modules/.bin/supabase");
function run(args, name) {
  const r = spawnSync(cli, [...args, "--workdir", dir], {
    env,
    encoding: "utf8",
    maxBuffer: 20 * 1024 * 1024,
  });
  writeFileSync(
    dir + "/" + name + ".log",
    (r.stdout ?? "") + (r.stderr ?? ""),
    { mode: 0o600 },
  );
  chmodSync(dir + "/" + name + ".log", 0o600);
  if (r.status !== 0)
    throw Error(
      "fresh stack " + name + " failed; inspect only errors in ignored log",
    );
  return r.stdout;
}
let c;
try {
  run(
    [
      "start",
      "-x",
      "realtime,storage-api,imgproxy,postgres-meta,studio,edge-runtime,logflare,vector,supavisor",
    ],
    "start",
  );
  const raw = JSON.parse(run(["status", "-o", "json"], "status"));
  if (
    new URL(raw.API_URL).hostname !== "127.0.0.1" ||
    new URL(raw.DB_URL).hostname !== "127.0.0.1"
  )
    throw Error("fresh loopback guard failed");
  c = new pg.Client({ connectionString: raw.DB_URL });
  await c.connect();
  const rows = (
    await c.query(
      "select version from supabase_migrations.schema_migrations order by version",
    )
  ).rows;
  if (rows.length !== 3) throw Error("expected exactly three S1 migrations");
  const admin = createClient(raw.API_URL, raw.SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const email = "fresh-" + randomBytes(5).toString("hex") + "@example.test",
    password = randomBytes(24).toString("base64url");
  const u = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (u.error) throw Error("fresh fixture creation failed");
  const client = createClient(raw.API_URL, raw.ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  if ((await client.auth.signInWithPassword({ email, password })).error)
    throw Error("fresh login failed");
  if ((await client.rpc("goos_bootstrap_account", { p_locale: "th" })).error)
    throw Error("fresh bootstrap failed");
  const profile = await client.rpc("goos_create_profile", {
    p_display_alias: "ข้อมูลสมมติติดตั้งใหม่",
    p_country_code: "TH",
    p_age_band: "adult",
    p_notice_id: "00000000-0000-4000-8000-000000000001",
    p_confirmed: true,
  });
  if (profile.error) throw Error("fresh profile/consent failed");
  console.log(
    "Fresh migrations: 3 applied; real Auth → bootstrap → profile/consent passed",
  );
} finally {
  if (c) await c.end();
  run(["stop"], "stop");
}
