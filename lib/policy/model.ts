import { object, text, version, uuid, email, InputError } from "../auth/input";
import { choice, integer } from "../s3/input";
export const retentionDefaults = {
  draft_days: 30, case_days: 365, audit_days: 730, verification_days: 90,
  backup_target_days: 30, request_days: 7, share_days: 30,
};
export type PolicyDefinition = {
  controller_name: string; country_codes: string[]; privacy_contact: string;
  service_hours: string; notice_th: string; notice_en: string; legal_review_ack: boolean;
  retention: typeof retentionDefaults;
};
export type PolicyVersion = {
  id: string; version: number; state: "draft" | "published" | "retired";
  definition: PolicyDefinition; content_hash: string; created_at: string;
};
export type PolicyState = {
  release: { enabled: boolean; mode: string }; policy_ready: boolean; roster_ready: boolean;
  current: string | null; versions: PolicyVersion[];
  roster: { account_id: string; scope: string; expires_at: string; active: boolean; mfa: boolean }[];
};
export function definition(value: unknown): PolicyDefinition {
  const d = object(value, ["controller_name", "country_codes", "privacy_contact", "service_hours", "notice_th", "notice_en", "legal_review_ack", "retention"]);
  if (!Array.isArray(d.country_codes) || d.country_codes.length > 20 || d.country_codes.some(c => typeof c !== "string" || !/^[A-Z]{2}$/.test(c)) || typeof d.legal_review_ack !== "boolean") throw new InputError("invalid_input");
  const r = object(d.retention, Object.keys(retentionDefaults));
  const retention = Object.fromEntries(Object.keys(retentionDefaults).map(k => [k, integer(r[k], 1, k === "request_days" ? 30 : k === "share_days" ? 90 : 3650)])) as PolicyDefinition["retention"];
  return { controller_name: text(d.controller_name, 0, 200), country_codes: [...new Set(d.country_codes as string[])], privacy_contact: text(d.privacy_contact, 0, 254), service_hours: text(d.service_hours, 0, 500), notice_th: text(d.notice_th, 0, 6000), notice_en: text(d.notice_en, 0, 6000), legal_review_ack: d.legal_review_ack, retention };
}
export function policyMutation(value: unknown) {
  const d = object(value, ["action", "id", "version", "definition", "hash", "mode", "email", "account", "scope", "grant", "expires"]);
  if (d.action === "save") return { fn: "goos_policy_save", args: { p_id: d.id === null ? null : uuid(d.id), p_version: d.id === null ? null : version(d.version), p_definition: definition(d.definition) } };
  if (d.action === "publish") {
    const hash = text(d.hash, 64, 64); if (!/^[a-f0-9]{64}$/.test(hash)) throw new InputError("invalid_input");
    return { fn: "goos_policy_publish", args: { p_id: uuid(d.id), p_hash: hash } };
  }
  if (d.action === "release") return { fn: "goos_policy_release", args: { p_mode: choice(d.mode, ["off", "owner_preview", "enabled"]) } };
  if (d.action === "lookup") return { fn: "goos_policy_lookup", args: { p_email: email(d.email) } };
  if (d.action === "scope") {
    if (typeof d.grant !== "boolean" || typeof d.expires !== "string" || !Number.isFinite(Date.parse(d.expires))) throw new InputError("invalid_input");
    return { fn: "goos_policy_scope", args: { p_account: uuid(d.account), p_scope: choice(d.scope, ["impact", "privacy", "safety"]), p_grant: d.grant, p_expires: new Date(d.expires).toISOString() } };
  }
  throw new InputError("invalid_input");
}
