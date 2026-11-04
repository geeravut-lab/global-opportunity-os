export interface AccountContext {
  account_id: string;
  locale: string;
  subject_id: string | null;
  aal: string;
  staff_assured: boolean;
  has_membership: boolean;
  has_platform_role: boolean;
  can_reset_password: boolean;
  has_password: boolean;
}
export interface Profile {
  id: string;
  display_alias: string;
  country_code: string;
  coarse_region: string;
  safe_contact: "none" | "email" | null;
  version: number;
  own: boolean;
  can_write: boolean;
}
export interface Notice {
  id: string;
  version: string;
  body: string;
  hash: string;
  environment: string;
}
export interface Delegation {
  id: string;
  subject_id: string;
  delegate_account_id: string;
  own: boolean;
  status: string;
  expires_at: string;
  version: number;
  scopes: string[];
}
export interface Organization {
  id: string;
  display_name: string;
  status: string;
  country_code: string;
  can_manage?: boolean;
}
export interface Member {
  id: string;
  account_id: string;
  status: string;
  version: number;
  roles: string[];
}
export interface Invitation {
  id: string;
  organization_id: string;
  organization_name: string;
  role: string;
  expires_at: string;
  status: string;
}
export interface ConsentEvent {
  id: string;
  purpose: string;
  recipient_account_id: string | null;
  notice_id: string;
  action: string;
  scopes: string[];
  occurred_at: string;
}
export interface FactorInfo {
  id: string;
  friendly_name?: string;
  status: string;
}
export interface AccountData {
  context: AccountContext;
  profile: Profile | null;
  notices: Notice[];
  delegations: Delegation[];
  organizations: Organization[];
  invitations: Invitation[];
  consents: ConsentEvent[];
  factors: FactorInfo[];
  notifications: NotificationInfo[];
  can_change_password: boolean;
}

export interface OutgoingInvitation {
  id: string;
  recipient_account_id: string;
  role: string;
  status: string;
  expires_at: string;
}

export interface NotificationInfo {
  id: string;
  kind: string;
  read_at: string | null;
  created_at: string;
}
