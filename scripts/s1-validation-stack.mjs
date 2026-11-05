// Stack แยกสำหรับทดสอบ Confirm email Off/Realtime/restore เท่านั้น ไม่ link หรือ reset hosted
import {
  mkdirSync,
  readFileSync,
  writeFileSync,
  cpSync,
  chmodSync,
} from "node:fs";
import { resolve, delimiter } from "node:path";
import { spawnSync } from "node:child_process";
const action = process.argv[2] ?? "start",
  id = "global-opportunity-os-s1-validation";
if (!["start", "stop", "status"].includes(action))
  throw Error("Use start/stop/status");
const dir = resolve(".local/s1-validation-stack");
mkdirSync(dir + "/supabase", { recursive: true, mode: 0o700 });
const source = readFileSync("supabase/config.toml", "utf8");
if (!source.includes('project_id = "global-opportunity-os-s1-local"'))
  throw Error("Source local config guard");
if (action === "start") {
  const config = source
    .replace("global-opportunity-os-s1-local", id)
    .replaceAll("543", "563")
    .replace(
      /(\[auth\.email\][\s\S]*?enable_confirmations\s*=\s*)true/,
      "$1false",
    )
    .replaceAll("http://127.0.0.1:3000", "http://127.0.0.1:3100");
  if (!config.includes('project_id = "' + id + '"'))
    throw Error("Validation id guard");
  writeFileSync(dir + "/supabase/config.toml", config, { mode: 0o600 });
  cpSync("supabase/migrations", dir + "/supabase/migrations", {
    recursive: true,
  });
}
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
function run(args, label) {
  const r = spawnSync(
    resolve("node_modules/.bin/supabase"),
    [...args, "--workdir", dir],
    { env, encoding: "utf8", maxBuffer: 30 * 1024 * 1024 },
  );
  const path = dir + "/" + label + ".log";
  writeFileSync(path, (r.stdout ?? "") + (r.stderr ?? ""), { mode: 0o600 });
  chmodSync(path, 0o600);
  if (r.status !== 0) {
    // รายงานเฉพาะ enum/exit code; stdout/stderr เต็มอาจมี local keys จึงคงไว้ใน private log
    const raw = (r.stdout ?? "") + (r.stderr ?? "");
    const reason =
      [
        ["port_conflict", /address already in use|port is already allocated/i],
        ["image_rate_limit", /toomanyrequests|pull rate limit/i],
        ["image_fetch", /failed to pull|manifest unknown|pull access denied/i],
        ["container_health", /unhealthy|health check|not healthy/i],
        ["timeout", /timed out|timeout|context deadline exceeded/i],
        ["migration", /failed to apply migration|migration failed|SQLSTATE/i],
        ["daemon", /cannot connect to the docker daemon/i],
      ].find(([, pattern]) => pattern.test(raw))?.[0] ?? "unclassified";
    console.error(
      JSON.stringify({ validation: label, exit: r.status, reason }),
    );
    throw Error(
      "Validation stack " +
        label +
        " failed; inspect private log without credentials",
    );
  }
  return r.stdout;
}
if (action === "stop") {
  run(["stop"], "stop");
  console.log(
    "Stopped only the validation stack; original local and hosted unchanged",
  );
} else {
  if (action === "start")
    run(
      [
        "start",
        "-x",
        "storage-api,imgproxy,postgres-meta,studio,edge-runtime,logflare,vector,supavisor",
      ],
      "start",
    );
  if (action === "start") run(["migration", "up", "--local"], "migrate");
  const raw = JSON.parse(run(["status", "-o", "json"], "status"));
  for (const k of ["API_URL", "DB_URL"])
    if (
      new URL(raw[k]).hostname !== "127.0.0.1" ||
      !new URL(raw[k]).port.startsWith("563")
    )
      throw Error("Validation loopback/port guard");
  writeFileSync(
    ".local/s1-validation-runtime.json",
    JSON.stringify({ ...raw, PROJECT_ID: id, WORKDIR: dir }, null, 2),
    { mode: 0o600 },
  );
  chmodSync(".local/s1-validation-runtime.json", 0o600);
  console.log(
    "Validation stack ready: isolated loopback ports56320–56324, Confirm email Off and Realtime; keys saved privately",
  );
}
