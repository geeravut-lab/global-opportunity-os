import type { AccountContext, Delegation, Notice } from "../auth/types";
import type { CatalogEntry } from "../s2/model";
import type {
  S3Org,
  S3Subject,
  S3Row,
  S3Detail,
  S3Team,
  S3Preferences,
  S3Inbox,
  S3Rule,
  S3Job,
} from "./model";
export type S3Section =
  | "home"
  | "apply"
  | "application"
  | "applications"
  | "queue"
  | "team"
  | "settings"
  | "automation"
  | "delivery";
export type S3PageData = {
  context: AccountContext;
  orgs: S3Org[];
  subjects: S3Subject[];
  notice: Notice;
  delegationNotice: Notice;
  delegations: Delegation[];
  rows: S3Row[];
  detail: S3Detail | null;
  team: S3Team[];
  preferences: S3Preferences;
  inbox: S3Inbox[];
  rules: S3Rule[];
  jobs: S3Job[];
  listing: CatalogEntry | null;
  availability: { accepting: boolean; remaining: number | null } | null;
  org: string | null;
  page: number;
};
