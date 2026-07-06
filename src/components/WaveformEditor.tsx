"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useSimulatedPlaybackProgress } from "@/hooks/useSimulatedPlaybackProgress";
import { msToLabel, buildMirroredWaveformPath } from "@/lib/waveform";
import { readJsonResponse } from "@/lib/read-json-response";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";

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
  /** When true, range changes stay local until the parent saves explicitly. */
  manualSave?: boolean;
  /** Show an unsaved-changes indicator in the card header. */
  unsaved?: boolean;
  onDraftChange?: (startMs: number, endMs: number) => void;
  onPreview?: () => void;
  onPause?: () => void;
  onRestart?: () => void;
  onSeek?: (positionMs: number) => void;
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
  /** Hide built-in play/pause/restart controls (e.g. when rendered in a parent header). */
  hidePlaybackControls?: boolean;
  /** Rendered inside the card below the waveform, separated by a border. */
  footer?: ReactNode;
}

type DragHandle = "start" | "end" | "playhead" | null;

const playbackButtonClass =
  "rounded border border-zinc-300 text-zinc-600 hover:bg-zinc-50 disabled:opacity-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-900";

function playbackButtonClassName(size: "default" | "lg") {
  return cn(playbackButtonClass, size === "lg" ? "p-2.5" : "p-1.5");
}

function iconClassName(size: "default" | "lg") {
  return size === "lg" ? "h-5 w-5" : "h-4 w-4";
}

function PlayIcon({ size = "default" }: { size?: "default" | "lg" }) {
  return (
    <svg viewBox="0 0 24 24" className={cn(iconClassName(size), "fill-current")} aria-hidden>
      <path d="M8 5v14l11-7z" />
    </svg>
  );
}

function PauseIcon({ size = "default" }: { size?: "default" | "lg" }) {
  return (
    <svg viewBox="0 0 24 24" className={cn(iconClassName(size), "fill-current")} aria-hidden>
      <path d="M6 5h4v14H6V5zm8 0h4v14h-4V5z" />
    </svg>
  );
}

function RestartIcon({ size = "default" }: { size?: "default" | "lg" }) {
  return (
    <svg viewBox="0 0 24 24" className={cn(iconClassName(size), "fill-current")} aria-hidden>
      <path d="M12 5V1L7 6l5 5V7c3.31 0 6 2.69 6 6s-2.69 6-6 6-6-2.69-6-6H4c0 4.42 3.58 8 8 8s8-3.58 8-8-3.58-8-8-8z" />
    </svg>
  );
}

type ClipPlaybackButtonsProps = {
  startMs: number;
  endMs: number;
  previewKey?: string;
  activePreviewKey?: string | null;
  onPreviewActive?: (key: string) => void;
  onPreview?: () => void;
  onPause?: () => void;
  onRestart?: () => void;
  isPlaying?: boolean;
  disabled?: boolean;
  size?: "default" | "lg";
  className?: string;
};

