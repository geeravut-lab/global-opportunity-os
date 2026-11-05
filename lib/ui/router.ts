"use client";
import { useRouter } from "next/navigation";
import {
  useCallback,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useTransition,
} from "react";
import { beginActivity } from "./activity";
export function useBusyRouter() {
  const router = useRouter(),
    [pending, startTransition] = useTransition(),
    [sequence, advance] = useReducer((v) => v + 1, 0),
    finishes = useRef<(() => void)[]>([]);
  const run = useCallback((action: () => void) => {
    finishes.current.push(beginActivity());
    advance();
    startTransition(action);
  }, []);
  useEffect(() => {
    if (!pending) {
      for (const finish of finishes.current) finish();
      finishes.current = [];
    }
  }, [pending, sequence]);
  useEffect(
    () => () => {
      for (const finish of finishes.current) finish();
      finishes.current = [];
    },
    [],
  );
  return useMemo(
    () => ({
      ...router,
      isPending: pending,
      push: (...args: Parameters<typeof router.push>) =>
        run(() => router.push(...args)),
      replace: (...args: Parameters<typeof router.replace>) =>
        run(() => router.replace(...args)),
      refresh: () => run(() => router.refresh()),
      back: () => run(() => router.back()),
      forward: () => run(() => router.forward()),
    }),
    [router, run, pending],
  );
}
