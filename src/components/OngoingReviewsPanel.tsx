import Link from "next/link";
import { ClipboardCheck } from "lucide-react";
import type { OngoingSessionReview } from "@/lib/track-review";
import { cn } from "@/lib/utils";

export function OngoingReviewsPanel({
  reviews,
  className,
}: {
  reviews: OngoingSessionReview[];
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
        <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-sky-500/10 text-sky-600 dark:text-sky-400">
          <ClipboardCheck className="size-4" aria-hidden="true" />
        </span>
        <div>
          <h2 className="text-lg font-medium">Your ongoing reviews</h2>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Sessions where you started reviewing clips but still have tracks left.
          </p>
        </div>
      </div>

      {reviews.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border px-4 py-6 text-center text-sm text-muted-foreground">
          No reviews in progress. Start one from a session&apos;s actions menu.
        </p>
      ) : (
        <ul className="space-y-2">
          {reviews.map((review) => {
            const { reviewed, remaining, total } = review.userReviewProgress;
            const pct = total > 0 ? Math.round((reviewed / total) * 100) : 0;

            return (
              <li key={review.sessionId}>
                <Link
                  href={`/sessions/${review.sessionId}/review`}
                  className="flex items-center gap-3 rounded-lg border border-border px-3 py-3 transition-colors hover:border-sky-300/60 hover:bg-secondary/40"
                >
                  {review.playlistImageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={review.playlistImageUrl}
                      alt=""
                      className="size-12 shrink-0 rounded object-cover"
                    />
                  ) : (
                    <div className="size-12 shrink-0 rounded bg-secondary" />
                  )}
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium">{review.sessionName}</span>
                    <span className="block truncate text-sm text-muted-foreground">
                      {review.spotifyPlaylistName ?? "Spotify playlist"}
                    </span>
                    <span className="mt-2 block h-1.5 overflow-hidden rounded-full bg-secondary">
                      <span
                        className="block h-full rounded-full bg-emerald-500"
                        style={{ width: `${pct}%` }}
                      />
                    </span>
                    <span className="mt-1.5 block text-xs text-muted-foreground">
                      {reviewed} of {total} reviewed · {remaining} left
                    </span>
                  </span>
                  <span className="shrink-0 rounded-lg border border-border px-3 py-1.5 text-sm font-medium">
                    Continue
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
