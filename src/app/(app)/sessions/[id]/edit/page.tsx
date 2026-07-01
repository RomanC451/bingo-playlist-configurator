"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { Breadcrumb } from "@/components/Breadcrumb";
import { SessionEditorsList, type SessionEditorSummary } from "@/components/SessionEditorsList";
import { TrackClipDot, TrackClipStatusText, TrackNeedsAttentionText, trackListLinkClassName } from "@/components/TrackClipStatus";
import { TrackReactionCounts } from "@/components/TrackReactionCounts";
import { useRecordSessionWork } from "@/hooks/useRecordSessionWork";
import { EditSessionPageSkeleton } from "@/components/page-skeletons";
import { useDelayedLoading } from "@/hooks/useDelayedLoading";
import { hasCustomClip } from "@/lib/clip-selection";
import type { AttentionFlaggedBy } from "@/lib/track-attention";
import { msToLabel } from "@/lib/waveform";
import { readJsonResponse } from "@/lib/read-json-response";
import { cn } from "@/lib/utils";

interface PlaybackRange {
  startMs: number;
  endMs: number;
  versionId?: string;
  editorName?: string;
  source: "saved" | "default";
}

interface TrackContributor {
  userId: string;
  name: string;
}

interface TrackSummary {
  id: string;
  spotifyTrackId: string;
  trackName: string;
  artistName: string;
  albumArtUrl: string | null;
  position: number;
  playbackRange: PlaybackRange;
  versionCount: number;
  contributors: TrackContributor[];
  likeCount: number;
  dislikeCount: number;
  needsAttention: boolean;
  attentionFlaggedBy: AttentionFlaggedBy | null;
  attentionComment: string | null;
}

interface BingoSession {
  id: string;
  name: string;
  tracks: TrackSummary[];
  editors: SessionEditorSummary[];
}

export default function EditSessionPage() {
  const params = useParams();
  const sessionId = params.id as string;
  useRecordSessionWork(sessionId);
  const [session, setSession] = useState<BingoSession | null>(null);
  const [initialized, setInitialized] = useState(false);
  const { loading, begin, end } = useDelayedLoading();
  const [error, setError] = useState<string | null>(null);

  const loadSession = useCallback(async () => {
    begin();
    try {
      const res = await fetch(`/api/sessions/${sessionId}`);
      const data = await readJsonResponse<{ error?: string } & BingoSession>(res);
      if (!res.ok) {
        setError(data.error ?? "Failed to load session");
        setSession(null);
      } else {
        setSession(data);
        setError(null);
      }
      setInitialized(true);
    } catch {
      setError("Failed to load session");
      setSession(null);
      setInitialized(true);
    } finally {
      end();
    }
  }, [begin, end, sessionId]);

  useEffect(() => {
    void loadSession();
  }, [loadSession]);

  if (!initialized) {
    if (loading) return <EditSessionPageSkeleton />;
    return null;
  }

  if (error || !session) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-red-700">
        {error ?? "Session not found"}
      </div>
    );
  }

  return (
    <div>
      <Breadcrumb
        className="mb-4"
        items={[
          { label: "Bingo sessions", href: "/sessions" },
          { label: session.name },
        ]}
      />
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between sm:gap-6">
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold">{session.name}</h1>
          <p className="mt-1 text-sm text-zinc-500">
            Each track has one shared clip. Save a new version when you change the range.
          </p>
        </div>
        <Link
          href={`/sessions/${sessionId}/play`}
          className="inline-flex w-full shrink-0 items-center justify-center whitespace-nowrap rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-emerald-700 sm:w-auto"
        >
          Start playback
        </Link>
      </div>

      <SessionEditorsList editors={session.editors ?? []} />

      {session.tracks.length === 0 ? (
        <div className="mt-8 rounded-lg border border-amber-200 bg-amber-50 p-4 text-amber-800">
          No tracks in this playlist.
        </div>
      ) : (
        <ul className="mt-8 space-y-2">
          {session.tracks.map((track, index) => {
            const range = track.playbackRange;
            const otherEditors = track.contributors
              .map((member) => member.name)
              .filter((name) => name !== range.editorName);

            return (
              <li key={track.id}>
                <Link
                  href={`/sessions/${sessionId}/tracks/${track.id}`}
                  className={cn(
                    "flex items-center gap-4 rounded-xl border border-border bg-card p-4 transition-colors",
                    trackListLinkClassName(range, { needsAttention: track.needsAttention }),
                  )}
                >
                  <span className="w-8 shrink-0 text-sm text-zinc-400">{index + 1}</span>
                  <span className="relative shrink-0">
                    {track.albumArtUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={track.albumArtUrl}
                        alt=""
                        className="h-12 w-12 rounded object-cover"
                      />
                    ) : (
                      <div className="h-12 w-12 rounded bg-zinc-200 dark:bg-zinc-800" />
                    )}
                    <TrackClipDot playbackRange={range} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">{track.trackName}</p>
                    <p className="truncate text-sm text-muted-foreground">{track.artistName}</p>
                    {track.needsAttention && (
                      <TrackNeedsAttentionText
                        needsAttention
                        flaggedBy={track.attentionFlaggedBy}
                        comment={track.attentionComment}
                        className="mt-1 text-[10px] leading-tight"
                      />
                    )}
                    {hasCustomClip(range) && (
                      <>
                        <TrackClipStatusText
                          playbackRange={range}
                          className="mt-1 block text-[10px] font-medium leading-tight"
                        />
                        <TrackReactionCounts
                          likeCount={track.likeCount ?? 0}
                          dislikeCount={track.dislikeCount ?? 0}
                          size="lg"
                          className="mt-1.5"
                        />
                      </>
                    )}
                  </div>
                  <div className="text-right text-sm">
                    <p className="text-zinc-600 dark:text-zinc-300">
                      {msToLabel(range.startMs)} – {msToLabel(range.endMs)}
                    </p>
                    {hasCustomClip(range) && (
                      <p className="mt-0.5 text-xs text-zinc-400">
                        {track.versionCount} version{track.versionCount === 1 ? "" : "s"}
                      </p>
                    )}
                    {otherEditors.length > 0 && (
                      <p className="mt-0.5 text-xs text-zinc-500">
                        Also edited by {otherEditors.join(", ")}
                      </p>
                    )}
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
