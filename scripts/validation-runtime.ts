import { readFileSync, writeFileSync, mkdirSync, chmodSync } from "node:fs";
import { createHmac } from "node:crypto";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import pg from "pg";
export interface ValidationRuntime {
  mode: "local" | "hosted";
  origin: string;
  apiUrl: string;
  key: string;
  dbUrl?: string;
  serviceKey?: string;
  project: string;
}
export function assertValidationTarget(r: ValidationRuntime) {
  const api = new URL(r.apiUrl);
  if (r.mode === "hosted") {
    if (
      r.project !== "fxqgvqvthrdzmgnmqgom" ||
      api.origin !== "https://fxqgvqvthrdzmgnmqgom.supabase.co" ||
      r.origin !== "https://opp4all.vercel.app"
    )
      throw Error("Hosted operator target rejected");
  } else {
    if (
      !["127.0.0.1", "localhost", "[::1]"].includes(api.hostname) ||
      !["54321", "56321", "57321"].includes(api.port)
    )
      throw Error("Local operator API target rejected");
    if (r.dbUrl) {
      const db = new URL(r.dbUrl);
      if (
        !["127.0.0.1", "localhost", "[::1]"].includes(db.hostname) ||
        !["54322", "56322", "57322"].includes(db.port)
      )
        throw Error("Local operator database target rejected");
    }
  }
}
export function validationRuntime(): ValidationRuntime {
  if (process.env.GOOS_VALIDATION_TARGET === "hosted") {
    const apiUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
      origin = process.env.APP_ORIGIN ?? "",
      key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? "";
    if (
      new URL(apiUrl).origin !== "https://fxqgvqvthrdzmgnmqgom.supabase.co" ||
      new URL(origin).origin !== "https://opp4all.vercel.app" ||
      !key.startsWith("sb_publishable_")
    )
      throw Error("Hosted validation project/origin/key guard");
    return {
      mode: "hosted",
      origin: "https://opp4all.vercel.app",
      apiUrl: new URL(apiUrl).origin,
      key,
      project: "fxqgvqvthrdzmgnmqgom",
    };
  }
  const raw = JSON.parse(
    readFileSync(".local/s1-validation-runtime.json", "utf8"),
  );
  if (
    raw.PROJECT_ID !== "global-opportunity-os-s1-validation" ||
    new URL(raw.API_URL).hostname !== "127.0.0.1" ||
    new URL(raw.API_URL).port !== "56321" ||
    new URL(raw.DB_URL).hostname !== "127.0.0.1" ||
    new URL(raw.DB_URL).port !== "56322"
  )
    throw Error("Isolated validation runtime guard");
  return {
    mode: "local",
    origin: "http://127.0.0.1:3100",
    apiUrl: raw.API_URL,
    key: raw.ANON_KEY,
    serviceKey: raw.SERVICE_ROLE_KEY,
    dbUrl: raw.DB_URL,
    project: raw.PROJECT_ID,
  };
}
export function privateJson(path: string, data: unknown) {
  mkdirSync(".local", { recursive: true, mode: 0o700 });
  writeFileSync(path, JSON.stringify(data, null, 2) + "\n", { mode: 0o600 });
  chmodSync(path, 0o600);
}
export function literal(value: string) {
  return "'" + value.replaceAll("'", "''") + "'";
}
export async function management(path: string, method = "GET", body?: unknown) {
  const token = process.env.SUPABASE_ACCESS_TOKEN;
  if (!token) throw Error("Management token is not configured");
  const r = await fetch(
    "https://api.supabase.com/v1/projects/fxqgvqvthrdzmgnmqgom" + path,
    {
      method,
      headers: {
        Authorization: `Bearer ${token}`,
        ...(body ? { "Content-Type": "application/json" } : {}),
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
      signal: AbortSignal.timeout(45000),
    },
  );
  if (!r.ok) throw Error("Supabase operator API " + r.status);
  return r.status === 204 ? null : r.json();
}
export async function operatorSql(
  r: ValidationRuntime,
  query: string,
  readOnly = true,
): Promise<pg.QueryResultRow[]> {
  assertValidationTarget(r);
  if (r.mode === "hosted")
    return management("/database/query", "POST", {
      query,
      read_only: readOnly,
    });
  const c = new pg.Client({ connectionString: r.dbUrl });
  await c.connect();
  try {
    return (await c.query(query)).rows;
  } finally {
    await c.end();
  }
}
export async function fixtureAdmin(
  r: ValidationRuntime,
): Promise<SupabaseClient> {
  assertValidationTarget(r);
  let key = r.serviceKey;
  if (r.mode === "hosted") {
    const rows = await management("/api-keys");
    key = Array.isArray(rows)
      ? rows.find((x) => x.name === "service_role")?.api_key
      : undefined;
    if (!key) {
      const legacy = await management("/api-keys/legacy");
      key = legacy.service_role_key ?? legacy.service_role?.api_key;
    }
  }
  if (!key)
    throw Error(
      "A server-side fixture cleanup key is required; never bind it to the web app",
    );
  const client = createClient(r.apiUrl, key, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });
  // ตรวจสิทธิ์ cleanup แบบอ่านอย่างเดียวก่อนอนุญาตให้สร้าง fixture
  const probe = await client.auth.admin.getUserById("00000000-0000-4000-8000-000000000000");
  if (probe.error?.status !== 404 || probe.data.user)
    throw Error("Fixture cleanup credential could not be verified before writes");
  return client;
}
export interface FixtureManifest {
  run: string;
  target: "local" | "hosted";
  startedAt: string;
  project: string;
  apiOrigin: string;
  actors: {
    id: string;
    email: string;
    password: string;
    factorId?: string;
    totp?: string;
  }[];
  organizations: string[];
  pending?: { email: string; password: string }[];
  cleanedAt?: string;
}
// Only exact, server-tagged synthetic identities belonging to this run may be removed.
// App cleanup is atomic; Auth deletion follows and can be resumed. Immutable audit IDs remain.
export async function cleanupFixtures(
  r: ValidationRuntime,
  m: FixtureManifest,
  admin: SupabaseClient,
) {
  if (
    m.target !== r.mode ||
    m.project !== r.project ||
    m.apiOrigin !== r.apiUrl ||
    !/^gooss1[a-f0-9]{16}$/.test(m.run)
  )
    throw Error("Fixture run/target guard");
  for (const p of m.pending ?? []) {
    if (!new RegExp("^" + m.run + "-[a-z0-9]+@example\\.test$").test(p.email))
      throw Error("Pending fixture email guard");
    const rows = await operatorSql(
      r,
      `select id from auth.users where lower(email)=${literal(p.email)} and created_at>=${literal(m.startedAt)}::timestamptz`,
    );
    if (rows.length > 1) throw Error("Pending fixture collision");
    if (rows[0] && !m.actors.some((a) => a.id === rows[0].id)) {
      const protectedAccount = await operatorSql(
        r,
        `select exists(select 1 from private.platform_owner where account_id=${literal(rows[0].id)}::uuid) as protected`,
      );
      if (protectedAccount[0].protected)
        throw Error("Protected owner cannot be adopted as a pending fixture");
      const u = await admin.auth.admin.getUserById(rows[0].id);
      if (u.error || !u.data.user) throw Error("Pending fixture lookup failed");
      if (
        u.data.user.app_metadata?.goos_fixture_run &&
        u.data.user.app_metadata.goos_fixture_run !== m.run
      )
        throw Error("Pending identity belongs to another fixture run");
      const tagged = await admin.auth.admin.updateUserById(rows[0].id, {
        app_metadata: { ...u.data.user.app_metadata, goos_fixture_run: m.run },
      });
      if (tagged.error) throw Error("Pending fixture tagging failed");
      m.actors.push({ id: rows[0].id, ...p });
    }
  }
  const uuid =
    /^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i;
  if (!m.actors.length) {
    m.cleanedAt = new Date().toISOString();
    return;
  }
  if (
    m.actors.some(
      (a) =>
        !uuid.test(a.id) ||
        !new RegExp("^" + m.run + "-[a-z0-9]+@example\\.test$").test(a.email),
    ) ||
    m.organizations.some((x) => !uuid.test(x))
  )
    throw Error("Fixture identity allowlist guard");
  const ids = `array[${m.actors.map((a) => literal(a.id) + "::uuid").join(",")}]::uuid[]`,
    orgs = `array[${m.organizations.map((id) => literal(id) + "::uuid").join(",")}]::uuid[]`;
  const pairs = m.actors
    .map(
      (a) =>
        `(u.id=${literal(a.id)}::uuid and lower(u.email)=${literal(a.email)})`,
    )
    .join(" or ");
  const sql = `begin;set local lock_timeout='5s';set local statement_timeout='30s';
 do $$begin
 if exists(select 1 from private.platform_owner where account_id=any(${ids})) then raise exception 'protected owner cleanup denied';end if;
 if exists(select 1 from auth.users u where u.id=any(${ids}) and(not(${pairs}) or coalesce(u.raw_app_meta_data->>'goos_fixture_run','')<>${literal(m.run)})) then raise exception 'fixture ownership mismatch';end if;
 if exists(select 1 from app.accounts a where a.id=any(${ids}) and not exists(select 1 from auth.users u where u.id=a.id and u.raw_app_meta_data->>'goos_fixture_run'=${literal(m.run)})) then raise exception 'untracked fixture account';end if;
 if exists(select 1 from app.organizations where created_by=any(${ids}) and not(id=any(${orgs}))) or exists(select 1 from app.organizations where id=any(${orgs}) and not(created_by=any(${ids}))) then raise exception 'organization allowlist mismatch';end if;
 if exists(select 1 from app.org_memberships where organization_id=any(${orgs}) and not(account_id=any(${ids}))) or exists(select 1 from app.org_memberships where account_id=any(${ids}) and not(organization_id=any(${orgs}))) then raise exception 'foreign membership cleanup denied';end if;
 if exists(select 1 from app.org_invitations where (organization_id=any(${orgs}) or recipient_account_id=any(${ids}) or invited_by=any(${ids})) and not(organization_id=any(${orgs}) and recipient_account_id=any(${ids}) and invited_by=any(${ids}))) then raise exception 'foreign invitation cleanup denied';end if;
 if exists(select 1 from app.delegations d join app.subjects s on s.id=d.subject_id where (d.granted_by=any(${ids}) or d.delegate_account_id=any(${ids}) or s.account_id=any(${ids})) and not(d.granted_by=any(${ids}) and d.delegate_account_id=any(${ids}) and s.account_id=any(${ids}))) then raise exception 'foreign delegation cleanup denied';end if;
 if exists(select 1 from private.brand_assets where created_by=any(${ids})) or exists(select 1 from private.platform_role_grants where account_id=any(${ids}) or granted_by=any(${ids})) then raise exception 'privileged fixture needs separate cleanup';end if;
 end $$;
 delete from private.consent_events where subject_id in(select id from app.subjects where account_id=any(${ids})) and actor_id=any(${ids}) and(recipient_account_id is null or recipient_account_id=any(${ids}));
 delete from app.delegation_scopes where delegation_id in(select d.id from app.delegations d join app.subjects s on s.id=d.subject_id where s.account_id=any(${ids}) and d.granted_by=any(${ids}) and d.delegate_account_id=any(${ids}));
 delete from app.delegations where granted_by=any(${ids}) and delegate_account_id=any(${ids}) and subject_id in(select id from app.subjects where account_id=any(${ids}));
 delete from app.org_invitations where organization_id=any(${orgs}) and invited_by=any(${ids}) and recipient_account_id=any(${ids});
 delete from app.org_member_roles where membership_id in(select id from app.org_memberships where organization_id=any(${orgs}) and account_id=any(${ids}));
 delete from app.org_memberships where organization_id=any(${orgs}) and account_id=any(${ids});
 delete from app.organizations where id=any(${orgs}) and created_by=any(${ids});
 delete from app.notifications where account_id=any(${ids});
 delete from private.revoked_sessions where account_id=any(${ids});
 delete from app.subjects where account_id=any(${ids});
 -- DELETE triggers ส่งสัญญาณครั้งสุดท้ายก่อนลบ revision เพื่อไม่เหลือ FK
 delete from private.live_revisions where account_id=any(${ids});
 delete from app.accounts where id=any(${ids});
 commit;`;
  await operatorSql(r, sql, false);
  for (const a of m.actors) {
    const existing = await admin.auth.admin.getUserById(a.id);
    if (existing.error?.status === 404) continue;
    if (existing.error)
      throw Error("Fixture Auth lookup failed during cleanup");
    if (
      existing.data.user?.app_metadata?.goos_fixture_run !== m.run ||
      existing.data.user.email !== a.email
    )
      throw Error("Auth fixture ownership mismatch");
    const deleted = await admin.auth.admin.deleteUser(a.id);
    if (deleted.error) throw Error("Fixture Auth deletion failed");
  }
  const left = await operatorSql(
    r,
    `select (select count(*) from app.accounts where id=any(${ids}))::int as accounts,(select count(*) from auth.users where id=any(${ids}))::int as identities,(select count(*) from app.organizations where id=any(${orgs}))::int as organizations`,
  );
  if (left[0].accounts || left[0].identities || left[0].organizations)
    throw Error("Fixture cleanup incomplete");
  m.cleanedAt = new Date().toISOString();
}
export function syntheticTotp(secret: string) {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  let bits = "";
  for (const ch of secret.toUpperCase().replace(/=/g, "")) {
    const n = alphabet.indexOf(ch);
    if (n < 0) throw Error("Synthetic TOTP encoding");
    bits += n.toString(2).padStart(5, "0");
  }
  const key = Buffer.from(
      Array.from({ length: Math.floor(bits.length / 8) }, (_, i) =>
        parseInt(bits.slice(i * 8, i * 8 + 8), 2),
      ),
    ),
    counter = Buffer.alloc(8);
  counter.writeBigUInt64BE(BigInt(Math.floor(Date.now() / 30000)));
  const digest = createHmac("sha1", key).update(counter).digest(),
    offset = digest[digest.length - 1] & 15;
  return ((digest.readUInt32BE(offset) & 0x7fffffff) % 1000000)
    .toString()
    .padStart(6, "0");
}
