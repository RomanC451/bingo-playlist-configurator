"use client";

import type {
  MemberReviewEntry,
  MemberReviewProgress,
  ReviewTrackListItem,
  TrackClipReviewSummary,
} from "@/lib/track-review";
import { cn } from "@/lib/utils";

function reviewsFromOthers(
  reviews: TrackClipReviewSummary[],
  currentUserId?: string | null,
) {
  if (!currentUserId) return reviews;
  return reviews.filter((review) => review.userId !== currentUserId);
}

function ReviewVerdictBadge({ verdict }: { verdict: TrackClipReviewSummary["verdict"] }) {
  const isOk = verdict === "OK";
  return (
    <span
      className={cn(
        "inline-flex shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
        isOk
          ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300"
          : "bg-rose-500/15 text-rose-700 dark:text-rose-300",
      )}
    >
      {isOk ? "OK" : "Not OK"}
    </span>
  );
}

function ReviewEntry({ review }: { review: TrackClipReviewSummary }) {
  return (
    <li
      className={cn(
        "rounded-lg border border-border bg-card/50 px-3 py-2.5",
        !review.isCurrent && "opacity-60",
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-sm font-medium">{review.userName}</p>
          {!review.isCurrent && (
            <p className="text-[10px] text-muted-foreground">Older clip version</p>
          )}
        </div>
        <ReviewVerdictBadge verdict={review.verdict} />
      </div>
      {review.comment && (
        <p className="mt-2 text-sm leading-snug text-muted-foreground">{review.comment}</p>
      )}
    </li>
  );
}

export function TrackReviewsPanel({
  track,
  currentUserId,
  className,
}: {
  track: ReviewTrackListItem;
  currentUserId?: string | null;
  className?: string;
}) {
  const currentReviews = reviewsFromOthers(
    track.reviews.filter((review) => review.isCurrent),
    currentUserId,
  );
  const olderReviews = reviewsFromOthers(
    track.reviews.filter((review) => !review.isCurrent),
    currentUserId,
  );

  if (currentReviews.length === 0 && olderReviews.length === 0) {
    return (
      <div
        className={cn(
          "rounded-xl border border-dashed border-border px-4 py-3 text-sm text-muted-foreground",
          className,
        )}
      >
        No other team members have reviewed this clip yet.
      </div>
    );
  }

  return (
    <div className={cn("rounded-xl border border-border bg-card p-4", className)}>
      <h3 className="text-sm font-semibold">Team reviews</h3>
      {currentReviews.length === 0 ? (
        <p className="mt-2 text-sm text-muted-foreground">
          No other team members have reviewed the current clip version yet.
        </p>
      ) : (
        <ul className="mt-3 space-y-2">
          {currentReviews.map((review) => (
            <ReviewEntry
              key={`${review.userId}-${review.reviewedAt}`}
              review={review}
            />
          ))}
        </ul>
      )}
      {olderReviews.length > 0 && (
        <details className="mt-4">
          <summary className="cursor-pointer text-xs text-muted-foreground hover:text-foreground">
            {olderReviews.length} older review{olderReviews.length === 1 ? "" : "s"} from other members
          </summary>
          <ul className="mt-2 space-y-2">
            {olderReviews.map((review) => (
              <ReviewEntry
                key={`${review.userId}-${review.reviewedAt}-old`}
                review={review}
              />
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}

function MemberReviewEntryRow({ entry }: { entry: MemberReviewEntry }) {
  return (
    <li className="flex items-start justify-between gap-3 rounded-lg border border-border bg-card/50 px-3 py-2">
      <div className="min-w-0">
        <p className="truncate text-sm font-medium">{entry.trackName}</p>
        <p className="truncate text-xs text-muted-foreground">{entry.artistName}</p>
        {entry.comment && (
          <p className="mt-1 text-sm leading-snug text-muted-foreground">{entry.comment}</p>
        )}
      </div>
      <ReviewVerdictBadge verdict={entry.verdict} />
    </li>
  );
}

function MemberProgressRow({
  member,
  isYou,
  defaultOpen,
}: {
  member: MemberReviewProgress;
  isYou: boolean;
  defaultOpen?: boolean;
}) {
  const pct = member.total > 0 ? Math.round((member.reviewed / member.total) * 100) : 0;

  return (
    <li className="rounded-xl border border-border bg-card">
      <details open={defaultOpen} className="group">
        <summary className="cursor-pointer list-none px-4 py-3 [&::-webkit-details-marker]:hidden">
          <div className="flex items-center gap-3">
            <div
              className={cn(
                "flex size-8 shrink-0 items-center justify-center rounded-full bg-secondary text-xs font-semibold",
                isYou && "ring-2 ring-sky-500/50",
              )}
            >
              {member.userName.charAt(0).toUpperCase()}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between gap-2">
                <p className="truncate font-medium">
                  {member.userName}
                  {isYou && (
                    <span className="ml-1.5 text-xs font-normal text-muted-foreground">(you)</span>
                  )}
                </p>
                <p className="shrink-0 text-sm tabular-nums text-muted-foreground">
                  {member.reviewed}/{member.total}
                </p>
              </div>
              <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-secondary">
                <div
                  className="h-full rounded-full bg-emerald-500 transition-all"
                  style={{ width: `${pct}%` }}
                />
              </div>
              <div className="mt-1.5 flex gap-3 text-[11px] text-muted-foreground">
                <span>{member.okCount} OK</span>
                <span>{member.notOkCount} Not OK</span>
                <span>{member.remaining} left</span>
              </div>
            </div>
          </div>
        </summary>
        <div className="border-t border-border px-4 pb-3 pt-2">
          {member.reviews.length === 0 ? (
            <p className="text-sm text-muted-foreground">No reviews yet for current clip versions.</p>
          ) : (
            <ul className="space-y-2">
              {member.reviews.map((entry) => (
                <MemberReviewEntryRow key={`${member.userId}-${entry.trackId}`} entry={entry} />
              ))}
            </ul>
          )}
        </div>
      </details>
    </li>
  );
}

export function AllReviewsDialog({
  open,
  members,
  currentUserId,
  onClose,
}: {
  open: boolean;
  members: MemberReviewProgress[];
  currentUserId?: string | null;
  onClose: () => void;
}) {
  const sortedMembers = [...members].sort((a, b) => {
    if (currentUserId && a.userId === currentUserId) return 1;
    if (currentUserId && b.userId === currentUserId) return -1;
    return b.reviewed - a.reviewed;
  });

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="presentation">
      <button
        type="button"
        aria-label="Close dialog"
        className="absolute inset-0 bg-black/40"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="all-reviews-title"
        className="relative flex max-h-[min(36rem,90dvh)] w-full max-w-xl flex-col overflow-hidden rounded-xl border border-border bg-background shadow-xl"
      >
        <div className="border-b border-border px-5 py-4">
          <h2 id="all-reviews-title" className="text-lg font-semibold">
            Team reviews
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Each member&apos;s progress and reviews for the current clip versions.
          </p>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
          {sortedMembers.length === 0 ? (
            <p className="text-sm text-muted-foreground">No team members yet.</p>
          ) : (
            <ul className="space-y-3">
              {sortedMembers.map((member) => (
                <MemberProgressRow
                  key={member.userId}
                  member={member}
                  isYou={member.userId === currentUserId}
                />
              ))}
            </ul>
          )}
        </div>
        <div className="border-t border-border px-5 py-3">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-border px-4 py-2 text-sm hover:bg-secondary"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

export function AllReviewsButton({
  members,
  currentUserId,
  onClick,
  className,
}: {
  members: MemberReviewProgress[];
  currentUserId?: string | null;
  onClick: () => void;
  className?: string;
}) {
  const others = currentUserId
    ? members.filter((member) => member.userId !== currentUserId)
    : members;
  const reviewedCount = others.reduce((sum, member) => sum + member.reviewed, 0);

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-lg border border-border px-3 py-1.5 text-sm text-foreground hover:bg-secondary",
        className,
      )}
    >
      Team reviews{reviewedCount > 0 ? ` (${reviewedCount})` : ""}
    </button>
  );
}
