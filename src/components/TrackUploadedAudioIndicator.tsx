import { Check, Music2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface TrackUploadedAudioIndicatorProps {
  hasUploadedAudio: boolean;
  className?: string;
}

export function TrackUploadedAudioIndicator({
  hasUploadedAudio,
  className,
}: TrackUploadedAudioIndicatorProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium",
        hasUploadedAudio
          ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200"
          : "bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200",
        className,
      )}
      title={hasUploadedAudio ? "Audio uploaded" : "Audio missing"}
    >
      {hasUploadedAudio ? (
        <Check className="size-3" aria-hidden="true" />
      ) : (
        <Music2 className="size-3" aria-hidden="true" />
      )}
      {hasUploadedAudio ? "Audio" : "No audio"}
    </span>
  );
}
