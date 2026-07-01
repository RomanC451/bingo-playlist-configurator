import type { ClipReactionType } from "@prisma/client";

export type ClipReactionValue = "like" | "dislike";

export type VersionReactionUser = {
  userId: string;
  name: string;
  image: string | null;
};

export type VersionReactions = {
  likeCount: number;
  dislikeCount: number;
  currentUserReaction: ClipReactionValue | null;
  likedBy: VersionReactionUser[];
  dislikedBy: VersionReactionUser[];
};

function formatUserName(user: { name: string | null; email: string }) {
  return user.name ?? user.email.split("@")[0];
}

export function reactionCountsFromEntries(
  reactions: Array<{ reaction: ClipReactionType }>,
): { likeCount: number; dislikeCount: number } {
  let likeCount = 0;
  let dislikeCount = 0;

  for (const entry of reactions) {
    if (entry.reaction === "LIKE") {
      likeCount++;
    } else {
      dislikeCount++;
    }
  }

  return { likeCount, dislikeCount };
}

export function mapClipReactionType(reaction: ClipReactionType): ClipReactionValue {
  return reaction === "LIKE" ? "like" : "dislike";
}

export function clipReactionTypeFromValue(value: ClipReactionValue): ClipReactionType {
  return value === "like" ? "LIKE" : "DISLIKE";
}

export function mapVersionReactions(
  reactions: Array<{
    reaction: ClipReactionType;
    userId: string;
    user: { id: string; name: string | null; email: string; image: string | null };
  }>,
  currentUserId: string,
): VersionReactions {
  const likedBy: VersionReactionUser[] = [];
  const dislikedBy: VersionReactionUser[] = [];
  let currentUserReaction: ClipReactionValue | null = null;

  for (const entry of reactions) {
    const mapped = {
      userId: entry.userId,
      name: formatUserName(entry.user),
      image: entry.user.image,
    };

    if (entry.reaction === "LIKE") {
      likedBy.push(mapped);
    } else {
      dislikedBy.push(mapped);
    }

    if (entry.userId === currentUserId) {
      currentUserReaction = mapClipReactionType(entry.reaction);
    }
  }

  return {
    likeCount: likedBy.length,
    dislikeCount: dislikedBy.length,
    currentUserReaction,
    likedBy,
    dislikedBy,
  };
}
