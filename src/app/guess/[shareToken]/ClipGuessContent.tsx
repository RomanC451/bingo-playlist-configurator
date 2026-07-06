"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  CLIP_GUESS_GUEST_HEADER,
  computeTimeToGuessMs,
  type GuessChoice,
  type GuessProgress,
} from "@/lib/clip-guess-shared";
import { useClipGuessGuestId } from "@/hooks/useClipGuessGuest";
import { UploadedAudioRequiredNotice } from "@/components/UploadedAudioRequiredNotice";
import { useClipPlayback } from "@/hooks/useClipPlayback";
import { useDelayedLoading } from "@/hooks/useDelayedLoading";
import { useSimulatedPlaybackProgress } from "@/hooks/useSimulatedPlaybackProgress";
import { playbackItemId } from "@/lib/uploaded-audio";
import { readJsonResponse } from "@/lib/read-json-response";
import { msToLabel } from "@/lib/waveform";
import { SpotifyVolumeSlider } from "@/components/SpotifyVolumeSlider";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ClipPlaybackButtons } from "@/components/WaveformEditor";
import { ClipGuessEntryScreen } from "@/app/guess/[shareToken]/ClipGuessEntryScreen";
import { TutorialWelcomeBanner } from "@/components/tutorial/TutorialWelcomeBanner";

type CurrentClip = {
  id: string;
  position: number;
  clipIndex: number;
  spotifyTrackId: string;
  startMs: number;
  endMs: number;
  hasUploadedAudio: boolean;
};

type GuessAnswer = {
  id: string;
  trackName: string;
  artistName: string;
  albumArtUrl: string | null;
};

type GuestGuess = {
  trackClipId: string;
  guessedTrackClipId: string;
  correct: boolean;
};

function getEncouragementMessage(correct: number, total: number) {
  if (total === 0) return "Thanks for playing!";
  const accuracy = correct / total;
  if (accuracy === 1) return "Perfect score — you did great!";
  if (accuracy >= 0.8) return "You did great!";
  if (accuracy >= 0.6) return "Nice job!";
  if (accuracy >= 0.4) return "Good effort — keep it up!";
  return "Thanks for playing!";
}

function GuessResultsSummary({ guesses }: { guesses: GuestGuess[] }) {
  const correctCount = guesses.filter((guess) => guess.correct).length;
  const total = guesses.length;
  const accuracy = total > 0 ? Math.round((correctCount / total) * 100) : 0;
  return (
    <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-8 dark:border-emerald-900 dark:bg-emerald-950">
      <div className="text-center">
        <h2 className="text-2xl font-semibold text-emerald-800 dark:text-emerald-200">
          {getEncouragementMessage(correctCount, total)}
        </h2>
        <p className="mt-2 text-sm text-emerald-700 dark:text-emerald-300">
          You got {correctCount} of {total} correct ({accuracy}%)
        </p>
      </div>

      <div className="mt-6 grid grid-cols-2 gap-3 text-center">
        <div className="rounded-lg border border-emerald-200/80 bg-white/60 px-4 py-3 dark:border-emerald-800 dark:bg-emerald-950/60">
          <p className="text-2xl font-semibold text-emerald-700 dark:text-emerald-300">
            {correctCount}
          </p>
          <p className="text-xs text-emerald-600 dark:text-emerald-400">Correct</p>
        </div>
        <div className="rounded-lg border border-emerald-200/80 bg-white/60 px-4 py-3 dark:border-emerald-800 dark:bg-emerald-950/60">
          <p className="text-2xl font-semibold text-emerald-700 dark:text-emerald-300">
            {total - correctCount}
          </p>
          <p className="text-xs text-emerald-600 dark:text-emerald-400">Missed</p>
        </div>
      </div>
    </div>
  );
}

interface ClipGuessContentProps {
  shareToken: string;
}

