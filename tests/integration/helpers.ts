import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { createHmac } from "node:crypto";
import pg from "pg";
import {
  localRuntime,
  localActors,
  type FixtureActor,
} from "../../scripts/local-runtime";
export const runtime = localRuntime();
export const actors = localActors();
export function clientWithToken(token: string) {
  return createClient(runtime.apiUrl, runtime.anonKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
}
export async function login(actor: FixtureActor) {
  const c = createClient(runtime.apiUrl, runtime.anonKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });
  const result = await c.auth.signInWithPassword({
    email: actor.email,
    password: actor.password,
  });
  if (result.error) throw Error("fixture login rejected: " + result.error.code);
  return c;
}
export async function token(client: SupabaseClient) {
  const r = await client.auth.getSession();
  if (!r.data.session) throw Error("fixture session missing");
  return r.data.session.access_token;
}
export function totp(secret: string) {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  let bits = "";
  for (const letter of secret.toUpperCase().replace(/=/g, "")) {
    const i = alphabet.indexOf(letter);
    if (i < 0) throw Error("invalid local TOTP secret");
    bits += i.toString(2).padStart(5, "0");
  }
  const key = Buffer.from(
    Array.from({ length: Math.floor(bits.length / 8) }, (_, i) =>
      parseInt(bits.slice(i * 8, i * 8 + 8), 2),
    ),
  );
  const counter = Buffer.alloc(8);
  counter.writeBigUInt64BE(BigInt(Math.floor(Date.now() / 30000)));
  const digest = createHmac("sha1", key).update(counter).digest(),
    offset = digest[digest.length - 1] & 15;
  return ((digest.readUInt32BE(offset) & 0x7fffffff) % 1000000)
    .toString()
    .padStart(6, "0");
}
export async function mfa(client: SupabaseClient) {
  const e = await client.auth.mfa.enroll({
    factorType: "totp",
    friendlyName: "S1 local test",
  });
  if (e.error || !e.data)
    throw Error("fixture MFA enrollment rejected: " + e.error?.code);
  const v = await client.auth.mfa.challengeAndVerify({
    factorId: e.data.id,
    code: totp(e.data.totp.secret),
  });
  if (v.error) throw Error("fixture MFA verify rejected: " + v.error.code);
  return e.data.id;
}
export async function sql<T extends pg.QueryResultRow = pg.QueryResultRow>(
  query: string,
  values: unknown[] = [],
) {
  const c = new pg.Client({ connectionString: runtime.dbUrl });
  await c.connect();
  try {
    return (await c.query<T>(query, values)).rows;
  } finally {
    await c.end();
  }
}
export async function asApi<T extends pg.QueryResultRow = pg.QueryResultRow>(
  client: SupabaseClient,
  query: string,
  values: unknown[] = [],
) {
  const jwt = JSON.parse(
    Buffer.from((await token(client)).split(".")[1], "base64url").toString(),
  );
  const c = new pg.Client({ connectionString: runtime.dbUrl });
  await c.connect();
  try {
    await c.query("begin");
    await c.query("select set_config('request.jwt.claims',$1,true)", [
      JSON.stringify(jwt),
    ]);
    await c.query("set local role goos_api");
    return (await c.query<T>(query, values)).rows;
  } finally {
    await c.query("rollback");
    await c.end();
  }
}
export const noticeId = "00000000-0000-4000-8000-000000000001";
export async function profile(client: SupabaseClient, alias: string) {
  const r = await client.rpc("goos_create_profile", {
    p_display_alias: alias,
    p_country_code: "TH",
    p_age_band: "adult",
    p_notice_id: noticeId,
    p_confirmed: true,
  });
  if (r.error) throw Error("fixture profile rejected: " + r.error.code);
  return r.data as string;
}
