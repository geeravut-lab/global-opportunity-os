import { createHmac, timingSafeEqual } from "node:crypto";
function stable(value) {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return "[" + value.map(stable).join(",") + "]";
  return "{" + Object.keys(value).sort().map(k => JSON.stringify(k) + ":" + stable(value[k])).join(",") + "}";
}
export function signDeletionLedger(artifact, key, keyId = "maintenance-v1") {
  if (!key || key.length < 32 || !artifact?.ledger || !/^[a-f0-9]{64}$/.test(artifact.hash)) throw Error("LEDGER_SIGNING_UNAVAILABLE");
  const data = { ledger: artifact.ledger, hash: artifact.hash, key_id: keyId };
  return { ...data, signature: createHmac("sha256", key).update("Opp4All deletion receipt v1\n" + stable(data)).digest("hex") };
}
export function verifyDeletionLedger(artifact, keys) {
  const key = artifact && keys[artifact.key_id]; if (!key || typeof artifact.signature !== "string" || !/^[a-f0-9]{64}$/.test(artifact.signature)) throw Error("UNTRUSTED_DELETION_RECEIPT");
  const expected = signDeletionLedger(artifact, key, artifact.key_id).signature;
  if (!timingSafeEqual(Buffer.from(expected, "hex"), Buffer.from(artifact.signature, "hex"))) throw Error("UNTRUSTED_DELETION_RECEIPT");
  return { ledger: artifact.ledger, hash: artifact.hash };
}
export function resolveExecutedReceipts(artifacts) {
  if (!Array.isArray(artifacts) || artifacts.length > 10000) throw Error("INVALID_LEDGER_SET");
  const jobs = new Map();
  for (const a of artifacts) {
    if (a?.ledger?.format !== 1 || typeof a.ledger.job_id !== "string" || !/^[a-f0-9]{64}$/.test(a.hash) || !["intent", "executed"].includes(a.ledger.stage)) throw Error("INVALID_DELETION_RECEIPT");
    const old = jobs.get(a.ledger.job_id) ?? [];
    if (old.some(x => ["account_id", "subject_id", "request_id"].some(k => x.ledger[k] !== a.ledger[k]))) throw Error("CONFLICTING_DELETION_TARGETS");
    old.push(a); jobs.set(a.ledger.job_id, old);
  }
  return [...jobs.values()].map(rows => {
    const executed = rows.filter(x => x.ledger.stage === "executed" && x.ledger.db_purged_at);
    if (!executed.length) throw Error("UNRESOLVED_PURGE_INTENT");
    if (executed.some(x => ["preview_hash", "policy_hash", "approved_by", "officer_id", "db_purged_at"].some(k => x.ledger[k] !== executed[0].ledger[k]))) throw Error("CONFLICTING_EXECUTED_RECEIPTS");
    return executed.sort((a, b) => String(b.ledger.auth_deleted_at ?? "").localeCompare(String(a.ledger.auth_deleted_at ?? "")))[0];
  });
}
