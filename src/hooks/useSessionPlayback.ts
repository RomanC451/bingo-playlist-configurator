"use client";

import { useCallback, useState } from "react";
import { reportPlaybackError } from "@/lib/playback-client";
import { readJsonResponse } from "@/lib/read-json-response";

export interface SessionPlaybackState {
  is_playing: boolean;
  progress_ms: number | null;
  item: { id: string } | null;
}

export function useSessionPlayback(sessionId: string) {
  const [playback, setPlayback] = useState<SessionPlaybackState | null>(null);
  const [rateLimitMessage, setRateLimitMessage] = useState<string | null>(null);

  const refreshPlayback = useCallback(async () => {
    if (isPlaybackRateLimited()) return;

    try {
      const res = await fetch(`/api/playback/${sessionId}?scope=player`);
      const json = await readJsonResponse<{ playback?: SessionPlaybackState | null }>(res);

      if (!res.ok) {
        const message = reportPlaybackError(
          res,
          json,
          "Spotify rate limit exceeded",
          { toast: false },
        );
        if (res.status === 429) {
          setRateLimitMessage(message);
        }
        return;
      }

      setRateLimitMessage(null);
      setPlayback(json.playback ?? null);
    } catch {
      // Ignore transient poll failures.
    }
  }, [sessionId]);

  return { playback, setPlayback, refreshPlayback, rateLimitMessage };
}
