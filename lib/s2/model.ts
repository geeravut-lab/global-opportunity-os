export const s2Enabled = () => process.env.S2_ENABLED === "true";
export interface S2Org {
  id: string;
  display_name: string;
  country_code: string;
  status: string;
  stored_status: string;
  version: number;
  verification_expires_at: string | null;
  can_manage: boolean;
  can_review: boolean;
}
export interface Evidence {
  id: string;
  status: string;
  inspection: string | null;
  created_at: string;
}
export interface Rule {
  field: "country" | "region" | "language" | "adult" | "remote" | "hours";
  op: "eq" | "in" | "gte" | "lte";
  value: string | boolean | number | string[];
}
export interface CatalogEntry {
  id: string;
  revision_id: string;
  version: number;
  synthetic: boolean;
  organization_name: string;
  organization_expires_at: string;
  title_th: string;
  title_en: string;
  description_th: string;
  description_en: string;
  category: string;
  country_code: string;
  coarse_region: string;
  languages: string[];
  remote: boolean;
  cost_amount: number;
  currency: string;
  capacity: number | null;
  accessibility_th: string;
  accessibility_en: string;
  source_url: string;
  valid_until: string;
  reviewed_at: string;
  job_pay_min: number | null;
  job_pay_max: number | null;
  job_pay_unit: string | null;
  job_contract: string | null;
  rule_version: number;
  rules: Rule[];
}
export interface CatalogResult {
  items: CatalogEntry[];
  page: number;
  total: number;
  has_more: boolean;
}
export interface DraftListing {
  id: string;
  organization_id: string;
  state: string;
  version: number;
  revision: CatalogEntry & {
    id: string;
    opportunity_id: string;
    revision_no: number;
  };
}
export interface Assessment {
  subject_id: string;
  goals: string[];
  country_code: string | null;
  coarse_region: string | null;
  preferred_language: string | null;
  remote_ok: boolean | null;
  available_hours_week: number | null;
  confirmed_at: string | null;
  notice_id: string;
  version: number;
}
export interface Bookmark {
  title_th: string | null;
  title_en: string | null;
  id: string;
  available: boolean;
  created_at: string;
}
export interface Match {
  id: string;
  revision_id: string;
  title_th: string;
  title_en: string;
  category: string;
  match: {
    status: "eligible" | "ineligible" | "unknown";
    rule_version: number;
    reasons: { field: string; status: string; op: string; expected: unknown }[];
  };
}
