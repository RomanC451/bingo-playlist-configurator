"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { Breadcrumb } from "@/components/Breadcrumb";
import { BreadcrumbRow } from "@/components/BreadcrumbRow";
import { PlaybackPageSkeleton } from "@/components/page-skeletons";
import { ReviewNotOkDialog } from "@/components/ReviewNotOkDialog";
import {
  AllReviewsButton,
  AllReviewsDialog,
  TrackReviewsPanel,
} from "@/components/TrackReviewsPanel";
import {
  ReviewSessionTrackNav,
  ReviewSessionTrackNavMobile,
  ReviewSessionTrackNavSkeleton,
  ReviewSessionTrackNavTrigger,
} from "@/components/ReviewSessionTrackNav";
import { TrackPageLayout } from "@/components/TrackPageLayout";
import { SpotifyWebPlaybackGate, useSpotifyWebPlaybackStatus } from "@/components/SpotifyWebPlaybackGate";
import { SpotifyVolumeSlider } from "@/components/SpotifyVolumeSlider";
import type { MemberReviewProgress, ReviewTrackListItem } from "@/lib/track-review";
import { isClipReviewBlockedByOther } from "@/lib/track-review";
import { useRecordSessionWork } from "@/hooks/useRecordSessionWork";
import { mergeTrackEditingBy, useSessionTrackLocks } from "@/hooks/useSessionTrackLocks";
import { useDelayedLoading } from "@/hooks/useDelayedLoading";
import { useSimulatedPlaybackProgress } from "@/hooks/useSimulatedPlaybackProgress";
import { useSpotifyWebPlayer } from "@/hooks/useSpotifyWebPlayer";
import { readJsonResponse } from "@/lib/read-json-response";
import { msToLabel } from "@/lib/waveform";

interface ReviewProgress {
  reviewed: number;
  remaining: number;
  total: number;
}

function resolveCurrentTrack(
  current: { id: string } | null | undefined,
  tracks: ReviewTrackListItem[],
): ReviewTrackListItem | null {
  if (!current?.id) return null;
  return tracks.find((track) => track.id === current.id) ?? null;
}

interface ReviewSessionContentProps {
  sessionId: string;
}

