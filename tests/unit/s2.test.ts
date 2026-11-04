import { describe, it, expect } from "vitest";
import {
  assessmentInput,
  catalogFilters,
  listingInput,
  rules,
  revision,
} from "../../lib/s2/input";
const listing = () => ({
  title_th: "ข้อมูลสมมติ",
  title_en: "Synthetic",
  description_th: "รายละเอียด",
  description_en: "Description",
  category: "skills",
  country_code: "TH",
  languages: ["th"],
  remote: true,
  cost_amount: 0,
  currency: "THB",
  accessibility_th: "คีย์บอร์ด",
  accessibility_en: "Keyboard",
  source_url: "https://example.invalid/source",
  valid_until: "2099-01-01T00:00:00Z",
  rules: [],
});
describe("S2 input boundaries", () => {
  it("optional answers remain unknown; zero hours is not a missing answer", () => {
    expect(assessmentInput({ goals: [] })).toMatchObject({
      country_code: null,
      remote_ok: null,
      available_hours_week: null,
    });
    expect(assessmentInput({ available_hours_week: 0 })).toMatchObject({
      available_hours_week: 0,
    });
  });
  it("rejects sensitive/unrecognized answers and duplicates", () => {
    expect(() => assessmentInput({ diagnosis: "private" })).toThrow();
    expect(() => assessmentInput({ goals: ["jobs", "jobs"] })).toThrow();
    expect(() => assessmentInput({ available_hours_week: 169 })).toThrow();
  });
  it("rule AST rejects scripts, unknown fields/operators and oversized input", () => {
    expect(() => rules([{ field: "sql", op: "eq", value: "true" }])).toThrow();
    expect(() =>
      rules([{ field: "country", op: "eval", value: "TH" }]),
    ).toThrow();
    expect(() =>
      rules(Array(13).fill({ field: "adult", op: "eq", value: true })),
    ).toThrow();
    expect(() => rules([{ field: "hours", op: "gte", value: "5" }])).toThrow();
  });
  it("accepts declared non-sensitive rules without interpreting missing values", () => {
    expect(
      rules([
        { field: "country", op: "in", value: ["TH", "US"] },
        { field: "remote", op: "eq", value: true },
        { field: "hours", op: "gte", value: 5 },
      ]),
    ).toHaveLength(3);
  });
  it("paid adult job terms cannot silently default to missing or charge an application fee", () => {
    expect(() => listingInput({ ...listing(), category: "jobs" })).toThrow();
    const job = {
      ...listing(),
      category: "jobs",
      job_pay_min: 100,
      job_pay_max: 200,
      job_pay_unit: "day",
      job_contract: "part-time",
    };
    expect(listingInput(job).job_pay_min).toBe(100);
    expect(() => listingInput({ ...job, cost_amount: 1 })).toThrow();
    expect(() => listingInput({ ...job, job_pay_max: 50 })).toThrow();
  });
  it("rejects credential-bearing or non-HTTPS source links", () => {
    expect(() =>
      listingInput({ ...listing(), source_url: "javascript:alert(1)" }),
    ).toThrow();
    expect(() =>
      listingInput({
        ...listing(),
        source_url: "https://user:password@example.invalid",
      }),
    ).toThrow();
  });
  it("limits search and pagination while retaining Thai text", () => {
    expect(
      catalogFilters(
        new URLSearchParams({
          q: "ทักษะ",
          region: "กรุงเทพ",
          access: "คีย์บอร์ด",
          page: "2",
        }),
      ),
    ).toMatchObject({ q: "ทักษะ", page: 2 });
    for (const p of [
      { page: "101" },
      { q: "a".repeat(101) },
      { tenant: "forged" },
    ])
      expect(() =>
        catalogFilters(
          new URLSearchParams(
            Object.entries(p).filter(
              (pair): pair is [string, string] => typeof pair[1] === "string",
            ),
          ),
        ),
      ).toThrow();
  });
  it("create version zero is explicit and null cannot bypass optimistic concurrency", () => {
    expect(revision(0)).toBe(0);
    for (const v of [null, undefined, -1, "1", 1.5])
      expect(() => revision(v)).toThrow();
  });
});
