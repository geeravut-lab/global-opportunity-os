import { object, uuid, text, confirmed, InputError } from "../auth/input";
import { choice } from "../s3/input";
export function purgeMutation(value: unknown) {
  const d = object(value, ["action", "request", "job", "hash", "reason", "expires", "release", "enabled", "confirmed"]);
  const hash = () => { const h = text(d.hash, 64, 64); if (!/^[a-f0-9]{64}$/.test(h)) throw new InputError("invalid_input"); return h; };
  if (d.action === "preview") return { fn: "goos_purge_preview", args: { p_request: uuid(d.request) } };
  if (d.action === "approve") { confirmed(d.confirmed); return { fn: "goos_purge_approve", args: { p_request: uuid(d.request), p_hash: hash() } }; }
  if (d.action === "ledger_saved") { confirmed(d.confirmed); return { fn: "goos_purge_ledger_saved", args: { p_job: uuid(d.job), p_hash: hash() } }; }
  if (d.action === "receipt") return { fn: "goos_purge_receipt", args: { p_request: uuid(d.request) } };
  if (d.action === "enable") { if (typeof d.enabled !== "boolean") throw new InputError("invalid_input"); confirmed(d.confirmed); return { fn: "goos_purge_enable", args: { p_enabled: d.enabled } }; }
  if (d.action === "hold") {
    if (d.release != null) return { fn: "goos_purge_hold", args: { p_request: uuid(d.request), p_release: uuid(d.release), p_reason: null, p_expires: null } };
    const expires = text(d.expires, 20, 40); if (!Number.isFinite(Date.parse(expires))) throw new InputError("invalid_input");
    return { fn: "goos_purge_hold", args: { p_request: uuid(d.request), p_reason: choice(d.reason, ["active_investigation", "legal_obligation"]), p_expires: new Date(expires).toISOString(), p_release: null } };
  }
  throw new InputError("invalid_input");
}
