export const CLIP_GUESS_GUEST_HEADER = "x-clip-guess-guest-id";

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

export type ClipGuessAnalytics = {
  uniqueGuests: number;
  totalGuesses: number;
  correctGuesses: number;
  overallAccuracy: number | null;
  perClip: Array<{
    trackClipId: string;
    position: number;
    trackName: string;
    artistName: string;
    guessCount: number;
    correctCount: number;
    accuracy: number | null;
  }>;
};
