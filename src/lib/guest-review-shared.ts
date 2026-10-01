export const GUEST_REVIEW_GUEST_HEADER = "x-guest-review-guest-id";
export const GUEST_REVIEW_GUEST_QUERY_PARAM = "guest";

export function guestReviewIdStorageKey(shareToken: string) {
  return `guest-review-guest-id:${shareToken}`;
}

export function guestReviewNameStorageKey(shareToken: string) {
  return `guest-review-guest-name:${shareToken}`;
}

export type GuestReviewProgress = {
  reviewed: number;
  remaining: number;
  total: number;
};

export type GuestReviewClip = {
  id: string;
  position: number;
  spotifyTrackId: string;
  trackName: string;
  artistName: string;
  albumArtUrl: string | null;
  durationMs: number;
  startMs: number;
  endMs: number;
  hasUploadedAudio: boolean;
  playbackSource: "saved" | "default";
};

export type GuestReviewSummary = {
  trackClipId: string;
  position: number;
  trackName: string;
  artistName: string;
  albumArtUrl: string | null;
  okCount: number;
  notOkCount: number;
  comments: Array<{
    guestName: string;
    comment: string;
    updatedAt: string;
  }>;
};
