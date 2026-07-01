"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { Breadcrumb } from "@/components/Breadcrumb";
import { PlaybackPageSkeleton } from "@/components/page-skeletons";
import { ReviewNotOkDialog } from "@/components/ReviewNotOkDialog";
import {
  AllReviewsButton,
  AllReviewsDialog,
  TrackReviewsPanel,
} from "@/components/TrackReviewsPanel";
import {
  ReviewSessionTrackNav,
  ReviewSessionTrackNavSkeleton,
} from "@/components/ReviewSessionTrackNav";
import { TrackPageLayout } from "@/components/TrackPageLayout";
import type { MemberReviewProgress, ReviewTrackListItem } from "@/lib/track-review";
import { isClipReviewBlockedByOther } from "@/lib/track-review";
import { useRecordSessionWork } from "@/hooks/useRecordSessionWork";
import { mergeTrackEditingBy, useSessionTrackLocks } from "@/hooks/useSessionTrackLocks";
import { useDelayedLoading } from "@/hooks/useDelayedLoading";
import { useSimulatedPlaybackProgress } from "@/hooks/useSimulatedPlaybackProgress";
import {
  isPlaybackRateLimited,
  reportPlaybackError,
} from "@/lib/playback-client";
import { readJsonResponse } from "@/lib/read-json-response";
import { isWebPlayerDevice } from "@/lib/spotify-types";
import { msToLabel } from "@/lib/waveform";

interface PlaybackRange {
  source: "saved" | "default";
  editorName?: string;
  versionId?: string;
}

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

interface ReviewSessionContentProps {
  sessionId: string;
}

