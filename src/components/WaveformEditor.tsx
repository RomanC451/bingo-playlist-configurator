"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useSimulatedPlaybackProgress } from "@/hooks/useSimulatedPlaybackProgress";
import { msToLabel } from "@/lib/waveform";
import type { WaveformSource } from "@/lib/waveform";
import { readJsonResponse } from "@/lib/read-json-response";

interface PlaybackState {
  is_playing: boolean;
  progress_ms: number | null;
  item: { id: string } | null;
}

export type { PlaybackState };

interface WaveformEditorProps {
  trackId: string;
  trackName: string;
  artistName: string;
  albumArtUrl?: string | null;
  durationMs: number;
  startMs: number;
  endMs: number;
  clipId: string;
  sessionId: string;
  saveUrl?: string;
  onUpdate?: (startMs: number, endMs: number) => void;
  onPreview?: () => void;
  onPause?: () => void;
  onRestart?: () => void;
  /** Read-only clip preview (no drag handles or auto-save). */
  readOnly?: boolean;
  /** Hide track title/art (e.g. when embedded in a proposal card). */
  compact?: boolean;
  /** Unique id so only one editor on the page shows playback progress. */
  previewKey?: string;
  activePreviewKey?: string | null;
  onPreviewActive?: (key: string) => void;
  /** Shared playback state (one poll per page). When set, internal polling is disabled. */
  playback?: PlaybackState | null;
  onPlaybackChange?: React.Dispatch<React.SetStateAction<PlaybackState | null>>;
}

type DragHandle = "start" | "end" | null;

const playbackButtonClass =
  "rounded border border-zinc-300 p-1.5 text-zinc-600 hover:bg-zinc-50 disabled:opacity-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-900";

function PlayIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4 fill-current" aria-hidden>
      <path d="M8 5v14l11-7z" />
    </svg>
  );
}

function PauseIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4 fill-current" aria-hidden>
      <path d="M6 5h4v14H6V5zm8 0h4v14h-4V5z" />
    </svg>
  );
}

function RestartIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4 fill-current" aria-hidden>
      <path d="M12 5V1L7 6l5 5V7c3.31 0 6 2.69 6 6s-2.69 6-6 6-6-2.69-6-6H4c0 4.42 3.58 8 8 8s8-3.58 8-8-3.58-8-8-8z" />
    </svg>
  );
}

