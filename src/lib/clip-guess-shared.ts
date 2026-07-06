export const CLIP_GUESS_GUEST_HEADER = "x-clip-guess-guest-id";
export const CLIP_GUESS_GUEST_QUERY_PARAM = "guest";

export function guestStorageKey(shareToken: string) {
  return `clip-guess-guest-id:${shareToken}`;
}

export type GuessChoice = {
  id: string;
  trackName: string;
  artistName: string;
};

export type GuessProgress = {
  guessed: number;
  remaining: number;
  total: number;
};

export type GuessMetricSummary = {
  min: number | null;
  max: number | null;
  average: number | null;
};

export type ClipGuessAnalytics = {
  uniqueGuests: number;
  totalGuesses: number;
  correctGuesses: number;
  overallAccuracy: number | null;
  replays: GuessMetricSummary;
  correctGuessTimeMs: GuessMetricSummary;
  perClip: Array<{
    trackClipId: string;
    position: number;
    trackName: string;
    artistName: string;
    guessCount: number;
    correctCount: number;
    accuracy: number | null;
    replays: GuessMetricSummary;
    correctGuessTimeMs: GuessMetricSummary;
  }>;
};

export function computeTimeToGuessMs(
  replayCount: number,
  clipDurationMs: number,
  elapsedMs: number,
): number {
  if (replayCount > 0) {
    return clipDurationMs;
  }

  return Math.min(Math.max(0, elapsedMs), clipDurationMs);
}
