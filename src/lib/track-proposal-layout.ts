import type { PlaybackRange } from "@/lib/clip-selection";

export type LayoutProposal = {
  id: string;
  userName: string;
  startMs: number;
  endMs: number;
  voteCount: number;
  isWinner: boolean;
  isMine: boolean;
  isDefault: boolean;
};

type ProposalInput = {
  id: string;
  userName: string;
  startMs: number;
  endMs: number;
  voteCount: number;
  isWinner: boolean;
  isMine: boolean;
  createdAt: string;
};

export type TrackProposalLayout = {
  featured: LayoutProposal;
  teamSidebar: LayoutProposal[];
  showYourProposal: boolean;
};

function toLayoutProposal(proposal: ProposalInput): LayoutProposal {
  return {
    id: proposal.id,
    userName: proposal.userName,
    startMs: proposal.startMs,
    endMs: proposal.endMs,
    voteCount: proposal.voteCount,
    isWinner: proposal.isWinner,
    isMine: proposal.isMine,
    isDefault: false,
  };
}

function defaultProposal(track: {
  defaultStartMs: number;
  defaultEndMs: number;
}): LayoutProposal {
  return {
    id: "default",
    userName: "Default clip",
    startMs: track.defaultStartMs,
    endMs: track.defaultEndMs,
    voteCount: 0,
    isWinner: false,
    isMine: false,
    isDefault: true,
  };
}

function sortTeamProposals(proposals: ProposalInput[]) {
  return [...proposals].sort((a, b) => {
    if (a.isWinner !== b.isWinner) return a.isWinner ? -1 : 1;
    if (b.voteCount !== a.voteCount) return b.voteCount - a.voteCount;
    return a.createdAt.localeCompare(b.createdAt);
  });
}

export function resolveTrackProposalLayout(
  track: { defaultStartMs: number; defaultEndMs: number },
  playbackRange: PlaybackRange,
  proposals: ProposalInput[],
): TrackProposalLayout {
  const others = sortTeamProposals(proposals.filter((p) => !p.isMine));

  let featured: LayoutProposal;

  if (playbackRange.source === "vote" && playbackRange.proposalId) {
    const winner = proposals.find((p) => p.id === playbackRange.proposalId);
    featured = winner ? toLayoutProposal(winner) : defaultProposal(track);
  } else if (others.length > 0) {
    featured = toLayoutProposal(others[0]!);
  } else {
    featured = defaultProposal(track);
  }

  const teamSidebar = others
    .filter((p) => p.id !== featured.id)
    .map(toLayoutProposal);

  return {
    featured,
    teamSidebar,
    showYourProposal: !featured.isMine,
  };
}

export function featuredSectionTitle(featured: LayoutProposal): string {
  if (featured.isDefault) return "Default clip";
  if (featured.isWinner) return "Team pick";
  return `${featured.userName}'s proposal`;
}
