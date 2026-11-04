import { describe, it, expect } from "vitest";
import {
  assertValidationTarget,
  cleanupFixtures,
  type ValidationRuntime,
  type FixtureManifest,
} from "../../scripts/validation-runtime";
import type { SupabaseClient } from "@supabase/supabase-js";
const local: ValidationRuntime = {
  mode: "local",
  origin: "http://127.0.0.1:3100",
  apiUrl: "http://127.0.0.1:56321",
  key: "fixture",
  dbUrl: "postgresql://fixture:fixture@127.0.0.1:56322/postgres",
  project: "global-opportunity-os-s1-validation",
};
describe("Destructive validation target guards", () => {
  it("accepts the isolated loopback target", () =>
    expect(() => assertValidationTarget(local)).not.toThrow());
  it("rejects a remote database masquerading as local", () =>
    expect(() =>
      assertValidationTarget({
        ...local,
        dbUrl: "postgresql://fixture:fixture@unrelated.invalid:56322/postgres",
      }),
    ).toThrow());
  it("rejects an unrelated API before disclosing a fixture admin key", () =>
    expect(() =>
      assertValidationTarget({ ...local, apiUrl: "https://unrelated.invalid" }),
    ).toThrow());
  it("requires the exact hosted project and application origin", () =>
    expect(() =>
      assertValidationTarget({
        ...local,
        mode: "hosted",
        apiUrl: "https://fxqgvqvthrdzmgnmqgom.supabase.co",
        origin: "https://unrelated.invalid",
        project: "fxqgvqvthrdzmgnmqgom",
      }),
    ).toThrow());
  const manifest: FixtureManifest = {
    run: "gooss10000000000000000",
    target: "local",
    project: local.project,
    apiOrigin: local.apiUrl,
    startedAt: "2026-11-04T00:00:00Z",
    actors: [],
    organizations: [],
  };
  it("cannot mark another stack cleaned from an empty ID list", async () => {
    await expect(
      cleanupFixtures(
        local,
        { ...manifest, project: "global-opportunity-os-s1-local" },
        {} as SupabaseClient,
      ),
    ).rejects.toThrow("target guard");
  });
  it("rejects an email/UUID outside the exact synthetic run before SQL or Auth calls", async () => {
    await expect(
      cleanupFixtures(
        local,
        {
          ...manifest,
          actors: [
            {
              id: "00000000-0000-4000-8000-000000000099",
              email: "outside@example.test",
              password: "synthetic-only",
            },
          ],
        },
        {} as SupabaseClient,
      ),
    ).rejects.toThrow("allowlist guard");
  });
});
