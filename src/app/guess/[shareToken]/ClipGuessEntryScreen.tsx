"use client";

import { Music2 } from "lucide-react";
import type { GuessProgress } from "@/lib/clip-guess-shared";

interface ClipGuessEntryScreenProps {
  sessionName: string | null;
  progress: GuessProgress | null;
  onStart: () => void;
  loading?: boolean;
}

export function ClipGuessEntryScreen({
  sessionName,
  progress,
  onStart,
  loading = false,
}: ClipGuessEntryScreenProps) {
  const hasSavedProgress = (progress?.guessed ?? 0) > 0;

  return (
    <div className="mx-auto flex min-h-[70vh] w-full max-w-lg items-center px-4 py-12">
      <div className="w-full rounded-2xl border border-border/80 bg-card p-8 shadow-sm shadow-emerald-950/5 dark:shadow-none">
        <div className="text-center">
          <div className="mx-auto mb-4 flex size-14 items-center justify-center rounded-xl bg-emerald-600/10 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-400">
            <Music2 className="size-7" aria-hidden="true" />
          </div>
          <p className="text-xs font-medium uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
            Clip guess
          </p>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight">
            {sessionName ?? "Music bingo"}
          </h1>
        </div>

        <div className="mt-6 space-y-3 text-sm text-muted-foreground">
          <p>
            You will hear short clips from songs in this playlist. Listen carefully, then pick
            which track you think each clip is from.
          </p>
          <p>
            Your progress is saved automatically on this device. You can close the page and come
            back later to pick up where you left off.
          </p>
          {hasSavedProgress && progress ? (
            <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2.5 text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/50 dark:text-emerald-200">
              You have guessed {progress.guessed} of {progress.total} clip
              {progress.total === 1 ? "" : "s"} so far.
            </p>
          ) : null}
        </div>

        <button
          type="button"
          disabled={loading}
          onClick={onStart}
          className="mt-8 w-full rounded-lg bg-emerald-600 py-3 text-sm font-medium text-white transition-colors hover:bg-emerald-700 disabled:opacity-50"
        >
          {loading ? "Loading…" : hasSavedProgress ? "Continue" : "Start"}
        </button>
      </div>
    </div>
  );
}
