export function s3Enabled() {
  return process.env.S3_ENABLED === "true" && process.env.S2_ENABLED === "true";
}
export const shareFields = [
  "display_alias",
  "country_code",
  "coarse_region",
  "preferred_language",
  "available_hours_week",
  "skills",
  "contact_email",
] as const;
export type ShareField = (typeof shareFields)[number];
export type S3Org = {
  id: string;
  name: string;
  roles: string[];
  can_route: boolean;
  can_assign: boolean;
  can_manage: boolean;
};
export type S3Subject = {
  id: string;
  own: boolean;
  can_prepare: boolean;
  can_submit: boolean;
  can_progress: boolean;
};
export type S3Package = {
  recipient: { id: string; name: string };
  purpose: string;
  fields: ShareField[];
  values: Partial<Record<ShareField, string | number | string[]>>;
  opportunity: {
    id: string;
    revision_id: string;
    title_th: string;
    title_en: string;
    category: string;
    job_pay_min: number | null;
    job_pay_max: number | null;
    currency: string;
    job_pay_unit: string | null;
    job_contract: string | null;
  };
  notice_id: string;
  notice_hash: string;
};
export type Preview = {
  id: string;
  hash: string;
  expires_at: string;
  package: S3Package;
  readback_required: boolean;
};
export type S3Row = {
  id: string;
  case_id: string;
  organization_id: string;
  state: string;
  version: number;
  case_state: string;
  case_version: number;
  priority: string;
  resolution_code: string | null;
  due_at: string | null;
  timezone: string;
  job_stage: string;
  category: string;
  assigned_member_id: string | null;
  title_th: string;
  title_en: string;
  can_work: boolean;
  can_progress: boolean;
  can_route: boolean;
};
export type S3Team = { id: string; account_id: string; roles: string[] };
export type S3Note = {
  id: string;
  visibility: "internal" | "beneficiary_shared";
  body: string;
  supersedes_id: string | null;
  own: boolean;
  created_at: string;
};
export type S3Detail = {
  id: string;
  subject_id: string | null;
  state: string;
  version: number;
  job_stage: string;
  receipt_code: string;
  case: {
    id: string;
    state: string;
    version: number;
    priority: string;
    due_at: string | null;
    timezone: string;
    resolution_code: string | null;
  };
  package: S3Package;
  can_work: boolean;
  can_submit: boolean;
  own: boolean;
  responses: {
    id: string;
    package: S3Package;
    hash: string;
    created_at: string;
  }[];
  requests: {
    id: string;
    fields: ShareField[];
    status: string;
    reason_code: string;
    created_at: string;
  }[];
  events: { state: string; reason_code: string; created_at: string }[];
  case_events: { action: string; reason_code: string; created_at: string }[];
  notes: S3Note[];
};
export type S3Preferences = {
  in_app: boolean;
  email: boolean;
  timezone: string;
  version: number;
};
export type S3Rule = {
  id: string;
  organization_id: string;
  kind: "followup_due";
  minutes_before: number;
  timezone: string;
  enabled: boolean;
  version: number;
};
export type S3Job = {
  id: string;
  kind: string;
  channel: string;
  status: string;
  attempts: number;
  error_code: string | null;
  available_at: string;
  created_at: string;
};
export type S3Inbox = {
  id: string;
  kind: string;
  resource_path: string | null;
  read_at: string | null;
  created_at: string;
};
