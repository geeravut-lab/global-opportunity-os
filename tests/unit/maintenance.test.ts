import { describe, it, expect } from "vitest";
import { authorized } from "../../lib/maintenance/worker.mjs";
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
