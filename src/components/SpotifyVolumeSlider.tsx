"use client";

import { Volume2, VolumeX } from "lucide-react";
import { cn } from "@/lib/utils";

interface SpotifyVolumeSliderProps {
  volume: number;
  onVolumeChange: (volume: number) => void;
  disabled?: boolean;
  className?: string;
  /** Hide the percentage label for tighter header placement. */
  compact?: boolean;
}

export function SpotifyVolumeSlider({
  volume,
  onVolumeChange,
  disabled = false,
  className,
  compact = false,
}: SpotifyVolumeSliderProps) {
  const percent = Math.round(volume * 100);
  const Icon = percent === 0 ? VolumeX : Volume2;

  return (
    <div className={cn("flex min-w-0 items-center gap-2", className)}>
      <Icon className="size-4 shrink-0 text-zinc-500" aria-hidden />
      <input
        type="range"
        min={0}
        max={100}
        step={1}
        value={percent}
        disabled={disabled}
        aria-label="Volume"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={percent}
        aria-valuetext={`${percent} percent`}
        onChange={(event) => onVolumeChange(Number(event.target.value) / 100)}
        className={cn(
          "h-1.5 min-w-0 flex-1 cursor-pointer accent-emerald-600 disabled:cursor-not-allowed disabled:opacity-50",
          compact ? "w-20" : "sm:max-w-40",
        )}
      />
      {!compact && (
        <span className="w-9 shrink-0 text-right text-xs tabular-nums text-zinc-500">
          {percent}%
        </span>
      )}
    </div>
  );
}
