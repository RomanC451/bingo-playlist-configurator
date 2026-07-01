import { ThumbsDown, ThumbsUp } from "lucide-react";
import { cn } from "@/lib/utils";

const sizeClasses = {
  sm: {
    root: "gap-2 text-xs",
    item: "gap-0.5",
    icon: "size-3",
  },
  md: {
    root: "gap-2 text-xs",
    item: "gap-1",
    icon: "size-3.5",
  },
  lg: {
    root: "gap-2.5 text-sm",
    item: "gap-1",
    icon: "size-4",
  },
} as const;

export function TrackReactionCounts({
  likeCount,
  dislikeCount,
  className,
  size = "md",
}: {
  likeCount: number;
  dislikeCount: number;
  className?: string;
  size?: keyof typeof sizeClasses;
}) {
  const styles = sizeClasses[size];

  return (
    <span
      className={cn(
        "inline-flex items-center font-medium tabular-nums text-muted-foreground",
        styles.root,
        className,
      )}
    >
      <span className={cn("inline-flex items-center", styles.item)}>
        <ThumbsUp className={cn("shrink-0", styles.icon)} aria-hidden="true" />
        {likeCount}
      </span>
      <span className={cn("inline-flex items-center", styles.item)}>
        <ThumbsDown className={cn("shrink-0", styles.icon)} aria-hidden="true" />
        {dislikeCount}
      </span>
    </span>
  );
}