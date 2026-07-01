import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/api-auth";
import { prisma } from "@/lib/db";
import {
  requireSessionAccess,
  apiErrorResponse,
} from "@/lib/team-auth";
import { loadSessionEditors, loadSessionTrackSummaries } from "@/lib/track-summaries";
import { loadActiveTrackEditLocksForSession } from "@/lib/track-edit-lock-db";
import {
  computeUserReviewProgressForClips,
  trackClipProposalInclude,
} from "@/lib/track-review";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_request: Request, context: RouteContext) {
  const { session, error } = await requireAuth();
  if (error) return error;

  const { id } = await context.params;
  const userId = session!.user!.id;

  try {
    await requireSessionAccess(id, userId);

    const bingoSession = await prisma.bingoSession.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        teamId: true,
        spotifyPlaylistName: true,
        defaultClipDurationMs: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!bingoSession) {
      return NextResponse.json({ error: "Session not found" }, { status: 404 });
    }

    const [tracks, editors, clips, reviews, locksByClipId] = await Promise.all([
      loadSessionTrackSummaries(id),
      loadSessionEditors(id),
      prisma.trackClip.findMany({
        where: { sessionId: id },
        include: trackClipProposalInclude,
      }),
      prisma.trackClipReview.findMany({
        where: { userId, trackClip: { sessionId: id } },
        select: {
          trackClipId: true,
          userId: true,
          versionId: true,
          verdict: true,
          comment: true,
        },
      }),
      loadActiveTrackEditLocksForSession(id),
    ]);

    const userReviewProgress = computeUserReviewProgressForClips(clips, reviews, {
      currentUserId: userId,
      locksByClipId,
    });

    return NextResponse.json({ ...bingoSession, tracks, editors, userReviewProgress });
  } catch (err) {
    return apiErrorResponse(err, "Failed to load session");
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
  const { session, error } = await requireAuth();
  if (error) return error;

  const { id } = await context.params;

  try {
    await requireSessionAccess(id, session!.user!.id);
    await prisma.bingoSession.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (err) {
    return apiErrorResponse(err, "Failed to delete session");
  }
}
