import { NextResponse } from "next/server";
import { z } from "zod";
import { internalError, spotifyErrorResponse } from "@/lib/api-errors";
import { requireAuth } from "@/lib/api-auth";
import { prisma } from "@/lib/db";
import {
  asSpotifyApiError,
  getDevices,
  getPlaybackState,
} from "@/lib/spotify";
import { requireSessionAccess, teamAccessResponse } from "@/lib/team-auth";
import {
  getActiveTrackEditLock,
  loadActiveTrackEditLocksForSession,
} from "@/lib/track-edit-lock-db";
import {
  buildMemberReviewSummaries,
  buildReviewQueue,
  buildReviewTrackList,
  computeReviewProgress,
  groupTeamReviewsByClipId,
  playbackVersionKey,
  resolveTrackPlaybackRange,
  type ReviewQueueItem,
  type TrackClipWithProposal,
} from "@/lib/track-review";

const reviewSchema = z.object({
  clipId: z.string(),
  verdict: z.enum(["OK", "NOT_OK"]),
  comment: z.string().trim().max(500).optional(),
});

type RouteContext = { params: Promise<{ id: string }> };

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

function playbackErrorResponse(err: unknown) {
  const spotifyErr = asSpotifyApiError(err);
  if (spotifyErr) {
    return spotifyErrorResponse(spotifyErr);
  }

  const message = err instanceof Error ? err.message : "Playback failed";
  return internalError(message);
}

async function loadSessionClips(sessionId: string): Promise<TrackClipWithProposal[] | null> {
  const bingoSession = await prisma.bingoSession.findUnique({
    where: { id: sessionId },
    select: {
      id: true,
      name: true,
      trackClips: {
        orderBy: { position: "asc" },
        include: trackClipInclude,
      },
    },
  });

  if (!bingoSession) return null;

  return bingoSession.trackClips;
}

function mapQueueItem(item: ReviewQueueItem) {
  return {
    id: item.id,
    spotifyTrackId: item.spotifyTrackId,
    trackName: item.trackName,
    artistName: item.artistName,
    albumArtUrl: item.albumArtUrl,
    durationMs: item.durationMs,
    position: item.position,
    startMs: item.startMs,
    endMs: item.endMs,
    playbackRange: item.playbackRange,
  };
}

export async function GET(_request: Request, context: RouteContext) {
  const { session, error } = await requireAuth();
  if (error) return error;

  const { id: sessionId } = await context.params;
  const userId = session!.user!.id;

  try {
    const { bingoSession } = await requireSessionAccess(sessionId, userId);
    const teamId = bingoSession.teamId;
    if (!teamId) {
      return NextResponse.json({ error: "Session has no team" }, { status: 400 });
    }

    const sessionData = await prisma.bingoSession.findUnique({
      where: { id: sessionId },
      select: {
        id: true,
        name: true,
        trackClips: {
          orderBy: { position: "asc" },
          include: trackClipInclude,
        },
      },
    });

    if (!sessionData) {
      return NextResponse.json({ error: "Session not found" }, { status: 404 });
    }

    const clipIds = sessionData.trackClips.map((c) => c.id);

    const [reviews, teamReviews, teamMembers, locksByClipId] = await Promise.all([
      prisma.trackClipReview.findMany({
        where: { userId, trackClipId: { in: clipIds } },
      }),
      prisma.trackClipReview.findMany({
        where: { trackClipId: { in: clipIds } },
        include: {
          user: { select: { id: true, name: true, email: true, image: true } },
        },
        orderBy: { updatedAt: "desc" },
      }),
      prisma.teamMember.findMany({
        where: { teamId },
        include: {
          user: { select: { id: true, name: true, email: true, image: true } },
        },
        orderBy: { createdAt: "asc" },
      }),
      loadActiveTrackEditLocksForSession(sessionId),
    ]);

    const reviewsByClipId = new Map(reviews.map((r) => [r.trackClipId, r]));
    const teamReviewsByClipId = groupTeamReviewsByClipId(teamReviews);
    const queueOptions = { currentUserId: userId, locksByClipId };
    const queue = buildReviewQueue(sessionData.trackClips, reviewsByClipId, queueOptions);
    const tracks = buildReviewTrackList(
      sessionData.trackClips,
      reviewsByClipId,
      teamReviewsByClipId,
      locksByClipId,
    );
    const progress = computeReviewProgress(sessionData.trackClips.length, queue.length);
    const current =
      queue.length > 0 ? (tracks.find((track) => track.id === queue[0]!.id) ?? null) : null;
    const members = buildMemberReviewSummaries(
      sessionData.trackClips,
      teamMembers,
      teamReviews,
    );

    let playback = null;
    let deviceList: Awaited<ReturnType<typeof getDevices>>["devices"] = [];

    try {
      const [playbackResult, devicesResult] = await Promise.all([
        getPlaybackState(teamId),
        getDevices(teamId),
      ]);
      playback = playbackResult;
      deviceList = devicesResult.devices;
    } catch {
      // Review queue still works when Spotify is unavailable or rate-limited.
    }

    return NextResponse.json({
      session: { id: sessionData.id, name: sessionData.name },
      complete: queue.length === 0,
      progress,
      current,
      queue: queue.map(mapQueueItem),
      tracks,
      members,
      playback,
      devices: deviceList,
      hasActiveDevice: deviceList.some((d) => d.is_active),
    });
  } catch (err) {
    const response = teamAccessResponse(err);
    if (response) return response;
    return playbackErrorResponse(err);
  }
}