export function ReviewSessionContent({ sessionId }: ReviewSessionContentProps) {
  useRecordSessionWork(sessionId);
  const { data: authSession } = useSession();
  const currentUserId = authSession?.user?.id ?? null;
  const [sessionName, setSessionName] = useState<string | null>(null);
  const [teamId, setTeamId] = useState<string | null>(null);
  const [currentClip, setCurrentClip] = useState<ReviewTrackListItem | null>(null);
  const [trackList, setTrackList] = useState<ReviewTrackListItem[]>([]);
  const [memberProgress, setMemberProgress] = useState<MemberReviewProgress[]>([]);
  const [progress, setProgress] = useState<ReviewProgress | null>(null);
  const [complete, setComplete] = useState(false);
  const [initialized, setInitialized] = useState(false);
  const { begin, end } = useDelayedLoading();
  const [error, setError] = useState<string | null>(null);
  const [notOkDialogOpen, setNotOkDialogOpen] = useState(false);
  const [allReviewsOpen, setAllReviewsOpen] = useState(false);
  const [tracksSheetOpen, setTracksSheetOpen] = useState(false);
  const autoPlayRequested = useRef<string | null>(null);
  const polledLocks = useSessionTrackLocks(sessionId);
  const displayTrackList = useMemo(
    () => mergeTrackEditingBy(trackList, polledLocks),
    [trackList, polledLocks],
  );

  const { webPlaybackReady } = useSpotifyWebPlaybackStatus(teamId);
  const webPlayer = useSpotifyWebPlayer(teamId, webPlaybackReady);
  const simulatedPlayback = useSimulatedPlaybackProgress(webPlayer.playback);
  const actionLoading = webPlayer.actionLoading;

  const loadState = useCallback(async (options?: { silent?: boolean }) => {
    if (!options?.silent) begin();

    try {
      const res = await fetch(`/api/sessions/${sessionId}/review`);
      const json = await readJsonResponse<{
        session?: { id: string; name: string; teamId?: string };
        complete?: boolean;
        progress?: ReviewProgress;
        current?: { id: string } | null;
        tracks?: ReviewTrackListItem[];
        members?: MemberReviewProgress[];
        error?: string;
      }>(res);

      if (!res.ok) {
        if (!options?.silent) {
          setError(json.error ?? "Failed to load review");
          setInitialized(true);
        }
        return;
      }

      setSessionName(json.session?.name ?? null);
      setTeamId(json.session?.teamId ?? null);
      setComplete(json.complete ?? false);
      setProgress(json.progress ?? null);
      const tracks = json.tracks ?? [];
      setTrackList(tracks);
      setCurrentClip(resolveCurrentTrack(json.current, tracks));
      setMemberProgress(json.members ?? []);

      if (!options?.silent) setError(null);
      if (!options?.silent) setInitialized(true);
    } catch (err) {
      if (!options?.silent) {
        setError(err instanceof Error ? err.message : "Failed to load");
        setInitialized(true);
      }
    } finally {
      if (!options?.silent) end();
    }
  }, [begin, end, sessionId]);

  useEffect(() => {
    void loadState();
  }, [loadState]);

  useEffect(() => {
    if (!currentClip || !currentUserId) return;

    const current = displayTrackList.find((track) => track.id === currentClip.id);
    if (!current || !isClipReviewBlockedByOther(current.id, polledLocks, currentUserId)) {
      return;
    }

    const next =
      displayTrackList.find(
        (track) =>
          !isClipReviewBlockedByOther(track.id, polledLocks, currentUserId) &&
          track.reviewStatus === "pending",
      ) ??
      displayTrackList.find(
        (track) => !isClipReviewBlockedByOther(track.id, polledLocks, currentUserId),
      );

    if (next && next.id !== currentClip.id) {
      setCurrentClip(next);
      autoPlayRequested.current = null;
    }
  }, [currentClip, currentUserId, displayTrackList, polledLocks]);

  const isCurrentTrack =
    simulatedPlayback != null &&
    currentClip != null &&
    simulatedPlayback.item?.id === currentClip.spotifyTrackId;

  const clipDuration = currentClip ? currentClip.endMs - currentClip.startMs : 1;
  const progressInClip =
    isCurrentTrack && simulatedPlayback.progress_ms != null
      ? Math.min(
          Math.max(0, simulatedPlayback.progress_ms - currentClip.startMs),
          clipDuration,
        )
      : 0;
  const progressPct = Math.min(100, (progressInClip / clipDuration) * 100);
  const isClipPlaying = isCurrentTrack && !!simulatedPlayback?.is_playing;

  const playClip = useCallback(
    async (clip: ReviewTrackListItem) => {
      if (!webPlaybackReady) {
        setError("In-browser Spotify preview is not ready for this team.");
        return;
      }

      setError(null);
      try {
        await webPlayer.playClip(clip.spotifyTrackId, clip.startMs, clip.endMs);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Playback failed");
      }
    },
    [webPlaybackReady, webPlayer],
  );

  useEffect(() => {
    if (!currentClip || complete || !webPlaybackReady) return;
    if (autoPlayRequested.current === currentClip.id) return;
    autoPlayRequested.current = currentClip.id;
    void playClip(currentClip);
  }, [currentClip, complete, webPlaybackReady, playClip]);

  async function submitVerdict(verdict: "OK" | "NOT_OK", comment?: string) {
    if (!currentClip || actionLoading) return;

    setError(null);
    try {
      const res = await fetch(`/api/sessions/${sessionId}/review`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clipId: currentClip.id,
          verdict,
          ...(comment ? { comment } : {}),
        }),
      });
      const json = await readJsonResponse<{
        error?: string;
        complete?: boolean;
        progress?: ReviewProgress;
        current?: { id: string } | null;
        tracks?: ReviewTrackListItem[];
        members?: MemberReviewProgress[];
      }>(res);

      if (!res.ok) {
        setError(json.error ?? "Failed to save review");
        return;
      }

      setComplete(json.complete ?? false);
      setProgress(json.progress ?? null);
      const tracks = json.tracks ?? [];
      setTrackList(tracks);
      const nextClip = resolveCurrentTrack(json.current, tracks);
      setCurrentClip(nextClip);
      setMemberProgress(json.members ?? []);
      setNotOkDialogOpen(false);
      autoPlayRequested.current = null;

      if (nextClip) {
        await playClip(nextClip);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save review");
    }
  }

  async function togglePlayPause() {
    if (!currentClip || actionLoading) return;

    if (isClipPlaying) {
      await webPlayer.pause();
    } else {
      await playClip(currentClip);
    }
  }

  async function selectTrack(track: ReviewTrackListItem) {
    if (isClipReviewBlockedByOther(track.id, polledLocks, currentUserId)) {
      return;
    }
    setComplete(false);
    setCurrentClip(track);
    autoPlayRequested.current = null;
    await playClip(track);
  }

  const trackNav =
    displayTrackList.length > 0 ? (
      <ReviewSessionTrackNav
        currentTrackId={currentClip?.id}
        currentUserId={currentUserId}
        tracks={displayTrackList}
        onSelectTrack={(track) => void selectTrack(track)}
      />
    ) : !initialized ? (
      <ReviewSessionTrackNavSkeleton />
    ) : null;

  if (!initialized) {
    return (
      <TrackPageLayout nav={trackNav} constrainContent>
        <PlaybackPageSkeleton />
      </TrackPageLayout>
    );
  }

  return (
    <TrackPageLayout nav={trackNav} constrainContent>
    <div>
      <BreadcrumbRow
        className="mb-4"
        breadcrumb={
          <Breadcrumb
            items={[
              { label: "Bingo sessions", href: "/sessions" },
              {
                label: sessionName ?? "Session",
                href: `/sessions/${sessionId}/edit`,
                skeleton: !sessionName,
              },
              { label: "Review clips" },
            ]}
          />
        }
        action={
          <AllReviewsButton
            members={memberProgress}
            currentUserId={currentUserId}
            onClick={() => setAllReviewsOpen(true)}
          />
        }
      />

      <div className="min-w-0">
        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
          <h1 className="text-2xl font-semibold">Review clips</h1>
          <SpotifyVolumeSlider
            compact
            volume={webPlayer.volume}
            onVolumeChange={webPlayer.setVolume}
            disabled={!webPlaybackReady}
          />
        </div>
        <p className="mt-1 text-sm text-zinc-500">
          Listen to each clip and mark it OK or Not OK. Your review advances automatically.
        </p>
        <div className="mt-3">
          <ReviewSessionTrackNavTrigger
            tracks={displayTrackList}
            open={tracksSheetOpen}
            onOpen={() => setTracksSheetOpen(true)}
          />
        </div>
      </div>

      <div className="mt-8 space-y-6">
        <SpotifyWebPlaybackGate teamId={teamId}>
      <div className="space-y-6">
        {(error || webPlayer.error) && (
          <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-red-700">
            {error ?? webPlayer.error}
          </div>
        )}

        {complete && !currentClip ? (
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-8 text-center dark:border-emerald-900 dark:bg-emerald-950">
            <h2 className="text-xl font-semibold text-emerald-800 dark:text-emerald-200">
              All clips reviewed
            </h2>
            <p className="mt-2 text-sm text-emerald-700 dark:text-emerald-300">
              You&apos;ve reviewed all tracks for their current clip versions.
              {progress && progress.total > 0
                ? ` (${progress.reviewed} of ${progress.total})`
                : ""}
              {" "}Select a track on the left to listen again.
            </p>
            <Link
              href={`/sessions/${sessionId}/edit`}
              className="mt-6 inline-flex rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700"
            >
              Back to session
            </Link>
          </div>
        ) : currentClip ? (
          <>
            <div className="flex items-center gap-4">
              {progress && (
                <p className="text-sm text-zinc-500">
                  {progress.remaining} remaining · {progress.reviewed} reviewed ·{" "}
                  {progress.total} total
                </p>
              )}
            </div>

            <div className="rounded-xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-950">
              <h2 className="text-2xl font-semibold">{currentClip.trackName}</h2>
              <p className="text-zinc-500">{currentClip.artistName}</p>
              <p className="mt-2 text-sm text-zinc-500">
                Clip: {msToLabel(currentClip.startMs)} – {msToLabel(currentClip.endMs)}
                {currentClip.playbackRange?.source === "saved" && (
                  <span className="ml-2 text-emerald-600">
                    Saved clip · {currentClip.playbackRange.editorName}
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
                  disabled={actionLoading || !webPlaybackReady}
                  onClick={() => void togglePlayPause()}
                  className="rounded-lg border border-zinc-300 px-4 py-2 disabled:opacity-50 dark:border-zinc-700"
                >
                  {isClipPlaying ? "Pause" : "Replay"}
                </button>
                <button
                  type="button"
                  disabled={actionLoading || !webPlaybackReady}
                  onClick={() => void submitVerdict("OK")}
                  className="inline-flex min-w-[6rem] items-center justify-center rounded-lg bg-emerald-600 px-6 py-2 font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
                >
                  OK
                </button>
                <button
                  type="button"
                  disabled={actionLoading || !webPlaybackReady}
                  onClick={() => setNotOkDialogOpen(true)}
                  className="inline-flex min-w-[6rem] items-center justify-center rounded-lg bg-rose-600 px-6 py-2 font-medium text-white hover:bg-rose-700 disabled:opacity-50"
                >
                  Not OK
                </button>
              </div>
            </div>

            <TrackReviewsPanel
              track={currentClip}
              currentUserId={currentUserId}
            />
          </>
        ) : (
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-amber-800">
            No tracks to review.{" "}
            <Link href={`/sessions/${sessionId}/edit`} className="underline">
              Back to session
            </Link>
          </div>
        )}

        <Link
          href={`/sessions/${sessionId}/edit`}
          className="text-sm text-emerald-600 hover:underline"
        >
          Back to editor
        </Link>
      </div>
      </SpotifyWebPlaybackGate>
      </div>

      <ReviewNotOkDialog
        open={notOkDialogOpen}
        loading={actionLoading}
        trackName={currentClip?.trackName}
        onClose={() => setNotOkDialogOpen(false)}
        onSubmit={(comment) => void submitVerdict("NOT_OK", comment || undefined)}
      />

      <AllReviewsDialog
        open={allReviewsOpen}
        members={memberProgress}
        currentUserId={currentUserId}
        onClose={() => setAllReviewsOpen(false)}
      />

      <ReviewSessionTrackNavMobile
        tracks={displayTrackList}
        currentTrackId={currentClip?.id}
        currentUserId={currentUserId}
        open={tracksSheetOpen}
        onOpenChange={setTracksSheetOpen}
        onSelectTrack={(track) => void selectTrack(track)}
      />
    </div>
    </TrackPageLayout>
  );
}
