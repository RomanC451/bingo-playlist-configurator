import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAuth } from "@/lib/api-auth";
import {
  CLIP_GUESS_GUEST_HEADER,
  GuessShareError,
  buildGuessChoices,
  buildGuessClipQueue,
  computeGuessProgress,
  enrichSessionClipsForGuess,
  isCorrectGuess,
  resolveGuessShareSession,
} from "@/lib/clip-guess";
import { prisma } from "@/lib/db";

const guessSchema = z.object({
  trackClipId: z.string(),
  guessedTrackClipId: z.string(),
});

const guestIdSchema = z.string().uuid();

type RouteContext = { params: Promise<{ shareToken: string }> };

function readGuestId(request: Request) {
  const header = request.headers.get(CLIP_GUESS_GUEST_HEADER);
  const parsed = guestIdSchema.safeParse(header);
  if (!parsed.success) {
    return null;
  }
  return parsed.data;
}

function guessShareResponse(err: unknown) {
  if (err instanceof GuessShareError) {
    return NextResponse.json({ error: err.message }, { status: err.status });
  }
  return null;
}

export async function GET(request: Request, context: RouteContext) {
  const { shareToken } = await context.params;
  const guestId = readGuestId(request);

  if (!guestId) {
    return NextResponse.json({ error: "Valid guest id required" }, { status: 400 });
  }

  try {
    const bingoSession = await resolveGuessShareSession(shareToken);
    const enrichedClips = enrichSessionClipsForGuess(bingoSession.trackClips);
    const choices = buildGuessChoices(enrichedClips);

    const existingGuesses = await prisma.clipGuess.findMany({
      where: { sessionId: bingoSession.id, guestId },
      select: {
        trackClipId: true,
        guessedTrackClipId: true,
        correct: true,
      },
    });

    const guessedClipIds = new Set(existingGuesses.map((g) => g.trackClipId));
    const queue = buildGuessClipQueue(enrichedClips, guessedClipIds);
    const progress = computeGuessProgress(enrichedClips.length, guessedClipIds.size);
    const current = queue[0] ?? null;
    const complete = queue.length === 0;

    return NextResponse.json({
      session: { id: bingoSession.id, name: bingoSession.name },
      choices,
      progress,
      complete,
      current: current
        ? {
            id: current.id,
            position: current.position,
            clipIndex: progress.guessed + 1,
            spotifyTrackId: current.spotifyTrackId,
            startMs: current.startMs,
            endMs: current.endMs,
          }
        : null,
      guesses: existingGuesses,
    });
  } catch (err) {
    const response = guessShareResponse(err);
    if (response) return response;
    throw err;
  }
}

export async function POST(request: Request, context: RouteContext) {
  const { shareToken } = await context.params;
  const guestId = readGuestId(request);

  if (!guestId) {
    return NextResponse.json({ error: "Valid guest id required" }, { status: 400 });
  }

  try {
    const body = await request.json();
    const parsed = guessSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid input" }, { status: 400 });
    }

    const bingoSession = await resolveGuessShareSession(shareToken);
    const enrichedClips = enrichSessionClipsForGuess(bingoSession.trackClips);
    const clipIds = new Set(enrichedClips.map((c) => c.id));

    if (!clipIds.has(parsed.data.trackClipId) || !clipIds.has(parsed.data.guessedTrackClipId)) {
      return NextResponse.json({ error: "Invalid track" }, { status: 400 });
    }

    const existing = await prisma.clipGuess.findUnique({
      where: {
        sessionId_guestId_trackClipId: {
          sessionId: bingoSession.id,
          guestId,
          trackClipId: parsed.data.trackClipId,
        },
      },
    });

    if (existing) {
      return NextResponse.json({ error: "Already guessed this clip" }, { status: 409 });
    }

    const correct = isCorrectGuess(parsed.data.trackClipId, parsed.data.guessedTrackClipId);

    await prisma.clipGuess.create({
      data: {
        sessionId: bingoSession.id,
        guestId,
        trackClipId: parsed.data.trackClipId,
        guessedTrackClipId: parsed.data.guessedTrackClipId,
        correct,
      },
    });

    const existingGuesses = await prisma.clipGuess.findMany({
      where: { sessionId: bingoSession.id, guestId },
      select: {
        trackClipId: true,
        guessedTrackClipId: true,
        correct: true,
      },
    });

    const guessedClipIds = new Set(existingGuesses.map((g) => g.trackClipId));
    const queue = buildGuessClipQueue(enrichedClips, guessedClipIds);
    const progress = computeGuessProgress(enrichedClips.length, guessedClipIds.size);
    const current = queue[0] ?? null;
    const answeredClip = enrichedClips.find((c) => c.id === parsed.data.trackClipId);

    return NextResponse.json({
      success: true,
      correct,
      answer: answeredClip
        ? {
            id: answeredClip.id,
            trackName: answeredClip.trackName,
            artistName: answeredClip.artistName,
            albumArtUrl: answeredClip.albumArtUrl,
          }
        : null,
      progress,
      complete: queue.length === 0,
      current: current
        ? {
            id: current.id,
            position: current.position,
            clipIndex: progress.guessed + 1,
            spotifyTrackId: current.spotifyTrackId,
            startMs: current.startMs,
            endMs: current.endMs,
          }
        : null,
      guesses: existingGuesses,
    });
  } catch (err) {
    const response = guessShareResponse(err);
    if (response) return response;
    throw err;
  }
}
