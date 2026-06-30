import { useCallback, useEffect, useRef, useState } from "react";
import { LOADING_THRESHOLD_MS } from "@/lib/loading-threshold";

export function useDelayedLoading(thresholdMs = LOADING_THRESHOLD_MS) {
  const [loading, setLoading] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const activeRef = useRef(false);

  const clearTimer = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const begin = useCallback(() => {
    activeRef.current = true;
    clearTimer();
    timerRef.current = setTimeout(() => {
      if (activeRef.current) {
        setLoading(true);
      }
    }, thresholdMs);
  }, [clearTimer, thresholdMs]);

  const end = useCallback(() => {
    activeRef.current = false;
    clearTimer();
    setLoading(false);
  }, [clearTimer]);

  useEffect(() => clearTimer, [clearTimer]);

  return { loading, begin, end };
}
