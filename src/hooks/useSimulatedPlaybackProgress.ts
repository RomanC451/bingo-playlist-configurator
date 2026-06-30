"use client";

import { useEffect, useRef, useState } from "react";

export interface SimulatedPlaybackInput {
  is_playing: boolean;
  progress_ms: number | null;
  item: { id: string } | null;
}

function playbackSyncKey(playback: SimulatedPlaybackInput | null): string {
  if (!playback) return "none";
  return `${playback.item?.id ?? ""}:${playback.is_playing}:${playback.progress_ms ?? "null"}`;
}

/** Interpolate progress_ms locally while playing to avoid polling Spotify. */
export function useSimulatedPlaybackProgress<T extends SimulatedPlaybackInput>(
  playback: T | null,
  enabled = true,
): T | null {
  const [simulatedProgressMs, setSimulatedProgressMs] = useState<number | null>(
    playback?.progress_ms ?? null,
  );
  const anchorRef = useRef({ progressMs: 0, wallClockMs: 0 });
  const syncKey = playbackSyncKey(playback);

  useEffect(() => {
    if (!playback) {
      setSimulatedProgressMs(null);
      return;
    }

    setSimulatedProgressMs(playback.progress_ms);

    if (playback.is_playing && playback.progress_ms != null) {
      anchorRef.current = {
        progressMs: playback.progress_ms,
        wallClockMs: Date.now(),
      };
    }
  }, [syncKey, playback]);

  useEffect(() => {
    if (!enabled || !playback?.is_playing || playback.progress_ms == null) {
      return;
    }

    let raf = 0;
    const tick = () => {
      const elapsed = Date.now() - anchorRef.current.wallClockMs;
      setSimulatedProgressMs(anchorRef.current.progressMs + elapsed);
      raf = requestAnimationFrame(tick);
    };

    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [enabled, playback?.is_playing, syncKey]);

  if (!playback) return null;

  if (!enabled) return playback;

  return {
    ...playback,
    progress_ms: simulatedProgressMs,
  };
}