export function WaveformEditor({
  trackId,
  trackName,
  artistName,
  albumArtUrl,
  durationMs,
  startMs,
  endMs,
  clipId,
  sessionId,
  saveUrl,
  onUpdate,
  onPreview,
  onPause,
  onRestart,
  readOnly = false,
  compact = false,
  previewKey,
  activePreviewKey = null,
  onPreviewActive,
  playback: sharedPlayback,
  onPlaybackChange,
}: WaveformEditorProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [placeholderPeaks, setPlaceholderPeaks] = useState<number[]>([]);
  const [waveformDurationMs, setWaveformDurationMs] = useState(durationMs);
  const [localStart, setLocalStart] = useState(startMs);
  const [localEnd, setLocalEnd] = useState(endMs);
  const [dragging, setDragging] = useState<DragHandle>(null);
  const [loading, setLoading] = useState(true);
  const [waveformSource, setWaveformSource] = useState<WaveformSource | null>(null);
  const [waveformNote, setWaveformNote] = useState<string | null>(null);
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [playbackLoading, setPlaybackLoading] = useState(false);
  const [localPlayback, setLocalPlayback] = useState<PlaybackState | null>(null);
  const usesSharedPlayback = onPlaybackChange != null;
  const rawPlayback = usesSharedPlayback ? (sharedPlayback ?? null) : localPlayback;
  const setPlayback = usesSharedPlayback ? onPlaybackChange : setLocalPlayback;
  const localStartRef = useRef(startMs);
  const localEndRef = useRef(endMs);
  const clipEndPauseRequested = useRef(false);
  const playbackGeneration = useRef(0);
  const clipPlayStartedAt = useRef(0);

  useEffect(() => {
    localStartRef.current = localStart;
    localEndRef.current = localEnd;
  }, [localStart, localEnd]);

  const effectiveDuration = waveformDurationMs || durationMs || 180000;

  useEffect(() => {
    // Sync when parent saves or clip changes
    // eslint-disable-next-line react-hooks/set-state-in-effect -- intentional prop sync
    setLocalStart(startMs);
    setLocalEnd(endMs);
    localStartRef.current = startMs;
    localEndRef.current = endMs;
  }, [startMs, endMs]);

  const loadWaveform = useCallback(
    async () => {
      setLoading(true);
      setWaveformNote("Loading waveform…");
      try {
        const params = new URLSearchParams({
          trackName,
          artistName,
        });
        const res = await fetch(`/api/waveform/${trackId}?${params}`);
        const data = await readJsonResponse<{
          rawAmplitudes?: number[];
          peaks?: number[];
          durationMs?: number;
          source?: WaveformSource;
          imageUrl?: string;
          message?: string;
          error?: string;
        }>(res);

        if (!res.ok && !data.imageUrl && !data.rawAmplitudes?.length && !data.peaks?.length) {
          setImageUrl(null);
          setPlaceholderPeaks([]);
          setWaveformSource("placeholder");
          setWaveformNote(data.error ?? data.message ?? "Could not load waveform.");
          return;
        }

        setWaveformDurationMs(data.durationMs ?? durationMs);
        setWaveformSource(data.source ?? null);
        setWaveformNote(data.message ?? null);

        if (data.source === "wavevisual" && data.imageUrl) {
          const imageParams = new URLSearchParams();
          const isDark =
            typeof document !== "undefined" &&
            document.documentElement.classList.contains("dark");
          imageParams.set("theme", isDark ? "dark" : "light");
          imageParams.set("t", String(Date.now()));
          const separator = data.imageUrl.includes("?") ? "&" : "?";
          setImageUrl(`${data.imageUrl}${separator}${imageParams.toString()}`);
          setPlaceholderPeaks([]);
        } else {
          setImageUrl(null);
          setPlaceholderPeaks(data.peaks ?? []);
        }
      } finally {
        setLoading(false);
      }
    },
    [trackId, durationMs, trackName, artistName],
  );

  useEffect(() => {
    void loadWaveform();
  }, [loadWaveform]);

  const scheduleSave = useCallback(
    (newStart: number, newEnd: number) => {
      if (readOnly) return;
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
      setSaveStatus("saving");
      saveTimeoutRef.current = setTimeout(async () => {
        try {
          const url =
            saveUrl ?? `/api/sessions/${sessionId}/clips/${clipId}`;
          const res = await fetch(url, {
            method: saveUrl ? "PUT" : "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ startMs: newStart, endMs: newEnd }),
          });
          if (!res.ok) throw new Error("Save failed");
          onUpdate?.(newStart, newEnd);
          setSaveStatus("saved");
        } catch {
          setSaveStatus("error");
        }
      }, 400);
    },
    [clipId, sessionId, saveUrl, onUpdate, readOnly],
  );

  const msFromClientX = useCallback(
    (clientX: number) => {
      const rect = containerRef.current?.getBoundingClientRect();
      if (!rect) return 0;
      const ratio = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
      return Math.round(ratio * effectiveDuration);
    },
    [effectiveDuration],
  );

  useEffect(() => {
    if (!dragging) return;

    function onMove(e: MouseEvent) {
      const ms = msFromClientX(e.clientX);
      if (dragging === "start") {
        const next = Math.max(0, Math.min(ms, localEndRef.current - 1000));
        setLocalStart(next);
        localStartRef.current = next;
      } else {
        const next = Math.min(
          effectiveDuration,
          Math.max(ms, localStartRef.current + 1000),
        );
        setLocalEnd(next);
        localEndRef.current = next;
      }
    }

    function onUp() {
      setDragging(null);
      scheduleSave(localStartRef.current, localEndRef.current);
    }

    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, [dragging, localStart, localEnd, msFromClientX, scheduleSave, effectiveDuration]);

  const startPct = (localStart / effectiveDuration) * 100;
  const endPct = (localEnd / effectiveDuration) * 100;

  const playbackBody = useCallback(
    (action: "preview" | "pause" | "play", positionMs?: number) => ({
      clipId,
      action,
      positionMs,
      clipStartMs: localStartRef.current,
      clipEndMs: localEndRef.current,
    }),
    [clipId],
  );

  const callPlayback = useCallback(
    async (action: "preview" | "pause" | "play", positionMs?: number) => {
      if (action === "preview" || action === "play") {
        playbackGeneration.current += 1;
        clipEndPauseRequested.current = false;
        clipPlayStartedAt.current = Date.now();
        if (previewKey && onPreviewActive) {
          onPreviewActive(previewKey);
        }
      } else {
        playbackGeneration.current += 1;
        clipEndPauseRequested.current = true;
      }

      setPlaybackLoading(true);
      try {
        const res = await fetch(`/api/playback/${sessionId}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(playbackBody(action, positionMs)),
        });
        const json = await readJsonResponse<{ playback?: PlaybackState | null }>(res);
        if (json.playback) setPlayback(json.playback);
        else if (action === "pause") {
          setPlayback((prev) =>
            prev ? { ...prev, is_playing: false } : prev,
          );
        }
      } finally {
        setPlaybackLoading(false);
      }
    },
    [sessionId, playbackBody, previewKey, onPreviewActive, setPlayback],
  );

  const isCurrentTrack = rawPlayback?.item?.id === trackId;
  const isActivePreview =
    previewKey == null || activePreviewKey == null
      ? previewKey == null
      : activePreviewKey === previewKey;
  const showPlaybackProgress = isCurrentTrack && isActivePreview;
  const playback = useSimulatedPlaybackProgress(rawPlayback, showPlaybackProgress);
  const clipDuration = Math.max(1, localEnd - localStart);
  const progressInClip =
    showPlaybackProgress && playback?.progress_ms != null
      ? Math.min(
          Math.max(0, playback.progress_ms - localStart),
          clipDuration,
        )
      : 0;
  const progressPct = Math.min(100, (progressInClip / clipDuration) * 100);
  const playheadPct =
    showPlaybackProgress && playback?.progress_ms != null
      ? Math.min(100, Math.max(0, (playback.progress_ms / effectiveDuration) * 100))
      : null;

  useEffect(() => {
    if (
      playbackLoading ||
      !showPlaybackProgress ||
      !playback?.is_playing ||
      playback.progress_ms == null ||
      clipEndPauseRequested.current
    ) {
      return;
    }

    const msPastEnd = playback.progress_ms - localEndRef.current;
    const msSincePlayStart = Date.now() - clipPlayStartedAt.current;

    if (
      msSincePlayStart < 5000 ||
      msPastEnd < 0 ||
      msPastEnd > 3000 ||
      playback.progress_ms < localStartRef.current
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
      await callPlayback("pause");
    })();
  }, [
    showPlaybackProgress,
    playback?.is_playing,
    playback?.progress_ms,
    callPlayback,
    playbackLoading,
  ]);

  function handlePreview() {
    if (onPreview) {
      void onPreview();
      return;
    }
    void callPlayback("preview");
  }

  function handlePause() {
    if (onPause) {
      void onPause();
      return;
    }
    void callPlayback("pause");
  }

  function handleRestart() {
    if (onRestart) {
      void onRestart();
      return;
    }
    void callPlayback("preview", localStartRef.current);
  }

  const showPlaybackControls = onPreview || onPause || onRestart || sessionId;

  const playbackButtons = (
    <>
      <button
        type="button"
        disabled={playbackLoading}
        onClick={handlePreview}
        aria-label="Preview clip"
        title="Preview clip"
        className={playbackButtonClass}
      >
        <PlayIcon />
      </button>
      <button
        type="button"
        disabled={playbackLoading}
        onClick={handlePause}
        aria-label="Pause"
        title="Pause"
        className={playbackButtonClass}
      >
        <PauseIcon />
      </button>
      <button
        type="button"
        disabled={playbackLoading}
        onClick={handleRestart}
        aria-label="Restart clip"
        title="Restart clip"
        className={playbackButtonClass}
      >
        <RestartIcon />
      </button>
    </>
  );

  return (
    <div
      className={
        compact
          ? ""
          : "rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950"
      }
    >
      {!compact && (
        <div className="mb-3 flex items-start gap-3">
          {albumArtUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={albumArtUrl} alt="" className="h-12 w-12 rounded object-cover" />
          )}
          <div className="min-w-0 flex-1">
            <p className="truncate font-medium">{trackName}</p>
            <p className="truncate text-sm text-zinc-500">{artistName}</p>
          </div>
          <div className="flex items-center gap-2 text-xs text-zinc-500">
            <span>
              {msToLabel(localStart)} – {msToLabel(localEnd)}
            </span>
            {!readOnly && saveStatus === "saving" && <span>Saving…</span>}
            {!readOnly && saveStatus === "saved" && (
              <span className="text-emerald-600">Saved</span>
            )}
            {!readOnly && saveStatus === "error" && (
              <span className="text-red-600">Error</span>
            )}
            {showPlaybackControls && (
              <div className="flex items-center gap-1">{playbackButtons}</div>
            )}
          </div>
        </div>
      )}

      {compact && showPlaybackControls && (
        <div className="mb-2 flex justify-end">
          <div className="flex items-center gap-1">{playbackButtons}</div>
        </div>
      )}

      <div
        ref={containerRef}
        className={`relative h-20 overflow-hidden rounded-lg bg-zinc-100 dark:bg-zinc-900 ${
          readOnly ? "cursor-default" : "cursor-crosshair"
        }`}
      >
        {loading ? (
          <div className="flex h-full items-center justify-center text-sm text-zinc-500">
            {waveformNote ?? "Loading waveform…"}
          </div>
        ) : (
          <>
            {imageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={imageUrl}
                alt={`Waveform for ${trackName}`}
                className="absolute inset-0 h-full w-full select-none object-fill"
                draggable={false}
              />
            ) : (
              <div className="absolute inset-0 flex items-center gap-[0.5px] px-0.5">
                {placeholderPeaks.map((peak, i) => {
                  const halfHeight = Math.max(3, peak * 50);
                  return (
                    <div
                      key={i}
                      className="flex h-full flex-1 flex-col items-stretch justify-center"
                    >
                      <div className="flex flex-1 items-end">
                        <div
                          className="w-full rounded-t-sm bg-zinc-400 dark:bg-zinc-600"
                          style={{ height: `${halfHeight}%` }}
                        />
                      </div>
                      <div className="flex flex-1 items-start">
                        <div
                          className="w-full rounded-b-sm bg-zinc-400 dark:bg-zinc-600"
                          style={{ height: `${halfHeight}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
            <div
              className="absolute inset-y-0 bg-emerald-500/20"
              style={{ left: `${startPct}%`, width: `${endPct - startPct}%` }}
            />
            {playheadPct != null && (
              <div
                className="pointer-events-none absolute inset-y-0 z-10 w-0.5 -translate-x-1/2 bg-white shadow-sm dark:bg-zinc-100"
                style={{ left: `${playheadPct}%` }}
              />
            )}
            {!readOnly && (
              <>
                <div
                  className="absolute inset-y-0 w-1 -translate-x-1/2 cursor-ew-resize bg-emerald-500"
                  style={{ left: `${startPct}%` }}
                  onMouseDown={() => setDragging("start")}
                  role="slider"
                  aria-label="Clip start"
                  aria-valuenow={localStart}
                />
                <div
                  className="absolute inset-y-0 w-1 -translate-x-1/2 cursor-ew-resize bg-emerald-500"
                  style={{ left: `${endPct}%` }}
                  onMouseDown={() => setDragging("end")}
                  role="slider"
                  aria-label="Clip end"
                  aria-valuenow={localEnd}
                />
              </>
            )}
          </>
        )}
      </div>

      {waveformSource === "placeholder" && waveformNote && (
        <p className="mt-2 text-xs text-amber-600 dark:text-amber-400">{waveformNote}</p>
      )}

      {showPlaybackControls && isActivePreview && (
        <div className="mt-2">
          <div className="h-1.5 overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-800">
            <div
              className="h-full bg-emerald-500"
              style={{ width: `${progressPct}%` }}
            />
          </div>
          <p className="mt-1 text-xs text-zinc-500">
            {msToLabel(progressInClip)} / {msToLabel(clipDuration)} in clip
            {showPlaybackProgress && playback?.is_playing && (
              <span className="ml-2 text-emerald-600">Playing</span>
            )}
            {showPlaybackProgress && playback && !playback.is_playing && progressInClip > 0 && (
              <span className="ml-2 text-zinc-400">Paused</span>
            )}
          </p>
        </div>
      )}
    </div>
  );
}
