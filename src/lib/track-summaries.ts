import {
  getLatestVersion,
  resolvePlaybackRange,
  type PlaybackRange,
} from "@/lib/clip-selection";
import { mapVersionReactions, reactionCountsFromEntries } from "@/lib/clip-reactions";
import { mapAttentionFlaggedBy, trackAttentionUserInclude } from "@/lib/track-attention";
import { loadActiveTrackEditLocksForSession } from "@/lib/track-edit-lock-db";
import { prisma } from "@/lib/db";

const versionReactionInclude = {
  reactions: {
    include: {
      user: { select: { id: true, name: true, email: true, image: true } },
    },
    orderBy: { updatedAt: "desc" as const },
  },
} as const;

const proposalInclude = {
  proposal: {
    include: {
      versions: {
        include: {
          createdBy: { select: { id: true, name: true, email: true } },
          ...versionReactionInclude,
        },
        orderBy: { createdAt: "desc" as const },
      },
    },
  },
} as const;

function formatUserName(user: { name: string | null; email: string }) {
  return user.name ?? user.email.split("@")[0];
}

function contributorsFromVersions(
  versions: Array<{
    createdAt: Date;
    createdByUserId: string;
    createdBy: { id: string; name: string | null; email: string };
  }>,
) {
  const byUser = new Map<string, { userId: string; name: string; lastEditedAt: Date }>();

  for (const version of versions) {
    const existing = byUser.get(version.createdByUserId);
    if (!existing || version.createdAt > existing.lastEditedAt) {
      byUser.set(version.createdByUserId, {
        userId: version.createdByUserId,
        name: formatUserName(version.createdBy),
        lastEditedAt: version.createdAt,
      });
    }
  }

  return [...byUser.values()]
    .sort((a, b) => b.lastEditedAt.getTime() - a.lastEditedAt.getTime())
    .map(({ userId, name }) => ({ userId, name }));
}

function mapVersion(
  version: {
    id: string;
    startMs: number;
    endMs: number;
    createdAt: Date;
    createdByUserId: string;
    createdBy: { id: string; name: string | null; email: string };
    reactions: Array<{
      reaction: "LIKE" | "DISLIKE";
      userId: string;
      user: { id: string; name: string | null; email: string; image: string | null };
    }>;
  },
  isCurrent: boolean,
  currentUserId: string,
) {
  return {
    id: version.id,
    startMs: version.startMs,
    endMs: version.endMs,
    createdAt: version.createdAt.toISOString(),
    createdByUserId: version.createdByUserId,
    createdByName: formatUserName(version.createdBy),
    isCurrent,
    reactions: mapVersionReactions(version.reactions, currentUserId),
  };
}

function resolveClipPlayback(
  clip: {
    startMs: number;
    endMs: number;
    proposal: {
      versions: Array<{
        id: string;
        startMs: number;
        endMs: number;
        createdAt: Date;
        createdByUserId: string;
        createdBy: { name: string | null; email: string };
      }>;
    } | null;
  },
): PlaybackRange {
  const latest = getLatestVersion(clip.proposal?.versions ?? []);
  return resolvePlaybackRange(
    { startMs: clip.startMs, endMs: clip.endMs },
    latest,
  );
}

export async function loadSessionTrackSummaries(sessionId: string) {
  const [clips, locksByClipId] = await Promise.all([
    prisma.trackClip.findMany({
      where: { sessionId },
      orderBy: { position: "asc" },
      include: {
        ...proposalInclude,
        ...trackAttentionUserInclude,
      },
    }),
    loadActiveTrackEditLocksForSession(sessionId),
  ]);

  return clips.map((clip) => {
    const versions = clip.proposal?.versions ?? [];
    const latest = getLatestVersion(versions);
    const playbackRange = resolveClipPlayback(clip);
    const { likeCount, dislikeCount } = latest
      ? reactionCountsFromEntries(latest.reactions ?? [])
      : { likeCount: 0, dislikeCount: 0 };

    return {
      id: clip.id,
      spotifyTrackId: clip.spotifyTrackId,
      trackName: clip.trackName,
      artistName: clip.artistName,
      albumArtUrl: clip.albumArtUrl,
      durationMs: clip.durationMs,
      position: clip.position,
      defaultStartMs: clip.startMs,
      defaultEndMs: clip.endMs,
      playbackRange,
      versionCount: versions.length,
      contributors: contributorsFromVersions(versions),
      likeCount,
      dislikeCount,
      needsAttention: clip.needsAttention,
      attentionFlaggedBy: mapAttentionFlaggedBy(clip.needsAttentionBy),
      attentionComment: clip.needsAttentionComment,
      editingBy: locksByClipId.get(clip.id) ?? null,
    };
  });
}

