import { AttentionFlaggedByAvatar } from "@/components/AttentionFlaggedByAvatar";
import { hasCustomClip, type PlaybackRange } from "@/lib/clip-selection";
import type { AttentionFlaggedBy } from "@/lib/track-attention";
import { cn } from "@/lib/utils";

type ClipStatusRange = Pick<PlaybackRange, "source" | "editorName">;

export function customClipRowClassName(playbackRange: ClipStatusRange): string {
  if (!hasCustomClip(playbackRange)) {
    return "";
  }

  return "bg-sky-500/[0.07] hover:bg-sky-500/10 dark:bg-sky-500/[0.09] dark:hover:bg-sky-500/12";
}

export function needsAttentionRowClassName(needsAttention: boolean): string {
  if (!needsAttention) {
    return "";
  }

  return "bg-rose-500/[0.08] hover:bg-rose-500/12 dark:bg-rose-500/[0.1] dark:hover:bg-rose-500/14";
}

export function trackListLinkClassName(
  playbackRange: ClipStatusRange,
  { active = false, needsAttention = false }: { active?: boolean; needsAttention?: boolean } = {},
): string {
  if (active) {
    return "bg-primary/10 font-medium text-primary";
  }

  return cn(
    "text-foreground hover:bg-secondary",
    needsAttention
      ? needsAttentionRowClassName(true)
      : customClipRowClassName(playbackRange),
  );
}

export function TrackClipDot({
  playbackRange,
  className,
}: {
  playbackRange: ClipStatusRange;
  className?: string;
}) {
  if (!hasCustomClip(playbackRange)) {
    return null;
  }

  const title = playbackRange.editorName
    ? `Custom clip · last saved by ${playbackRange.editorName}`
    : "Custom clip";

  return (
    <span
      className={cn(
        "absolute right-0 top-0 size-2.5 -translate-y-1/4 translate-x-1/4 rounded-full border-2 border-card bg-sky-500",
        className,
      )}
      title={title}
      aria-hidden
    />
  );
}

export function TrackClipStatusText({
  playbackRange,
  className,
  defaultLabel = "Default clip",
}: {
  playbackRange: ClipStatusRange;
  className?: string;
  defaultLabel?: string;
}) {
  if (!hasCustomClip(playbackRange)) {
    return (
      <span className={cn("text-muted-foreground", className)}>{defaultLabel}</span>
    );
  }

  return (
    <span className={cn("text-sky-600 dark:text-sky-400", className)}>
      Saved
      {playbackRange.editorName ? ` · ${playbackRange.editorName}` : ""}
    </span>
  );
}

export function TrackNeedsAttentionText({
  needsAttention,
  flaggedBy,
  comment,
  className,
}: {
  needsAttention: boolean;
  flaggedBy?: AttentionFlaggedBy | null;
  comment?: string | null;
  className?: string;
}) {
  if (!needsAttention) {
    return null;
  }

  return (
    <span className={cn("block min-w-0", className)}>
      <span className="inline-flex items-center gap-1 font-medium text-rose-600 dark:text-rose-400">
        {flaggedBy ? <AttentionFlaggedByAvatar user={flaggedBy} size="sm" /> : null}
        Needs attention
        {flaggedBy ? ` · ${flaggedBy.name}` : ""}
      </span>
      {comment ? (
        <span className="mt-0.5 block truncate text-[10px] font-normal leading-tight text-rose-600/80 dark:text-rose-400/80">
          {comment}
        </span>
      ) : null}
    </span>
  );
}
