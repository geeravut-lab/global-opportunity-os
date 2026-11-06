import { describe, it, expect } from "vitest";
import { definition, policyMutation, retentionDefaults } from "../../lib/policy/model";
import { signDeletionLedger, verifyDeletionLedger, resolveExecutedReceipts } from "../../lib/maintenance/deletion-ledger.mjs";
import { purgeOne } from "../../lib/maintenance/purge.mjs";
const policy = { controller_name: "", country_codes: ["TH"], privacy_contact: "", service_hours: "", notice_th: "", notice_en: "", legal_review_ack: false, retention: retentionDefaults };
const intent = { hash: "a".repeat(64), ledger: { format: 1, job_id: "synthetic-job", account_id: "synthetic-account", subject_id: "synthetic-subject", request_id: "synthetic-request", stage: "intent" } };
const executed = { ...intent, ledger: { ...intent.ledger, stage: "executed", db_purged_at: "2026-11-06T00:00:00Z" } };
describe("Policy and deletion receipts", () => {
  it("rejects malformed countries and out-of-bounds retention without inventing legal content", () => {
    expect(definition(policy).controller_name).toBe("");
    expect(() => definition({ ...policy, country_codes: [null] })).toThrow();
    expect(() => definition({ ...policy, retention: { ...retentionDefaults, share_days: 365 } })).toThrow();
    expect(() => policyMutation({ action: "release", mode: "synthetic" })).toThrow();
  });
  it("authenticates all receipt fields and fails closed on tampering or unknown signing keys", () => {
    const key = "synthetic-signing-key-".repeat(3), artifact = signDeletionLedger(executed, key);
    expect(verifyDeletionLedger(artifact, { "maintenance-v1": key })).toEqual(executed);
    expect(() => verifyDeletionLedger({ ...artifact, ledger: { ...artifact.ledger, account_id: "other" } }, { "maintenance-v1": key })).toThrow();
    expect(() => verifyDeletionLedger(artifact, {})).toThrow();
    expect(() => signDeletionLedger(executed, "")).toThrow();
  });
  it("refuses reopening a restored database with unresolved deletion intents", () => {
    expect(() => resolveExecutedReceipts([intent])).toThrow("UNRESOLVED_PURGE_INTENT");
    expect(resolveExecutedReceipts([intent, executed])).toEqual([executed]);
    expect(() => resolveExecutedReceipts([intent, { ...executed, ledger: { ...executed.ledger, subject_id: "other" } }])).toThrow("CONFLICTING_DELETION_TARGETS");
    expect(() => resolveExecutedReceipts([executed, { ...executed, ledger: { ...executed.ledger, db_purged_at: "other" } }])).toThrow("CONFLICTING_EXECUTED_RECEIPTS");
  });
  it("never claims a purge when the kill switch or server-only Auth key is missing", async () => {
    const tx = async () => { throw Error("must not reach database"); };
    expect(await purgeOne(tx, { enabled: false, url: "", key: "" })).toEqual({ configured: false, processed: false });
    expect(await purgeOne(tx, { enabled: true, url: "", key: "" })).toEqual({ configured: false, processed: false });
    await expect(purgeOne(tx, { enabled: true, url: "https://unapproved.example.test", key: "synthetic" })).rejects.toThrow("target guard");
  });
});
