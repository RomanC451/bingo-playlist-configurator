"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  getSharedPlaybackVolume,
  registerHtmlAudioElement,
  setSharedPlaybackVolume,
} from "@/lib/playback-volume";
import type { ClipPlaybackState } from "@/lib/playback-state";

type ClipBounds = {
  startMs: number;
  endMs: number;
};

let sharedAudio: HTMLAudioElement | null = null;

function getSharedAudio() {
  if (typeof window === "undefined") {
    return null;
  }

  if (!sharedAudio) {
    sharedAudio = new Audio();
    sharedAudio.preload = "metadata";
    sharedAudio.volume = getSharedPlaybackVolume();
    registerHtmlAudioElement(sharedAudio);
  }

  return sharedAudio;
}

type HtmlAudioPlayerOptions = {
  getStreamUrl: (clipId: string) => string;
  getStreamHeaders?: () => HeadersInit | undefined;
  enabled?: boolean;
};

export function useHtmlAudioPlayer({
  getStreamUrl,
  getStreamHeaders,
  enabled = true,
}: HtmlAudioPlayerOptions) {
  const [playback, setPlayback] = useState<ClipPlaybackState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [volume, setVolumeState] = useState(getSharedPlaybackVolume());
  const [ready, setReady] = useState(false);

  const clipBoundsRef = useRef<ClipBounds | null>(null);
  const lastPlayContextRef = useRef<{ clipId: string; startMs: number; endMs: number } | null>(
    null,
  );
  const clipEndPauseRequested = useRef(false);
  const playbackGeneration = useRef(0);
  const activeClipIdRef = useRef<string | null>(null);
  const loadedClipIdRef = useRef<string | null>(null);
  const getStreamUrlRef = useRef(getStreamUrl);
  const getStreamHeadersRef = useRef(getStreamHeaders);

  getStreamUrlRef.current = getStreamUrl;
  getStreamHeadersRef.current = getStreamHeaders;

  useEffect(() => {
    if (!enabled) {
      setReady(false);
      return;
    }

    const audio = getSharedAudio();
    if (!audio) return;

    registerHtmlAudioElement(audio);
    setReady(true);

    const syncPlayback = () => {
      const clipId = activeClipIdRef.current;
      if (!clipId) {
        setPlayback(null);
        return;
      }

      setPlayback({
        is_playing: !audio.paused && !audio.ended,
        progress_ms: Number.isFinite(audio.currentTime)
          ? Math.round(audio.currentTime * 1000)
          : null,
        item: { id: clipId },
      });
    };

    const onTimeUpdate = () => {
      syncPlayback();
      const bounds = clipBoundsRef.current;
      if (!bounds || clipEndPauseRequested.current || audio.paused) {
        return;
      }

      const progressMs = Math.round(audio.currentTime * 1000);
      if (progressMs >= bounds.endMs) {
        clipEndPauseRequested.current = true;
        audio.pause();
        audio.currentTime = bounds.endMs / 1000;
        syncPlayback();
      }
    };

    const onPlay = () => syncPlayback();
    const onPause = () => syncPlayback();
    const onEnded = () => syncPlayback();
    const onError = () => {
      setError("Failed to play uploaded audio");
      syncPlayback();
    };

    audio.addEventListener("timeupdate", onTimeUpdate);
    audio.addEventListener("play", onPlay);
    audio.addEventListener("pause", onPause);
    audio.addEventListener("ended", onEnded);
    audio.addEventListener("error", onError);

    return () => {
      audio.removeEventListener("timeupdate", onTimeUpdate);
      audio.removeEventListener("play", onPlay);
      audio.removeEventListener("pause", onPause);
      audio.removeEventListener("ended", onEnded);
      audio.removeEventListener("error", onError);
    };
  }, [enabled]);

  const activeLoadRef = useRef<{
    clipId: string;
    promise: Promise<HTMLAudioElement>;
  } | null>(null);

  const ensureLoaded = useCallback(async (clipId: string) => {
    const audio = getSharedAudio();
    if (!audio) {
      throw new Error("Audio playback is not available");
    }

    if (loadedClipIdRef.current === clipId && audio.src) {
      return audio;
    }

    const inFlight = activeLoadRef.current;
    if (inFlight?.clipId === clipId) {
      return inFlight.promise;
    }

    const loadPromise = (async () => {
      const streamUrl = getStreamUrlRef.current(clipId);
      const headers = getStreamHeadersRef.current?.();

      if (headers) {
        const response = await fetch(streamUrl, { headers });
        if (!response.ok) {
          throw new Error("Failed to load uploaded audio");
        }
        const blob = await response.blob();
        if (audio.src.startsWith("blob:")) {
          URL.revokeObjectURL(audio.src);
        }
        audio.src = URL.createObjectURL(blob);
      } else {
        if (audio.src.startsWith("blob:")) {
          URL.revokeObjectURL(audio.src);
        }
        audio.src = streamUrl;
      }

      await new Promise<void>((resolve, reject) => {
        const onLoaded = () => {
          cleanup();
          resolve();
        };
        const onLoadError = () => {
          cleanup();
          reject(new Error("Failed to load uploaded audio"));
        };
        const cleanup = () => {
          audio.removeEventListener("loadedmetadata", onLoaded);
          audio.removeEventListener("error", onLoadError);
        };
        audio.addEventListener("loadedmetadata", onLoaded, { once: true });
        audio.addEventListener("error", onLoadError, { once: true });
        audio.load();
      });

      loadedClipIdRef.current = clipId;
      return audio;
    })();

    activeLoadRef.current = { clipId, promise: loadPromise };

    try {
      return await loadPromise;
    } finally {
      if (activeLoadRef.current?.promise === loadPromise) {
        activeLoadRef.current = null;
      }
    }
  }, []);

  const playClip = useCallback(
    async (clipId: string, startMs: number, endMs: number) => {
      const generation = ++playbackGeneration.current;
      clipEndPauseRequested.current = false;
      clipBoundsRef.current = { startMs, endMs };
      activeClipIdRef.current = clipId;

      setActionLoading(true);
      setError(null);

      try {
        const audio = await ensureLoaded(clipId);
        if (generation !== playbackGeneration.current) return;

        audio.currentTime = startMs / 1000;
        lastPlayContextRef.current = { clipId, startMs, endMs };
        await audio.play();
        if (generation !== playbackGeneration.current) return;

        setPlayback({
          is_playing: true,
          progress_ms: startMs,
          item: { id: clipId },
        });
      } catch (err) {
        if (generation !== playbackGeneration.current) return;
        const message = err instanceof Error ? err.message : "Playback failed";
        setError(message);
        throw err;
      } finally {
        if (generation === playbackGeneration.current) {
          setActionLoading(false);
        }
      }
    },
    [ensureLoaded],
  );

  const pause = useCallback(async () => {
    playbackGeneration.current += 1;
    clipEndPauseRequested.current = true;
    setActionLoading(true);
    try {
      sharedAudio?.pause();
      setPlayback((prev) => (prev ? { ...prev, is_playing: false } : prev));
    } finally {
      setActionLoading(false);
    }
  }, []);

  const resume = useCallback(async () => {
    if (!sharedAudio) return;
    clipEndPauseRequested.current = false;
    setActionLoading(true);
    setError(null);
    try {
      await sharedAudio.play();
      setPlayback((prev) =>
        prev
          ? { ...prev, is_playing: true, progress_ms: Math.round(sharedAudio!.currentTime * 1000) }
          : prev,
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Playback failed");
    } finally {
      setActionLoading(false);
    }
  }, []);

  const playOrResumeClip = useCallback(
    async (clipId: string, startMs: number, endMs: number) => {
      const audio = getSharedAudio();
      const lastContext = lastPlayContextRef.current;
      const canResume =
        audio &&
        activeClipIdRef.current === clipId &&
        loadedClipIdRef.current === clipId &&
        lastContext?.clipId === clipId &&
        lastContext.startMs === startMs &&
        lastContext.endMs === endMs &&
        audio.paused &&
        Number.isFinite(audio.currentTime);

      if (canResume) {
        const progressMs = Math.round(audio.currentTime * 1000);
        if (progressMs >= startMs && progressMs < endMs) {
          clipBoundsRef.current = { startMs, endMs };
          clipEndPauseRequested.current = false;
          await resume();
          return;
        }
      }

      await playClip(clipId, startMs, endMs);
    },
    [playClip, resume],
  );

  const restartClip = useCallback(
    async (clipId: string, startMs: number, endMs: number) => {
      await playClip(clipId, startMs, endMs);
    },
    [playClip],
  );

  const seekClip = useCallback(
    async (clipId: string, positionMs: number, startMs: number, endMs: number) => {
      const clampedMs = Math.max(startMs, Math.min(endMs, Math.round(positionMs)));

      setActionLoading(true);
      setError(null);

      try {
        const audio = await ensureLoaded(clipId);

        playbackGeneration.current += 1;
        clipBoundsRef.current = { startMs, endMs };
        activeClipIdRef.current = clipId;
        lastPlayContextRef.current = { clipId, startMs, endMs };
        audio.currentTime = clampedMs / 1000;

        if (clampedMs >= endMs) {
          clipEndPauseRequested.current = true;
          audio.pause();
          setPlayback({
            is_playing: false,
            progress_ms: clampedMs,
            item: { id: clipId },
          });
        } else {
          clipEndPauseRequested.current = false;
          await audio.play();
          setPlayback({
            is_playing: true,
            progress_ms: clampedMs,
            item: { id: clipId },
          });
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : "Seek failed";
        setError(message);
        throw err;
      } finally {
        setActionLoading(false);
      }
    },
    [ensureLoaded],
  );

  const setVolume = useCallback((nextVolume: number) => {
    setVolumeState(setSharedPlaybackVolume(nextVolume));
  }, []);

  return {
    playback,
    setPlayback,
    error,
    actionLoading,
    playClip,
    playOrResumeClip,
    pause,
    resume,
    restartClip,
    seekClip,
    volume,
    setVolume,
    ready: enabled && ready,
    source: "upload" as const,
  };
}
