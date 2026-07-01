import { prisma } from "@/lib/db";
import { loadActiveTrackEditLocksForSessions } from "@/lib/track-edit-lock-db";
import {
  buildSessionsUserReviewProgressMap,
  pickOngoingSessionReviews,
  trackClipProposalInclude,
  type OngoingSessionReview,
} from "@/lib/track-review";

export async function loadOngoingUserReviews(
  teamId: string,
  userId: string,
): Promise<OngoingSessionReview[]> {
  const sessions = await prisma.bingoSession.findMany({
    where: { teamId },
    orderBy: { updatedAt: "desc" },
    select: {
      id: true,
      name: true,
      spotifyPlaylistName: true,
      spotifyPlaylistImageUrl: true,
      trackClips: {
        take: 1,
        orderBy: { position: "asc" },
        select: { albumArtUrl: true },
      },
      _count: { select: { trackClips: true } },
    },
  });

  if (sessions.length === 0) {
    return [];
  }

  const sessionIds = sessions.map((session) => session.id);
  const [clips, reviews, locksByClipId] = await Promise.all([
    prisma.trackClip.findMany({
      where: { sessionId: { in: sessionIds } },
      include: trackClipProposalInclude,
    }),
    prisma.trackClipReview.findMany({
      where: {
        userId,
        trackClip: { sessionId: { in: sessionIds } },
      },
      select: {
        trackClipId: true,
        userId: true,
        versionId: true,
        verdict: true,
        comment: true,
      },
    }),
    loadActiveTrackEditLocksForSessions(sessionIds),
  ]);

  const progressBySession = buildSessionsUserReviewProgressMap(clips, reviews, {
    currentUserId: userId,
    locksByClipId,
  });

  return pickOngoingSessionReviews(
    sessions.map((session) => ({
      id: session.id,
      name: session.name,
      spotifyPlaylistName: session.spotifyPlaylistName,
      playlistImageUrl:
        session.spotifyPlaylistImageUrl ?? session.trackClips[0]?.albumArtUrl ?? null,
      trackCount: session._count.trackClips,
    })),
    progressBySession,
  );
}
