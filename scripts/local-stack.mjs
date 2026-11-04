import { spawnSync } from "node:child_process";
import { mkdirSync, writeFileSync, readFileSync, chmodSync } from "node:fs";
import { resolve, delimiter } from "node:path";
const command = process.argv[2] ?? "start";
if (!["start", "stop", "status", "migrate"].includes(command))
  throw Error("ใช้เฉพาะ start/stop/status/migrate ของ local stack");
if (
  !readFileSync("supabase/config.toml", "utf8").includes(
    'project_id = "global-opportunity-os-s1-local"',
  )
)
  throw Error("ไม่ใช่ local development project ที่กำหนด");
mkdirSync(".local/bin", { recursive: true, mode: 0o700 });
const docker = spawnSync("sh", ["-c", "command -v docker"], {
  encoding: "utf8",
}).stdout.trim();
if (!docker || docker.includes("/.local/bin/"))
  throw Error("หา Docker CLI ต้นทางไม่ได้");
// แก้เฉพาะ wget health probe ไป loopback; ไม่เปลี่ยน proxy ของ service หรือ destination ภายนอก
const wrapper = `#!/usr/bin/env node\nimport {spawnSync} from 'node:child_process';\nconst args=process.argv.slice(2);\nif(args[0]==='create'){const i=args.indexOf('--health-cmd');if(i>=0&&/^wget .*http:\\/\\/127\\.0\\.0\\.1:\\d+\\/health$/.test(args[i+1]??''))args[i+1]='env -u HTTP_PROXY -u http_proxy -u HTTPS_PROXY -u https_proxy '+args[i+1];}\nconst r=spawnSync(${JSON.stringify(docker)},args,{env:process.env,stdio:'inherit'});process.exit(r.status??1);\n`;
writeFileSync(".local/bin/docker", wrapper, { mode: 0o700 });
chmodSync(".local/bin/docker", 0o700);
const env = {
  ...process.env,
  PATH: resolve(".local/bin") + delimiter + process.env.PATH,
  SUPABASE_INTERNAL_IMAGE_REGISTRY:
    process.env.SUPABASE_INTERNAL_IMAGE_REGISTRY ?? "ghcr.io",
};
// ใช้เฉพาะ daemon ในเครื่อง ไม่ปล่อยให้ inherited context ชี้ไป remote Docker
for (const name of [
  "DOCKER_CONTEXT",
  "DOCKER_TLS",
  "DOCKER_TLS_VERIFY",
  "DOCKER_CERT_PATH",
])
  delete env[name];
env.DOCKER_HOST = "unix:///var/run/docker.sock";
const args =
  command === "start"
    ? [
        "start",
        "-x",
        "realtime,storage-api,imgproxy,postgres-meta,studio,edge-runtime,logflare,vector,supavisor",
      ]
    : command === "status"
      ? ["status", "-o", "json"]
      : command === "migrate"
        ? ["migration", "up", "--local"]
        : ["stop"];
const result = spawnSync("node_modules/.bin/supabase", args, {
  env,
  encoding: "utf8",
  maxBuffer: 20 * 1024 * 1024,
});
writeFileSync(
  `.local/${command}.log`,
  (result.stdout ?? "") + (result.stderr ?? ""),
  { mode: 0o600 },
);
chmodSync(`.local/${command}.log`, 0o600);
if (result.status !== 0) {
  console.error(
    "Local Supabase ยังไม่พร้อม ตรวจเฉพาะ error ใน .local/" +
      command +
      ".log โดยไม่พิมพ์ keys",
  );
  process.exit(result.status ?? 1);
}
if (command === "status") {
  const status = JSON.parse(result.stdout);
  writeFileSync(
    ".local/supabase-runtime.json",
    JSON.stringify(status, null, 2) + "\n",
    { mode: 0o600 },
  );
  chmodSync(".local/supabase-runtime.json", 0o600);
  console.log(
    "อ่าน local status สำเร็จ เก็บ runtime config ในไฟล์ ignored โดยไม่แสดงค่า",
  );
} else
  console.log(
    command === "start"
      ? "Local Supabase healthy (Database/Auth/API/Mailpit)"
      : command === "migrate"
        ? "ใช้ migrations กับ local DB เท่านั้นสำเร็จ"
        : "หยุด local Supabase แล้ว โดยรักษาข้อมูลตาม CLI default",
  );
