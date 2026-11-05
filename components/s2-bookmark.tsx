"use client";
import { useState } from "react";
import Link from "next/link";
export function BookmarkButton({
  lang,
  id,
  remove = false,
}: {
  lang: "th" | "en";
  id: string;
  remove?: boolean;
}) {
  const [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false);
  return (
    <div>
      <button
        type="button"
        className="button secondary"
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          try {
            const r = await fetch("/api/s2/bookmarks/" + id, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ saved: !remove }),
            });
            setMessage(
              r.ok
                ? lang === "th"
                  ? "บันทึกแล้ว"
                  : "Saved"
                : lang === "th"
                  ? "กรุณาเข้าสู่ระบบและสร้างโปรไฟล์ก่อน หรือรายการนี้อาจไม่พร้อมแล้ว"
                  : "Sign in and create your profile, or this listing may no longer be available.",
            );
            if (r.ok) window.dispatchEvent(new Event("goos:saved"));
          } catch {
            setMessage(
              lang === "th"
                ? "ยังบันทึกไม่ได้ ลองใหม่อีกครั้ง"
                : "Unable to save. Please try again.",
            );
          } finally {
            setBusy(false);
          }
        }}
      >
        {remove
          ? lang === "th"
            ? "นำออกจากรายการบันทึก"
            : "Remove bookmark"
          : lang === "th"
            ? "บันทึกโอกาส"
            : "Save opportunity"}
      </button>
      <p role="status">{message}</p>
      {message && (
        <Link href={`/${lang}/account/profile`}>
          {lang === "th" ? "บัญชีและโปรไฟล์" : "Account and profile"}
        </Link>
      )}
    </div>
  );
}
