"use client";
import type { ComponentProps } from "react";
import { useBusyRouter } from "@/lib/ui/router";
export function BusyForm({ onSubmit, ...props }: ComponentProps<"form">) {
  const router = useBusyRouter();
  return (
    <form
      {...props}
      onSubmit={(event) => {
        onSubmit?.(event);
        if (
          event.defaultPrevented ||
          (props.method ?? "get").toLowerCase() !== "get" ||
          props.target === "_blank"
        )
          return;
        const url = new URL(event.currentTarget.action, location.href);
        if (url.origin !== location.origin) return;
        event.preventDefault();
        const data = new FormData(
          event.currentTarget,
          (event.nativeEvent as SubmitEvent).submitter,
        );
        url.search = new URLSearchParams(
          [...data].map(([key, value]) => [
            key,
            typeof value === "string" ? value : value.name,
          ]),
        ).toString();
        router.push(url.pathname + url.search + url.hash);
      }}
    />
  );
}
