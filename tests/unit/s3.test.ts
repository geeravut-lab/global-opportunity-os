import { describe, it, expect } from "vitest";
import {
  previewInput,
  submitInput,
  transitionInput,
  timestamp,
  timezone,
} from "../../lib/s3/input";
const id = "11111111-1111-4111-8111-111111111111",
  hash = "a".repeat(64);
describe("S3 strict consent and transition contracts", () => {
  it("does not accept client recipient/actor/privilege fields or unsafe sharing fields", () => {
    const p = {
      subject: id,
      opportunity: id,
      fields: ["display_alias"],
      skills: [],
      notice: id,
      application: null,
    };
    expect(previewInput(p).p_fields).toEqual(["display_alias"]);
    for (const unsafe of [{ recipient: id }, { actor: id }, { admin: true }])
      expect(() => previewInput({ ...p, ...unsafe })).toThrow();
    expect(() => previewInput({ ...p, fields: ["disability"] })).toThrow();
    expect(() =>
      previewInput({ ...p, skills: Array(11).fill("skill") }),
    ).toThrow();
  });
  it("requires explicit confirmation, bounded idempotency key, complete hash and read-back flag", () => {
    const p = {
      preview: id,
      hash,
      notice: id,
      confirmed: true,
      readback: false,
    };
    expect(submitInput(p, "receipt-key-123").p_confirmed).toBe(true);
    for (const bad of [
      { confirmed: false },
      { hash: "broken" },
      { readback: "yes" },
      { recipient: id },
    ])
      expect(() => submitInput({ ...p, ...bad }, "receipt-key-123")).toThrow();
    expect(() => submitInput(p, null)).toThrow();
  });
  it("permits typed human actions only, with positive non-null optimistic versions", () => {
    const p = { action: "accept", version: 1, reason: "reviewed", fields: [] };
    expect(transitionInput(p).p_action).toBe("accept");
    for (const bad of [
      { action: "auto_accept" },
      { version: null },
      { version: 0 },
      { fields: ["diagnosis"] },
    ])
      expect(() => transitionInput({ ...p, ...bad })).toThrow();
  });
  it("timestamps require an explicit offset and timezone names are real IANA zones", () => {
    expect(timestamp("2026-11-05T10:00:00+07:00")).toBe(
      "2026-11-05T03:00:00.000Z",
    );
    expect(timestamp(null, true)).toBe(null);
    expect(() => timestamp("2026-11-05T10:00")).toThrow();
    expect(timezone("Asia/Bangkok")).toBe("Asia/Bangkok");
    expect(() => timezone("made/up")).toThrow();
  });
});
