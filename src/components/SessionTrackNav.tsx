"use client";

import Link from "next/link";
import { useEffect, useRef, type ReactNode } from "react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { TrackClipDot, TrackClipStatusText, TrackNeedsAttentionText, trackListLinkClassName } from "@/components/TrackClipStatus";
import { TrackReactionCounts } from "@/components/TrackReactionCounts";
import { hasCustomClip } from "@/lib/clip-selection";
import type { AttentionFlaggedBy } from "@/lib/track-attention";
import { cn } from "@/lib/utils";

export interface SessionTrackNavItem {
  id: string;
  trackName: string;
  artistName: string;
  albumArtUrl: string | null;
  position: number;
  playbackRange: {
    source: "saved" | "default";
    editorName?: string;
  };
  likeCount: number;
  dislikeCount: number;
  needsAttention: boolean;
  attentionFlaggedBy: AttentionFlaggedBy | null;
  attentionComment: string | null;
}

interface SessionTrackNavProps {
  sessionId: string;
  currentTrackId: string;
  tracks: SessionTrackNavItem[];
  onBeforeNavigate?: (href: string) => boolean;
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
      aria-label={ariaHidden ? undefined : "Session tracks"}
      aria-hidden={ariaHidden}
      style={{ width: COLLAPSED_WIDTH_PX }}
      className={navShellClassName}
    >
      <p className="shrink-0 px-2 pb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
        Tracks
      </p>
      <ScrollArea className={trackListScrollClassName}>{children}</ScrollArea>
    </nav>
  );
}

export function SessionTrackNav({
  sessionId,
  currentTrackId,
  tracks,
  onBeforeNavigate,
}: SessionTrackNavProps) {
  const navRef = useRef<HTMLElement>(null);
  const activeRef = useRef<HTMLAnchorElement>(null);

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
        if (!nav) {
          return;
        }
        setNavWidth(nav, measureExpandedWidth(nav));
      }}
      onMouseLeave={() => {
        const nav = navRef.current;
        if (!nav) {
          return;
        }
        setNavWidth(nav, COLLAPSED_WIDTH_PX);
      }}
    >
      <TrackNavShell navRef={navRef}>
        <ul className="space-y-0.5 pr-2">
          {tracks.map((track) => {
            const isActive = track.id === currentTrackId;
            const href = `/sessions/${sessionId}/tracks/${track.id}`;
            return (
              <li key={track.id}>
                <Link
                  ref={isActive ? activeRef : undefined}
                  href={href}
                  onClick={(event) => {
                    if (onBeforeNavigate && !onBeforeNavigate(href)) {
                      event.preventDefault();
                    }
                  }}
                  aria-current={isActive ? "page" : undefined}
                  className={cn(
                    "flex items-center gap-2 rounded-lg px-2 py-2 text-sm transition-colors",
                    trackListLinkClassName(track.playbackRange, {
                      active: isActive,
                      needsAttention: track.needsAttention,
                    }),
                  )}
                >
                  <span className="w-5 shrink-0 text-center text-xs text-muted-foreground">
                    {track.position + 1}
                  </span>
                  <span className="relative shrink-0">
                    {track.albumArtUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={track.albumArtUrl}
                        alt=""
                        className="size-9 rounded object-cover"
                      />
                    ) : (
                      <div className="size-9 rounded bg-secondary" />
                    )}
                    <TrackClipDot playbackRange={track.playbackRange} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate group-hover/tracks:whitespace-nowrap">
                      {track.trackName}
                    </span>
                    <span className="block truncate text-xs font-normal text-muted-foreground group-hover/tracks:whitespace-nowrap">
                      {track.artistName}
                    </span>
                    {track.needsAttention && (
                      <TrackNeedsAttentionText
                        needsAttention
                        flaggedBy={track.attentionFlaggedBy}
                        comment={track.attentionComment}
                        className="truncate text-[10px] leading-tight group-hover/tracks:whitespace-normal"
                      />
                    )}
                    {hasCustomClip(track.playbackRange) && (
                      <>
                        <TrackClipStatusText
                          playbackRange={track.playbackRange}
                          className="block truncate text-[10px] font-medium leading-tight group-hover/tracks:whitespace-nowrap"
                        />
                        <TrackReactionCounts
                          likeCount={track.likeCount ?? 0}
                          dislikeCount={track.dislikeCount ?? 0}
                          size="md"
                          className="mt-1"
                        />
                      </>
                    )}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      </TrackNavShell>
    </aside>
  );
}

export function SessionTrackNavSkeleton() {
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
              <div className="size-9 shrink-0 animate-pulse rounded bg-secondary" />
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
