import { getLatestVersion, resolvePlaybackRange, type PlaybackRange } from "@/lib/clip-selection";
import type { TrackEditingBy } from "@/lib/track-edit-lock";
import type { TrackClipReviewVerdict } from "@prisma/client";

export type TrackClipReviewRecord = {
  trackClipId: string;
  userId: string;
  versionId: string | null;
  verdict: TrackClipReviewVerdict;
  comment: string | null;
};

export type TrackClipWithProposal = {
  id: string;
  spotifyTrackId: string;
  trackName: string;
  artistName: string;
  albumArtUrl: string | null;
  durationMs: number;
  position: number;
  startMs: number;
  endMs: number;
  proposal: {
    versions: Array<{
      id: string;
      startMs: number;
      endMs: number;
      createdAt: Date;
      createdBy?: { name: string | null; email?: string };
    }>;
  } | null;
};

export function playbackVersionKey(range: PlaybackRange): string | null {
  return range.versionId ?? null;
}

export function resolveTrackPlaybackRange(clip: TrackClipWithProposal): PlaybackRange {
  const latest = getLatestVersion(clip.proposal?.versions ?? []);
  return resolvePlaybackRange({ startMs: clip.startMs, endMs: clip.endMs }, latest);
}

export function isReviewCurrent(
  review: Pick<TrackClipReviewRecord, "versionId"> | null | undefined,
  range: PlaybackRange,
): boolean {
  if (!review) return false;
  return review.versionId === playbackVersionKey(range);
}

export function isTrackUnreviewed(
  clip: TrackClipWithProposal,
  review: Pick<TrackClipReviewRecord, "versionId"> | null | undefined,
): boolean {
  const range = resolveTrackPlaybackRange(clip);
  return !isReviewCurrent(review, range);
}

export type ReviewQueueItem = {
  id: string;
  spotifyTrackId: string;
  trackName: string;
  artistName: string;
  albumArtUrl: string | null;
  durationMs: number;
  position: number;
  startMs: number;
  endMs: number;
  playbackRange: PlaybackRange;
};

export function isClipReviewBlockedByOther(
  clipId: string,
  locksByClipId: Map<string, TrackEditingBy> | undefined,
  currentUserId: string | null | undefined,
): boolean {
  const lock = locksByClipId?.get(clipId);
  if (!lock) return false;
  if (!currentUserId) return true;
  return lock.userId !== currentUserId;
}

export function buildReviewQueue(
  clips: TrackClipWithProposal[],
  reviewsByClipId: Map<string, TrackClipReviewRecord>,
  options?: {
    currentUserId?: string;
    locksByClipId?: Map<string, TrackEditingBy>;
  },
): ReviewQueueItem[] {
  return clips
    .filter((clip) => {
      if (isClipReviewBlockedByOther(clip.id, options?.locksByClipId, options?.currentUserId)) {
        return false;
      }
      const review = reviewsByClipId.get(clip.id);
      return isTrackUnreviewed(clip, review);
    })
    .map((clip) => {
      const playbackRange = resolveTrackPlaybackRange(clip);
      return {
        id: clip.id,
        spotifyTrackId: clip.spotifyTrackId,
        trackName: clip.trackName,
        artistName: clip.artistName,
        albumArtUrl: clip.albumArtUrl,
        durationMs: clip.durationMs,
        position: clip.position,
        startMs: playbackRange.startMs,
        endMs: playbackRange.endMs,
        playbackRange,
      };
    });
}

export function computeReviewProgress(
  totalTracks: number,
  queueLength: number,
): { reviewed: number; remaining: number; total: number } {
  const remaining = queueLength;
  const reviewed = Math.max(0, totalTracks - remaining);
  return { reviewed, remaining, total: totalTracks };
}

export type UserReviewProgress = {
  reviewed: number;
  remaining: number;
  total: number;
};

export function getReviewActionLabel(reviewed: number): "Start review" | "Continue review" {
  return reviewed > 0 ? "Continue review" : "Start review";
}

export function isOngoingUserReview(progress: UserReviewProgress): boolean {
  return progress.reviewed > 0 && progress.remaining > 0;
}

export type OngoingSessionReview = {
  sessionId: string;
  sessionName: string;
  spotifyPlaylistName: string | null;
  playlistImageUrl: string | null;
  userReviewProgress: UserReviewProgress;
};

