import { describe, it, expect } from "vitest";
import { authorized, failureReason } from "../../lib/maintenance/worker.mjs";
describe("machine endpoint authorization", () => {
  it("rejects absent, short, malformed and incorrect credentials", () => {
    expect(authorized(null, undefined)).toBe(false);
    expect(authorized("Bearer short", "short")).toBe(false);
    expect(authorized("Basic " + "a".repeat(48), "a".repeat(48))).toBe(false);
    expect(authorized("Bearer " + "b".repeat(48), "a".repeat(48))).toBe(false);
  });
  it("accepts the exact machine credential", () => {
    expect(authorized("Bearer " + "a".repeat(48), "a".repeat(48))).toBe(true);
  });
});
describe("machine failure diagnostics", () => {
  it("returns bounded categories without copying database messages or credentials", () => {
    expect(
      failureReason({ code: "28P01", message: "private credential" }),
    ).toBe("DATABASE_AUTH");
    expect(failureReason({ code: "SELF_SIGNED_CERT_IN_CHAIN" })).toBe(
      "DATABASE_TLS",
    );
    expect(failureReason({ code: "42501" })).toBe("DATABASE_PRIVILEGE");
    expect(failureReason({ code: "ECONNREFUSED" })).toBe(
      "DATABASE_CONNECTIVITY",
    );
    expect(failureReason({ code: "57014" })).toBe("DATABASE_TIMEOUT");
    expect(failureReason(new Error("private credential"))).toBe(
      "INTERNAL_FAILURE",
    );
    expect(failureReason(null)).toBe("INTERNAL_FAILURE");
    expect(failureReason({ code: "user-controlled secret" })).toBe(
      "INTERNAL_FAILURE",
    );
  });
});
