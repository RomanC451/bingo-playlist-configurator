"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useSimulatedPlaybackProgress } from "@/hooks/useSimulatedPlaybackProgress";
import { useRecordSessionWork } from "@/hooks/useRecordSessionWork";
import { PlaybackPageSkeleton } from "@/components/page-skeletons";
import { useDelayedLoading } from "@/hooks/useDelayedLoading";
import { msToLabel } from "@/lib/waveform";
import { errorMessageFromBody, externalErrorFromBody } from "@/lib/api-errors";
import { readJsonResponse } from "@/lib/read-json-response";
import { isWebPlayerDevice } from "@/lib/spotify-types";

interface TrackClip {
  id: string;
  spotifyTrackId: string;
  trackName: string;
  artistName: string;
  albumArtUrl: string | null;
  durationMs: number;
  position: number;
  startMs: number;
  endMs: number;
  playbackRange?: {
    source: "vote" | "default";
    proposerName?: string;
    voteCount: number;
  };
}

interface BingoSession {
  id: string;
  name: string;
  trackClips: TrackClip[];
}

interface PlaybackState {
  is_playing: boolean;
  progress_ms: number | null;
  item: { id: string } | null;
}

interface Device {
  id: string;
  name: string;
  type: string;
  is_active: boolean;
}

interface PlaybackControlsProps {
  sessionId: string;
}

