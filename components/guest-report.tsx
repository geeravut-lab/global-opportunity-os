"use client";
import { useRef, useState, useId, type FormEvent } from "react";
import { BusyForm } from "./busy-form";
import { busyFetch } from "@/lib/ui/activity";
import { s4Text } from "@/lib/s4/copy";
type Receipt = { id: string; receipt?: string; state: string; kind?: string };
export function GuestReport({ lang }: { lang: "th" | "en" }) {
  const t = (k: string) => s4Text(lang, k),
    id = useId(),
    lock = useRef(false);
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [created, setCreated] = useState<Receipt | null>(null),
    [status, setStatus] = useState<Receipt | null>(null),
    [proof, setProof] = useState("");
  async function send(data: Record<string, unknown>, create: boolean) {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setError("");
    try {
      const r = await busyFetch("/api/s4/guest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!r.ok) {
        setError(t("error"));
        return;
      }
      const d = (await r.json()).data as Receipt;
      if (create) {
        setCreated(d);
        setStatus(null);
      } else setStatus(d);
    } catch {
      setError(t("error"));
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  const create = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    void send(
      {
        operation: "create",
        kind: String(f.get("kind")),
        body: String(f.get("body")),
        id: null,
        receipt: null,
      },
      true,
    );
  };
  return (
    <>
      <p>{t("anonymous_notice")}</p>
      <p className="notice">{t("limits")}</p>
      <p role="alert">{error}</p>
      <BusyForm
        onSubmit={create}
        className="panel form-grid"
        aria-label={t("report")}
      >
        <h2>{t("report")}</h2>
        <fieldset disabled={busy}>
          <label htmlFor={id + "kind"}>{t("kind")}</label>
          <select name="kind" id={id + "kind"}>
            <option value="service">{t("service")}</option>
            <option value="safety">{t("safety")}</option>
          </select>
          <label htmlFor={id + "body"}>{t("body")}</label>
          <textarea
            id={id + "body"}
            name="body"
            required
            maxLength={2000}
            rows={5}
          />
          <button type="submit">{t("submit")}</button>
        </fieldset>
      </BusyForm>
      {created && (
        <section className="panel" aria-live="polite">
          <h2>{t("receipt")}</h2>
          <p>{t("receipt_notice")}</p>
          <label htmlFor={id + "created-id"}>{t("tracking_id")}</label>
          <input id={id + "created-id"} readOnly value={created.id} />
          <label htmlFor={id + "created-key"}>{t("tracking_key")}</label>
          <input id={id + "created-key"} readOnly value={created.receipt} />
        </section>
      )}
      <BusyForm
        aria-label={t("track_report")}
        className="panel form-grid"
        onSubmit={(e) => {
          e.preventDefault();
          const f = new FormData(e.currentTarget);
          const receipt = String(f.get("receipt"));
          setProof(receipt);
          void send(
            {
              operation: "status",
              kind: null,
              body: null,
              id: String(f.get("id")),
              receipt,
            },
            false,
          );
        }}
      >
        <h2>{t("track_report")}</h2>
        <fieldset disabled={busy}>
          <label htmlFor={id + "track-id"}>{t("tracking_id")}</label>
          <input id={id + "track-id"} name="id" required />
          <label htmlFor={id + "track-key"}>{t("tracking_key")}</label>
          <input
            id={id + "track-key"}
            name="receipt"
            required
            minLength={64}
            maxLength={64}
          />
          <button type="submit">{t("track_report")}</button>
        </fieldset>
      </BusyForm>
      {status && (
        <section className="panel" role="status">
          <h2>{t(status.state)}</h2>
          {["resolved", "dismissed"].includes(status.state) && (
            <BusyForm
              aria-label={t("appeal")}
              onSubmit={(e) => {
                e.preventDefault();
                const f = new FormData(e.currentTarget);
                void send(
                  {
                    operation: "create",
                    kind: status.kind,
                    body: String(f.get("body")),
                    id: status.id,
                    receipt: proof,
                  },
                  true,
                );
              }}
            >
              <label htmlFor={id + "appeal"}>{t("appeal")}</label>
              <textarea
                id={id + "appeal"}
                name="body"
                required
                maxLength={2000}
              />
              <button disabled={busy} type="submit">
                {t("appeal")}
              </button>
            </BusyForm>
          )}
        </section>
      )}
    </>
  );
}
