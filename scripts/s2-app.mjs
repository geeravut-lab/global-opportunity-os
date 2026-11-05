// เปิด S2 ด้วย local runtime ที่ตรวจแล้ว ไม่รับ hosted values ที่อาจ inherited จาก Cloud
import { spawn } from "node:child_process";
import { localRuntime } from "./local-runtime.ts";
const r = localRuntime(),
  mode = process.argv[2] ?? "dev",
  port = Number(process.argv[3] ?? 3000);
if (
  !["dev", "start"].includes(mode) ||
  ![3000, 3200].includes(port) ||
  new URL(r.apiUrl).port !== "54321" ||
  new URL(r.dbUrl).port !== "54322"
)
  throw Error("S2 local app target guard");
const env = {
  ...process.env,
  S2_ENABLED: "true",
  AUTH_ENABLED: "true",
  AUTH_GOOGLE_ENABLED: "false",
  APP_ORIGIN: "http://127.0.0.1:" + port,
  NEXT_PUBLIC_SUPABASE_URL: r.apiUrl,
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: r.anonKey,
  NEXT_TELEMETRY_DISABLED: "1",
};
// Web child ไม่ต้องมี operator/service credentials; proxy/CA และ guard variables คงเดิม
for (const name of [
  "SUPABASE_ACCESS_TOKEN",
  "VERCEL_TOKEN",
  "SUPABASE_SERVICE_ROLE_KEY",
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