export function PlaybackControls({ sessionId }: PlaybackControlsProps) {
  useRecordSessionWork(sessionId);
  const [data, setData] = useState<{
    session: BingoSession;
    playback: PlaybackState | null;
    devices: Device[];
    hasActiveDevice: boolean;
  } | null>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [initialized, setInitialized] = useState(false);
  const { loading, begin, end } = useDelayedLoading();
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [selectedDeviceId, setSelectedDeviceId] = useState<string>("");
  const clipEndPauseRequested = useRef(false);
  const playbackGeneration = useRef(0);
  const clipPlayStartedAt = useRef(0);
  const rateLimitedUntil = useRef(0);

  const loadState = useCallback(async (options?: { silent?: boolean; playerOnly?: boolean }) => {
    if (Date.now() < rateLimitedUntil.current) {
      return;
    }

    const trackLoading = !options?.silent && !options?.playerOnly;
    if (trackLoading) begin();

    try {
      const url = options?.playerOnly
        ? `/api/playback/${sessionId}?scope=player`
        : `/api/playback/${sessionId}`;
      const res = await fetch(url);
      const json = await readJsonResponse<{
        session?: BingoSession;
        playback: PlaybackState | null;
        devices?: Device[];
        hasActiveDevice?: boolean;
        error?: string;
      }>(res);

      if (res.status === 429) {
        const external = externalErrorFromBody(json);
        const waitMs = (external?.retryAfterSeconds ?? 30) * 1000;
        rateLimitedUntil.current = Date.now() + waitMs;
        const message = errorMessageFromBody(json, "Spotify rate limit exceeded");
        if (!options?.silent) {
          setError(message);
        }
        if (trackLoading) {
          setInitialized(true);
        }
        return;
      }

      if (!res.ok) throw new Error(errorMessageFromBody(json, "Failed to load playback"));

      if (options?.playerOnly) {
        setData((prev) => (prev ? { ...prev, playback: json.playback } : prev));
        return;
      }

      setData(json as {
        session: BingoSession;
        playback: PlaybackState | null;
        devices: Device[];
        hasActiveDevice: boolean;
      });
      if (!options?.silent) {
        setError(null);
      }
      const devices = json.devices ?? [];
      const deviceIds = new Set(devices.map((d: Device) => d.id));
      setSelectedDeviceId((prev) => {
        if (
          prev &&
          deviceIds.has(prev) &&
          !isWebPlayerDevice(json.devices?.find((d: Device) => d.id === prev)?.name ?? "")
        ) {
          return prev;
        }
        const preferred =
          devices.find((d: Device) => !isWebPlayerDevice(d.name) && d.is_active) ??
          devices.find((d: Device) => !isWebPlayerDevice(d.name));
        return preferred?.id ?? "";
      });
      if (trackLoading) {
        setInitialized(true);
      }
    } catch (err) {
      if (!options?.silent) {
        setError(err instanceof Error ? err.message : "Failed to load");
      }
      if (trackLoading) {
        setInitialized(true);
      }
    } finally {
      if (trackLoading) {
        end();
      }
    }
  }, [begin, end, sessionId]);

  useEffect(() => {
    void loadState();
  }, [loadState]);

  const clips = data?.session.trackClips ?? [];
  const currentClip = clips[currentIndex];
  const playback = useSimulatedPlaybackProgress(data?.playback ?? null);
  const connectDevices =
    data?.devices.filter((d) => !isWebPlayerDevice(d.name)) ?? [];
  const effectiveDeviceId =
    (selectedDeviceId && connectDevices.some((d) => d.id === selectedDeviceId)
      ? selectedDeviceId
      : connectDevices.find((d) => d.is_active)?.id) ??
    connectDevices[0]?.id ??
    "";
  const noConnectDevice = connectDevices.length === 0;

  const isCurrentTrack =
    playback != null &&
    currentClip != null &&
    playback.item?.id === currentClip.spotifyTrackId;

  const clipDuration = currentClip ? currentClip.endMs - currentClip.startMs : 1;

  const progressInClip =
    isCurrentTrack && playback.progress_ms != null
      ? Math.min(
          Math.max(0, playback.progress_ms - currentClip.startMs),
          clipDuration,
        )
      : 0;
  const progressPct = Math.min(100, (progressInClip / clipDuration) * 100);

  const isClipPlaying = isCurrentTrack && !!playback?.is_playing;

  useEffect(() => {
    clipEndPauseRequested.current = false;
  }, [currentIndex]);

  useEffect(() => {
    if (
      actionLoading ||
      !isCurrentTrack ||
      !playback?.is_playing ||
      playback.progress_ms == null ||
      clipEndPauseRequested.current
    ) {
      return;
    }

    const msPastEnd = playback.progress_ms - currentClip!.endMs;
    const msSincePlayStart = Date.now() - clipPlayStartedAt.current;

    // Ignore stale progress from before the seek, and wait at least 5s after starting.
    if (
      msSincePlayStart < 5000 ||
      msPastEnd < 0 ||
      msPastEnd > 3000 ||
      playback.progress_ms < currentClip!.startMs
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
        const res = await fetch(`/api/playback/${sessionId}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            clipId: currentClip!.id,
            deviceId: effectiveDeviceId || undefined,
            action: "pause",
          }),
        });
        if (generationAtTrigger !== playbackGeneration.current) return;
        if (res.ok) await loadState({ silent: true });
        else clipEndPauseRequested.current = false;
      } catch {
        if (generationAtTrigger === playbackGeneration.current) {
          clipEndPauseRequested.current = false;
        }
      }
    })();
  }, [
    isCurrentTrack,
    playback?.is_playing,
    playback?.progress_ms,
    currentClip,
    sessionId,
    effectiveDeviceId,
    loadState,
    actionLoading,
  ]);

  async function playClip(clipId: string, options?: { resume?: boolean }) {
    const clip = clips.find((c) => c.id === clipId);
    let positionMs: number | undefined;

    if (
      options?.resume &&
      clip &&
      playback?.item?.id === clip.spotifyTrackId &&
      playback.progress_ms != null &&
      playback.progress_ms >= clip.startMs &&
      playback.progress_ms < clip.endMs
    ) {
      positionMs = playback.progress_ms;
    }

    playbackGeneration.current += 1;
    clipEndPauseRequested.current = false;
    clipPlayStartedAt.current = Date.now();
    setActionLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/playback/${sessionId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clipId,
          deviceId: effectiveDeviceId || undefined,
          action: "play",
          ...(positionMs != null ? { positionMs } : {}),
        }),
      });
      const json = await readJsonResponse<{ error?: string; playback?: PlaybackState }>(res);
      if (!res.ok) throw new Error(errorMessageFromBody(json, "Playback failed"));
      if (json.playback) {
        setData((prev) =>
          prev
            ? {
                ...prev,
                playback: json.playback!,
                hasActiveDevice: true,
              }
            : prev,
        );
      } else {
        await loadState({ silent: true });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Playback failed");
    } finally {
      setActionLoading(false);
    }
  }

  async function pauseClip() {
    if (!currentClip) return;
    playbackGeneration.current += 1;
    clipEndPauseRequested.current = true;
    setActionLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/playback/${sessionId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clipId: currentClip.id,
          deviceId: effectiveDeviceId || undefined,
          action: "pause",
        }),
      });
      const json = await readJsonResponse<{ error?: string }>(res);
      if (!res.ok) throw new Error(errorMessageFromBody(json, "Pause failed"));
      await loadState({ silent: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Pause failed");
    } finally {
      setActionLoading(false);
    }
  }

  async function togglePlayPause() {
    if (!currentClip || actionLoading) return;
    if (isClipPlaying) {
      await pauseClip();
    } else {
      await playClip(currentClip.id, { resume: true });
    }
  }

  async function goNext() {
    if (currentIndex >= clips.length - 1 || actionLoading) return;
    const next = currentIndex + 1;
    setCurrentIndex(next);
    await playClip(clips[next].id);
  }

  async function goBack() {
    if (currentIndex <= 0 || actionLoading) return;
    const prev = currentIndex - 1;
    setCurrentIndex(prev);
    await playClip(clips[prev].id);
  }

  if (!initialized) {
    if (loading) return <PlaybackPageSkeleton />;
    return null;
  }

  if (!data) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-red-700">
        {error ?? "Unable to load session"}
      </div>
    );
  }

  if (clips.length === 0) {
    return (
      <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-amber-800">
        This session has no tracks.{" "}
        <Link href={`/sessions/${sessionId}/edit`} className="underline">
          Edit session
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {noConnectDevice && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-red-900 dark:border-red-900 dark:bg-red-950 dark:text-red-100">
          <p className="font-medium">No Spotify Connect device found</p>
          <p className="mt-1 text-sm">
            Only the browser Web Player is available, which cannot play bingo clips.
            Install and open the{" "}
            <a
              href="https://www.spotify.com/download/"
              className="underline"
              target="_blank"
              rel="noreferrer"
            >
              Spotify desktop app
            </a>{" "}
            (or use the mobile app), then refresh this page.
          </p>
        </div>
      )}

      {!noConnectDevice && !effectiveDeviceId && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-amber-900 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-100">
          <p className="font-medium">No active Spotify device</p>
          <p className="mt-1 text-sm">
            Open Spotify on your phone, computer, or speaker, then return here. Playback
            requires an active Connect device and Spotify Premium.
          </p>
        </div>
      )}

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-red-700">
          {error}
        </div>
      )}

      <div className="flex items-center gap-4">
        <label className="text-sm text-zinc-600 dark:text-zinc-400">
          Device
          <select
            value={effectiveDeviceId}
            onChange={(e) => setSelectedDeviceId(e.target.value)}
            className="ml-2 rounded border border-zinc-300 bg-white px-2 py-1 dark:border-zinc-700 dark:bg-zinc-900"
          >
            {connectDevices.length === 0 ? (
              <option value="">No Connect device — open desktop app</option>
            ) : (
              connectDevices.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name} {d.is_active ? "(active)" : ""}
                </option>
              ))
            )}
          </select>
        </label>
      </div>

      <div className="rounded-xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-950">
        <p className="text-sm text-zinc-500">
          Track {currentIndex + 1} of {clips.length}
        </p>
        <h2 className="mt-1 text-2xl font-semibold">{currentClip.trackName}</h2>
        <p className="text-zinc-500">{currentClip.artistName}</p>
        <p className="mt-2 text-sm text-zinc-500">
          Clip: {msToLabel(currentClip.startMs)} – {msToLabel(currentClip.endMs)}
          {currentClip.playbackRange?.source === "vote" && (
            <span className="ml-2 text-emerald-600">
              Team pick · {currentClip.playbackRange.proposerName} (
              {currentClip.playbackRange.voteCount} vote
              {currentClip.playbackRange.voteCount === 1 ? "" : "s"})
            </span>
          )}
          {currentClip.playbackRange?.source === "default" && (
            <span className="ml-2 text-zinc-400">Default</span>
          )}
        </p>

        <div className="mt-4 h-2 overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-800">
          <div
            className="h-full bg-emerald-500"
            style={{ width: `${progressPct}%` }}
          />
        </div>
        <p className="mt-1 text-xs text-zinc-500">
          {msToLabel(progressInClip)} / {msToLabel(clipDuration)} within clip
        </p>

        <div className="mt-6 flex flex-wrap gap-3">
          <button
            type="button"
            disabled={currentIndex === 0 || actionLoading}
            onClick={goBack}
            className="rounded-lg border border-zinc-300 px-4 py-2 disabled:opacity-50 dark:border-zinc-700"
          >
            Back
          </button>
          <button
            type="button"
            disabled={actionLoading}
            onClick={togglePlayPause}
            className="inline-flex min-w-[6.5rem] items-center justify-center rounded-lg bg-emerald-600 px-6 py-2 font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
          >
            {isClipPlaying ? "Pause" : "Play"}
          </button>
          <button
            type="button"
            disabled={currentIndex >= clips.length - 1 || actionLoading}
            onClick={goNext}
            className="rounded-lg border border-zinc-300 px-4 py-2 disabled:opacity-50 dark:border-zinc-700"
          >
            Next
          </button>
        </div>
      </div>

      <Link
        href={`/sessions/${sessionId}/edit`}
        className="text-sm text-emerald-600 hover:underline"
      >
        Back to editor
      </Link>
    </div>
  );
}
