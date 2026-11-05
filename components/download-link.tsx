"use client";
import { useState, type ReactNode } from "react";
import { busyFetch } from "@/lib/ui/activity";
export function DownloadLink({
  href,
  lang,
  children,
}: {
  href: string;
  lang: "th" | "en";
  children: ReactNode;
}) {
  const [error, setError] = useState(false);
  return (
    <>
      <a
        href={href}
        onClick={async (event) => {
          if (event.ctrlKey || event.metaKey || event.shiftKey || event.altKey)
            return;
          event.preventDefault();
          setError(false);
          try {
            const response = await busyFetch(href, { cache: "no-store" });
            if (!response.ok) throw Error();
            const body = await response.blob(),
              url = URL.createObjectURL(body),
              link = document.createElement("a");
            link.href = url;
            link.download =
              response.headers
                .get("content-disposition")
                ?.match(/filename="?([^";]+)/)?.[1] ?? "download";
            link.click();
            URL.revokeObjectURL(url);
          } catch {
            setError(true);
          }
        }}
      >
        {children}
      </a>
      {error && (
        <p role="alert">
          {lang === "th"
            ? "ดาวน์โหลดไม่สำเร็จ กรุณาลองใหม่"
            : "Download failed. Please try again."}
        </p>
      )}
    </>
  );
}
