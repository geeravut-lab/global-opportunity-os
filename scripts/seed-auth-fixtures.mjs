import { createClient } from "@supabase/supabase-js";
import { randomBytes } from "node:crypto";
import { writeFileSync, chmodSync } from "node:fs";
import { localRuntime } from "./local-runtime.ts";
const r = localRuntime();
const admin = createClient(r.apiUrl, r.serviceRoleKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
    detectSessionInUrl: false,
  },
});
const actors = {};
const suffix = randomBytes(5).toString("hex");
for (const name of [
  "ownerA",
  "ownerB",
  "helper",
  "outsider",
  "member",
  "web",
  "recovery",
  "staleMfa",
  "logout",
  "webMfa",
]) {
  const email = `goos-s1-test-${name.toLowerCase()}-${suffix}@example.test`,
    password = randomBytes(24).toString("base64url");
  const created = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { goos_fixture: true },
  });
  if (created.error || !created.data.user)
    throw Error(
      "สร้าง fixture ไม่สำเร็จ: " + (created.error?.code ?? "unknown"),
    );
  const client = createClient(r.apiUrl, r.anonKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });
  const login = await client.auth.signInWithPassword({ email, password });
  if (login.error) throw Error("fixture login ล้มเหลว: " + login.error.code);
  const boot = await client.rpc("goos_bootstrap_account", { p_locale: "th" });
  if (boot.error)
    throw Error(
      "fixture bootstrap ล้มเหลว: " +
        boot.error.code +
        " " +
        boot.error.message,
    );
  actors[name] = { id: created.data.user.id, email, password };
}
writeFileSync(
  ".local/auth-fixtures.json",
  JSON.stringify(actors, null, 2) + "\n",
  { mode: 0o600 },
);
chmodSync(".local/auth-fixtures.json", 0o600);
console.log(
  "สร้างบัญชีสมมติ 10 บัญชีใน local Auth และ bootstrap ผ่าน user JWT แล้ว; credentials เก็บใน .local ที่ ignored",
);
