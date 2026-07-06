"use client";

import { useState } from "react";
import {
  ListMusic,
  MoreVertical,
  Music2,
  Pencil,
  Play,
  Scissors,
  User,
} from "lucide-react";
import { MemberAvatarStack, type MemberUser } from "@/components/MemberAvatarStack";
import { SessionActionsDropdown } from "@/components/SessionActionsDropdown";
import { Button } from "@/components/ui/button";
import { getReviewActionLabel, type UserReviewProgress } from "@/lib/track-review";

const ACCENT_COLORS = ["#059669", "#0d9488", "#0891b2", "#6366f1", "#9333ea", "#db2777"];

export function accentForSession(id: string): string {
  let hash = 0;
  for (const char of id) {
    hash = (hash * 31 + char.charCodeAt(0)) | 0;
  }
  return ACCENT_COLORS[Math.abs(hash) % ACCENT_COLORS.length]!;
}

export type SessionCardData = {
  id: string;
  name: string;
  playlist: string;
  trackCount: number;
  owner: string;
  clipRange: string;
  playlistImageUrl: string | null;
  accent: string;
  userReviewProgress: UserReviewProgress;
};

export function SessionCard({
  session,
  teamMembers = [],
  showMemberPhotos,
  onPlay,
  onEdit,
  onTeamProgress,
  onDelete,
}: {
  session: SessionCardData;
  teamMembers?: MemberUser[];
  showMemberPhotos?: boolean;
  onPlay?: (id: string) => void;
  onEdit?: (id: string) => void;
  onTeamProgress?: (id: string) => void;
  onDelete?: (id: string) => void;
}) {
  const [imageFailed, setImageFailed] = useState(false);
  const showImage = session.playlistImageUrl && !imageFailed;
  const reviewActionLabel = getReviewActionLabel(session.userReviewProgress.reviewed);

  return (
    <div className="group relative flex flex-col gap-4 rounded-xl border border-border bg-card p-4 transition-colors hover:border-primary/40 sm:flex-row sm:items-center sm:gap-5 sm:p-5">
      {teamMembers.length > 0 && (
        <MemberAvatarStack
          members={teamMembers}
          showPhotos={showMemberPhotos}
          className="absolute right-4 top-4 z-10"
        />
      )}
      <div
        className="relative flex size-16 shrink-0 items-center justify-center overflow-hidden rounded-lg sm:size-[68px]"
        style={showImage ? undefined : { backgroundColor: session.accent }}
        aria-hidden="true"
      >
        {showImage ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={session.playlistImageUrl!}
            alt=""
            onError={() => setImageFailed(true)}
            className="size-full object-cover"
          />
        ) : (
          <Music2 className="size-7 text-background" strokeWidth={2.5} />
        )}
        <span className="absolute -bottom-1.5 -right-1.5 flex size-7 items-center justify-center rounded-full border-2 border-card bg-primary">
          <Play className="size-3 fill-primary-foreground text-primary-foreground" />
        </span>
      </div>

      <div className="min-w-0 flex-1">
        <h3
          className={`truncate text-base font-semibold leading-tight text-foreground ${teamMembers.length > 0 ? "pr-24 sm:pr-28" : ""}`}
        >
          {session.name}
        </h3>
        <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-sm text-muted-foreground">
          <span className="inline-flex items-center gap-1.5">
            <ListMusic className="size-4 shrink-0 text-primary" />
            <span className="truncate">{session.playlist}</span>
          </span>
          <span className="inline-flex items-center gap-1.5">
            <Music2 className="size-4 shrink-0" />
            {session.trackCount} tracks
          </span>
          <span className="inline-flex items-center gap-1.5">
            <User className="size-4 shrink-0" />
            {session.owner}
          </span>
        </div>
        <div className="mt-2.5">
          <span className="inline-flex items-center gap-1.5 rounded-md bg-secondary px-2 py-0.5 font-mono text-xs text-secondary-foreground">
            <Scissors className="size-3" />
            Clip {session.clipRange}
          </span>
        </div>
      </div>

      <div className="flex items-center gap-2 border-t border-border pt-3 sm:border-t-0 sm:pt-0">
        <Button
          onClick={() => onPlay?.(session.id)}
          className="flex-1 gap-2 font-semibold sm:flex-none"
        >
          <Play className="size-4 fill-current" />
          Play
        </Button>
        <Button
          variant="secondary"
          onClick={() => onEdit?.(session.id)}
          className="gap-2"
        >
          <Pencil className="size-4" />
          <span className="sm:not-sr-only">Edit</span>
        </Button>

        <SessionActionsDropdown
          sessionId={session.id}
          reviewLabel={reviewActionLabel}
          onTeamProgress={() => onTeamProgress?.(session.id)}
          onDelete={onDelete ? () => onDelete(session.id) : undefined}
          trigger={
            <Button type="button" variant="ghost" size="icon" aria-label="Actions">
              <MoreVertical className="size-4" aria-hidden="true" />
            </Button>
          }
        />
      </div>
    </div>
  );
}

export function SessionCardSkeleton() {
  return (
    <div className="flex flex-col gap-4 rounded-xl border border-border bg-card p-4 sm:flex-row sm:items-center sm:gap-5 sm:p-5">
      <div className="size-16 shrink-0 rounded-lg bg-muted sm:size-[68px]" />
      <div className="min-w-0 flex-1 space-y-2">
        <div className="h-5 w-40 rounded bg-muted" />
        <div className="h-4 w-full max-w-sm rounded bg-muted" />
        <div className="h-5 w-24 rounded bg-muted" />
      </div>
      <div className="flex gap-2 border-t border-border pt-3 sm:border-t-0 sm:pt-0">
        <div className="h-9 flex-1 rounded-lg bg-muted sm:w-24 sm:flex-none" />
        <div className="size-9 rounded-lg bg-muted" />
        <div className="size-9 rounded-lg bg-muted" />
      </div>
    </div>
  );
}