export type SessionEditor = {
  userId: string;
  name: string;
  trackCount: number;
  lastEditedAt: string;
};

export async function loadSessionEditors(sessionId: string): Promise<SessionEditor[]> {
  const groups = await prisma.clipProposalVersion.groupBy({
    by: ["createdByUserId"],
    where: { proposal: { trackClip: { sessionId } } },
    _max: { createdAt: true },
    _count: { _all: true },
  });

  if (groups.length === 0) {
    return [];
  }

  const users = await prisma.user.findMany({
    where: { id: { in: groups.map((group) => group.createdByUserId) } },
    select: { id: true, name: true, email: true },
  });
  const usersById = new Map(users.map((user) => [user.id, user]));

  return groups
    .map((group) => {
      const user = usersById.get(group.createdByUserId);
      const lastEditedAt = group._max.createdAt;
      return {
        userId: group.createdByUserId,
        name: user ? formatUserName(user) : "Unknown",
        trackCount: group._count._all,
        lastEditedAt: lastEditedAt?.toISOString() ?? new Date(0).toISOString(),
      };
    })
    .sort(
      (a, b) =>
        new Date(b.lastEditedAt).getTime() - new Date(a.lastEditedAt).getTime(),
    );
}

export async function loadTrackDetail(sessionId: string, clipId: string, userId: string) {
  const clip = await prisma.trackClip.findFirst({
    where: { id: clipId, sessionId },
    include: {
      session: { select: { name: true } },
      ...proposalInclude,
      ...trackAttentionUserInclude,
    },
  });

  if (!clip) return null;

  const versions = clip.proposal?.versions ?? [];
  const latest = getLatestVersion(versions);
  const playbackRange = resolvePlaybackRange(
    { startMs: clip.startMs, endMs: clip.endMs },
    latest,
  );

  return {
    sessionName: clip.session.name,
    track: {
      id: clip.id,
      spotifyTrackId: clip.spotifyTrackId,
      trackName: clip.trackName,
      artistName: clip.artistName,
      albumArtUrl: clip.albumArtUrl,
      durationMs: clip.durationMs,
      position: clip.position,
      defaultStartMs: clip.startMs,
      defaultEndMs: clip.endMs,
    },
    playbackRange,
    needsAttention: clip.needsAttention,
    attentionFlaggedBy: mapAttentionFlaggedBy(clip.needsAttentionBy),
    attentionComment: clip.needsAttentionComment,
    currentVersion: latest
      ? mapVersion(
          {
            ...latest,
            createdBy: latest.createdBy,
            reactions: latest.reactions ?? [],
          },
          true,
          userId,
        )
      : null,
    versions: versions.map((version) =>
      mapVersion(
        {
          ...version,
          createdBy: version.createdBy,
          reactions: version.reactions ?? [],
        },
        version.id === latest?.id,
        userId,
      ),
    ),
    currentUserId: userId,
  };
}

export function attachPlaybackRanges<
  T extends {
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
  },
>(clips: T[]) {
  return clips.map((clip) => {
    const latest = getLatestVersion(clip.proposal?.versions ?? []);
    const playbackRange: PlaybackRange = resolvePlaybackRange(
      { startMs: clip.startMs, endMs: clip.endMs },
      latest,
    );
    return {
      ...clip,
      playbackStartMs: playbackRange.startMs,
      playbackEndMs: playbackRange.endMs,
      playbackRange,
    };
  });
}
