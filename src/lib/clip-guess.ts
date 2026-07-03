import { randomBytes } from "crypto";
import { prisma } from "@/lib/db";
import { attachPlaybackRanges } from "@/lib/track-summaries";
import type { ClipGuessAnalytics, GuessChoice, GuessProgress } from "@/lib/clip-guess-shared";

export {
  CLIP_GUESS_GUEST_HEADER,
  guestStorageKey,
  type ClipGuessAnalytics,
  type GuessChoice,
  type GuessProgress,
} from "@/lib/clip-guess-shared";

export function generateGuessShareToken() {
  return randomBytes(24).toString("base64url");
}

export class GuessShareError extends Error {
  constructor(
    message: string,
    public status: 403 | 404 = 404,
  ) {
    super(message);
    this.name = "GuessShareError";
  }
}

const trackClipInclude = {
  proposal: {
    include: {
      versions: {
        include: { createdBy: { select: { name: true, email: true } } },
        orderBy: { createdAt: "desc" as const },
      },
    },
  },
} as const;

export async function resolveGuessShareSession(shareToken: string) {
  const bingoSession = await prisma.bingoSession.findUnique({
    where: { guessShareToken: shareToken },
    select: {
      id: true,
      name: true,
      teamId: true,
      guessShareEnabled: true,
      guessShareToken: true,
      trackClips: {
        orderBy: { position: "asc" },
        include: trackClipInclude,
      },
    },
  });

  if (!bingoSession || !bingoSession.guessShareEnabled || !bingoSession.guessShareToken) {
    throw new GuessShareError("Guess link not found or disabled", 404);
  }

  if (!bingoSession.teamId) {
    throw new GuessShareError("Session has no team for playback", 403);
  }

  return bingoSession;
}

export type GuessClipPlayback = {
  id: string;
  position: number;
  spotifyTrackId: string;
  startMs: number;
  endMs: number;
};

export function buildGuessChoices(
  clips: Array<{ id: string; trackName: string; artistName: string }>,
): GuessChoice[] {
  return clips.map((clip) => ({
    id: clip.id,
    trackName: clip.trackName,
    artistName: clip.artistName,
  }));
}

export function buildGuessClipQueue(
  clips: Array<
    ReturnType<typeof attachPlaybackRanges>[number] & {
      id: string;
      position: number;
      spotifyTrackId: string;
    }
  >,
  guessedClipIds: Set<string>,
): GuessClipPlayback[] {
  return clips
    .filter((clip) => !guessedClipIds.has(clip.id))
    .map((clip) => ({
      id: clip.id,
      position: clip.position,
      spotifyTrackId: clip.spotifyTrackId,
      startMs: clip.playbackStartMs,
      endMs: clip.playbackEndMs,
    }));
}

export function computeGuessProgress(total: number, guessed: number): GuessProgress {
  return {
    total,
    guessed,
    remaining: Math.max(0, total - guessed),
  };
}

export function isCorrectGuess(trackClipId: string, guessedTrackClipId: string) {
  return trackClipId === guessedTrackClipId;
}

export async function loadClipGuessAnalytics(sessionId: string): Promise<ClipGuessAnalytics> {
  const [clips, guesses] = await Promise.all([
    prisma.trackClip.findMany({
      where: { sessionId },
      orderBy: { position: "asc" },
      select: { id: true, position: true, trackName: true, artistName: true },
    }),
    prisma.clipGuess.findMany({
      where: { sessionId },
      select: { guestId: true, trackClipId: true, correct: true },
    }),
  ]);

  const uniqueGuests = new Set(guesses.map((g) => g.guestId)).size;
  const totalGuesses = guesses.length;
  const correctGuesses = guesses.filter((g) => g.correct).length;

  const byClip = new Map<string, { guessCount: number; correctCount: number }>();
  for (const guess of guesses) {
    const existing = byClip.get(guess.trackClipId) ?? { guessCount: 0, correctCount: 0 };
    existing.guessCount += 1;
    if (guess.correct) existing.correctCount += 1;
    byClip.set(guess.trackClipId, existing);
  }

  const perClip = clips.map((clip) => {
    const stats = byClip.get(clip.id) ?? { guessCount: 0, correctCount: 0 };
    return {
      trackClipId: clip.id,
      position: clip.position,
      trackName: clip.trackName,
      artistName: clip.artistName,
      guessCount: stats.guessCount,
      correctCount: stats.correctCount,
      accuracy:
        stats.guessCount > 0 ? stats.correctCount / stats.guessCount : null,
    };
  });

  return {
    uniqueGuests,
    totalGuesses,
    correctGuesses,
    overallAccuracy: totalGuesses > 0 ? correctGuesses / totalGuesses : null,
    perClip,
  };
}

export function enrichSessionClipsForGuess(
  clips: Awaited<ReturnType<typeof resolveGuessShareSession>>["trackClips"],
) {
  return attachPlaybackRanges(clips);
}
