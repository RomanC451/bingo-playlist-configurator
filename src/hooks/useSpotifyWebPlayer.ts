"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { readJsonResponse } from "@/lib/read-json-response";
import {
  loadSpotifyWebPlaybackSdk,
  putPlayTrack,
  trackUriFromId,
  webPlaybackStateToPlaybackState,
} from "@/lib/spotify-web-playback";

export interface WebPlaybackState {
  is_playing: boolean;
  progress_ms: number | null;
  item: { id: string } | null;
}

export type SpotifyWebPlayerStatus =
  | "idle"
  | "loading"
  | "ready"
  | "error";

type ClipBounds = {
  startMs: number;
  endMs: number;
};

let sharedPlayer: Spotify.Player | null = null;
let sharedDeviceId: string | null = null;
let sharedPlayerKey: string | null = null;
let initPromise: Promise<{ deviceId: string }> | null = null;

const VOLUME_STORAGE_KEY = "spotify-web-playback-volume";
let sharedVolume = 1;

function readStoredVolume(): number {
  if (typeof window === "undefined") {
    return 1;
  }

  const stored = localStorage.getItem(VOLUME_STORAGE_KEY);
  if (stored == null) {
    return 1;
  }

  const parsed = Number(stored);
  if (!Number.isFinite(parsed)) {
    return 1;
  }

  return Math.min(1, Math.max(0, parsed));
}

function persistVolume(volume: number) {
  if (typeof window === "undefined") {
    return;
  }

  localStorage.setItem(VOLUME_STORAGE_KEY, String(volume));
}

function applyPlayerVolume(volume: number) {
  void sharedPlayer?.setVolume(volume);
}

function setSharedVolume(volume: number) {
  const clamped = Math.min(1, Math.max(0, volume));
  sharedVolume = clamped;
  persistVolume(clamped);
  applyPlayerVolume(clamped);
  return clamped;
}

sharedVolume = readStoredVolume();

async function fetchPlayerToken(teamId: string): Promise<string> {
  const res = await fetch(`/api/spotify/player-token?teamId=${encodeURIComponent(teamId)}`);
  const json = await readJsonResponse<{ accessToken?: string; error?: string; code?: string }>(
    res,
  );
  if (!res.ok) {
    throw new Error(json.error ?? "Failed to get Spotify player token");
  }
  if (!json.accessToken) {
    throw new Error("No access token returned");
  }
  return json.accessToken;
}

async function fetchGuessPlayerToken(shareToken: string): Promise<string> {
  const res = await fetch(`/api/public/guess/${encodeURIComponent(shareToken)}/player-token`);
  const json = await readJsonResponse<{ accessToken?: string; error?: string; code?: string }>(
    res,
  );
  if (!res.ok) {
    throw new Error(json.error ?? "Failed to get Spotify player token");
  }
  if (!json.accessToken) {
    throw new Error("No access token returned");
  }
  return json.accessToken;
}

function createTokenProvider(fetchToken: () => Promise<string>) {
  return (cb: (token: string) => void) => {
    void fetchToken()
      .then(cb)
      .catch(() => cb(""));
  };
}

async function ensurePlayer(playerKey: string, fetchToken: () => Promise<string>): Promise<{ deviceId: string }> {
  if (sharedPlayer && sharedDeviceId && sharedPlayerKey === playerKey) {
    return { deviceId: sharedDeviceId };
  }

  if (sharedPlayer && sharedPlayerKey !== playerKey) {
    sharedPlayer.disconnect();
    sharedPlayer = null;
    sharedDeviceId = null;
    initPromise = null;
  }

  if (initPromise) {
    return initPromise;
  }

  initPromise = (async () => {
    await loadSpotifyWebPlaybackSdk();
    if (!window.Spotify?.Player) {
      throw new Error("Spotify Web Playback SDK failed to initialize");
    }

    const player = new window.Spotify.Player({
      name: "Bingo Playlist Maker",
      getOAuthToken: createTokenProvider(fetchToken),
      volume: sharedVolume,
    });

    const deviceId = await new Promise<string>((resolve, reject) => {
      const timeout = window.setTimeout(() => {
        reject(new Error("Spotify player connection timed out"));
      }, 15000);

      player.addListener("ready", ({ device_id }) => {
        window.clearTimeout(timeout);
        resolve(device_id);
      });

      player.addListener("initialization_error", ({ message }) => {
        window.clearTimeout(timeout);
        reject(new Error(message || "Spotify player initialization failed"));
      });

      player.addListener("authentication_error", ({ message }) => {
        window.clearTimeout(timeout);
        reject(new Error(message || "Spotify authentication failed"));
      });

      player.addListener("account_error", ({ message }) => {
        window.clearTimeout(timeout);
        reject(new Error(message || "Spotify account error — Premium required"));
      });

      void player.connect().then((connected) => {
        if (!connected) {
          window.clearTimeout(timeout);
          reject(new Error("Failed to connect Spotify Web Playback SDK"));
        }
      });
    });

    sharedPlayer = player;
    sharedDeviceId = deviceId;
    sharedPlayerKey = playerKey;
    applyPlayerVolume(sharedVolume);
    return { deviceId };
  })();

  try {
    return await initPromise;
  } catch (err) {
    initPromise = null;
    sharedPlayer = null;
    sharedDeviceId = null;
    sharedPlayerKey = null;
    throw err;
  }
}

type SpotifyWebPlayerOptions = {
  teamId?: string | null;
  shareToken?: string | null;
  enabled?: boolean;
};

