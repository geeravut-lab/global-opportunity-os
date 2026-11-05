import { describe, it, expect } from "vitest";
import { authorized, failureReason } from "../../lib/maintenance/worker.mjs";
import { X509Certificate } from "node:crypto";
import { supabaseProductionCa } from "../../lib/maintenance/supabase-ca.mjs";
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
describe("Supabase production trust roots", () => {
  it("pins the two official production roots, excluding staging and expired/non-CA certificates", () => {
    expect(supabaseProductionCa).toHaveLength(2);
    expect(
      supabaseProductionCa.map(
        (pem) => new X509Certificate(pem).fingerprint256,
      ),
    ).toEqual([
      "80:70:25:AD:50:D4:ED:21:9D:2C:9C:7D:29:9C:00:4F:82:4E:B0:0C:F7:F6:5A:FE:F6:07:D0:7B:72:E6:CA:FA",
      "5F:9B:77:95:1A:7A:A1:30:3F:9B:58:EE:A9:BF:A8:9E:35:8C:FD:C1:5F:97:86:FF:10:D4:93:0A:72:2C:9A:E2",
    ]);
    for (const pem of supabaseProductionCa) {
      const cert = new X509Certificate(pem);
      expect(cert.ca).toBe(true);
      expect(cert.subject.split("\n")).toContain("CN=Supabase Root 2021 CA");
      expect(cert.subject).toBe(cert.issuer);
      expect(cert.verify(cert.publicKey)).toBe(true);
      expect(Date.parse(cert.validFrom)).toBeLessThan(Date.now());
      expect(Date.parse(cert.validTo)).toBeGreaterThan(Date.now());
    }
  });
});
