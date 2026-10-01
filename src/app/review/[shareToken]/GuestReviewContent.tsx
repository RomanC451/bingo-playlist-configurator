"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { CheckCircle2, ChevronLeft, ChevronRight } from "lucide-react";
import { ReviewNotOkDialog } from "@/components/ReviewNotOkDialog";
import { SpotifyVolumeSlider } from "@/components/SpotifyVolumeSlider";
import { WaveformEditor, ClipPlaybackButtons } from "@/components/WaveformEditor";
import { useClipPlayback } from "@/hooks/useClipPlayback";
import { useGuestReviewIdentity } from "@/hooks/useGuestReviewIdentity";
import {
  GUEST_REVIEW_GUEST_HEADER,
  guestReviewClipStorageKey,
  type GuestReviewProgress,
  type GuestReviewTrackItem,
} from "@/lib/guest-review-shared";
import { readJsonResponse } from "@/lib/read-json-response";
import { msToLabel } from "@/lib/waveform";
import { GuestReviewEntryScreen } from "./GuestReviewEntryScreen";

interface GuestReviewContentProps {
  shareToken: string;
}

type PublicReviewResponse = {
  session?: { id: string; name: string };
  progress?: GuestReviewProgress;
  complete?: boolean;
  current?: GuestReviewTrackItem | null;
  tracks?: GuestReviewTrackItem[];
  guestName?: string | null;
  error?: string;
};

function GuestReviewCompleteScreen({
  sessionName,
  guestName,
  progress,
  onReviewAgain,
}: {
  sessionName: string | null;
  guestName: string;
  progress: GuestReviewProgress | null;
  onReviewAgain: () => void;
}) {
  const total = progress?.total ?? 0;
  const reviewed = progress?.reviewed ?? total;

  return (
    <div className="mx-auto flex min-h-[70vh] w-full max-w-lg items-center px-4 py-12">
      <div className="w-full rounded-2xl border border-emerald-200 bg-emerald-50 p-8 text-center shadow-sm dark:border-emerald-900 dark:bg-emerald-950">
        <div className="mx-auto mb-4 flex size-14 items-center justify-center rounded-full bg-emerald-600/15 text-emerald-600 dark:text-emerald-400">
          <CheckCircle2 className="size-8" aria-hidden="true" />
        </div>
        <p className="text-xs font-medium uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
          Clip review complete
        </p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight text-emerald-900 dark:text-emerald-100">
          Thanks, {guestName.trim() || "guest"}!
        </h1>
        <p className="mt-2 text-sm text-emerald-800 dark:text-emerald-300">
          {sessionName ? `You finished reviewing “${sessionName}”.` : "You finished reviewing every clip."}
        </p>
        {total > 0 ? (
          <p className="mt-4 text-sm font-medium text-emerald-700 dark:text-emerald-300">
            {reviewed} of {total} clip{total === 1 ? "" : "s"} reviewed
          </p>
        ) : null}
        <button
          type="button"
          onClick={onReviewAgain}
          className="mt-8 w-full rounded-lg border border-emerald-300 bg-white px-4 py-2.5 text-sm font-medium text-emerald-800 transition-colors hover:bg-emerald-100 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-100 dark:hover:bg-emerald-900"
        >
          Review tracks again
        </button>
      </div>
    </div>
  );
}

function readSavedClipId(shareToken: string) {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(guestReviewClipStorageKey(shareToken));
}

function writeSavedClipId(shareToken: string, clipId: string | null) {
  const key = guestReviewClipStorageKey(shareToken);
  if (clipId) localStorage.setItem(key, clipId);
  else localStorage.removeItem(key);
}

function resolveInitialClipId(
  tracks: GuestReviewTrackItem[],
  preferredClipId: string | null,
  queueFirstId: string | null,
) {
  if (preferredClipId && tracks.some((track) => track.id === preferredClipId)) {
    return preferredClipId;
  }
  if (queueFirstId && tracks.some((track) => track.id === queueFirstId)) {
    return queueFirstId;
  }
  return tracks[0]?.id ?? null;
}

