"use client";

import { useState } from "react";
import { AlertTriangle } from "lucide-react";
import { AttentionFlaggedByAvatar } from "@/components/AttentionFlaggedByAvatar";
import { FlagAttentionDialog } from "@/components/FlagAttentionDialog";
import { Button } from "@/components/ui/button";
import type { AttentionFlaggedBy } from "@/lib/track-attention";
import { cn } from "@/lib/utils";

export function NeedsAttentionButton({
  needsAttention,
  flaggedBy,
  attentionComment,
  trackName,
  disabled = false,
  loading = false,
  onFlag,
  onClear,
  className,
}: {
  needsAttention: boolean;
  flaggedBy?: AttentionFlaggedBy | null;
  attentionComment?: string | null;
  trackName?: string;
  disabled?: boolean;
  loading?: boolean;
  onFlag: (comment: string) => void | Promise<boolean>;
  onClear: () => void;
  className?: string;
}) {
  const [dialogOpen, setDialogOpen] = useState(false);

  function handleButtonClick() {
    if (needsAttention) {
      onClear();
      return;
    }
    setDialogOpen(true);
  }

  function handleDialogSubmit(comment: string) {
    void (async () => {
      const ok = await onFlag(comment);
      if (ok !== false) {
        setDialogOpen(false);
      }
    })();
  }

  const tooltipLines = [
    flaggedBy ? `Flagged by ${flaggedBy.name}` : null,
    attentionComment,
  ].filter(Boolean);

  return (
    <>
      <span className="group/attention-tip relative inline-flex">
        <Button
          type="button"
          variant={needsAttention ? "default" : "outline"}
          size="sm"
          disabled={disabled || loading}
          aria-pressed={needsAttention}
          className={cn(
            "gap-1.5",
            needsAttention &&
              "border-rose-700 bg-rose-600 text-white hover:bg-rose-700 dark:border-rose-800 dark:bg-rose-700 dark:hover:bg-rose-600",
            className,
          )}
          onClick={handleButtonClick}
        >
          {needsAttention && flaggedBy ? (
            <AttentionFlaggedByAvatar user={flaggedBy} size="sm" className="border-white/30" />
          ) : (
            <AlertTriangle className="size-4 shrink-0" aria-hidden="true" />
          )}
          Needs attention
        </Button>
        {needsAttention && tooltipLines.length > 0 && (
          <span
            role="tooltip"
            className="pointer-events-none absolute bottom-full right-0 z-20 mb-2 hidden w-max max-w-[16rem] rounded-md border border-border bg-popover px-2.5 py-1.5 text-xs leading-snug text-popover-foreground shadow-md group-hover/attention-tip:block"
          >
            {tooltipLines.map((line, index) => (
              <span key={index} className={cn("block", index > 0 && "mt-1 text-muted-foreground")}>
                {line}
              </span>
            ))}
          </span>
        )}
      </span>

      <FlagAttentionDialog
        open={dialogOpen}
        loading={loading}
        trackName={trackName}
        onClose={() => setDialogOpen(false)}
        onSubmit={handleDialogSubmit}
      />
    </>
  );
}
