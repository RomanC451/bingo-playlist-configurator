"use client";

import { useEffect, useState } from "react";
import type { TrackEditingBy } from "@/lib/track-edit-lock";
import { readJsonResponse } from "@/lib/read-json-response";

const POLL_MS = 20_000;

export function useSessionTrackLocks(sessionId: string | undefined) {
  const [locksByClipId, setLocksByClipId] = useState<Map<string, TrackEditingBy>>(
    () => new Map(),
  );

  useEffect(() => {
    if (!sessionId) {
      setLocksByClipId(new Map());
      return;
    }

    let cancelled = false;

    async function poll() {
      try {
        const res = await fetch(`/api/sessions/${sessionId}/track-locks`);
        if (!res.ok || cancelled) return;
        const body = await readJsonResponse<{ locks?: Record<string, TrackEditingBy> }>(res);
        if (cancelled) return;
        setLocksByClipId(new Map(Object.entries(body.locks ?? {})));
      } catch {
        // Keep last known locks on transient failures.
      }
    }

    void poll();
    const intervalId = setInterval(() => void poll(), POLL_MS);

    return () => {
      cancelled = true;
      clearInterval(intervalId);
    };
  }, [sessionId]);

  return locksByClipId;
}

export function mergeTrackEditingBy<T extends { id: string; editingBy?: TrackEditingBy | null }>(
  tracks: T[],
  locksByClipId: Map<string, TrackEditingBy>,
): T[] {
  if (locksByClipId.size === 0) {
    return tracks;
  }

  return tracks.map((track) => ({
    ...track,
    editingBy: locksByClipId.get(track.id) ?? track.editingBy ?? null,
  }));
}
