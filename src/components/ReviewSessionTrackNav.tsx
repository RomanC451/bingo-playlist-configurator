"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { ReviewTrackListItem, ReviewTrackStatus } from "@/lib/track-review";
import { isTrackLockedByOther } from "@/lib/track-edit-lock";
import { TrackEditingIndicator } from "@/components/TrackEditingIndicator";
import { cn } from "@/lib/utils";

interface ReviewSessionTrackNavProps {
  currentTrackId?: string | null;
  currentUserId?: string | null;
  tracks: ReviewTrackListItem[];
  onSelectTrack: (track: ReviewTrackListItem) => void;
}

const COLLAPSED_WIDTH_PX = 224;
const MAX_EXPANDED_WIDTH_PX = 448;
const trackListScrollClassName = "h-0 min-h-0 flex-1";

const asideClassName = cn(
  "group/tracks sticky top-12 z-10 h-[calc(100dvh-4rem)] w-full min-h-0",
);

const navShellClassName = cn(
  "flex h-full min-h-0 w-full flex-col overflow-hidden rounded-xl border border-border bg-card p-2",
  "transition-[box-shadow] duration-200",
  "group-hover/tracks:shadow-xl group-hover/tracks:ring-1 group-hover/tracks:ring-border/60",
);

function measureExpandedWidth(nav: HTMLElement): number {
  const prevWidth = nav.style.width;

  nav.style.width = "max-content";

  const leftEdge = nav.getBoundingClientRect().left;
  const maxByViewport = window.innerWidth - leftEdge - 16;

  const measured = Math.min(
    Math.max(nav.offsetWidth, COLLAPSED_WIDTH_PX),
    MAX_EXPANDED_WIDTH_PX,
    maxByViewport,
  );

  nav.style.width = prevWidth;

  return measured;
}

function setNavWidth(nav: HTMLElement, width: number) {
  nav.style.width = `${width}px`;
}

function reviewStatusDotClass(status: ReviewTrackStatus): string {
  switch (status) {
    case "ok":
      return "bg-emerald-500";
    case "not_ok":
      return "bg-rose-500";
    default:
      return "bg-muted-foreground/35";
  }
}

function reviewTrackRowClassName(status: ReviewTrackStatus, active: boolean): string {
  if (active) {
    return cn(
      "bg-zinc-200/90 font-medium text-foreground shadow-sm",
      "ring-2 ring-sky-500/70 ring-inset dark:bg-zinc-800/95 dark:ring-sky-400/55",
    );
  }

  switch (status) {
    case "ok":
      return "bg-emerald-500/[0.07] text-foreground hover:bg-emerald-500/10 dark:bg-emerald-500/[0.09] dark:hover:bg-emerald-500/12";
    case "not_ok":
      return "bg-rose-500/[0.08] text-foreground hover:bg-rose-500/12 dark:bg-rose-500/[0.1] dark:hover:bg-rose-500/14";
    default:
      return "text-foreground hover:bg-secondary";
  }
}

function TrackNavShell({
  navRef,
  children,
  ariaHidden,
}: {
  navRef?: React.RefObject<HTMLElement | null>;
  children: ReactNode;
  ariaHidden?: boolean;
}) {
  return (
    <nav
      ref={navRef}
      aria-label={ariaHidden ? undefined : "Review tracks"}
      aria-hidden={ariaHidden}
      style={{ width: COLLAPSED_WIDTH_PX }}
      className={navShellClassName}
    >
      <div className="flex shrink-0 items-center justify-between gap-2 px-2 pb-2">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Tracks
        </p>
        <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
          <span className="inline-flex items-center gap-1">
            <span className="size-1.5 rounded-full bg-emerald-500" aria-hidden />
            OK
          </span>
          <span className="inline-flex items-center gap-1">
            <span className="size-1.5 rounded-full bg-rose-500" aria-hidden />
            Not OK
          </span>
        </div>
      </div>
      <ScrollArea className={trackListScrollClassName}>{children}</ScrollArea>
    </nav>
  );
}

export function ReviewSessionTrackNav({
  currentTrackId,
  currentUserId,
  tracks,
  onSelectTrack,
}: ReviewSessionTrackNavProps) {
  const navRef = useRef<HTMLElement>(null);
  const activeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    activeRef.current?.scrollIntoView({ block: "nearest" });
  }, [currentTrackId]);

  if (tracks.length === 0) {
    return null;
  }

  return (
    <aside
      className={asideClassName}
      onMouseEnter={() => {
        const nav = navRef.current;
        if (!nav) return;
        setNavWidth(nav, measureExpandedWidth(nav));
      }}
      onMouseLeave={() => {
        const nav = navRef.current;
        if (!nav) return;
        setNavWidth(nav, COLLAPSED_WIDTH_PX);
      }}
    >
      <TrackNavShell navRef={navRef}>
        <ul className="space-y-0.5 pr-2">
          {tracks.map((track) => {
            const isActive = track.id === currentTrackId;
            const lockedByOther = isTrackLockedByOther(track.editingBy, currentUserId);
            return (
              <li key={track.id}>
                <button
                  ref={isActive ? activeRef : undefined}
                  type="button"
                  disabled={lockedByOther}
                  aria-current={isActive ? "true" : undefined}
                  aria-disabled={lockedByOther || undefined}
                  onClick={() => {
                    if (!lockedByOther) {
                      onSelectTrack(track);
                    }
                  }}
                  className={cn(
                    "flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left text-sm transition-colors",
                    reviewTrackRowClassName(track.reviewStatus, isActive),
                    lockedByOther && "cursor-not-allowed opacity-60",
                  )}
                >
                  <span className="w-5 shrink-0 text-center text-xs tabular-nums text-muted-foreground">
                    {track.position + 1}
                  </span>
                  <span
                    className={cn(
                      "size-2 shrink-0 rounded-full",
                      reviewStatusDotClass(track.reviewStatus),
                      isActive && "ring-2 ring-sky-500/80 ring-offset-1 ring-offset-zinc-200 dark:ring-sky-400/70 dark:ring-offset-zinc-800",
                    )}
                    aria-hidden
                  />
                  <span className="min-w-0 flex-1">
                    <span
                      className={cn(
                        "block truncate group-hover/tracks:whitespace-nowrap",
                        isActive && "text-foreground",
                      )}
                    >
                      {track.trackName}
                    </span>
                    <span className="block truncate text-xs font-normal text-muted-foreground group-hover/tracks:whitespace-nowrap">
                      {track.artistName}
                    </span>
                    {track.editingBy && (
                      <TrackEditingIndicator
                        editingBy={track.editingBy}
                        className="mt-1"
                      />
                    )}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      </TrackNavShell>
    </aside>
  );
}

export function ReviewSessionTrackNavSkeleton() {
  return (
    <aside className={asideClassName} aria-busy="true" aria-label="Loading tracks">
      <TrackNavShell ariaHidden>
        <ul className="space-y-0.5 pr-2">
          {Array.from({ length: 12 }, (_, index) => (
            <li
              key={index}
              className="flex items-center gap-2 rounded-lg px-2 py-2"
            >
              <div className="h-3 w-5 shrink-0 animate-pulse rounded bg-secondary" />
              <div className="size-2 shrink-0 animate-pulse rounded-full bg-secondary" />
              <div className="min-w-0 flex-1 space-y-1.5">
                <div className="h-3.5 w-24 animate-pulse rounded bg-secondary" />
                <div className="h-3 w-16 animate-pulse rounded bg-secondary" />
              </div>
            </li>
          ))}
        </ul>
      </TrackNavShell>
    </aside>
  );
}
