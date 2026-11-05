import {
  object,
  uuid,
  text,
  version,
  confirmed,
  InputError,
} from "../auth/input";
import { choice, fields, timestamp } from "../s3/input";
import { kinds } from "./model";
export const kindInput = (value: unknown) => choice(value, kinds);
export function dateInput(value: unknown) {
  const v = text(value, 10, 10);
  if (
    !/^\d{4}-\d\d-\d\d$/.test(v) ||
    !Number.isFinite(Date.parse(v)) ||
    new Date(v).toISOString().slice(0, 10) !== v
  )
    throw new InputError("invalid_input");
  return v;
}
export function mutation(route: string, value: unknown, key: string | null) {
  const parts = route.split("/");
  if (route === "proposals") {
    const d = object(value, ["case", "opportunity", "purpose"]);
    return {
      fn: "goos_s4_propose",
      args: {
        p_case: uuid(d.case),
        p_opportunity: uuid(d.opportunity),
        p_purpose: choice(d.purpose, ["service_support", "work_support"]),
      },
    };
  }
  if (route === "previews") {
    const d = object(value, ["id", "fields", "skills", "notice"]);
    if (!Array.isArray(d.skills) || d.skills.length > 10)
      throw new InputError("invalid_input");
    return {
      fn: "goos_s4_preview",
      args: {
        p_id: uuid(d.id),
        p_fields: fields(d.fields),
        p_skills: d.skills.map((v) => text(v, 1, 60)),
        p_notice: uuid(d.notice),
      },
    };
  }
  if (route === "submissions") {
    const d = object(value, ["preview", "hash", "notice", "confirmed"]);
    const hash = text(d.hash, 64, 64);
    if (
      !/^[a-f0-9]{64}$/.test(hash) ||
      !key ||
      !/^[A-Za-z0-9_-]{8,80}$/.test(key)
    )
      throw new InputError("invalid_input");
    return {
      fn: "goos_s4_submit",
      args: {
        p_preview: uuid(d.preview),
        p_hash: hash,
        p_notice: uuid(d.notice),
        p_confirmed: confirmed(d.confirmed),
        p_key: key,
      },
    };
  }
  if (route === "outcomes") {
    const d = object(value, [
      "case",
      "kind",
      "start",
      "end",
      "occurred",
      "body",
      "corrects",
    ]);
    return {
      fn: "goos_s4_outcome_create",
      args: {
        p_case: uuid(d.case),
        p_kind: choice(d.kind, [
          "service_delivered",
          "job_started",
          "skills_completed",
        ]),
        p_start: dateInput(d.start),
        p_end: dateInput(d.end),
        p_occurred: timestamp(d.occurred),
        p_body: text(d.body, 1, 2000),
        p_corrects: d.corrects === null ? null : uuid(d.corrects),
      },
    };
  }
  if (route === "privacy") {
    const d = object(value, ["kind", "body", "confirmed"]);
    return {
      fn: "goos_s4_privacy_create",
      args: {
        p_kind: choice(d.kind, ["access", "export", "correct", "delete"]),
        p_body: text(d.body, 1, 2000),
        p_confirmed: confirmed(d.confirmed),
      },
    };
  }
  if (route === "reports") {
    const d = object(value, ["kind", "body", "org", "accused", "appeal"]);
    return {
      fn: "goos_s4_report_create",
      args: {
        p_kind: choice(d.kind, ["service", "safety"]),
        p_body: text(d.body, 1, 2000),
        p_org: d.org === null ? null : uuid(d.org),
        p_accused: d.accused === null ? null : uuid(d.accused),
        p_appeal: d.appeal === null ? null : uuid(d.appeal),
      },
    };
  }
  if (route === "scope") {
    const d = object(value, ["account", "scope", "grant", "expires"]);
    if (typeof d.grant !== "boolean") throw new InputError("invalid_input");
    return {
      fn: "goos_s4_scope",
      args: {
        p_account: uuid(d.account),
        p_scope: choice(d.scope, ["impact", "privacy", "safety"]),
        p_grant: d.grant,
        p_expires: timestamp(d.expires),
      },
    };
  }
  if (parts.length === 3 && parts[2] === "assign") {
    const d = object(value, ["account", "expires", "version"]);
    return {
      fn: "goos_s4_assign",
      args: {
        p_kind: choice(parts[0], ["outcomes", "privacy", "reports"]),
        p_id: uuid(parts[1]),
        p_account: uuid(d.account),
        p_expires: timestamp(d.expires),
        p_version: version(d.version),
      },
    };
  }
  if (parts.length === 3 && parts[0] === "cessations" && parts[2] === "ack") {
    object(value, []);
    return { fn: "goos_s4_cessation_ack", args: { p_id: uuid(parts[1]) } };
  }
  if (
    parts.length === 3 &&
    parts[0] === "outcomes" &&
    parts[2] === "evidence"
  ) {
    const d = object(value, ["body"]);
    const body = text(d.body, 60, 1398104);
    if (!/^[A-Za-z0-9+/]+={0,2}$/.test(body))
      throw new InputError("invalid_input");
    return {
      fn: "goos_s4_evidence",
      args: { p_id: uuid(parts[1]), p_body: body },
    };
  }
  if (parts.length === 3 && parts[2] === "action") {
    if (parts[0] === "cases") {
      const d = object(value, [
        "action",
        "version",
        "member",
        "body",
        "visibility",
        "supersedes",
      ]);
      return {
        fn: "goos_s4_case_action",
        args: {
          p_id: uuid(parts[1]),
          p_action: choice(d.action, [
            "assign",
            "note",
            "start",
            "resolve",
            "close",
          ]),
          p_version: version(d.version),
          p_member: d.member === null ? null : uuid(d.member),
          p_body: d.body === null ? null : text(d.body, 1, 2000),
          p_visibility:
            d.visibility === null
              ? null
              : choice(d.visibility, ["internal", "beneficiary_shared"]),
          p_supersedes: d.supersedes === null ? null : uuid(d.supersedes),
        },
      };
    }
    if (parts[0] === "referrals") {
      const d = object(value, ["action", "version", "member"]);
      return {
        fn: "goos_s4_referral_action",
        args: {
          p_id: uuid(parts[1]),
          p_action: choice(d.action, [
            "accept",
            "decline",
            "cancel",
            "revoke",
            "expire",
          ]),
          p_version: version(d.version),
          p_member: d.member === null ? null : uuid(d.member),
        },
      };
    }
    const d = object(value, ["action", "version", "reason"]);
    const base = { p_id: uuid(parts[1]), p_version: version(d.version) };
    if (parts[0] === "outcomes")
      return {
        fn: "goos_s4_outcome_action",
        args: {
          ...base,
          p_action: choice(d.action, [
            "confirm",
            "dispute",
            "verify",
            "reject",
          ]),
          p_alternate:
            d.reason === null
              ? null
              : choice(d.reason, ["reviewed_documentary_evidence"]),
        },
      };
    if (parts[0] === "privacy")
      return {
        fn: "goos_s4_privacy_action",
        args: {
          ...base,
          p_action: choice(d.action, [
            "verify_identity",
            "approve",
            "hold",
            "release_hold",
            "decline",
            "stop_sharing",
            "complete_correction",
          ]),
          p_reason:
            d.reason === null
              ? null
              : choice(d.reason, [
                  "authenticated_session_review",
                  "assisted_verified",
                  "active_investigation",
                  "legal_obligation",
                ]),
        },
      };
    if (parts[0] === "reports")
      return {
        fn: "goos_s4_report_action",
        args: {
          ...base,
          p_action: choice(d.action, ["review", "resolve", "dismiss"]),
        },
      };
  }
  throw new InputError("invalid_input");
}
