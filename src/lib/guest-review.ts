import { randomBytes } from "crypto";
import { prisma } from "@/lib/db";
import {
  isReviewCurrent,
  resolveTrackPlaybackRange,
  type TrackClipWithProposal,
} from "@/lib/track-review";
import { hasUploadedAudio } from "@/lib/uploaded-audio";
import type {
  GuestReviewClip,
  GuestReviewProgress,
  GuestReviewSummary,
} from "@/lib/guest-review-shared";

export {
  GUEST_REVIEW_GUEST_HEADER,
  GUEST_REVIEW_GUEST_QUERY_PARAM,
  guestReviewIdStorageKey,
  guestReviewNameStorageKey,
  type GuestReviewClip,
  type GuestReviewProgress,
  type GuestReviewSummary,
} from "@/lib/guest-review-shared";

export function generateReviewShareToken() {
  return randomBytes(24).toString("base64url");
}

export class ReviewShareError extends Error {
  constructor(
    message: string,
    public status: 403 | 404 = 404,
  ) {
    super(message);
    this.name = "ReviewShareError";
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

export async function resolveReviewShareSession(shareToken: string) {
  const bingoSession = await prisma.bingoSession.findUnique({
    where: { reviewShareToken: shareToken },
    select: {
      id: true,
      name: true,
      teamId: true,
      reviewShareEnabled: true,
      reviewShareToken: true,
      trackClips: {
        orderBy: { position: "asc" },
        include: trackClipInclude,
      },
    },
  });

  if (!bingoSession || !bingoSession.reviewShareEnabled || !bingoSession.reviewShareToken) {
    throw new ReviewShareError("Review link not found or disabled", 404);
  }

  if (!bingoSession.teamId) {
    throw new ReviewShareError("Session has no team for playback", 403);
  }

  return bingoSession;
}

export type GuestReviewRecord = {
  trackClipId: string;
  versionId: string | null;
  verdict: "OK" | "NOT_OK";
  comment: string | null;
  guestName: string;
};

export function mapGuestReviewClip(clip: TrackClipWithProposal): GuestReviewClip {
  const playbackRange = resolveTrackPlaybackRange(clip);
  return {
    id: clip.id,
    position: clip.position,
    spotifyTrackId: clip.spotifyTrackId,
    trackName: clip.trackName,
    artistName: clip.artistName,
    albumArtUrl: clip.albumArtUrl,
    durationMs: clip.durationMs,
    startMs: playbackRange.startMs,
    endMs: playbackRange.endMs,
    hasUploadedAudio: hasUploadedAudio(clip),
    playbackSource: playbackRange.source,
  };
}

export function buildGuestReviewQueue(
  clips: TrackClipWithProposal[],
  reviewsByClipId: Map<string, Pick<GuestReviewRecord, "versionId">>,
): GuestReviewClip[] {
  return clips
    .filter((clip) => {
      const review = reviewsByClipId.get(clip.id);
      const range = resolveTrackPlaybackRange(clip);
      return !isReviewCurrent(review, range);
    })
    .map(mapGuestReviewClip);
}

export function computeGuestReviewProgress(
  totalTracks: number,
  queueLength: number,
): GuestReviewProgress {
  const remaining = queueLength;
  const reviewed = Math.max(0, totalTracks - remaining);
  return { reviewed, remaining, total: totalTracks };
}

export async function loadGuestReviewSummaries(
  sessionId: string,
): Promise<{
  uniqueGuests: number;
  totalReviews: number;
  okCount: number;
  notOkCount: number;
  perClip: GuestReviewSummary[];
}> {
  const [clips, reviews] = await Promise.all([
    prisma.trackClip.findMany({
      where: { sessionId },
      orderBy: { position: "asc" },
      select: {
        id: true,
        position: true,
        trackName: true,
        artistName: true,
        albumArtUrl: true,
      },
    }),
    prisma.guestTrackClipReview.findMany({
      where: { sessionId },
      orderBy: { updatedAt: "desc" },
      select: {
        trackClipId: true,
        guestId: true,
        guestName: true,
        verdict: true,
        comment: true,
        updatedAt: true,
      },
    }),
  ]);

  const uniqueGuests = new Set(reviews.map((review) => review.guestId)).size;
  let okCount = 0;
  let notOkCount = 0;
  for (const review of reviews) {
    if (review.verdict === "OK") okCount += 1;
    else notOkCount += 1;
  }

  const reviewsByClip = new Map<string, typeof reviews>();
  for (const review of reviews) {
    const list = reviewsByClip.get(review.trackClipId) ?? [];
    list.push(review);
    reviewsByClip.set(review.trackClipId, list);
  }

  const perClip: GuestReviewSummary[] = clips.map((clip) => {
    const clipReviews = reviewsByClip.get(clip.id) ?? [];
    return {
      trackClipId: clip.id,
      position: clip.position,
      trackName: clip.trackName,
      artistName: clip.artistName,
      albumArtUrl: clip.albumArtUrl,
      okCount: clipReviews.filter((review) => review.verdict === "OK").length,
      notOkCount: clipReviews.filter((review) => review.verdict === "NOT_OK").length,
      comments: clipReviews
        .filter((review) => review.verdict === "NOT_OK" && Boolean(review.comment?.trim()))
        .map((review) => ({
          guestName: review.guestName,
          comment: review.comment!.trim(),
          updatedAt: review.updatedAt.toISOString(),
        })),
    };
  });

  return {
    uniqueGuests,
    totalReviews: reviews.length,
    okCount,
    notOkCount,
    perClip,
  };
}
