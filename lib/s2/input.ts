import { object, text, InputError } from "../auth/input";
import type { Rule } from "./model";
const fail = (): never => {
  throw new InputError("invalid_input");
};
export function revision(v: unknown) {
  if (!Number.isSafeInteger(v) || Number(v) < 0) fail();
  return Number(v);
}
const number = (
  v: unknown,
  min: number,
  max: number,
  nullable = false,
): number | null => {
  if (nullable && (v === null || v === "" || v === undefined)) return null;
  if (typeof v !== "number" || !Number.isFinite(v) || v < min || v > max)
    fail();
  return v as number;
};
const strings = (v: unknown, allowed: readonly string[], max: number) => {
  if (
    !Array.isArray(v) ||
    v.length > max ||
    v.some((x) => typeof x !== "string" || !allowed.includes(x)) ||
    new Set(v).size !== v.length
  )
    fail();
  return v as string[];
};
export function rules(v: unknown): Rule[] {
  if (!Array.isArray(v) || v.length > 12) fail();
  for (const raw of v as unknown[]) {
    const r = object(raw, ["field", "op", "value"]),
      f = r.field,
      op = r.op,
      val = r.value;
    if (["country", "region", "language"].includes(String(f))) {
      if (op === "eq") text(val, 1, 80);
      else if (op === "in") {
        if (!Array.isArray(val) || val.length < 1 || val.length > 20) fail();
        for (const x of val as unknown[]) text(x, 1, 80);
      } else fail();
    } else if (f === "adult" || f === "remote") {
      if (op !== "eq" || typeof val !== "boolean") fail();
    } else if (f === "hours") {
      if (op !== "gte" && op !== "lte") fail();
      number(val, 0, 168);
    } else fail();
  }
  return v as Rule[];
}
const country = (v: unknown) => {
  const s = text(v, 2, 2);
  if (!/^[A-Z]{2}$/.test(s)) fail();
  return s;
};
export function listingInput(v: unknown) {
  const d = object(v, [
    "title_th",
    "title_en",
    "description_th",
    "description_en",
    "category",
    "country_code",
    "coarse_region",
    "languages",
    "remote",
    "cost_amount",
    "currency",
    "accessibility_th",
    "accessibility_en",
    "source_url",
    "valid_until",
    "capacity",
    "job_pay_min",
    "job_pay_max",
    "job_pay_unit",
    "job_contract",
    "rules",
  ]);
  const category = text(d.category);
  if (
    !["jobs", "skills", "access", "community"].includes(category) ||
    typeof d.remote !== "boolean"
  )
    fail();
  const langs = strings(d.languages, ["th", "en"], 2);
  if (!langs.length) fail();
  const source = text(d.source_url, 8, 500);
  let url: URL;
  try {
    url = new URL(source);
  } catch {
    fail();
  }
  if (url!.protocol !== "https:" || url!.username || url!.password) fail();
  const until = text(d.valid_until, 10, 50);
  if (!Number.isFinite(Date.parse(until)) || Date.parse(until) <= Date.now())
    fail();
  const currency = text(d.currency, 3, 3);
  if (!/^[A-Z]{3}$/.test(currency)) fail();
  const cost = number(d.cost_amount, 0, 9999999999),
    min = number(d.job_pay_min, 0, 9999999999, true),
    max = number(d.job_pay_max, 0, 9999999999, true);
  if (
    category === "jobs" &&
    (cost !== 0 ||
      min === null ||
      max === null ||
      min <= 0 ||
      max < min ||
      !["hour", "day", "month"].includes(String(d.job_pay_unit)) ||
      typeof d.job_contract !== "string" ||
      !d.job_contract.trim())
  )
    fail();
  const capacity = number(d.capacity, 0, 1000000, true);
  if (capacity !== null && !Number.isInteger(capacity)) fail();
  return {
    title_th: text(d.title_th, 1, 160),
    title_en: text(d.title_en, 1, 160),
    description_th: text(d.description_th, 1, 2000),
    description_en: text(d.description_en, 1, 2000),
    category,
    country_code: country(d.country_code),
    coarse_region: text(d.coarse_region ?? "", 0, 80),
    languages: langs,
    remote: d.remote,
    cost_amount: cost,
    currency,
    accessibility_th: text(d.accessibility_th, 1, 500),
    accessibility_en: text(d.accessibility_en, 1, 500),
    source_url: source,
    valid_until: until,
    capacity,
    job_pay_min: min,
    job_pay_max: max,
    job_pay_unit: d.job_pay_unit ? text(d.job_pay_unit, 1, 20) : null,
    job_contract: d.job_contract ? text(d.job_contract, 1, 80) : null,
    rules: rules(d.rules ?? []),
  };
}
export function assessmentInput(v: unknown) {
  const d = object(v, [
    "goals",
    "country_code",
    "coarse_region",
    "preferred_language",
    "remote_ok",
    "available_hours_week",
  ]);
  if (
    d.remote_ok !== null &&
    d.remote_ok !== undefined &&
    typeof d.remote_ok !== "boolean"
  )
    fail();
  if (
    d.preferred_language &&
    !["th", "en"].includes(String(d.preferred_language))
  )
    fail();
  const hours = number(d.available_hours_week, 0, 168, true);
  if (hours !== null && !Number.isInteger(hours)) fail();
  return {
    goals: strings(d.goals ?? [], ["jobs", "skills", "access", "community"], 4),
    country_code: d.country_code ? country(d.country_code) : null,
    coarse_region: d.coarse_region ? text(d.coarse_region, 0, 80) : null,
    preferred_language: d.preferred_language || null,
    remote_ok: d.remote_ok ?? null,
    available_hours_week: hours,
  };
}
export function catalogFilters(params: URLSearchParams) {
  const out: Record<string, string | number> = {};
  for (const [k, v] of params) {
    if (
      ![
        "q",
        "category",
        "country",
        "language",
        "remote",
        "free",
        "page",
        "region",
        "access",
      ].includes(k)
    )
      fail();
    if (k === "page") {
      const n = Number(v);
      if (!Number.isInteger(n) || n < 1 || n > 100) fail();
      out.page = n;
    } else if (v) {
      if (k === "q") out.q = text(v, 0, 100).normalize("NFKC");
      else if (k === "region" || k === "access") out[k] = text(v, 0, 80);
      else if (k === "country") out.country = country(v);
      else if (k === "category") {
        if (!["jobs", "skills", "access", "community"].includes(v)) fail();
        out[k] = v;
      } else if (k === "language") {
        if (!["th", "en"].includes(v)) fail();
        out[k] = v;
      } else {
        if (!["true", "false"].includes(v)) fail();
        out[k] = v;
      }
    }
  }
  return out;
}
