"use client";

import { useCallback, useEffect, useState } from "react";
import { guestStorageKey } from "@/lib/clip-guess-shared";

export function useClipGuessGuestId(shareToken: string | null) {
  const [guestId, setGuestId] = useState<string | null>(null);

  useEffect(() => {
    if (!shareToken) {
      setGuestId(null);
      return;
    }

    const key = guestStorageKey(shareToken);
    let id = localStorage.getItem(key);
    if (!id) {
      id = crypto.randomUUID();
      localStorage.setItem(key, id);
    }
    setGuestId(id);
  }, [shareToken]);

  return guestId;
}

export function usePublicGuessPlaybackStatus(shareToken: string | null) {
  const [webPlaybackReady, setWebPlaybackReady] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadStatus = useCallback(async () => {
    if (!shareToken) {
      setWebPlaybackReady(false);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(`/api/public/guess/${encodeURIComponent(shareToken)}/player-token`);
      if (res.ok) {
        setWebPlaybackReady(true);
        setError(null);
      } else {
        const json = (await res.json()) as { error?: string };
        setWebPlaybackReady(false);
        setError(json.error ?? "Spotify playback unavailable");
      }
    } catch {
      setWebPlaybackReady(false);
      setError("Spotify playback unavailable");
    } finally {
      setLoading(false);
    }
  }, [shareToken]);

  useEffect(() => {
    void loadStatus();
  }, [loadStatus]);

  return { webPlaybackReady, loading, error };
}
