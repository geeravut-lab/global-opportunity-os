import { s3Enabled } from "../s3/model";
export function s4Enabled() {
  return s3Enabled() && process.env.S4_ENABLED === "true";
}
export function s4IntakeEnabled() {
  return s4Enabled() && process.env.S4_ROLLOUT_MODE !== "owner_preview" && process.env.S4_ROLLOUT_MODE !== "off";
}
export const kinds = ["referrals", "outcomes", "privacy", "reports"] as const;
export type S4Kind = (typeof kinds)[number];
export type S4Row = {
  id: string;
  kind: S4Kind;
  state: string;
  version: number;
  created_at: string;
  title: string;
  can_view: boolean;
  can_consent?: boolean;
  can_revoke?: boolean;
  can_accept?: boolean;
  recipient_org_id?: string;
  share_active?: boolean;
  expires_at?: string;
  tier?: string;
  confirmed?: boolean;
  period_start?: string;
  period_end?: string;
  case_id?: string;
  case_version?: number;
  can_assign_case?: boolean;
  own?: boolean;
  reporter?: boolean;
  can_review?: boolean;
  can_assign?: boolean;
  can_export?: boolean;
  identity_verified?: boolean;
  hold?: string;
  appeal_of?: string;
};
export type S4Detail = {
  row: S4Row;
  body?: string;
  package?: {
    recipient: { id: string; name: string };
    purpose: string;
    fields: string[];
    values: Record<string, unknown>;
    notice_hash: string;
    request_expires_at: string;
    share_expires_at: string;
  } | null;
  case?: {
    id: string;
    state: string;
    version: number;
    can_work: boolean;
    can_assign: boolean;
  } | null;
  source_application?: string;
  occurred_at?: string;
  corrects_id?: string;
  notes?: {
    id: string;
    body: string;
    visibility: string;
    supersedes_id: string | null;
  }[];
  evidence?: { id: string; status: string; hash: string | null }[];
  events: { action: string; created_at: string; reason_code?: string | null }[];
};
export type S4Source = {
  id: string;
  type: "source" | "destination";
  can_refer?: boolean;
  own: boolean;
  title_th: string;
  title_en: string;
  organization_id: string;
  organization_name: string;
};
export type S4Staff = {
  account: string;
  scope: string;
  expires_at: string;
  name: string;
};
export type S4Cessation = {
  id: string;
  resource_kind: string;
  resource_id: string;
  recipient_org_id: string;
  status: string;
  can_ack: boolean;
};
