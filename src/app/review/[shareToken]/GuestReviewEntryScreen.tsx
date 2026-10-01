"use client";

import { ClipboardCheck } from "lucide-react";
import type { GuestReviewProgress } from "@/lib/guest-review-shared";

interface GuestReviewEntryScreenProps {
  sessionName: string | null;
  progress: GuestReviewProgress | null;
  guestName: string;
  onGuestNameChange: (name: string) => void;
  onStart: () => void;
  loading?: boolean;
}

export function GuestReviewEntryScreen({
  sessionName,
  progress,
  guestName,
  onGuestNameChange,
  onStart,
  loading = false,
}: GuestReviewEntryScreenProps) {
  const hasSavedProgress = (progress?.reviewed ?? 0) > 0;
  const trimmedName = guestName.trim();
  const canStart = trimmedName.length > 0 && !loading;

  return (
    <div className="mx-auto flex min-h-[70vh] w-full max-w-lg items-center px-4 py-12">
      <div className="w-full rounded-2xl border border-border/80 bg-card p-8 shadow-sm shadow-emerald-950/5 dark:shadow-none">
        <div className="text-center">
          <div className="mx-auto mb-4 flex size-14 items-center justify-center rounded-xl bg-emerald-600/10 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-400">
            <ClipboardCheck className="size-7" aria-hidden="true" />
          </div>
          <p className="text-xs font-medium uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
            Clip review
          </p>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight">
            {sessionName ?? "Music bingo"}
          </h1>
        </div>

        <div className="mt-6 space-y-3 text-sm text-muted-foreground">
          <p>
            Listen to each clip and mark whether it sounds right. You will see the song name,
            artist, and artwork for every track.
          </p>
          <p>If something is off, mark it Not OK and optionally leave a short comment.</p>
          {hasSavedProgress && progress ? (
            <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2.5 text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/50 dark:text-emerald-200">
              You have reviewed {progress.reviewed} of {progress.total} clip
              {progress.total === 1 ? "" : "s"} so far.
            </p>
          ) : null}
        </div>

        <div className="mt-6">
          <label className="block text-sm font-medium" htmlFor="guest-review-first-name">
            First name
          </label>
          <input
            id="guest-review-first-name"
            type="text"
            autoComplete="given-name"
            maxLength={80}
            value={guestName}
            disabled={loading}
            placeholder="Your first name"
            onChange={(event) => onGuestNameChange(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && canStart) onStart();
            }}
            className="mt-1.5 w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm outline-none ring-emerald-600/30 focus:ring-2"
          />
        </div>

        <button
          type="button"
          disabled={!canStart}
          onClick={onStart}
          className="mt-8 w-full rounded-lg bg-emerald-600 py-3 text-sm font-medium text-white transition-colors hover:bg-emerald-700 disabled:opacity-50"
        >
          {loading ? "Loading…" : hasSavedProgress ? "Continue" : "Start reviewing"}
        </button>
      </div>
    </div>
  );
}