export function ReviewSessionContent({ sessionId }: ReviewSessionContentProps) {
  useRecordSessionWork(sessionId);
  const { data: authSession } = useSession();
  const currentUserId = authSession?.user?.id ?? null;
  const [sessionName, setSessionName] = useState<string | null>(null);
  const [currentClip, setCurrentClip] = useState<ReviewTrackListItem | null>(null);
  const [trackList, setTrackList] = useState<ReviewTrackListItem[]>([]);
  const [memberProgress, setMemberProgress] = useState<MemberReviewProgress[]>([]);
  const [progress, setProgress] = useState<ReviewProgress | null>(null);
  const [complete, setComplete] = useState(false);
  const [playback, setPlayback] = useState<PlaybackState | null>(null);
  const [devices, setDevices] = useState<Device[]>([]);
  const [initialized, setInitialized] = useState(false);
  const { begin, end } = useDelayedLoading();
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [selectedDeviceId, setSelectedDeviceId] = useState<string>("");
  const [notOkDialogOpen, setNotOkDialogOpen] = useState(false);
  const [allReviewsOpen, setAllReviewsOpen] = useState(false);
  const clipEndPauseRequested = useRef(false);
  const playbackGeneration = useRef(0);
  const clipPlayStartedAt = useRef(0);
  const autoPlayRequested = useRef<string | null>(null);
  const polledLocks = useSessionTrackLocks(sessionId);
  const displayTrackList = useMemo(
    () => mergeTrackEditingBy(trackList, polledLocks),
    [trackList, polledLocks],
  );

  const loadState = useCallback(async (options?: { silent?: boolean }) => {
    if (!options?.silent) begin();

    try {
      const res = await fetch(`/api/sessions/${sessionId}/review`);
      const json = await readJsonResponse<{
        session?: { id: string; name: string };
        complete?: boolean;
        progress?: ReviewProgress;
        current?: { id: string } | null;
        tracks?: ReviewTrackListItem[];
        members?: MemberReviewProgress[];
        playback?: PlaybackState | null;
        devices?: Device[];
        error?: string;
      }>(res);

      if (!res.ok) {
        const message = reportPlaybackError(
          res,
          json,
          "Failed to load review",
          { toast: !options?.silent },
        );
        if (!options?.silent) setError(message);
        if (!options?.silent) setInitialized(true);
        return;
      }

      setSessionName(json.session?.name ?? null);
      setComplete(json.complete ?? false);
      setProgress(json.progress ?? null);
      const tracks = json.tracks ?? [];
      setTrackList(tracks);
      setCurrentClip(resolveCurrentTrack(json.current, tracks));
      setMemberProgress(json.members ?? []);
      setPlayback(json.playback ?? null);
      const deviceList = json.devices ?? [];
      setDevices(deviceList);

      const deviceIds = new Set(deviceList.map((d) => d.id));
      setSelectedDeviceId((prev) => {
        if (
          prev &&
          deviceIds.has(prev) &&
          !isWebPlayerDevice(deviceList.find((d) => d.id === prev)?.name ?? "")
        ) {
          return prev;
        }
        const preferred =
          deviceList.find((d) => !isWebPlayerDevice(d.name) && d.is_active) ??
          deviceList.find((d) => !isWebPlayerDevice(d.name));
        return preferred?.id ?? "";
      });

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

  const connectDevices = devices.filter((d) => !isWebPlayerDevice(d.name));
  const effectiveDeviceId =
    (selectedDeviceId && connectDevices.some((d) => d.id === selectedDeviceId)
      ? selectedDeviceId
      : connectDevices.find((d) => d.is_active)?.id) ??
    connectDevices[0]?.id ??
    "";
  const noConnectDevice = connectDevices.length === 0;

  const simulatedPlayback = useSimulatedPlaybackProgress(playback);

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

  useEffect(() => {
    clipEndPauseRequested.current = false;
  }, [currentClip?.id]);

  useEffect(() => {
    if (
      actionLoading ||
      !isCurrentTrack ||
      !simulatedPlayback?.is_playing ||
      simulatedPlayback.progress_ms == null ||
      clipEndPauseRequested.current ||
      !currentClip
    ) {
      return;
    }

    const msPastEnd = simulatedPlayback.progress_ms - currentClip.endMs;
    const msSincePlayStart = Date.now() - clipPlayStartedAt.current;

    if (
      msSincePlayStart < 5000 ||
      msPastEnd < 0 ||
      msPastEnd > 3000 ||
      simulatedPlayback.progress_ms < currentClip.startMs
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
            clipId: currentClip.id,
            deviceId: effectiveDeviceId || undefined,
            action: "pause",
          }),
        });
        const json = await readJsonResponse<{ error?: string }>(res);
        if (generationAtTrigger !== playbackGeneration.current) return;
        if (!res.ok) {
          reportPlaybackError(res, json, "Pause failed");
          clipEndPauseRequested.current = false;
          return;
        }
        const playerRes = await fetch(`/api/playback/${sessionId}?scope=player`);
        const playerJson = await readJsonResponse<{ playback?: PlaybackState }>(playerRes);
        if (playerRes.ok && playerJson.playback) {
          setPlayback(playerJson.playback);
        }
      } catch {
        if (generationAtTrigger === playbackGeneration.current) {
          clipEndPauseRequested.current = false;
        }
      }
    })();
  }, [
    isCurrentTrack,
    simulatedPlayback?.is_playing,
    simulatedPlayback?.progress_ms,
    currentClip,
    sessionId,
    effectiveDeviceId,
    actionLoading,
  ]);

  async function playClip(clipId: string) {
    if (isPlaybackRateLimited()) {
      setError("Spotify is rate-limited. Wait a moment, then press Replay.");
      return;
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
        }),
      });
      const json = await readJsonResponse<{ error?: string; playback?: PlaybackState }>(res);
      if (!res.ok) {
        setError(reportPlaybackError(res, json, "Playback failed"));
        return;
      }
      if (json.playback) {
        setPlayback(json.playback);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Playback failed");
    } finally {
      setActionLoading(false);
    }
  }

  useEffect(() => {
    if (!currentClip || complete || noConnectDevice || !effectiveDeviceId) return;
    if (autoPlayRequested.current === currentClip.id) return;
    autoPlayRequested.current = currentClip.id;
    void playClip(currentClip.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- play when clip or device becomes available
  }, [currentClip?.id, complete, noConnectDevice, effectiveDeviceId]);

  async function submitVerdict(verdict: "OK" | "NOT_OK", comment?: string) {
    if (!currentClip || actionLoading) return;

    setActionLoading(true);
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
      setCurrentClip(resolveCurrentTrack(json.current, tracks));
      setMemberProgress(json.members ?? []);
      setNotOkDialogOpen(false);
      autoPlayRequested.current = null;

      if (json.current) {
        await playClip(json.current.id);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save review");
    } finally {
      setActionLoading(false);
    }
  }

  async function togglePlayPause() {
    if (!currentClip || actionLoading) return;

    if (isClipPlaying) {
      playbackGeneration.current += 1;
      clipEndPauseRequested.current = true;
      setActionLoading(true);
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
        if (!res.ok) {
          setError(reportPlaybackError(res, json, "Pause failed"));
          return;
        }
        const playerRes = await fetch(`/api/playback/${sessionId}?scope=player`);
        const playerJson = await readJsonResponse<{ playback?: PlaybackState }>(playerRes);
        if (playerRes.ok && playerJson.playback) {
          setPlayback(playerJson.playback);
        }
      } finally {
        setActionLoading(false);
      }
    } else {
      await playClip(currentClip.id);
    }
  }

  async function selectTrack(track: ReviewTrackListItem) {
    if (isClipReviewBlockedByOther(track.id, polledLocks, currentUserId)) {
      return;
    }
    setComplete(false);
    setCurrentClip(track);
    autoPlayRequested.current = null;
    await playClip(track.id);
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
      <Breadcrumb
        className="mb-4"
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

      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Review clips</h1>
          <p className="mt-1 text-sm text-zinc-500">
            Listen to each clip and mark it OK or Not OK. Your review advances automatically.
          </p>
        </div>
        <AllReviewsButton
          members={memberProgress}
          currentUserId={currentUserId}
          onClick={() => setAllReviewsOpen(true)}
        />
      </div>

      <div className="mt-8 space-y-6">
        {noConnectDevice && (
          <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-red-900 dark:border-red-900 dark:bg-red-950 dark:text-red-100">
            <p className="font-medium">No Spotify Connect device found</p>
            <p className="mt-1 text-sm">
              Open the Spotify desktop or mobile app, then refresh this page.
            </p>
          </div>
        )}

        {!noConnectDevice && !effectiveDeviceId && (
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-amber-900 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-100">
            <p className="font-medium">No active Spotify device</p>
            <p className="mt-1 text-sm">
              Open Spotify on your phone, computer, or speaker, then return here.
            </p>
          </div>
        )}

        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-red-700">
            {error}
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
              <label className="text-sm text-zinc-600 dark:text-zinc-400">
                Device
                <select
                  value={effectiveDeviceId}
                  onChange={(e) => setSelectedDeviceId(e.target.value)}
                  className="ml-2 rounded border border-zinc-300 bg-white px-2 py-1 dark:border-zinc-700 dark:bg-zinc-900"
                >
                  {connectDevices.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name} {d.is_active ? "(active)" : ""}
                    </option>
                  ))}
                </select>
              </label>
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
                  disabled={actionLoading}
                  onClick={togglePlayPause}
                  className="rounded-lg border border-zinc-300 px-4 py-2 disabled:opacity-50 dark:border-zinc-700"
                >
                  {isClipPlaying ? "Pause" : "Replay"}
                </button>
                <button
                  type="button"
                  disabled={actionLoading}
                  onClick={() => void submitVerdict("OK")}
                  className="inline-flex min-w-[6rem] items-center justify-center rounded-lg bg-emerald-600 px-6 py-2 font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
                >
                  OK
                </button>
                <button
                  type="button"
                  disabled={actionLoading}
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
    </div>
    </TrackPageLayout>
  );
}