export function pickOngoingSessionReviews(
  sessions: Array<{
    id: string;
    name: string;
    spotifyPlaylistName: string | null;
    playlistImageUrl: string | null;
    trackCount: number;
  }>,
  progressBySession: Map<string, UserReviewProgress>,
): OngoingSessionReview[] {
  return sessions
    .map((session) => {
      const userReviewProgress = progressBySession.get(session.id) ?? {
        reviewed: 0,
        remaining: session.trackCount,
        total: session.trackCount,
      };
      if (!isOngoingUserReview(userReviewProgress)) {
        return null;
      }
      return {
        sessionId: session.id,
        sessionName: session.name,
        spotifyPlaylistName: session.spotifyPlaylistName,
        playlistImageUrl: session.playlistImageUrl,
        userReviewProgress,
      };
    })
    .filter((entry): entry is OngoingSessionReview => entry !== null)
    .sort((a, b) => {
      const aPct = a.userReviewProgress.reviewed / a.userReviewProgress.total;
      const bPct = b.userReviewProgress.reviewed / b.userReviewProgress.total;
      return bPct - aPct;
    });
}

export type TrackClipWithSession = TrackClipWithProposal & { sessionId: string };

export function buildSessionsUserReviewProgressMap(
  clips: TrackClipWithSession[],
  reviews: TrackClipReviewRecord[],
  options?: {
    currentUserId?: string;
    locksByClipId?: Map<string, TrackEditingBy>;
  },
): Map<string, UserReviewProgress> {
  const reviewsByClipId = new Map(reviews.map((review) => [review.trackClipId, review]));
  const clipsBySession = new Map<string, TrackClipWithProposal[]>();

  for (const clip of clips) {
    const list = clipsBySession.get(clip.sessionId) ?? [];
    list.push(clip);
    clipsBySession.set(clip.sessionId, list);
  }

  const progressBySession = new Map<string, UserReviewProgress>();
  for (const [sessionId, sessionClips] of clipsBySession) {
    const sessionReviews = new Map<string, TrackClipReviewRecord>();
    for (const clip of sessionClips) {
      const review = reviewsByClipId.get(clip.id);
      if (review) {
        sessionReviews.set(clip.id, review);
      }
    }
    const queueLength = buildReviewQueue(sessionClips, sessionReviews, options).length;
    progressBySession.set(sessionId, computeReviewProgress(sessionClips.length, queueLength));
  }

  return progressBySession;
}

export function computeUserReviewProgressForClips(
  clips: TrackClipWithProposal[],
  reviews: TrackClipReviewRecord[],
  options?: {
    currentUserId?: string;
    locksByClipId?: Map<string, TrackEditingBy>;
  },
): UserReviewProgress {
  const reviewsByClipId = new Map(reviews.map((review) => [review.trackClipId, review]));
  const queueLength = buildReviewQueue(clips, reviewsByClipId, options).length;
  return computeReviewProgress(clips.length, queueLength);
}

export const trackClipProposalInclude = {
  proposal: {
    include: {
      versions: {
        include: { createdBy: { select: { name: true, email: true } } },
        orderBy: { createdAt: "desc" as const },
      },
    },
  },
} as const;

export type ReviewTrackStatus = "pending" | "ok" | "not_ok";

export type TrackClipReviewSummary = {
  userId: string;
  userName: string;
  verdict: "OK" | "NOT_OK";
  comment: string | null;
  reviewedAt: string;
  isCurrent: boolean;
};

export type ReviewTrackListItem = {
  id: string;
  spotifyTrackId: string;
  trackName: string;
  artistName: string;
  albumArtUrl: string | null;
  durationMs: number;
  position: number;
  startMs: number;
  endMs: number;
  playbackRange: PlaybackRange;
  reviewStatus: ReviewTrackStatus;
  reviews: TrackClipReviewSummary[];
  editingBy: TrackEditingBy | null;
};

type ReviewWithUser = TrackClipReviewRecord & {
  updatedAt: Date;
  user: { id: string; name: string | null; email: string };
};

function formatReviewerName(user: { name: string | null; email: string }) {
  return user.name ?? user.email.split("@")[0];
}

export function mapReviewsForTrack(
  clip: TrackClipWithProposal,
  reviews: ReviewWithUser[],
): TrackClipReviewSummary[] {
  const playbackRange = resolveTrackPlaybackRange(clip);
  const versionKey = playbackVersionKey(playbackRange);

  return reviews
    .map((review) => ({
      userId: review.userId,
      userName: formatReviewerName(review.user),
      verdict: review.verdict,
      comment: review.comment,
      reviewedAt: review.updatedAt.toISOString(),
      isCurrent: review.versionId === versionKey,
    }))
    .sort((a, b) => {
      if (a.isCurrent !== b.isCurrent) return a.isCurrent ? -1 : 1;
      return b.reviewedAt.localeCompare(a.reviewedAt);
    });
}

