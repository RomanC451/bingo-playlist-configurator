import { resolvePlaybackRange, type PlaybackRange } from "@/lib/clip-selection";
import { prisma } from "@/lib/db";

export async function loadSessionTrackSummaries(sessionId: string) {
  const clips = await prisma.trackClip.findMany({
    where: { sessionId },
    orderBy: { position: "asc" },
    include: {
      proposals: {
        include: { user: { select: { id: true, name: true, email: true } } },
        orderBy: { createdAt: "asc" },
      },
      votes: true,
    },
  });

  return clips.map((clip) => {
    const playbackRange = resolvePlaybackRange(
      { startMs: clip.startMs, endMs: clip.endMs },
      clip.proposals,
      clip.votes,
    );

    const voteCounts = new Map<string, number>();
    for (const vote of clip.votes) {
      voteCounts.set(vote.proposalId, (voteCounts.get(vote.proposalId) ?? 0) + 1);
    }

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
      proposalCount: clip.proposals.length,
      voteCount: clip.votes.length,
      winningProposalId: playbackRange.proposalId ?? null,
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
  const groups = await prisma.clipProposal.groupBy({
    by: ["userId"],
    where: { trackClip: { sessionId } },
    _max: { updatedAt: true },
    _count: { _all: true },
  });

  if (groups.length === 0) {
    return [];
  }

  const users = await prisma.user.findMany({
    where: { id: { in: groups.map((group) => group.userId) } },
    select: { id: true, name: true, email: true },
  });
  const usersById = new Map(users.map((user) => [user.id, user]));

  return groups
    .map((group) => {
      const user = usersById.get(group.userId);
      const lastEditedAt = group._max.updatedAt;
      return {
        userId: group.userId,
        name: user?.name ?? user?.email.split("@")[0] ?? "Unknown",
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
      proposals: {
        include: {
          user: { select: { id: true, name: true, email: true } },
        },
        orderBy: { createdAt: "asc" },
      },
      votes: true,
    },
  });

  if (!clip) return null;

  const voteCounts = new Map<string, number>();
  for (const vote of clip.votes) {
    voteCounts.set(vote.proposalId, (voteCounts.get(vote.proposalId) ?? 0) + 1);
  }

  const userVote = clip.votes.find((v) => v.userId === userId) ?? null;
  const userProposal = clip.proposals.find((p) => p.userId === userId) ?? null;
  const playbackRange = resolvePlaybackRange(
    { startMs: clip.startMs, endMs: clip.endMs },
    clip.proposals,
    clip.votes,
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
    proposals: clip.proposals.map((p) => ({
      id: p.id,
      userId: p.userId,
      userName: p.user.name ?? p.user.email.split("@")[0],
      startMs: p.startMs,
      endMs: p.endMs,
      createdAt: p.createdAt.toISOString(),
      voteCount: voteCounts.get(p.id) ?? 0,
      isWinner: p.id === playbackRange.proposalId,
      isMine: p.userId === userId,
    })),
    userVote: userVote ? { proposalId: userVote.proposalId } : null,
    userProposal: userProposal
      ? { id: userProposal.id, startMs: userProposal.startMs, endMs: userProposal.endMs }
      : null,
  };
}

export function attachPlaybackRanges<
  T extends {
    id: string;
    startMs: number;
    endMs: number;
    proposals: Array<{
      id: string;
      startMs: number;
      endMs: number;
      createdAt: Date;
      user?: { name: string | null; email?: string };
    }>;
    votes: Array<{ proposalId: string }>;
  },
>(clips: T[]) {
  return clips.map((clip) => {
    const playbackRange: PlaybackRange = resolvePlaybackRange(
      { startMs: clip.startMs, endMs: clip.endMs },
      clip.proposals,
      clip.votes,
    );
    return {
      ...clip,
      playbackStartMs: playbackRange.startMs,
      playbackEndMs: playbackRange.endMs,
      playbackRange,
    };
  });
}
