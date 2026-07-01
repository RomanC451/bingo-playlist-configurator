"use client";

import { usePathname } from "next/navigation";
import { useCallback, useEffect, useRef } from "react";

export type LeaveDestination = string | "back";

export function useUnsavedLeaveGuard(
  isDirty: boolean,
  onLeaveAttempt: (destination: LeaveDestination) => void,
) {
  const pathname = usePathname();
  const allowNavigationRef = useRef(false);
  const onLeaveAttemptRef = useRef(onLeaveAttempt);

  useEffect(() => {
    onLeaveAttemptRef.current = onLeaveAttempt;
  }, [onLeaveAttempt]);

  useEffect(() => {
    if (!isDirty) return;

    const handler = (event: BeforeUnloadEvent) => {
      event.preventDefault();
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [isDirty]);

  useEffect(() => {
    if (!isDirty) return;

    const handleClick = (event: MouseEvent) => {
      if (event.defaultPrevented || event.button !== 0) return;
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;

      const anchor = (event.target as Element | null)?.closest("a[href]");
      if (!anchor || anchor.getAttribute("target") === "_blank") return;

      const href = anchor.getAttribute("href");
      if (!href || href.startsWith("#")) return;

      let path: string;
      try {
        const url = new URL(href, window.location.href);
        if (url.origin !== window.location.origin) return;
        path = url.pathname + url.search;
      } catch {
        return;
      }

      if (path === pathname) return;

      event.preventDefault();
      event.stopPropagation();
      onLeaveAttemptRef.current(path);
    };

    document.addEventListener("click", handleClick, true);
    return () => document.removeEventListener("click", handleClick, true);
  }, [isDirty, pathname]);

  useEffect(() => {
    if (!isDirty) return;

    window.history.pushState(null, "", window.location.href);

    const onPopState = () => {
      if (allowNavigationRef.current) {
        allowNavigationRef.current = false;
        return;
      }

      window.history.pushState(null, "", window.location.href);
      onLeaveAttemptRef.current("back");
    };

    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, [isDirty]);

  const runHistoryLeave = useCallback((action: () => void) => {
    allowNavigationRef.current = true;
    action();
  }, []);

  return { runHistoryLeave };
}
