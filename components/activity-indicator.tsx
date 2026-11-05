"use client";
import { useEffect, useSyncExternalStore } from "react";
import { useBusyRouter } from "@/lib/ui/router";
import {
  activityCount,
  serverActivityCount,
  subscribeActivity,
  blockDuplicateAction,
  trackNativeNavigation,
} from "@/lib/ui/activity";
export function ActivityIndicator({ lang }: { lang: "th" | "en" }) {
  const router = useBusyRouter();
  const count = useSyncExternalStore(
    subscribeActivity,
    activityCount,
    serverActivityCount,
  );
  useEffect(() => {
    const trackSubmit = (event: Event) =>
      trackNativeNavigation(event, router.push);
    document.addEventListener("click", blockDuplicateAction, true);
    document.addEventListener("submit", blockDuplicateAction, true);
    document.addEventListener("submit", trackSubmit);
    return () => {
      document.removeEventListener("click", blockDuplicateAction, true);
      document.removeEventListener("submit", blockDuplicateAction, true);
      document.removeEventListener("submit", trackSubmit);
    };
  }, [router]);
  if (!count) return null;
  return (
    <div
      className="activity-indicator"
      role="status"
      aria-live="polite"
      aria-atomic="true"
    >
      <span className="activity-spinner" aria-hidden="true" />
      <span>
        {lang === "th"
          ? "กำลังดำเนินการ กรุณารอสักครู่"
          : "Working. Please wait."}
      </span>
    </div>
  );
}
