import { readFileSync } from "node:fs";
export interface LocalRuntime {
  apiUrl: string;
  anonKey: string;
  serviceRoleKey: string;
  dbUrl: string;
  mailUrl: string;
}
export function localRuntime(): LocalRuntime {
  const raw = JSON.parse(
    readFileSync(".local/supabase-runtime.json", "utf8"),
  ) as Record<string, string>;
  for (const name of ["API_URL", "DB_URL", "MAILPIT_URL"]) {
    const value = new URL(raw[name]);
    if (!["127.0.0.1", "localhost", "[::1]"].includes(value.hostname))
      throw Error("ปฏิเสธ runtime ที่ไม่ใช่ loopback");
  }
  if (!raw.ANON_KEY || !raw.SERVICE_ROLE_KEY)
    throw Error("local keys ยังไม่พร้อม");
  return {
    apiUrl: raw.API_URL,
    anonKey: raw.ANON_KEY,
    serviceRoleKey: raw.SERVICE_ROLE_KEY,
    dbUrl: raw.DB_URL,
    mailUrl: raw.MAILPIT_URL,
  };
}
export interface FixtureActor {
  id: string;
  email: string;
  password: string;
}
export function localActors(): Record<string, FixtureActor> {
  localRuntime();
  return JSON.parse(
    readFileSync(".local/auth-fixtures.json", "utf8"),
  ) as Record<string, FixtureActor>;
}