export function useSpotifyWebPlayer(
  teamIdOrOptions: string | null | SpotifyWebPlayerOptions,
  enabledArg = true,
) {
  const options: SpotifyWebPlayerOptions =
    typeof teamIdOrOptions === "string" || teamIdOrOptions === null
      ? { teamId: teamIdOrOptions, enabled: enabledArg }
      : teamIdOrOptions;

  const teamId = options.teamId ?? null;
  const shareToken = options.shareToken ?? null;
  const enabled = options.enabled ?? true;
  const playerKey = shareToken ? `guess:${shareToken}` : teamId ? `team:${teamId}` : null;
  const fetchToken = useMemo(() => {
    if (shareToken) return () => fetchGuessPlayerToken(shareToken);
    if (teamId) return () => fetchPlayerToken(teamId);
    return null;
  }, [shareToken, teamId]);
  const [status, setStatus] = useState<SpotifyWebPlayerStatus>("idle");
  const [deviceId, setDeviceId] = useState<string | null>(null);
  const [playback, setPlayback] = useState<WebPlaybackState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [volume, setVolumeState] = useState(sharedVolume);

  const clipBoundsRef = useRef<ClipBounds | null>(null);
  const clipEndPauseRequested = useRef(false);
  const playbackGeneration = useRef(0);
  const clipPlayStartedAt = useRef(0);
  const playerRef = useRef<Spotify.Player | null>(null);

  useEffect(() => {
    if (!enabled || !playerKey || !fetchToken) {
      setStatus("idle");
      setDeviceId(null);
      return;
    }

    let cancelled = false;
    setStatus("loading");
    setError(null);

    void ensurePlayer(playerKey, fetchToken)
      .then(({ deviceId: id }) => {
        if (cancelled) return;
        setDeviceId(id);
        setStatus("ready");
        playerRef.current = sharedPlayer;
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setStatus("error");
        setError(err instanceof Error ? err.message : "Spotify player failed to start");
      });

    return () => {
      cancelled = true;
    };
  }, [enabled, fetchToken, playerKey]);

  useEffect(() => {
    const player = sharedPlayer;
    if (!player || !enabled || !playerKey) return;

    const onStateChanged = (state: Spotify.WebPlaybackState | null) => {
      setPlayback(webPlaybackStateToPlaybackState(state));
    };

    player.addListener("player_state_changed", onStateChanged);
    void player.getCurrentState().then(onStateChanged);

    player.addListener("authentication_error", () => {
      setError("Spotify session expired — refresh the page");
      setStatus("error");
    });

    return () => {
      player.removeListener("player_state_changed");
    };
  }, [enabled, playerKey, status]);

  useEffect(() => {
    const bounds = clipBoundsRef.current;
    if (
      actionLoading ||
      status !== "ready" ||
      !playback?.is_playing ||
      playback.progress_ms == null ||
      !bounds ||
      clipEndPauseRequested.current
    ) {
      return;
    }

    const msPastEnd = playback.progress_ms - bounds.endMs;
    const msSincePlayStart = Date.now() - clipPlayStartedAt.current;

    if (
      msSincePlayStart < 2000 ||
      msPastEnd < 0 ||
      msPastEnd > 3000 ||
      playback.progress_ms < bounds.startMs
    ) {
      return;
    }

    clipEndPauseRequested.current = true;
    const generationAtTrigger = playbackGeneration.current;

    void (async () => {
      if (generationAtTrigger !== playbackGeneration.current) {
        clipEndPauseRequested.current = false;
        return;
      }
      try {
        await sharedPlayer?.pause();
        setPlayback((prev) => (prev ? { ...prev, is_playing: false } : prev));
      } catch {
        clipEndPauseRequested.current = false;
      }
    })();
  }, [actionLoading, playback, status]);

  const playClip = useCallback(
    async (trackId: string, startMs: number, endMs: number) => {
      if (!playerKey || !fetchToken) {
        throw new Error("Spotify playback is not available");
      }

      playbackGeneration.current += 1;
      clipEndPauseRequested.current = false;
      clipPlayStartedAt.current = Date.now();
      clipBoundsRef.current = { startMs, endMs };

      setActionLoading(true);
      setError(null);

      try {
        const { deviceId: resolvedDeviceId } = await ensurePlayer(playerKey, fetchToken);
        const accessToken = await fetchToken();
        const player = sharedPlayer;
        if (player) {
          await player.activateElement();
        }

        await putPlayTrack(
          accessToken,
          resolvedDeviceId,
          trackUriFromId(trackId),
          startMs,
        );
      } catch (err) {
        const message = err instanceof Error ? err.message : "Playback failed";
        setError(message);
        throw err;
      } finally {
        setActionLoading(false);
      }
    },
    [fetchToken, playerKey],
  );

  const pause = useCallback(async () => {
    playbackGeneration.current += 1;
    clipEndPauseRequested.current = true;
    setActionLoading(true);
    try {
      await sharedPlayer?.pause();
      setPlayback((prev) => (prev ? { ...prev, is_playing: false } : prev));
    } finally {
      setActionLoading(false);
    }
  }, []);

  const resume = useCallback(async () => {
    if (!sharedPlayer) return;
    clipEndPauseRequested.current = false;
    setActionLoading(true);
    setError(null);
    try {
      await sharedPlayer.resume();
      setPlayback((prev) => (prev ? { ...prev, is_playing: true } : prev));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Playback failed");
    } finally {
      setActionLoading(false);
    }
  }, []);

  const restartClip = useCallback(
    async (trackId: string, startMs: number, endMs: number) => {
      await playClip(trackId, startMs, endMs);
    },
    [playClip],
  );

  const setVolume = useCallback((nextVolume: number) => {
    setVolumeState(setSharedVolume(nextVolume));
  }, []);

  return {
    status,
    deviceId,
    playback,
    setPlayback,
    error,
    actionLoading,
    playClip,
    pause,
    resume,
    restartClip,
    volume,
    setVolume,
    ready: status === "ready" && !!deviceId,
  };
}
