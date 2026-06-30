"use client";

import { useCallback, useRef, useState } from "react";
import { errorMessageFromBody, externalErrorFromBody } from "@/lib/api-errors";
import { readJsonResponse } from "@/lib/read-json-response";

export interface SessionPlaybackState {
  is_playing: boolean;
  progress_ms: number | null;
  item: { id: string } | null;
}

function applyRateLimitBackoff(
  rateLimitedUntil: { current: number },
  retryAfterSeconds?: number,
) {
  const waitMs = (retryAfterSeconds ?? 30) * 1000;
  rateLimitedUntil.current = Date.now() + waitMs;
}

export function useSessionPlayback(sessionId: string) {
  const [playback, setPlayback] = useState<SessionPlaybackState | null>(null);
  const [rateLimitMessage, setRateLimitMessage] = useState<string | null>(null);
  const rateLimitedUntil = useRef(0);

  const refreshPlayback = useCallback(async () => {
    if (Date.now() < rateLimitedUntil.current) return;

    try {
      const res = await fetch(`/api/playback/${sessionId}?scope=player`);
      const json = await readJsonResponse<{ playback?: SessionPlaybackState | null }>(res);

      if (res.status === 429) {
        const external = externalErrorFromBody(json);
        applyRateLimitBackoff(rateLimitedUntil, external?.retryAfterSeconds);
        setRateLimitMessage(errorMessageFromBody(json, "Spotify rate limit exceeded"));
        return;
      }

      if (res.ok) {
        setRateLimitMessage(null);
        setPlayback(json.playback ?? null);
      }
    } catch {
      // Ignore transient poll failures.
    }
  }, [sessionId]);

  return { playback, setPlayback, refreshPlayback, rateLimitMessage };
}