export function GuestReviewContent({ shareToken }: GuestReviewContentProps) {
  const { guestId, guestName, setGuestName } = useGuestReviewIdentity(shareToken);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [sessionName, setSessionName] = useState<string | null>(null);
  const [tracks, setTracks] = useState<GuestReviewTrackItem[]>([]);
  const [viewingClipId, setViewingClipId] = useState<string | null>(null);
  const [progress, setProgress] = useState<GuestReviewProgress | null>(null);
  const [complete, setComplete] = useState(false);
  const [hasStarted, setHasStarted] = useState(false);
  const [browsingAfterComplete, setBrowsingAfterComplete] = useState(false);
  const [initialized, setInitialized] = useState(false);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notOkDialogOpen, setNotOkDialogOpen] = useState(false);
  const autoPlayRequested = useRef<string | null>(null);
  const sessionRestored = useRef(false);
  const viewingClipIdRef = useRef<string | null>(null);

  const currentClip = useMemo(
    () => tracks.find((track) => track.id === viewingClipId) ?? null,
    [tracks, viewingClipId],
  );

  const currentIndex = useMemo(() => {
    if (!viewingClipId) return -1;
    return tracks.findIndex((track) => track.id === viewingClipId);
  }, [tracks, viewingClipId]);

  useEffect(() => {
    viewingClipIdRef.current = viewingClipId;
  }, [viewingClipId]);

  const clipPlayback = useClipPlayback({
    clipId: currentClip?.id ?? null,
    hasUploadedAudio: currentClip?.hasUploadedAudio ?? false,
    reviewShareToken: shareToken,
    guestId,
  });
  const isCurrentTrack =
    clipPlayback.playback != null &&
    currentClip != null &&
    clipPlayback.playback.item?.id === currentClip.id;
  const isClipPlaying = isCurrentTrack && !!clipPlayback.playback?.is_playing;

  const selectClip = useCallback(
    (clipId: string | null) => {
      setViewingClipId(clipId);
      viewingClipIdRef.current = clipId;
      writeSavedClipId(shareToken, clipId);
      autoPlayRequested.current = null;
    },
    [shareToken],
  );

  const applyState = useCallback(
    (json: PublicReviewResponse, options?: { preferClipId?: string | null }) => {
      const nextTracks = json.tracks ?? [];
      setSessionId(json.session?.id ?? null);
      setSessionName(json.session?.name ?? null);
      setProgress(json.progress ?? null);
      setComplete(json.complete ?? false);
      setTracks(nextTracks);

      const preferred =
        options?.preferClipId ??
        viewingClipIdRef.current ??
        readSavedClipId(shareToken);
      const nextClipId = resolveInitialClipId(
        nextTracks,
        preferred,
        json.current?.id ?? null,
      );
      setViewingClipId(nextClipId);
      viewingClipIdRef.current = nextClipId;
      writeSavedClipId(shareToken, nextClipId);

      const nextName = json.guestName?.trim();
      if (nextName) {
        setGuestName(nextName);
      }
    },
    [setGuestName, shareToken],
  );

  const loadState = useCallback(async () => {
    if (!guestId) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/public/review/${encodeURIComponent(shareToken)}`, {
        headers: { [GUEST_REVIEW_GUEST_HEADER]: guestId },
      });
      const json = await readJsonResponse<PublicReviewResponse>(res);
      if (!res.ok) {
        setError(json.error ?? "Failed to load review");
        setInitialized(true);
        return;
      }

      if (!sessionRestored.current) {
        sessionRestored.current = true;
        setHasStarted(false);
        setBrowsingAfterComplete(false);
        applyState(json, { preferClipId: readSavedClipId(shareToken) });
      } else {
        applyState(json);
      }
      setError(null);
      setInitialized(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load");
      setInitialized(true);
    } finally {
      setLoading(false);
    }
  }, [applyState, guestId, shareToken]);

  useEffect(() => {
    void loadState();
  }, [loadState]);

  useEffect(() => {
    if (!hasStarted || !currentClip || !clipPlayback.ready) return;
    if (autoPlayRequested.current === currentClip.id) return;
    if (!currentClip.hasUploadedAudio) return;
    autoPlayRequested.current = currentClip.id;
    void clipPlayback.playClip(currentClip.id, currentClip.startMs, currentClip.endMs);
  }, [clipPlayback.ready, clipPlayback.playClip, currentClip, hasStarted]);

  const handleClipSeek = useCallback(
    (positionMs: number) => {
      if (!currentClip || submitting || !clipPlayback.ready) return;
      setError(null);
      void clipPlayback
        .seekClip(positionMs, currentClip.startMs, currentClip.endMs)
        .catch((err) => setError(err instanceof Error ? err.message : "Seek failed"));
    },
    [clipPlayback, currentClip, submitting],
  );

  const goToRelativeTrack = useCallback(
    (delta: number) => {
      if (currentIndex < 0 || tracks.length === 0) return;
      const nextIndex = currentIndex + delta;
      if (nextIndex < 0 || nextIndex >= tracks.length) return;
      void clipPlayback.pause();
      selectClip(tracks[nextIndex]!.id);
    },
    [clipPlayback, currentIndex, selectClip, tracks],
  );

  async function submitVerdict(verdict: "OK" | "NOT_OK", comment = "") {
    if (!guestId || !currentClip) return;
    const trimmedName = guestName.trim();
    if (!trimmedName) {
      setError("Enter your first name to continue");
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      await clipPlayback.pause();
      const res = await fetch(`/api/public/review/${encodeURIComponent(shareToken)}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          [GUEST_REVIEW_GUEST_HEADER]: guestId,
        },
        body: JSON.stringify({
          clipId: currentClip.id,
          verdict,
          comment: verdict === "NOT_OK" ? comment : undefined,
          guestName: trimmedName,
        }),
      });
      const json = await readJsonResponse<PublicReviewResponse>(res);
      if (!res.ok) {
        setError(json.error ?? "Failed to save review");
        return;
      }
      setNotOkDialogOpen(false);

      const nextTracks = json.tracks ?? [];
      const submittedIndex = nextTracks.findIndex((track) => track.id === currentClip.id);
      const nextUnreviewed = nextTracks.find(
        (track, index) => index > submittedIndex && track.review == null,
      );
      const sequentialNext =
        submittedIndex >= 0 && submittedIndex < nextTracks.length - 1
          ? nextTracks[submittedIndex + 1]
          : null;
      const preferClipId = nextUnreviewed?.id ?? sequentialNext?.id ?? currentClip.id;

      applyState(json, { preferClipId });
      if (json.complete) {
        setBrowsingAfterComplete(false);
        void clipPlayback.pause();
      }
      autoPlayRequested.current = null;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save review");
    } finally {
      setSubmitting(false);
    }
  }

  function handleStart() {
    if (!guestName.trim()) {
      setError("Enter your first name to continue");
      return;
    }
    setHasStarted(true);
    setBrowsingAfterComplete(false);
    setError(null);
    if (!viewingClipId && tracks[0]) {
      selectClip(tracks[0].id);
    }
  }

  if (!initialized || loading || !guestId) {
    return (
      <div className="mx-auto w-full max-w-2xl px-4 py-16 text-center text-zinc-500">
        Loading…
      </div>
    );
  }

  if (error && !sessionName) {
    return (
      <div className="mx-auto w-full max-w-2xl px-4 py-16">
        <div className="rounded-lg border border-red-200 bg-red-50 p-6 text-red-700">
          {error}
        </div>
      </div>
    );
  }

  if (!hasStarted) {
    return (
      <GuestReviewEntryScreen
        sessionName={sessionName}
        progress={progress}
        guestName={guestName}
        onGuestNameChange={setGuestName}
        onStart={handleStart}
        loading={clipPlayback.actionLoading}
      />
    );
  }

  if (complete && !browsingAfterComplete) {
    return (
      <GuestReviewCompleteScreen
        sessionName={sessionName}
        guestName={guestName}
        progress={progress}
        onReviewAgain={() => {
          setBrowsingAfterComplete(true);
          if (tracks[0]) {
            selectClip(tracks[0].id);
          }
        }}
      />
    );
  }

  const canGoPrev = currentIndex > 0;
  const canGoNext = currentIndex >= 0 && currentIndex < tracks.length - 1;
  const existingVerdict = currentClip?.review?.verdict ?? null;

  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-8">
      <header className="mb-8 text-center">
        <p className="text-sm font-medium text-emerald-600">Clip review</p>
        <h1 className="mt-1 text-2xl font-semibold">{sessionName}</h1>
        <p className="mt-2 text-sm text-zinc-500">
          Hi {guestName.trim() || "there"} — mark each clip OK or Not OK.
        </p>
      </header>

      {(error || clipPlayback.error) && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-4 text-red-700">
          {error ?? clipPlayback.error}
        </div>
      )}

      {complete ? (
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 dark:border-emerald-900 dark:bg-emerald-950">
          <p className="text-sm text-emerald-800 dark:text-emerald-200">
            All clips are reviewed. You can still change any verdict.
          </p>
          <button
            type="button"
            onClick={() => {
              void clipPlayback.pause();
              setBrowsingAfterComplete(false);
            }}
            className="rounded-lg border border-emerald-300 bg-white px-3 py-1.5 text-sm font-medium text-emerald-800 hover:bg-emerald-100 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-100 dark:hover:bg-emerald-900"
          >
            Back to complete
          </button>
        </div>
      ) : null}

      {currentClip ? (
        <div className="space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-zinc-500">
              Track {currentIndex + 1} of {tracks.length}
              {progress
                ? ` · ${progress.reviewed} reviewed · ${progress.remaining} remaining`
                : ""}
            </p>
            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={!canGoPrev || submitting}
                onClick={() => goToRelativeTrack(-1)}
                className="inline-flex items-center gap-1 rounded-lg border border-zinc-300 px-3 py-1.5 text-sm hover:bg-zinc-50 disabled:opacity-50 dark:border-zinc-700 dark:hover:bg-zinc-900"
              >
                <ChevronLeft className="size-4" aria-hidden="true" />
                Previous
              </button>
              <button
                type="button"
                disabled={!canGoNext || submitting}
                onClick={() => goToRelativeTrack(1)}
                className="inline-flex items-center gap-1 rounded-lg border border-zinc-300 px-3 py-1.5 text-sm hover:bg-zinc-50 disabled:opacity-50 dark:border-zinc-700 dark:hover:bg-zinc-900"
              >
                Next
                <ChevronRight className="size-4" aria-hidden="true" />
              </button>
            </div>
          </div>

          <div className="rounded-xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-950">
            <div className="flex gap-4">
              {currentClip.albumArtUrl ? (
                // eslint-disable-next-line @next/next/no-img-element -- Spotify CDN album art
                <img
                  src={currentClip.albumArtUrl}
                  alt=""
                  className="size-24 shrink-0 rounded-lg object-cover"
                />
              ) : (
                <div className="flex size-24 shrink-0 items-center justify-center rounded-lg bg-zinc-100 text-zinc-400 dark:bg-zinc-900">
                  No art
                </div>
              )}
              <div className="min-w-0">
                <h2 className="text-2xl font-semibold">{currentClip.trackName}</h2>
                <p className="text-zinc-500">{currentClip.artistName}</p>
                <p className="mt-2 text-sm text-zinc-500">
                  Clip: {msToLabel(currentClip.startMs)} – {msToLabel(currentClip.endMs)}
                  {currentClip.playbackSource === "saved" ? (
                    <span className="ml-2 text-emerald-600">Saved clip</span>
                  ) : (
                    <span className="ml-2 text-zinc-400">Default</span>
                  )}
                </p>
                {existingVerdict ? (
                  <p
                    className={`mt-2 text-sm font-medium ${
                      existingVerdict === "OK"
                        ? "text-emerald-600"
                        : "text-rose-600"
                    }`}
                  >
                    Your verdict: {existingVerdict === "OK" ? "OK" : "Not OK"}
                    {currentClip.review?.comment
                      ? ` — ${currentClip.review.comment}`
                      : ""}
                  </p>
                ) : null}
              </div>
            </div>

            {!currentClip.hasUploadedAudio ? (
              <p className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-100">
                This track has no uploaded audio yet, so playback is unavailable.
              </p>
            ) : null}

            <div className="mt-4">
              <WaveformEditor
                readOnly
                compact
                hidePlaybackControls
                clipId={currentClip.id}
                sessionId={sessionId ?? shareToken}
                trackId={currentClip.spotifyTrackId}
                trackName={currentClip.trackName}
                artistName={currentClip.artistName}
                albumArtUrl={currentClip.albumArtUrl}
                durationMs={currentClip.durationMs}
                startMs={currentClip.startMs}
                endMs={currentClip.endMs}
                waveformUrl={`/api/public/review/${encodeURIComponent(shareToken)}/waveform/${encodeURIComponent(currentClip.id)}`}
                playback={clipPlayback.playback}
                onPause={
                  clipPlayback.ready ? () => void clipPlayback.pause() : undefined
                }
                onSeek={clipPlayback.ready ? handleClipSeek : undefined}
              />
            </div>

            <div className="mt-6 flex items-center justify-between gap-6">
              <ClipPlaybackButtons
                size="lg"
                startMs={currentClip.startMs}
                endMs={currentClip.endMs}
                isPlaying={isClipPlaying}
                disabled={
                  submitting ||
                  clipPlayback.actionLoading ||
                  !clipPlayback.ready ||
                  !currentClip.hasUploadedAudio
                }
                onPreview={() =>
                  void clipPlayback.playOrResumeClip(
                    currentClip.id,
                    currentClip.startMs,
                    currentClip.endMs,
                  )
                }
                onPause={() => void clipPlayback.pause()}
                onRestart={() =>
                  void clipPlayback.restartClip(
                    currentClip.id,
                    currentClip.startMs,
                    currentClip.endMs,
                  )
                }
              />
              <SpotifyVolumeSlider
                compact
                className="w-28 shrink-0"
                volume={clipPlayback.volume}
                onVolumeChange={clipPlayback.setVolume}
                disabled={!clipPlayback.ready}
              />
            </div>

            <div className="mt-6 flex justify-center gap-3">
              <button
                type="button"
                disabled={submitting}
                onClick={() => void submitVerdict("OK")}
                className="inline-flex min-w-[6rem] items-center justify-center rounded-lg bg-emerald-600 px-6 py-2 font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
              >
                {existingVerdict === "OK" ? "Keep OK" : "OK"}
              </button>
              <button
                type="button"
                disabled={submitting}
                onClick={() => setNotOkDialogOpen(true)}
                className="inline-flex min-w-[6rem] items-center justify-center rounded-lg bg-rose-600 px-6 py-2 font-medium text-white hover:bg-rose-700 disabled:opacity-50"
              >
                {existingVerdict === "NOT_OK" ? "Edit Not OK" : "Not OK"}
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div className="rounded-xl border border-border p-8 text-center text-muted-foreground">
          No tracks available for review.
        </div>
      )}

      <ReviewNotOkDialog
        open={notOkDialogOpen}
        loading={submitting}
        trackName={currentClip?.trackName}
        onClose={() => setNotOkDialogOpen(false)}
        onSubmit={(comment) => void submitVerdict("NOT_OK", comment)}
      />
    </div>
  );
}
