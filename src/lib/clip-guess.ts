import { randomBytes, createHash } from "crypto";
import { prisma } from "@/lib/db";
import { attachPlaybackRanges } from "@/lib/track-summaries";
import { hasUploadedAudio } from "@/lib/uploaded-audio";
import type { ClipGuessAnalytics, GuessChoice, GuessMetricSummary, GuessProgress } from "@/lib/clip-guess-shared";

export {
  CLIP_GUESS_GUEST_HEADER,
  guestStorageKey,
  type ClipGuessAnalytics,
  type GuessChoice,
  type GuessMetricSummary,
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
  hasUploadedAudio: boolean;
};

export const GUESS_CHOICE_DISTRACTOR_COUNT = 23;

export function buildGuessChoices(
  clips: Array<{ id: string; trackName: string; artistName: string }>,
): GuessChoice[] {
  return clips.map((clip) => ({
    id: clip.id,
    trackName: clip.trackName,
    artistName: clip.artistName,
  }));
}

function hashSeed(...parts: string[]): number {
  const hash = createHash("sha256").update(parts.join(":")).digest();
  return hash.readUInt32BE(0);
}

function mulberry32(seed: number) {
  let state = seed;
  return () => {
    state |= 0;
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function seededShuffle<T>(items: T[], seed: string): T[] {
  const random = mulberry32(hashSeed(seed));
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

export function buildGuessChoicesForClip(
  clips: Array<{ id: string; trackName: string; artistName: string }>,
  currentClipId: string,
  guestId: string,
): GuessChoice[] {
  const currentClip = clips.find((clip) => clip.id === currentClipId);
  if (!currentClip) {
    return [];
  }

  const otherClips = clips.filter((clip) => clip.id !== currentClipId);
  const distractorCount = Math.min(GUESS_CHOICE_DISTRACTOR_COUNT, otherClips.length);
  const distractors = seededShuffle(
    otherClips,
    `${guestId}:${currentClipId}:distractors`,
  ).slice(0, distractorCount);

  return seededShuffle(
    [currentClip, ...distractors],
    `${guestId}:${currentClipId}:choices`,
  ).map((clip) => ({
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
      uploadedAudioKey?: string | null;
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
      hasUploadedAudio: hasUploadedAudio(clip),
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

export function summarizeGuessMetrics(values: number[]): GuessMetricSummary {
  if (values.length === 0) {
    return { min: null, max: null, average: null };
  }

  let min = values[0];
  let max = values[0];
  let sum = 0;

  for (const value of values) {
    if (value < min) min = value;
    if (value > max) max = value;
    sum += value;
  }

  return {
    min,
    max,
    average: sum / values.length,
  };
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
      select: {
        guestId: true,
        trackClipId: true,
        correct: true,
        replayCount: true,
        timeToGuessMs: true,
      },
    }),
  ]);

  const uniqueGuests = new Set(guesses.map((g) => g.guestId)).size;
  const totalGuesses = guesses.length;
  const correctGuesses = guesses.filter((g) => g.correct).length;

  const byClip = new Map<
    string,
    {
      guessCount: number;
      correctCount: number;
      replayCounts: number[];
      correctGuessTimesMs: number[];
    }
  >();

  for (const guess of guesses) {
    const existing = byClip.get(guess.trackClipId) ?? {
      guessCount: 0,
      correctCount: 0,
      replayCounts: [],
      correctGuessTimesMs: [],
    };
    existing.guessCount += 1;
    existing.replayCounts.push(guess.replayCount);
    if (guess.correct) {
      existing.correctCount += 1;
      existing.correctGuessTimesMs.push(guess.timeToGuessMs);
    }
    byClip.set(guess.trackClipId, existing);
  }

  const perClip = clips.map((clip) => {
    const stats = byClip.get(clip.id) ?? {
      guessCount: 0,
      correctCount: 0,
      replayCounts: [],
      correctGuessTimesMs: [],
    };
    return {
      trackClipId: clip.id,
      position: clip.position,
      trackName: clip.trackName,
      artistName: clip.artistName,
      guessCount: stats.guessCount,
      correctCount: stats.correctCount,
      accuracy:
        stats.guessCount > 0 ? stats.correctCount / stats.guessCount : null,
      replays: summarizeGuessMetrics(stats.replayCounts),
      correctGuessTimeMs: summarizeGuessMetrics(stats.correctGuessTimesMs),
    };
  });

  return {
    uniqueGuests,
    totalGuesses,
    correctGuesses,
    overallAccuracy: totalGuesses > 0 ? correctGuesses / totalGuesses : null,
    replays: summarizeGuessMetrics(guesses.map((guess) => guess.replayCount)),
    correctGuessTimeMs: summarizeGuessMetrics(
      guesses.filter((guess) => guess.correct).map((guess) => guess.timeToGuessMs),
    ),
    perClip,
  };
}

export function enrichSessionClipsForGuess(
  clips: Awaited<ReturnType<typeof resolveGuessShareSession>>["trackClips"],
) {
  return attachPlaybackRanges(clips);
}