function BlurredMysteryTrack() {
  return (
    <div className="mt-4 flex items-center gap-4">
      <div className="relative size-20 shrink-0 overflow-hidden rounded-lg bg-zinc-200 dark:bg-zinc-800">
        <div
          className="absolute inset-0 bg-gradient-to-br from-emerald-300 via-zinc-400 to-violet-400 blur-md dark:from-emerald-700 dark:via-zinc-600 dark:to-violet-700"
          aria-hidden
        />
        <div className="absolute inset-0 flex items-center justify-center text-zinc-500/80 dark:text-zinc-400/80">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="currentColor"
            className="size-8 blur-[2px]"
            aria-hidden
          >
            <path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z" />
          </svg>
        </div>
      </div>
      <div className="min-w-0 flex-1 select-none">
        <p className="truncate text-lg font-semibold blur-sm">Mystery Track</p>
        <p className="truncate text-sm text-zinc-500 blur-sm">Unknown Artist</p>
      </div>
    </div>
  );
}

export function ClipGuessContent({ shareToken }: ClipGuessContentProps) {
  const [sessionName, setSessionName] = useState<string | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [choices, setChoices] = useState<GuessChoice[]>([]);
  const [currentClip, setCurrentClip] = useState<CurrentClip | null>(null);
  const [progress, setProgress] = useState<GuessProgress | null>(null);
  const [complete, setComplete] = useState(false);
  const [selectedGuess, setSelectedGuess] = useState<string | null>(null);
  const [lastResult, setLastResult] = useState<{
    correct: boolean;
    answer: GuessAnswer | null;
  } | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [initialized, setInitialized] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [clipPhase, setClipPhase] = useState<
    "unplayed" | "playing" | "paused" | "ended"
  >("unplayed");
  const [searchQuery, setSearchQuery] = useState("");
  const [guestGuesses, setGuestGuesses] = useState<GuestGuess[]>([]);
  const [hasStarted, setHasStarted] = useState(false);
  const { loading, begin, end } = useDelayedLoading();
  const autoPlayRequested = useRef<string | null>(null);
  const clipEngagementRef = useRef<{
    clipId: string | null;
    startedAt: number | null;
    replayCount: number;
  }>({
    clipId: null,
    startedAt: null,
    replayCount: 0,
  });

  const guestId = useClipGuessGuestId(shareToken);
  const clipPlayback = useClipPlayback({
    clipId: currentClip?.id ?? null,
    hasUploadedAudio: currentClip?.hasUploadedAudio ?? false,
    shareToken,
    guestId,
  });
  const simulatedPlayback = useSimulatedPlaybackProgress(clipPlayback.playback);

  const filteredChoices = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return choices;
    return choices.filter(
      (choice) =>
        choice.trackName.toLowerCase().includes(query) ||
        choice.artistName.toLowerCase().includes(query),
    );
  }, [choices, searchQuery]);

  const selectedGuessIsValid =
    selectedGuess != null && choices.some((choice) => choice.id === selectedGuess);

  useEffect(() => {
    if (selectedGuess && !choices.some((choice) => choice.id === selectedGuess)) {
      setSelectedGuess(null);
    }
  }, [choices, selectedGuess]);

  useEffect(() => {
    if (!currentClip) return;
    if (clipEngagementRef.current.clipId !== currentClip.id) {
      clipEngagementRef.current = {
        clipId: currentClip.id,
        startedAt: null,
        replayCount: 0,
      };
    }
  }, [currentClip?.id]);

  const loadState = useCallback(async () => {
    if (!guestId) return;

    begin();
    try {
      const res = await fetch(`/api/public/guess/${encodeURIComponent(shareToken)}`, {
        headers: { [CLIP_GUESS_GUEST_HEADER]: guestId },
      });
      const json = await readJsonResponse<{
        session?: { id: string; name: string };
        choices?: GuessChoice[];
        progress?: GuessProgress;
        complete?: boolean;
        current?: CurrentClip | null;
        guesses?: GuestGuess[];
        error?: string;
      }>(res);

      if (!res.ok) {
        setError(json.error ?? "Failed to load guess session");
        setInitialized(true);
        return;
      }

      setSessionName(json.session?.name ?? null);
      setSessionId(json.session?.id ?? null);
      setChoices(json.choices ?? []);
      setProgress(json.progress ?? null);
      setComplete(json.complete ?? false);
      setCurrentClip(json.current ?? null);
      setGuestGuesses(json.guesses ?? []);
      setSelectedGuess(null);
      setLastResult(null);
      setSearchQuery("");
      setError(null);
      setInitialized(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load");
      setInitialized(true);
    } finally {
      end();
    }
  }, [begin, end, guestId, shareToken]);

  useEffect(() => {
    void loadState();
  }, [loadState]);

  const isCurrentTrack =
    simulatedPlayback != null &&
    currentClip != null &&
    simulatedPlayback.item?.id === playbackItemId(currentClip);

  const clipDuration = currentClip ? currentClip.endMs - currentClip.startMs : 1;
  const progressInClip =
    isCurrentTrack && simulatedPlayback.progress_ms != null
      ? Math.min(
          Math.max(0, simulatedPlayback.progress_ms - currentClip.startMs),
          clipDuration,
        )
      : 0;
  const progressPct = Math.min(100, (progressInClip / clipDuration) * 100);

  const startClip = useCallback(
    async (clip: CurrentClip) => {
      if (!clipPlayback.ready) {
        setError(
          clip.hasUploadedAudio
            ? "Uploaded audio playback is not ready."
            : "This clip has no uploaded audio yet.",
        );
        return;
      }

      setError(null);
      try {
        await clipPlayback.playClip(clip.id, clip.startMs, clip.endMs);
        if (clipEngagementRef.current.clipId === clip.id && clipEngagementRef.current.startedAt == null) {
          clipEngagementRef.current.startedAt = Date.now();
        }
        setClipPhase("playing");
      } catch (err) {
        setError(err instanceof Error ? err.message : "Playback failed");
      }
    },
    [clipPlayback],
  );

  const pauseClip = useCallback(async () => {
    await clipPlayback.pause();
    setClipPhase("paused");
  }, [clipPlayback]);

  const resumeClip = useCallback(async () => {
    await clipPlayback.resume();
    setClipPhase("playing");
  }, [clipPlayback]);

  const replayClip = useCallback(async () => {
    if (!currentClip) return;
    if (!clipPlayback.ready) {
      setError(
        currentClip.hasUploadedAudio
          ? "Uploaded audio playback is not ready."
          : "This clip has no uploaded audio yet.",
      );
      return;
    }

    setError(null);
    try {
      await clipPlayback.restartClip(
        currentClip.id,
        currentClip.startMs,
        currentClip.endMs,
      );
      if (clipEngagementRef.current.clipId === currentClip.id) {
        clipEngagementRef.current.replayCount += 1;
      }
      setClipPhase("playing");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Playback failed");
    }
  }, [clipPlayback, currentClip]);

  const handleClipPreview = useCallback(() => {
    if (!currentClip) return;
    if (clipPhase === "paused") {
      void resumeClip();
      return;
    }
    if (clipPhase === "ended") {
      void replayClip();
      return;
    }
    void startClip(currentClip);
  }, [clipPhase, currentClip, replayClip, resumeClip, startClip]);

  useEffect(() => {
    if (!hasStarted || !currentClip || complete || !clipPlayback.ready || lastResult) return;
    if (autoPlayRequested.current === currentClip.id) return;
    autoPlayRequested.current = currentClip.id;
    void startClip(currentClip);
  }, [hasStarted, currentClip, complete, clipPlayback.ready, lastResult, startClip]);

  const handleEntryStart = useCallback(async () => {
    setHasStarted(true);
    if (!currentClip || complete || lastResult || !clipPlayback.ready) {
      return;
    }
    autoPlayRequested.current = currentClip.id;
    await startClip(currentClip);
  }, [clipPlayback.ready, complete, currentClip, lastResult, startClip]);

  useEffect(() => {
    if (clipPhase !== "playing" || clipDuration <= 0) return;
    if (progressInClip >= clipDuration - 150) {
      setClipPhase("ended");
      void clipPlayback.pause();
    }
  }, [clipPhase, progressInClip, clipDuration, clipPlayback]);

  async function submitGuess() {
    if (!guestId || !currentClip || !selectedGuessIsValid || submitting || lastResult) return;

    setSubmitting(true);
    setError(null);
    await clipPlayback.pause();
    setClipPhase("paused");

    try {
      const engagement = clipEngagementRef.current;
      const replayCount =
        engagement.clipId === currentClip.id ? engagement.replayCount : 0;
      const clipDurationMs = currentClip.endMs - currentClip.startMs;
      const elapsedMs =
        engagement.clipId === currentClip.id && engagement.startedAt != null
          ? Math.max(0, Date.now() - engagement.startedAt)
          : 0;
      const timeToGuessMs = computeTimeToGuessMs(replayCount, clipDurationMs, elapsedMs);

      const res = await fetch(`/api/public/guess/${encodeURIComponent(shareToken)}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          [CLIP_GUESS_GUEST_HEADER]: guestId,
        },
        body: JSON.stringify({
          trackClipId: currentClip.id,
          guessedTrackClipId: selectedGuess,
          replayCount,
          timeToGuessMs,
        }),
      });

      const json = await readJsonResponse<{
        correct?: boolean;
        answer?: GuessAnswer | null;
        progress?: GuessProgress;
        complete?: boolean;
        current?: CurrentClip | null;
        guesses?: GuestGuess[];
        error?: string;
      }>(res);

      if (!res.ok) {
        setError(json.error ?? "Failed to submit guess");
        return;
      }

      setLastResult({
        correct: json.correct ?? false,
        answer: json.answer ?? null,
      });
      setProgress(json.progress ?? null);
      setComplete(json.complete ?? false);
      setGuestGuesses(json.guesses ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to submit guess");
    } finally {
      setSubmitting(false);
    }
  }

  function continueToNext() {
    if (!guestId) return;

    void (async () => {
      const res = await fetch(`/api/public/guess/${encodeURIComponent(shareToken)}`, {
        headers: { [CLIP_GUESS_GUEST_HEADER]: guestId },
      });
      const json = await readJsonResponse<{
        choices?: GuessChoice[];
        complete?: boolean;
        current?: CurrentClip | null;
        progress?: GuessProgress;
        guesses?: GuestGuess[];
        error?: string;
      }>(res);

      if (!res.ok) {
        setError(json.error ?? "Failed to load next clip");
        return;
      }

      setChoices(json.choices ?? []);
      setCurrentClip(json.current ?? null);
      setComplete(json.complete ?? false);
      setProgress(json.progress ?? null);
      setGuestGuesses(json.guesses ?? []);
      setSelectedGuess(null);
      setLastResult(null);
      setSearchQuery("");
      setError(null);
      setClipPhase("unplayed");
      autoPlayRequested.current = null;

      const nextClip = json.current ?? null;
      if (nextClip && hasStarted && clipPlayback.ready) {
        autoPlayRequested.current = nextClip.id;
        try {
          await clipPlayback.playClip(nextClip.id, nextClip.startMs, nextClip.endMs);
          setClipPhase("playing");
        } catch (err) {
          setError(err instanceof Error ? err.message : "Playback failed");
        }
      }
    })();
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
      <>
        <TutorialWelcomeBanner tutorialId="clip-guess-guest" />
        <ClipGuessEntryScreen
          sessionName={sessionName}
          progress={progress}
          onStart={() => void handleEntryStart()}
          loading={clipPlayback.actionLoading}
        />
      </>
    );
  }

  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-8">
      <header className="mb-8 text-center" data-tutorial="clip-guess-progress">
        <p className="text-sm font-medium text-emerald-600">Clip guess</p>
        <h1 className="mt-1 text-2xl font-semibold">{sessionName}</h1>
        <p className="mt-2 text-sm text-zinc-500">
          Listen to each clip and pick which song you think it is.
        </p>
      </header>

      {(error || clipPlayback.error) && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-4 text-red-700">
          {error ?? clipPlayback.error}
        </div>
      )}

      {currentClip && !currentClip.hasUploadedAudio ? (
        <div className="mb-4">
          <UploadedAudioRequiredNotice sessionId={sessionId ?? undefined} />
        </div>
      ) : null}

      {complete && !currentClip && !lastResult ? (
        <GuessResultsSummary guesses={guestGuesses} />
      ) : currentClip ? (
        <div className="space-y-6">
          <div
            className="rounded-xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-950"
            data-tutorial="clip-guess-player"
          >
            <p className="text-sm text-zinc-500">
              Clip {currentClip.clipIndex}
              {progress ? ` of ${progress.total}` : ""}
            </p>

            {!lastResult ? (
              <>
                <BlurredMysteryTrack />

                <div className="mt-4 h-2 overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-800">
                  <div
                    className="h-full bg-emerald-500"
                    style={{ width: `${progressPct}%` }}
                  />
                </div>
                <p className="mt-1 text-xs text-zinc-500">
                  {msToLabel(progressInClip)} / {msToLabel(clipDuration)} within clip
                </p>
              </>
            ) : (
              <div
                className={`mt-4 rounded-lg p-4 ${
                  lastResult.correct
                    ? "border border-emerald-200 bg-emerald-50 text-emerald-900 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-100"
                    : "border border-rose-200 bg-rose-50 text-rose-900 dark:border-rose-900 dark:bg-rose-950 dark:text-rose-100"
                }`}
              >
                <p className="font-medium">
                  {lastResult.correct ? "Correct!" : "Not quite"}
                </p>
                {lastResult.answer && (
                  <div className="mt-2 flex items-center gap-3">
                    {lastResult.answer.albumArtUrl && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={lastResult.answer.albumArtUrl}
                        alt=""
                        className="size-12 rounded object-cover"
                      />
                    )}
                    <div>
                      <p className="font-medium">{lastResult.answer.trackName}</p>
                      <p className="text-sm opacity-80">{lastResult.answer.artistName}</p>
                    </div>
                  </div>
                )}
                <button
                  type="button"
                  onClick={continueToNext}
                  className="mt-4 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700"
                >
                  {complete ? "Finish" : "Next clip"}
                </button>
              </div>
            )}

            <div className="mt-4 flex items-center justify-between gap-6">
              {!lastResult ? (
                <ClipPlaybackButtons
                  size="lg"
                  startMs={currentClip.startMs}
                  endMs={currentClip.endMs}
                  isPlaying={clipPhase === "playing"}
                  disabled={clipPlayback.actionLoading || !clipPlayback.ready}
                  onPreview={handleClipPreview}
                  onPause={() => void pauseClip()}
                  onRestart={() => void replayClip()}
                />
              ) : (
                <div />
              )}
              <SpotifyVolumeSlider
                compact
                className="w-28 shrink-0"
                volume={clipPlayback.volume}
                onVolumeChange={clipPlayback.setVolume}
                disabled={!clipPlayback.ready}
              />
            </div>
          </div>

          {!lastResult && (
            <>
              <div
                className="rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950"
                data-tutorial="clip-guess-choices"
              >
                <div className="border-b border-zinc-200 px-4 py-3 dark:border-zinc-800">
                  <p className="text-sm font-medium">Which song is this?</p>
                  <input
                    type="search"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search songs or artists…"
                    className="mt-2 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm placeholder:text-zinc-400 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 dark:border-zinc-700 dark:bg-zinc-900"
                  />
                </div>
                <ScrollArea className="h-80">
                  <ul className="divide-y divide-zinc-100 dark:divide-zinc-800">
                    {filteredChoices.length === 0 ? (
                      <li className="px-4 py-6 text-center text-sm text-zinc-500">
                        No songs match your search.
                      </li>
                    ) : (
                      filteredChoices.map((choice) => {
                        const isSelected = selectedGuess === choice.id;
                        return (
                          <li key={choice.id}>
                            <button
                              type="button"
                              onClick={() => setSelectedGuess(choice.id)}
                              className={`flex w-full items-center gap-3 border-l-2 px-4 py-3 text-left transition-colors ${
                                isSelected
                                  ? "border-emerald-500 bg-emerald-50 dark:bg-emerald-950/40"
                                  : "border-transparent hover:bg-zinc-50 dark:hover:bg-zinc-900"
                              }`}
                            >
                              <span className="min-w-0">
                                <span
                                  className={`block truncate font-medium ${
                                    isSelected ? "text-emerald-700 dark:text-emerald-300" : ""
                                  }`}
                                >
                                  {choice.trackName}
                                </span>
                                <span className="block truncate text-sm text-zinc-500">
                                  {choice.artistName}
                                </span>
                              </span>
                            </button>
                          </li>
                        );
                      })
                    )}
                  </ul>
                </ScrollArea>
              </div>

              <button
                type="button"
                disabled={!selectedGuessIsValid || submitting || !clipPlayback.ready}
                onClick={() => void submitGuess()}
                className="w-full rounded-lg bg-emerald-600 py-3 font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
              >
                {submitting ? "Submitting…" : "Submit guess"}
              </button>
            </>
          )}
        </div>
      ) : null}
    </div>
  );
}
