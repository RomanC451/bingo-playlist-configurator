"use client";

import { useEffect, useId, useRef, useState, type ComponentProps } from "react";
import { ThumbsDown, ThumbsUp, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAlternatingMemberPhotos } from "@/components/MemberAvatarStack";
import type { ClipReactionValue, VersionReactionUser, VersionReactions } from "@/lib/clip-reactions";
import { cn } from "@/lib/utils";

const REACTION_AVATAR_COLORS = [
  "bg-emerald-600 text-white",
  "bg-sky-600 text-white",
  "bg-violet-600 text-white",
  "bg-amber-600 text-white",
  "bg-rose-600 text-white",
] as const;

function reactionAvatarColor(userId: string): string {
  let hash = 0;
  for (let i = 0; i < userId.length; i++) {
    hash = (hash + userId.charCodeAt(i)) % REACTION_AVATAR_COLORS.length;
  }
  return REACTION_AVATAR_COLORS[hash]!;
}

function reactionNamesLabel(users: VersionReactionUser[]): string | null {
  if (users.length === 0) {
    return null;
  }
  return users.map((user) => user.name).join(", ");
}

function ReactionAvatar({
  user,
  showPhoto,
}: {
  user: VersionReactionUser;
  showPhoto: boolean;
}) {
  const initial = user.name.charAt(0).toUpperCase();
  const hasImage = Boolean(user.image);

  if (!hasImage) {
    return (
      <span
        className={cn(
          "flex size-5 shrink-0 items-center justify-center rounded-full border border-background text-[10px] font-semibold",
          reactionAvatarColor(user.userId),
        )}
      >
        {initial}
      </span>
    );
  }

  return (
    <span className="relative flex size-5 shrink-0 items-center justify-center overflow-hidden rounded-full border border-background">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={user.image!}
        alt=""
        className={cn(
          "absolute inset-0 size-full object-cover transition-opacity duration-500",
          showPhoto ? "opacity-100" : "opacity-0",
        )}
      />
      <span
        className={cn(
          "flex size-full items-center justify-center text-[10px] font-semibold transition-opacity duration-500",
          reactionAvatarColor(user.userId),
          showPhoto ? "opacity-0" : "opacity-100",
        )}
      >
        {initial}
      </span>
    </span>
  );
}

function ReactionMembersPreview({ users }: { users: VersionReactionUser[] }) {
  const showPhotos = useAlternatingMemberPhotos();

  if (users.length === 0) {
    return null;
  }

  const visible = users.slice(0, 2);
  const overflow = users.length - visible.length;

  return (
    <span className="flex items-center">
      <span className="flex -space-x-1.5">
        {visible.map((user) => (
          <ReactionAvatar key={user.userId} showPhoto={showPhotos} user={user} />
        ))}
      </span>
      {overflow > 0 && (
        <span className="ml-1 text-xs font-medium tabular-nums">+{overflow}</span>
      )}
    </span>
  );
}

function ReactionTooltipButton({
  tooltip,
  className,
  children,
  ...props
}: ComponentProps<typeof Button> & {
  tooltip: string | null;
}) {
  return (
    <span className="group/reaction-tip relative inline-flex">
      <Button className={className} {...props}>
        {children}
      </Button>
      {tooltip && (
        <span
          role="tooltip"
          className="pointer-events-none absolute bottom-full right-0 z-20 mb-2 hidden w-max max-w-[14rem] rounded-md border border-border bg-popover px-2.5 py-1.5 text-xs leading-snug text-popover-foreground shadow-md group-hover/reaction-tip:block"
        >
          {tooltip}
        </span>
      )}
    </span>
  );
}

function ReactionVotersPanel({
  reactions,
  panelId,
}: {
  reactions: VersionReactions;
  panelId: string;
}) {
  return (
    <div
      id={panelId}
      className="mt-2 grid gap-3 rounded-lg border border-border bg-muted/30 p-3 text-sm sm:grid-cols-2"
    >
      <div>
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Liked ({reactions.likeCount})
        </p>
        {reactions.likedBy.length > 0 ? (
          <ul className="mt-1.5 space-y-1">
            {reactions.likedBy.map((user) => (
              <li key={user.userId}>{user.name}</li>
            ))}
          </ul>
        ) : (
          <p className="mt-1.5 text-muted-foreground">No likes yet</p>
        )}
      </div>
      <div>
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Disliked ({reactions.dislikeCount})
        </p>
        {reactions.dislikedBy.length > 0 ? (
          <ul className="mt-1.5 space-y-1">
            {reactions.dislikedBy.map((user) => (
              <li key={user.userId}>{user.name}</li>
            ))}
          </ul>
        ) : (
          <p className="mt-1.5 text-muted-foreground">No dislikes yet</p>
        )}
      </div>
    </div>
  );
}

export function ClipVersionReactions({
  reactions,
  disabled = false,
  loading = false,
  onReact,
  className,
  showVoters = true,
}: {
  reactions: VersionReactions;
  disabled?: boolean;
  loading?: boolean;
  onReact: (reaction: ClipReactionValue) => void;
  className?: string;
  showVoters?: boolean;
}) {
  const panelId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const [showVotersPanel, setShowVotersPanel] = useState(false);
  const likeActive = reactions.currentUserReaction === "like";
  const dislikeActive = reactions.currentUserReaction === "dislike";

  useEffect(() => {
    if (!showVotersPanel) return;

    function handlePointerDown(event: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) {
        setShowVotersPanel(false);
      }
    }

    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, [showVotersPanel]);

  return (
    <div ref={rootRef} className={cn("min-w-0", className)}>
      <div
        className={cn(
          "flex flex-wrap items-center gap-2",
          !showVoters && "justify-end",
        )}
      >
        <div className="flex items-center gap-1">
          <ReactionTooltipButton
            type="button"
            variant={likeActive ? "default" : "outline"}
            size="sm"
            className="gap-1.5"
            disabled={disabled || loading}
            aria-pressed={likeActive}
            tooltip={reactionNamesLabel(reactions.likedBy)}
            onClick={() => onReact("like")}
          >
            <ThumbsUp className="size-4 shrink-0" aria-hidden="true" />
            <ReactionMembersPreview users={reactions.likedBy} />
            <span className="sr-only">{reactions.likeCount} likes</span>
          </ReactionTooltipButton>
          <ReactionTooltipButton
            type="button"
            variant={dislikeActive ? "default" : "outline"}
            size="sm"
            className="gap-1.5"
            disabled={disabled || loading}
            aria-pressed={dislikeActive}
            tooltip={reactionNamesLabel(reactions.dislikedBy)}
            onClick={() => onReact("dislike")}
          >
            <ThumbsDown className="size-4 shrink-0" aria-hidden="true" />
            <ReactionMembersPreview users={reactions.dislikedBy} />
            <span className="sr-only">{reactions.dislikeCount} dislikes</span>
          </ReactionTooltipButton>
        </div>
        {showVoters && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="gap-1.5 text-muted-foreground"
            disabled={loading}
            aria-expanded={showVotersPanel}
            aria-controls={panelId}
            onClick={() => setShowVotersPanel((open) => !open)}
          >
            <Users className="size-4" aria-hidden="true" />
            {showVotersPanel ? "Hide voters" : "Who voted?"}
          </Button>
        )}
      </div>
      {showVoters && showVotersPanel && (
        <ReactionVotersPanel reactions={reactions} panelId={panelId} />
      )}
    </div>
  );
}
