import { NextResponse } from "next/server";
import { z } from "zod";
import {
  GUEST_REVIEW_GUEST_HEADER,
  ReviewShareError,
  buildGuestReviewQueue,
  buildGuestReviewTracks,
  computeGuestReviewProgress,
  mapGuestReviewClip,
  resolveReviewShareSession,
} from "@/lib/guest-review";
import { prisma } from "@/lib/db";
import { playbackVersionKey, resolveTrackPlaybackRange } from "@/lib/track-review";

const reviewSchema = z.object({
  clipId: z.string().min(1),
  verdict: z.enum(["OK", "NOT_OK"]),
  comment: z.string().trim().max(500).optional(),
  guestName: z.string().trim().min(1).max(80),
});

const guestIdSchema = z.string().uuid();

type RouteContext = { params: Promise<{ shareToken: string }> };

function readGuestId(request: Request) {
  const header = request.headers.get(GUEST_REVIEW_GUEST_HEADER);
  const parsed = guestIdSchema.safeParse(header);
  if (!parsed.success) {
    return null;
  }
  return parsed.data;
}

function reviewShareResponse(err: unknown) {
  if (err instanceof ReviewShareError) {
    return NextResponse.json({ error: err.message }, { status: err.status });
  }
  return null;
}

async function loadGuestReviewState(sessionId: string, guestId: string, clips: Parameters<typeof buildGuestReviewTracks>[0]) {
  const existingReviews = await prisma.guestTrackClipReview.findMany({
    where: { sessionId, guestId },
    select: {
      trackClipId: true,
      versionId: true,
      verdict: true,
      comment: true,
      guestName: true,
    },
  });

  const reviewsByClipId = new Map(
    existingReviews.map((review) => [review.trackClipId, review]),
  );
  const tracks = buildGuestReviewTracks(clips, reviewsByClipId);
  const queue = buildGuestReviewQueue(clips, reviewsByClipId);
  const progress = computeGuestReviewProgress(clips.length, queue.length);

  return {
    tracks,
    queue,
    progress,
    complete: queue.length === 0,
    current: queue[0] ?? null,
    guestName: existingReviews[0]?.guestName ?? null,
    reviews: existingReviews.map((review) => ({
      trackClipId: review.trackClipId,
      verdict: review.verdict,
      comment: review.comment,
    })),
  };
}

export async function GET(request: Request, context: RouteContext) {
  const { shareToken } = await context.params;
  const guestId = readGuestId(request);

  if (!guestId) {
    return NextResponse.json({ error: "Valid guest id required" }, { status: 400 });
  }

  try {
    const bingoSession = await resolveReviewShareSession(shareToken);
    const state = await loadGuestReviewState(
      bingoSession.id,
      guestId,
      bingoSession.trackClips,
    );

    return NextResponse.json({
      session: { id: bingoSession.id, name: bingoSession.name },
      ...state,
    });
  } catch (err) {
    const response = reviewShareResponse(err);
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
    const bingoSession = await resolveReviewShareSession(shareToken);
    const body = await request.json();
    const parsed = reviewSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid input" }, { status: 400 });
    }

    const clip = bingoSession.trackClips.find((entry) => entry.id === parsed.data.clipId);
    if (!clip) {
      return NextResponse.json({ error: "Track not found" }, { status: 404 });
    }

    const playbackRange = resolveTrackPlaybackRange(clip);
    const versionId = playbackVersionKey(playbackRange);
    const comment =
      parsed.data.verdict === "NOT_OK" ? (parsed.data.comment?.trim() || null) : null;

    await prisma.guestTrackClipReview.upsert({
      where: {
        sessionId_guestId_trackClipId: {
          sessionId: bingoSession.id,
          guestId,
          trackClipId: clip.id,
        },
      },
      create: {
        sessionId: bingoSession.id,
        guestId,
        guestName: parsed.data.guestName,
        trackClipId: clip.id,
        versionId,
        verdict: parsed.data.verdict,
        comment,
      },
      update: {
        guestName: parsed.data.guestName,
        versionId,
        verdict: parsed.data.verdict,
        comment,
      },
    });

    const state = await loadGuestReviewState(
      bingoSession.id,
      guestId,
      bingoSession.trackClips,
    );

    return NextResponse.json({
      session: { id: bingoSession.id, name: bingoSession.name },
      reviewed: mapGuestReviewClip(clip),
      ...state,
      guestName: parsed.data.guestName,
    });
  } catch (err) {
    const response = reviewShareResponse(err);
    if (response) return response;
    throw err;
  }
}
