"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ReviewNotOkDialog } from "@/components/ReviewNotOkDialog";
import { SpotifyVolumeSlider } from "@/components/SpotifyVolumeSlider";
import { ClipPlaybackButtons } from "@/components/WaveformEditor";
import { useClipPlayback } from "@/hooks/useClipPlayback";
import { useGuestReviewIdentity } from "@/hooks/useGuestReviewIdentity";
import { useSimulatedPlaybackProgress } from "@/hooks/useSimulatedPlaybackProgress";
import {
  GUEST_REVIEW_GUEST_HEADER,
  type GuestReviewClip,
  type GuestReviewProgress,
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
  current?: GuestReviewClip | null;
  guestName?: string | null;
  error?: string;
};

export function GuestReviewContent({ shareToken }: GuestReviewContentProps) {
  const { guestId, guestName, setGuestName } = useGuestReviewIdentity(shareToken);
  const [sessionName, setSessionName] = useState<string | null>(null);
  const [currentClip, setCurrentClip] = useState<GuestReviewClip | null>(null);
  const [progress, setProgress] = useState<GuestReviewProgress | null>(null);
  const [complete, setComplete] = useState(false);
  const [hasStarted, setHasStarted] = useState(false);
  const [initialized, setInitialized] = useState(false);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notOkDialogOpen, setNotOkDialogOpen] = useState(false);
  const autoPlayRequested = useRef<string | null>(null);

  const clipPlayback = useClipPlayback({
    clipId: currentClip?.id ?? null,
    hasUploadedAudio: currentClip?.hasUploadedAudio ?? false,
    reviewShareToken: shareToken,
    guestId,
  });
  const playback = useSimulatedPlaybackProgress(clipPlayback.playback);
  const isClipPlaying =
    !!playback?.is_playing && playback.item?.id === currentClip?.id;

  const applyState = useCallback((json: PublicReviewResponse) => {
    setSessionName(json.session?.name ?? null);
    setProgress(json.progress ?? null);
    setComplete(json.complete ?? false);
    setCurrentClip(json.current ?? null);
    if (json.guestName) {
      setGuestName(json.guestName);
    }
  }, [setGuestName]);

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
      applyState(json);
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
      applyState(json);
      autoPlayRequested.current = null;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save review");
    } finally {
      setSubmitting(false);
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

  if (!complete && !hasStarted) {
    return (
      <GuestReviewEntryScreen
        sessionName={sessionName}
        progress={progress}
        guestName={guestName}
        onGuestNameChange={setGuestName}
        onStart={() => {
          if (!guestName.trim()) {
            setError("Enter your first name to continue");
            return;
          }
          setHasStarted(true);
          setError(null);
        }}
        loading={clipPlayback.actionLoading}
      />
    );
  }

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

      {complete && !currentClip ? (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-8 text-center dark:border-emerald-900 dark:bg-emerald-950">
          <h2 className="text-xl font-semibold text-emerald-800 dark:text-emerald-200">
            Thanks, {guestName.trim() || "guest"}!
          </h2>
          <p className="mt-2 text-sm text-emerald-700 dark:text-emerald-300">
            You reviewed every clip
            {progress && progress.total > 0 ? ` (${progress.reviewed} of ${progress.total})` : ""}.
          </p>
        </div>
      ) : currentClip ? (
        <div className="space-y-6">
          {progress ? (
            <p className="text-sm text-zinc-500">
              {progress.remaining} remaining · {progress.reviewed} reviewed · {progress.total}{" "}
              total
            </p>
          ) : null}

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
              </div>
            </div>

            {!currentClip.hasUploadedAudio ? (
              <p className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-100">
                This track has no uploaded audio yet, so playback is unavailable.
              </p>
            ) : null}

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
                OK
              </button>
              <button
                type="button"
                disabled={submitting}
                onClick={() => setNotOkDialogOpen(true)}
                className="inline-flex min-w-[6rem] items-center justify-center rounded-lg bg-rose-600 px-6 py-2 font-medium text-white hover:bg-rose-700 disabled:opacity-50"
              >
                Not OK
              </button>
            </div>
          </div>
        </div>
      ) : null}

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