export async function POST(request: Request, context: RouteContext) {
  const { session, error } = await requireAuth();
  if (error) return error;

  const { id: sessionId } = await context.params;
  const userId = session!.user!.id;

  try {
    const { bingoSession } = await requireSessionAccess(sessionId, userId);
    const teamId = bingoSession.teamId;
    if (!teamId) {
      return NextResponse.json({ error: "Session has no team" }, { status: 400 });
    }

    const body = await request.json();
    const parsed = reviewSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid input" }, { status: 400 });
    }

    const clip = await prisma.trackClip.findFirst({
      where: { id: parsed.data.clipId, sessionId },
      include: trackClipInclude,
    });

    if (!clip) {
      return NextResponse.json({ error: "Track not found" }, { status: 404 });
    }

    const activeLock = await getActiveTrackEditLock(clip.id);
    if (activeLock && activeLock.editingBy.userId !== userId) {
      return NextResponse.json(
        {
          error: `${activeLock.editingBy.name} is editing this track`,
          editingBy: activeLock.editingBy,
        },
        { status: 409 },
      );
    }

    const playbackRange = resolveTrackPlaybackRange(clip);
    const versionId = playbackVersionKey(playbackRange);
    const comment = parsed.data.comment?.trim() || null;

    await prisma.$transaction(async (tx) => {
      await tx.trackClipReview.upsert({
        where: {
          trackClipId_userId: {
            trackClipId: clip.id,
            userId,
          },
        },
        create: {
          trackClipId: clip.id,
          userId,
          versionId,
          verdict: parsed.data.verdict,
          comment: parsed.data.verdict === "NOT_OK" ? comment : null,
        },
        update: {
          versionId,
          verdict: parsed.data.verdict,
          comment: parsed.data.verdict === "NOT_OK" ? comment : null,
        },
      });

      if (parsed.data.verdict === "NOT_OK") {
        await tx.trackClip.update({
          where: { id: clip.id },
          data: {
            needsAttention: true,
            needsAttentionByUserId: userId,
            needsAttentionComment: comment,
          },
        });
      } else {
        const current = await tx.trackClip.findUnique({
          where: { id: clip.id },
          select: { needsAttentionByUserId: true },
        });

        if (current?.needsAttentionByUserId === userId) {
          await tx.trackClip.update({
            where: { id: clip.id },
            data: {
              needsAttention: false,
              needsAttentionByUserId: null,
              needsAttentionComment: null,
            },
          });
        }
      }
    });

    const clips = await loadSessionClips(sessionId);
    if (!clips) {
      return NextResponse.json({ error: "Session not found" }, { status: 404 });
    }

    const clipIds = clips.map((c) => c.id);

    const [reviews, teamReviews, teamMembers, locksByClipId] = await Promise.all([
      prisma.trackClipReview.findMany({
        where: { userId, trackClipId: { in: clipIds } },
      }),
      prisma.trackClipReview.findMany({
        where: { trackClipId: { in: clipIds } },
        include: {
          user: { select: { id: true, name: true, email: true, image: true } },
        },
        orderBy: { updatedAt: "desc" },
      }),
      prisma.teamMember.findMany({
        where: { teamId },
        include: {
          user: { select: { id: true, name: true, email: true, image: true } },
        },
        orderBy: { createdAt: "asc" },
      }),
      loadActiveTrackEditLocksForSession(sessionId),
    ]);

    const reviewsByClipId = new Map(reviews.map((r) => [r.trackClipId, r]));
    const teamReviewsByClipId = groupTeamReviewsByClipId(teamReviews);
    const queueOptions = { currentUserId: userId, locksByClipId };
    const queue = buildReviewQueue(clips, reviewsByClipId, queueOptions);
    const tracks = buildReviewTrackList(clips, reviewsByClipId, teamReviewsByClipId, locksByClipId);
    const progress = computeReviewProgress(clips.length, queue.length);
    const current =
      queue.length > 0 ? (tracks.find((track) => track.id === queue[0]!.id) ?? null) : null;
    const members = buildMemberReviewSummaries(clips, teamMembers, teamReviews);

    return NextResponse.json({
      success: true,
      complete: queue.length === 0,
      progress,
      current,
      tracks,
      members,
    });
  } catch (err) {
    const response = teamAccessResponse(err);
    if (response) return response;
    throw err;
  }
}
