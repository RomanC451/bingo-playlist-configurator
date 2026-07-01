import { prisma } from "@/lib/db";

export type AttentionFlaggedBy = {
  userId: string;
  name: string;
  image: string | null;
};

function formatUserName(user: { name: string | null; email: string }) {
  return user.name ?? user.email.split("@")[0];
}

export function mapAttentionFlaggedBy(
  user: {
    id: string;
    name: string | null;
    email: string;
    image: string | null;
  } | null,
): AttentionFlaggedBy | null {
  if (!user) {
    return null;
  }

  return {
    userId: user.id,
    name: formatUserName(user),
    image: user.image,
  };
}

const attentionUserSelect = {
  id: true,
  name: true,
  email: true,
  image: true,
} as const;

export const trackAttentionUserInclude = {
  needsAttentionBy: { select: attentionUserSelect },
} as const;

export async function clearTrackNeedsAttention(clipId: string) {
  await prisma.trackClip.updateMany({
    where: { id: clipId, needsAttention: true },
    data: {
      needsAttention: false,
      needsAttentionByUserId: null,
      needsAttentionComment: null,
    },
  });
}

export async function loadTracksNeedingAttention(teamId: string) {
  const clips = await prisma.trackClip.findMany({
    where: {
      needsAttention: true,
      session: { teamId },
    },
    orderBy: [{ session: { updatedAt: "desc" } }, { position: "asc" }],
    select: {
      id: true,
      trackName: true,
      artistName: true,
      albumArtUrl: true,
      position: true,
      sessionId: true,
      session: { select: { name: true } },
      needsAttentionBy: { select: attentionUserSelect },
      needsAttentionComment: true,
    },
  });

  return clips.map((clip) => ({
    id: clip.id,
    trackName: clip.trackName,
    artistName: clip.artistName,
    albumArtUrl: clip.albumArtUrl,
    position: clip.position,
    sessionId: clip.sessionId,
    sessionName: clip.session.name,
    flaggedBy: mapAttentionFlaggedBy(clip.needsAttentionBy),
    comment: clip.needsAttentionComment,
  }));
}
