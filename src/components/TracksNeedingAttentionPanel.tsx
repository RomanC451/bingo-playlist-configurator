import Link from "next/link";
import { AlertTriangle } from "lucide-react";
import { AttentionFlaggedByAvatar } from "@/components/AttentionFlaggedByAvatar";
import { needsAttentionRowClassName } from "@/components/TrackClipStatus";
import type { AttentionFlaggedBy } from "@/lib/track-attention";
import { cn } from "@/lib/utils";

export interface AttentionTrackSummary {
  id: string;
  trackName: string;
  artistName: string;
  albumArtUrl: string | null;
  position: number;
  sessionId: string;
  sessionName: string;
  flaggedBy: AttentionFlaggedBy | null;
  comment: string | null;
}
export function TracksNeedingAttentionPanel({
  tracks,
  className,
}: {
  tracks: AttentionTrackSummary[];
  className?: string;
}) {
  return (
    <section
      className={cn(
        "rounded-xl border border-border bg-card p-5 shadow-sm lg:col-span-2",
        className,
      )}
    >
      <div className="mb-4 flex items-start gap-3">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-rose-500/10 text-rose-600 dark:text-rose-400">
          <AlertTriangle className="size-4" aria-hidden="true" />
        </span>
        <div>
          <h2 className="text-lg font-medium">Tracks needing attention</h2>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Songs flagged by your team that still need a fix.
          </p>
        </div>
      </div>

      {tracks.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border px-4 py-6 text-center text-sm text-muted-foreground">
          No tracks are flagged right now.
        </p>
      ) : (
        <ul className="space-y-2">
          {tracks.map((track) => (
            <li key={track.id}>
              <Link
                href={`/sessions/${track.sessionId}/tracks/${track.id}`}
                className={cn(
                  "flex items-center gap-3 rounded-lg border border-border px-3 py-2.5 transition-colors hover:border-rose-300/60",
                  needsAttentionRowClassName(true),
                )}
              >
                {track.albumArtUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={track.albumArtUrl}
                    alt=""
                    className="size-10 shrink-0 rounded object-cover"
                  />
                ) : (
                  <div className="size-10 shrink-0 rounded bg-secondary" />
                )}
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium">{track.trackName}</span>
                  <span className="block truncate text-sm text-muted-foreground">
                    {track.artistName}
                  </span>
                  {track.comment ? (
                    <span className="mt-1 block line-clamp-2 text-xs text-rose-600/90 dark:text-rose-400/90">
                      {track.comment}
                    </span>
                  ) : null}
                </span>
                <span className="shrink-0 text-right text-sm">
                  {track.flaggedBy ? (
                    <span className="mb-1 flex items-center justify-end gap-1.5">
                      <AttentionFlaggedByAvatar user={track.flaggedBy} size="md" />
                      <span className="max-w-[8rem] truncate text-xs text-rose-600 dark:text-rose-400">
                        {track.flaggedBy.name}
                      </span>
                    </span>
                  ) : null}
                  <span className="block font-medium text-foreground">{track.sessionName}</span>
                  <span className="block text-xs text-muted-foreground">
                    Track {track.position + 1}
                  </span>
                </span>              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
