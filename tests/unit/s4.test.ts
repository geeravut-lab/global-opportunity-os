import { describe, it, expect } from "vitest";
import { mutation, dateInput } from "../../lib/s4/input";
import { InputError } from "../../lib/auth/input";
import { inspectEvidence } from "../../lib/maintenance/worker.mjs";
import type pg from "pg";
const id = "00000000-0000-4000-8000-000000000111";
describe("S4 bounded inputs", () => {
  it("rejects silent consent, unselected data, extra privilege fields and malformed idempotency", () => {
    expect(() =>
      mutation(
        "submissions",
        { preview: id, hash: "a".repeat(64), notice: id, confirmed: false },
        "valid-key",
      ),
    ).toThrow(InputError);
    expect(() =>
      mutation(
        "submissions",
        { preview: id, hash: "a".repeat(64), notice: id, confirmed: true },
        null,
      ),
    ).toThrow(InputError);
    expect(() =>
      mutation(
        "previews",
        { id, fields: ["diagnosis"], skills: [], notice: id },
        null,
      ),
    ).toThrow(InputError);
    expect(() =>
      mutation(
        "proposals",
        { case: id, opportunity: id, purpose: "service_support", actor: id },
        null,
      ),
    ).toThrow(InputError);
  });
  it("rejects purge, self-selected reviewer bypass and untyped transitions", () => {
    expect(() =>
      mutation(
        "privacy/" + id + "/action",
        { action: "purge", version: 1, reason: null },
        null,
      ),
    ).toThrow(InputError);
    expect(() =>
      mutation(
        "outcomes/" + id + "/action",
        { action: "verify", version: 1, reason: null, reviewer: id },
        null,
      ),
    ).toThrow(InputError);
    expect(() =>
      mutation(
        "referrals/" + id + "/action",
        { action: "accept", version: 0, member: id },
        null,
      ),
    ).toThrow(InputError);
  });
  it("validates real date boundaries and explicit correction references", () => {
    expect(() => dateInput("2026-02-30")).toThrow(InputError);
    expect(dateInput("2026-02-28")).toBe("2026-02-28");
    const r = mutation(
      "outcomes",
      {
        case: id,
        kind: "service_delivered",
        start: "2026-01-01",
        end: "2026-01-02",
        occurred: "2026-01-02T10:00:00Z",
        body: "Synthetic evidence",
        corrects: id,
      },
      null,
    );
    expect(r.args).toMatchObject({
      p_corrects: id,
      p_case: id,
      p_kind: "service_delivered",
    });
  });
  it("never accepts caller-controlled SQL table names for the evidence worker", async () => {
    await expect(
      inspectEvidence({} as pg.Client, "application_packages"),
    ).rejects.toThrow("Evidence table guard");
    await expect(
      inspectEvidence({} as pg.Client, "s4_evidence;drop table app.accounts"),
    ).rejects.toThrow("Evidence table guard");
  });
});