function mapClipToListItem(
  clip: TrackClipWithProposal,
  reviewsByClipId: Map<string, TrackClipReviewRecord>,
  teamReviewsByClipId: Map<string, ReviewWithUser[]>,
  locksByClipId?: Map<string, TrackEditingBy>,
): ReviewTrackListItem {
  const review = reviewsByClipId.get(clip.id);
  const playbackRange = resolveTrackPlaybackRange(clip);
  let reviewStatus: ReviewTrackStatus = "pending";

  if (review && isReviewCurrent(review, playbackRange)) {
    reviewStatus = review.verdict === "OK" ? "ok" : "not_ok";
  }

  return {
    id: clip.id,
    spotifyTrackId: clip.spotifyTrackId,
    trackName: clip.trackName,
    artistName: clip.artistName,
    albumArtUrl: clip.albumArtUrl,
    durationMs: clip.durationMs,
    position: clip.position,
    startMs: playbackRange.startMs,
    endMs: playbackRange.endMs,
    playbackRange,
    reviewStatus,
    reviews: mapReviewsForTrack(clip, teamReviewsByClipId.get(clip.id) ?? []),
    editingBy: locksByClipId?.get(clip.id) ?? null,
  };
}

export function buildReviewTrackList(
  clips: TrackClipWithProposal[],
  reviewsByClipId: Map<string, TrackClipReviewRecord>,
  teamReviewsByClipId: Map<string, ReviewWithUser[]>,
  locksByClipId?: Map<string, TrackEditingBy>,
): ReviewTrackListItem[] {
  return clips.map((clip) =>
    mapClipToListItem(clip, reviewsByClipId, teamReviewsByClipId, locksByClipId),
  );
}

export function groupTeamReviewsByClipId(
  reviews: ReviewWithUser[],
): Map<string, ReviewWithUser[]> {
  const grouped = new Map<string, ReviewWithUser[]>();

  for (const review of reviews) {
    const existing = grouped.get(review.trackClipId) ?? [];
    existing.push(review);
    grouped.set(review.trackClipId, existing);
  }

  return grouped;
}

export type MemberReviewEntry = {
  trackId: string;
  trackName: string;
  artistName: string;
  position: number;
  verdict: "OK" | "NOT_OK";
  comment: string | null;
  reviewedAt: string;
};

export type MemberReviewProgress = {
  userId: string;
  userName: string;
  image: string | null;
  reviewed: number;
  remaining: number;
  total: number;
  okCount: number;
  notOkCount: number;
  reviews: MemberReviewEntry[];
};

type TeamMemberLike = {
  userId: string;
  user: { id: string; name: string | null; email: string; image: string | null };
};

export function buildMemberReviewSummaries(
  clips: TrackClipWithProposal[],
  members: TeamMemberLike[],
  teamReviews: ReviewWithUser[],
): MemberReviewProgress[] {
  const total = clips.length;
  const reviewsByUserId = new Map<string, ReviewWithUser[]>();

  for (const review of teamReviews) {
    const existing = reviewsByUserId.get(review.userId) ?? [];
    existing.push(review);
    reviewsByUserId.set(review.userId, existing);
  }

  return members.map((member) => {
    const userReviews = reviewsByUserId.get(member.userId) ?? [];
    const reviewsByClipId = new Map(userReviews.map((review) => [review.trackClipId, review]));

    let reviewed = 0;
    let okCount = 0;
    let notOkCount = 0;
    const entries: MemberReviewEntry[] = [];

    for (const clip of clips) {
      const review = reviewsByClipId.get(clip.id);
      if (!review || !isReviewCurrent(review, resolveTrackPlaybackRange(clip))) {
        continue;
      }

      reviewed++;
      if (review.verdict === "OK") {
        okCount++;
      } else {
        notOkCount++;
      }

      entries.push({
        trackId: clip.id,
        trackName: clip.trackName,
        artistName: clip.artistName,
        position: clip.position,
        verdict: review.verdict,
        comment: review.comment,
        reviewedAt: review.updatedAt.toISOString(),
      });
    }

    entries.sort((a, b) => a.position - b.position);

    return {
      userId: member.userId,
      userName: formatReviewerName(member.user),
      image: member.user.image,
      reviewed,
      remaining: Math.max(0, total - reviewed),
      total,
      okCount,
      notOkCount,
      reviews: entries,
    };
  });
}
