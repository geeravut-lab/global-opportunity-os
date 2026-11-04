import { readFileSync, realpathSync } from "node:fs";
import { resolve } from "node:path";
import { localRuntime } from "./local-runtime.ts";
import {
  validationRuntime,
  fixtureAdmin,
  cleanupFixtures,
  privateJson,
} from "./validation-runtime.ts";
const path = realpathSync(process.argv[2] ?? "");
if (!path.startsWith(resolve(".local") + "/") || !path.endsWith(".json"))
  throw Error("Use an explicit private fixture manifest path");
const m = JSON.parse(readFileSync(path, "utf8"));
let r;
if (m.target === "local" && m.project === "global-opportunity-os-s1-local") {
  const s = localRuntime();
  r = {
    mode: "local",
    project: m.project,
    origin: "http://127.0.0.1:3000",
    apiUrl: s.apiUrl,
    key: s.anonKey,
    serviceKey: s.serviceRoleKey,
    dbUrl: s.dbUrl,
  };
} else {
  if (m.target !== "local" && m.target !== "hosted")
    throw Error("Unknown fixture target");
  process.env.GOOS_VALIDATION_TARGET = m.target;
  r = validationRuntime();
}
const admin = await fixtureAdmin(r);
try {
  await cleanupFixtures(r, m, admin);
} finally {
  privateJson(path, m);
}
console.log(
  "Fixture cleanup verified for the exact run/target; immutable audit IDs retained.",
);
