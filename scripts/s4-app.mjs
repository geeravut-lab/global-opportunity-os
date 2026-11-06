// S4 launcher บังคับ local runtime และไม่ส่ง operator credentials ให้ web process
import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { localRuntime } from "./local-runtime.ts";
const r = localRuntime(),
  mode = process.argv[2] ?? "dev",
  port = Number(process.argv[3] ?? 3000);
if (
  !["dev", "start"].includes(mode) ||
  ![3000, 3400].includes(port) ||
  new URL(r.apiUrl).port !== "54321" ||
  new URL(r.dbUrl).port !== "54322"
)
  throw Error("S4 local app guard");
const env = {
  ...process.env,
  S3_ENABLED: "true",
  S4_ENABLED: "true",
  S4_ROLLOUT_MODE: "synthetic",
  S4_PURGE_ENABLED: "false",
  PURGE_LEDGER_SIGNING_KEY: createHash("sha256").update(r.serviceRoleKey + "local-synthetic-purge-receipts").digest("hex"),
  S2_ENABLED: "true",
  AUTH_ENABLED: "true",
  AUTH_GOOGLE_ENABLED: "false",
  APP_ORIGIN: "http://127.0.0.1:" + port,
  NEXT_PUBLIC_SUPABASE_URL: r.apiUrl,
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: r.anonKey,
  NEXT_TELEMETRY_DISABLED: "1",
};
for (const name of [
  "SUPABASE_PURGE_AUTH_KEY",
  "SUPABASE_ACCESS_TOKEN",
  "VERCEL_TOKEN",
  "SUPABASE_SERVICE_ROLE_KEY",
  "S3_WORKER_DATABASE_URL",
  "SMTP_PASSWORD",
  "MAINTENANCE_SECRET",
  "SMTP_HOST",
  "SMTP_PORT",
  "SMTP_USER",
  "SMTP_FROM",
])
  delete env[name];
const child = spawn(
  process.execPath,
  [
    "node_modules/next/dist/bin/next",
    mode,
    "--hostname",
    "127.0.0.1",
    "--port",
    String(port),
  ],
  { env, stdio: "inherit" },
);
for (const signal of ["SIGINT", "SIGTERM"])
  process.on(signal, () => child.kill(signal));
child.on("exit", (code) => process.exit(code ?? 1));