export function ClipPlaybackButtons({
  startMs,
  endMs,
  previewKey,
  onPreviewActive,
  onPreview,
  onPause,
  onRestart,
  isPlaying = false,
  disabled = false,
  size = "default",
  className,
}: ClipPlaybackButtonsProps) {
  const localStartRef = useRef(startMs);
  const localEndRef = useRef(endMs);

  useEffect(() => {
    localStartRef.current = startMs;
    localEndRef.current = endMs;
  }, [startMs, endMs]);

  function handlePreview() {
    if (!onPreview) return;
    if (previewKey && onPreviewActive) {
      onPreviewActive(previewKey);
    }
    void onPreview();
  }

  function handlePause() {
    if (!onPause) return;
    void onPause();
  }

  function handleRestart() {
    if (!onRestart) return;
    if (previewKey && onPreviewActive) {
      onPreviewActive(previewKey);
    }
    void onRestart();
  }

  function handlePlayPause() {
    if (isPlaying) {
      handlePause();
      return;
    }
    handlePreview();
  }

  const canTogglePlayback = Boolean(onPreview || onPause);
  const showControls = canTogglePlayback || onRestart;
  if (!showControls) return null;

  const buttonClass = playbackButtonClassName(size);
  const controlsGap = size === "lg" ? "gap-3" : "gap-1";

  return (
    <div
      className={
        className
          ? `flex items-center ${controlsGap} ${className}`
          : `flex items-center ${controlsGap}`
      }
    >
      {canTogglePlayback ? (
        <button
          type="button"
          onClick={handlePlayPause}
          disabled={disabled}
          aria-label={isPlaying ? "Pause clip" : "Play clip"}
          title={isPlaying ? "Pause" : "Play"}
          className={buttonClass}
        >
          {isPlaying ? <PauseIcon size={size} /> : <PlayIcon size={size} />}
        </button>
      ) : null}
      {onRestart ? (
        <button
          type="button"
          onClick={handleRestart}
          disabled={disabled}
          aria-label="Restart clip"
          title="Restart clip"
          className={buttonClass}
        >
          <RestartIcon size={size} />
        </button>
      ) : null}
    </div>
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
  manualSave = false,
  unsaved = false,
  onDraftChange,
  onPreview,
  onPause,
  onRestart,
  onSeek,
  readOnly = false,
  compact = false,
  previewKey,
  activePreviewKey = null,
  onPreviewActive,
  playback: sharedPlayback,
  onPlaybackChange,
  hidePlaybackControls = false,
  footer,
}: WaveformEditorProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [peaks, setPeaks] = useState<number[]>([]);
  const [waveformDurationMs, setWaveformDurationMs] = useState(durationMs);
  const [localStart, setLocalStart] = useState(startMs);
  const [localEnd, setLocalEnd] = useState(endMs);
  const [dragging, setDragging] = useState<DragHandle>(null);
  const [loading, setLoading] = useState(true);
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [localPlayback, setLocalPlayback] = useState<PlaybackState | null>(null);
  const usesSharedPlayback = onPlaybackChange != null;
  const hasExternalPlayback = sharedPlayback !== undefined;
  const rawPlayback =
    hasExternalPlayback || usesSharedPlayback ? (sharedPlayback ?? null) : localPlayback;
  const setPlayback = usesSharedPlayback ? onPlaybackChange : setLocalPlayback;
  const localStartRef = useRef(startMs);
  const localEndRef = useRef(endMs);
  const clipEndPauseRequested = useRef(false);
  const playbackGeneration = useRef(0);
  const clipPlayStartedAt = useRef(0);
  const seekPreviewMsRef = useRef<number | null>(null);
  const [seekPreviewMs, setSeekPreviewMs] = useState<number | null>(null);

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
      try {
        const params = new URLSearchParams({
          trackName,
          artistName,
          sessionId,
        });
        const res = await fetch(`/api/waveform/${trackId}?${params}`);
        const data = await readJsonResponse<{
          peaks?: number[];
          durationMs?: number;
        }>(res);

        setWaveformDurationMs(data.durationMs ?? durationMs);
        setPeaks(data.peaks ?? []);
      } finally {
        setLoading(false);
      }
    },
    [trackId, durationMs, trackName, artistName, sessionId],
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

  const closestHandle = useCallback(
    (clientX: number): "start" | "end" => {
      const rect = containerRef.current?.getBoundingClientRect();
      if (!rect) return "start";

      const clickX = clientX - rect.left;
      const startX = (localStartRef.current / effectiveDuration) * rect.width;
      const endX = (localEndRef.current / effectiveDuration) * rect.width;

      return Math.abs(clickX - startX) <= Math.abs(clickX - endX) ? "start" : "end";
    },
    [effectiveDuration],
  );

  const applyDragPosition = useCallback(
    (handle: "start" | "end", clientX: number) => {
      const ms = msFromClientX(clientX);
      if (handle === "start") {
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
    },
    [effectiveDuration, msFromClientX],
  );

  const beginDrag = useCallback(
    (clientX: number) => {
      if (readOnly) return;
      const handle = closestHandle(clientX);
      setDragging(handle);
      applyDragPosition(handle, clientX);
    },
    [applyDragPosition, closestHandle, readOnly],
  );

  const handleWaveformPointerDown = useCallback(
    (event: React.MouseEvent<HTMLDivElement>) => {
      if (readOnly || loading) return;
      event.preventDefault();
      beginDrag(event.clientX);
    },
    [beginDrag, loading, readOnly],
  );

  const commitSeek = useCallback(
    (positionMs: number) => {
      if (!onSeek) return;
      if (previewKey && onPreviewActive) {
        onPreviewActive(previewKey);
      }
      playbackGeneration.current += 1;
      clipEndPauseRequested.current = false;
      clipPlayStartedAt.current = Date.now();
      onSeek(positionMs);
    },
    [onPreviewActive, onSeek, previewKey],
  );

  const msFromClipProgressX = useCallback(
    (clientX: number, element: HTMLElement) => {
      const rect = element.getBoundingClientRect();
      const ratio = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
      return Math.round(localStartRef.current + ratio * (localEndRef.current - localStartRef.current));
    },
    [],
  );

  const handleProgressBarPointerDown = useCallback(
    (event: React.MouseEvent<HTMLDivElement>) => {
      if (!onSeek || loading) return;
      event.preventDefault();
      commitSeek(msFromClipProgressX(event.clientX, event.currentTarget));
    },
    [commitSeek, loading, msFromClipProgressX, onSeek],
  );

  const beginPlayheadDrag = useCallback(
    (event: React.MouseEvent<HTMLDivElement>) => {
      if (!onSeek || loading) return;
      event.preventDefault();
      event.stopPropagation();
      const initialMs = Math.max(
        localStartRef.current,
        Math.min(
          localEndRef.current,
          seekPreviewMsRef.current ??
            (rawPlayback?.item?.id === clipId && rawPlayback.progress_ms != null
              ? rawPlayback.progress_ms
              : localStartRef.current),
        ),
      );
      seekPreviewMsRef.current = initialMs;
      setSeekPreviewMs(initialMs);
      setDragging("playhead");
    },
    [clipId, loading, onSeek, rawPlayback?.item?.id, rawPlayback?.progress_ms],
  );

  useEffect(() => {
    if (!dragging) return;

    function onMove(e: MouseEvent) {
      if (dragging === "playhead") {
        const ms = Math.max(
          localStartRef.current,
          Math.min(localEndRef.current, msFromClientX(e.clientX)),
        );
        seekPreviewMsRef.current = ms;
        setSeekPreviewMs(ms);
        return;
      }

      if (dragging === "start" || dragging === "end") {
        applyDragPosition(dragging, e.clientX);
      }
    }

    function onUp() {
      if (dragging === "playhead") {
        const ms = seekPreviewMsRef.current;
        if (ms != null) {
          commitSeek(ms);
        }
        seekPreviewMsRef.current = null;
        setSeekPreviewMs(null);
        setDragging(null);
        return;
      }

      setDragging(null);
      if (manualSave) {
        onDraftChange?.(localStartRef.current, localEndRef.current);
        return;
      }
      scheduleSave(localStartRef.current, localEndRef.current);
    }

    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, [dragging, applyDragPosition, scheduleSave, manualSave, onDraftChange, msFromClientX, commitSeek]);

  const startPct = (localStart / effectiveDuration) * 100;
  const endPct = (localEnd / effectiveDuration) * 100;
  const waveformPath = useMemo(
    () => buildMirroredWaveformPath(peaks),
    [peaks],
  );

  const isCurrentTrack = rawPlayback?.item?.id === clipId;
  const isActivePreview =
    previewKey == null || activePreviewKey == null
      ? previewKey == null
      : activePreviewKey === previewKey;
  const showPlaybackProgress = isCurrentTrack && isActivePreview;
  const playback = useSimulatedPlaybackProgress(rawPlayback, showPlaybackProgress);
  const clipDuration = Math.max(1, localEnd - localStart);
  const displayProgressMs =
    seekPreviewMs ??
    (showPlaybackProgress && playback?.progress_ms != null ? playback.progress_ms : null);
  const progressInClip =
    displayProgressMs != null
      ? Math.min(Math.max(0, displayProgressMs - localStart), clipDuration)
      : 0;
  const progressPct = Math.min(100, (progressInClip / clipDuration) * 100);
  const playheadPct =
    displayProgressMs != null
      ? Math.min(100, Math.max(0, (displayProgressMs / effectiveDuration) * 100))
      : onSeek
        ? startPct
        : null;
  const showPlayhead = playheadPct != null && (onSeek || showPlaybackProgress);

  useEffect(() => {
    if (
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
      if (onPause) {
        void onPause();
      }
    })();
  }, [
    showPlaybackProgress,
    playback?.is_playing,
    playback?.progress_ms,
    onPause,
  ]);

  const showPlaybackControls =
    !hidePlaybackControls && (onPreview || onPause || onRestart);

  const wrappedOnPreview = useCallback(() => {
    if (!onPreview) return;
    playbackGeneration.current += 1;
    clipEndPauseRequested.current = false;
    clipPlayStartedAt.current = Date.now();
    onPreview();
  }, [onPreview]);

  const wrappedOnPause = useCallback(() => {
    if (!onPause) return;
    playbackGeneration.current += 1;
    clipEndPauseRequested.current = true;
    onPause();
  }, [onPause]);

  const wrappedOnRestart = useCallback(() => {
    if (!onRestart) return;
    playbackGeneration.current += 1;
    clipEndPauseRequested.current = false;
    clipPlayStartedAt.current = Date.now();
    onRestart();
  }, [onRestart]);

  const playbackButtons = (
    <ClipPlaybackButtons
      startMs={localStart}
      endMs={localEnd}
      previewKey={previewKey}
      activePreviewKey={activePreviewKey}
      onPreviewActive={onPreviewActive}
      onPreview={onPreview ? wrappedOnPreview : undefined}
      onPause={onPause ? wrappedOnPause : undefined}
      onRestart={onRestart ? wrappedOnRestart : undefined}
      isPlaying={showPlaybackProgress && !!playback?.is_playing}
    />
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
          <div className="flex flex-wrap items-center justify-end gap-2 text-xs text-zinc-500">
            {unsaved && (
              <Badge className="bg-amber-100 font-medium text-amber-800 dark:bg-amber-950 dark:text-amber-200">
                Unsaved
              </Badge>
            )}
            <span>
              {msToLabel(localStart)} – {msToLabel(localEnd)}
            </span>
            {!manualSave && !readOnly && saveStatus === "saving" && <span>Saving…</span>}
            {!manualSave && !readOnly && saveStatus === "saved" && (
              <span className="text-emerald-600">Saved</span>
            )}
            {!manualSave && !readOnly && saveStatus === "error" && (
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
        onMouseDown={handleWaveformPointerDown}
        className={`relative h-20 overflow-hidden rounded-lg bg-zinc-100 dark:bg-zinc-900 ${
          readOnly ? "cursor-default" : "cursor-ew-resize"
        }`}
      >
        {loading ? (
          <div className="flex h-full items-center justify-center text-sm text-zinc-500">
            Loading waveform…
          </div>
        ) : (
          <>
            <svg
              className="absolute inset-0 h-full w-full text-zinc-400 dark:text-zinc-600"
              preserveAspectRatio="none"
              viewBox={`0 0 ${peaks.length || 1} 100`}
              aria-hidden
            >
              <path d={waveformPath} fill="currentColor" />
            </svg>
            <div
              className="absolute inset-y-0 bg-emerald-500/20"
              style={{ left: `${startPct}%`, width: `${endPct - startPct}%` }}
            />
            {showPlayhead && (
              <div
                className={`absolute inset-y-0 z-20 w-4 -translate-x-1/2 ${
                  onSeek ? "cursor-grab active:cursor-grabbing" : "pointer-events-none"
                }`}
                style={{ left: `${playheadPct}%` }}
                onMouseDown={onSeek ? beginPlayheadDrag : undefined}
                role={onSeek ? "slider" : undefined}
                aria-label={onSeek ? "Playback position" : undefined}
                aria-valuemin={onSeek ? localStart : undefined}
                aria-valuemax={onSeek ? localEnd : undefined}
                aria-valuenow={onSeek ? displayProgressMs ?? localStart : undefined}
              >
                <div className="mx-auto h-full w-0.5 bg-white shadow-sm dark:bg-zinc-100" />
              </div>
            )}
            {!readOnly && (
              <>
                <div
                  className="pointer-events-none absolute inset-y-0 w-1 -translate-x-1/2 bg-emerald-500"
                  style={{ left: `${startPct}%` }}
                  role="slider"
                  aria-label="Clip start"
                  aria-valuenow={localStart}
                />
                <div
                  className="pointer-events-none absolute inset-y-0 w-1 -translate-x-1/2 bg-emerald-500"
                  style={{ left: `${endPct}%` }}
                  role="slider"
                  aria-label="Clip end"
                  aria-valuenow={localEnd}
                />
              </>
            )}
          </>
        )}
      </div>

      {(showPlaybackControls || onSeek) && isActivePreview && (
        <div className="mt-2">
          <div
            className={`h-1.5 overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-800 ${
              onSeek ? "cursor-pointer" : ""
            }`}
            onMouseDown={onSeek ? handleProgressBarPointerDown : undefined}
            role={onSeek ? "slider" : undefined}
            aria-label={onSeek ? "Clip playback progress" : undefined}
            aria-valuemin={onSeek ? 0 : undefined}
            aria-valuemax={onSeek ? clipDuration : undefined}
            aria-valuenow={onSeek ? progressInClip : undefined}
          >
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
      {footer && !compact && (
        <div className="-mx-4 -mb-4 mt-4 border-t border-zinc-200 px-4 py-3 dark:border-zinc-800">
          {footer}
        </div>
      )}
    </div>
  );
}
