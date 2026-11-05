import {
  InputError,
  object,
  text,
  uuid,
  version,
  confirmed,
} from "../auth/input";
import { shareFields } from "./model";
export const actions = [
  "withdraw",
  "revoke_share",
  "accept_offer",
  "start_review",
  "request_info",
  "waitlist",
  "decline",
  "accept",
  "complete",
  "interview",
  "offer",
  "job_started",
  "job_completed",
] as const;
export function choice(value: unknown, allowed: readonly string[]) {
  if (typeof value !== "string" || !allowed.includes(value))
    throw new InputError("invalid_input");
  return value;
}
export function bool(value: unknown) {
  if (typeof value !== "boolean") throw new InputError("invalid_input");
  return value;
}
export function integer(value: unknown, min: number, max: number) {
  if (
    !Number.isSafeInteger(value) ||
    Number(value) < min ||
    Number(value) > max
  )
    throw new InputError("invalid_input");
  return Number(value);
}
export function fields(value: unknown) {
  if (
    !Array.isArray(value) ||
    value.length < 1 ||
    value.length > 7 ||
    value.some((v) => !shareFields.includes(v))
  )
    throw new InputError("invalid_input");
  return [...new Set(value)] as string[];
}
export function timestamp(value: unknown, optional = false) {
  if (value === null && optional) return null;
  const s = text(value, 20, 40);
  if (
    !/^\d{4}-\d\d-\d\dT\d\d:\d\d(?::\d\d(?:\.\d{1,3})?)?(?:Z|[+-]\d\d:\d\d)$/.test(
      s,
    ) ||
    !Number.isFinite(Date.parse(s))
  )
    throw new InputError("invalid_input");
  return new Date(s).toISOString();
}
export function timezone(value: unknown) {
  const s = text(value, 1, 80);
  try {
    new Intl.DateTimeFormat("en", { timeZone: s }).format();
  } catch {
    throw new InputError("invalid_input");
  }
  return s;
}
export function previewInput(value: unknown) {
  const d = object(value, [
    "subject",
    "opportunity",
    "fields",
    "skills",
    "notice",
    "application",
  ]);
  if (!Array.isArray(d.skills) || d.skills.length > 10)
    throw new InputError("invalid_input");
  return {
    p_subject: uuid(d.subject),
    p_opportunity: uuid(d.opportunity),
    p_fields: fields(d.fields),
    p_skills: d.skills.map((v) => text(v, 1, 60)),
    p_notice: uuid(d.notice),
    p_application: d.application === null ? null : uuid(d.application),
  };
}
export function submitInput(value: unknown, key: string | null) {
  const d = object(value, [
    "preview",
    "hash",
    "notice",
    "confirmed",
    "readback",
  ]);
  const hash = text(d.hash, 64, 64);
  if (
    !/^[a-f0-9]{64}$/.test(hash) ||
    key === null ||
    !/^[A-Za-z0-9_-]{8,80}$/.test(key)
  )
    throw new InputError("invalid_input");
  return {
    p_preview: uuid(d.preview),
    p_hash: hash,
    p_notice: uuid(d.notice),
    p_confirmed: confirmed(d.confirmed),
    p_readback: bool(d.readback),
    p_key: key,
  };
}
export function transitionInput(value: unknown) {
  const d = object(value, ["action", "version", "reason", "fields"]);
  return {
    p_action: choice(d.action, actions),
    p_version: version(d.version),
    p_reason: choice(d.reason, [
      "user_requested",
      "reviewed",
      "criteria_not_met",
      "capacity_waitlist",
      "information_needed",
      "service_recorded",
      "interview_scheduled",
      "offer_made",
      "offer_accepted",
      "started",
      "completed",
    ]),
    p_fields:
      Array.isArray(d.fields) && d.fields.length === 0 ? [] : fields(d.fields),
  };
}
