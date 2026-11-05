"use client";
import NextLink, { useLinkStatus } from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useRef, type ComponentProps, type RefObject } from "react";
import { beginActivity } from "@/lib/ui/activity";
function LinkActivity({ finishRef }: { finishRef: RefObject<(() => void) | null> }) {
  const { pending } = useLinkStatus(),
    path = usePathname(),
    params = useSearchParams();
  useEffect(() => {
    if (pending && !finishRef.current) finishRef.current = beginActivity();
    if (!pending) {
      finishRef.current?.();
      finishRef.current = null;
    }
  }, [pending, path, params, finishRef]);
  useEffect(
    () => () => {
      finishRef.current?.();
      finishRef.current = null;
    },
    [finishRef],
  );
  return null;
}
export default function BusyLink({
  children,
  onClick,
  ...props
}: ComponentProps<typeof NextLink>) {
  const finishRef = useRef<(() => void) | null>(null);
  return (
    <NextLink
      {...props}
      onClick={(event) => {
        onClick?.(event);
        if (
          event.defaultPrevented ||
          event.metaKey ||
          event.ctrlKey ||
          event.shiftKey ||
          event.altKey ||
          props.target === "_blank" ||
          props.download
        )
          return;
        const href =
          typeof props.href === "string"
            ? props.href
            : (props.href.pathname ?? "");
        const url = new URL(href, window.location.href);
        if (
          url.origin !== location.origin ||
          (url.pathname === location.pathname && url.search === location.search)
        )
          return;
        finishRef.current?.();
        finishRef.current = beginActivity(event.currentTarget);
      }}
    >
      {children}
      <LinkActivity finishRef={finishRef} />
    </NextLink>
  );
}
