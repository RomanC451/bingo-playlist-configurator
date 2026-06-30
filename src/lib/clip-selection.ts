export interface ClipProposalLike {
  id: string;
  startMs: number;
  endMs: number;
  createdAt: Date;
  user?: { name: string | null; email?: string };
}

export interface ClipVoteLike {
  proposalId: string;
}

export interface DefaultClipLike {
  startMs: number;
  endMs: number;
}

export interface PlaybackRange {
  startMs: number;
  endMs: number;
  proposalId?: string;
  proposerName?: string;
  voteCount: number;
  source: "vote" | "default";
}

export function resolvePlaybackRange(
  defaultClip: DefaultClipLike,
  proposals: ClipProposalLike[],
  votes: ClipVoteLike[],
): PlaybackRange {
  if (votes.length === 0 || proposals.length === 0) {
    return {
      startMs: defaultClip.startMs,
      endMs: defaultClip.endMs,
      voteCount: 0,
      source: "default",
    };
  }

  const voteCounts = new Map<string, number>();
  for (const vote of votes) {
    voteCounts.set(vote.proposalId, (voteCounts.get(vote.proposalId) ?? 0) + 1);
  }

  const votedProposals = proposals
    .filter((p) => (voteCounts.get(p.id) ?? 0) > 0)
    .map((p) => ({
      proposal: p,
      voteCount: voteCounts.get(p.id) ?? 0,
    }));

  if (votedProposals.length === 0) {
    return {
      startMs: defaultClip.startMs,
      endMs: defaultClip.endMs,
      voteCount: 0,
      source: "default",
    };
  }

  votedProposals.sort((a, b) => {
    if (b.voteCount !== a.voteCount) return b.voteCount - a.voteCount;
    return a.proposal.createdAt.getTime() - b.proposal.createdAt.getTime();
  });

  const winner = votedProposals[0];
  const proposerName =
    winner.proposal.user?.name ??
    winner.proposal.user?.email?.split("@")[0] ??
    "Team member";

  return {
    startMs: winner.proposal.startMs,
    endMs: winner.proposal.endMs,
    proposalId: winner.proposal.id,
    proposerName,
    voteCount: winner.voteCount,
    source: "vote",
  };
}

export function resolveWinningProposalId(
  proposals: ClipProposalLike[],
  votes: ClipVoteLike[],
): string | null {
  const range = resolvePlaybackRange({ startMs: 0, endMs: 0 }, proposals, votes);
  return range.proposalId ?? null;
}
