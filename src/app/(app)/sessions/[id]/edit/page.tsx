"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { Breadcrumb } from "@/components/Breadcrumb";
import { SessionEditorsList, type SessionEditorSummary } from "@/components/SessionEditorsList";
import { useRecordSessionWork } from "@/hooks/useRecordSessionWork";
import { EditSessionPageSkeleton } from "@/components/page-skeletons";
import { useDelayedLoading } from "@/hooks/useDelayedLoading";
import { msToLabel } from "@/lib/waveform";
import { readJsonResponse } from "@/lib/read-json-response";

interface PlaybackRange {
  startMs: number;
  endMs: number;
  proposalId?: string;
  proposerName?: string;
  voteCount: number;
  source: "vote" | "default";
}

interface TrackSummary {
  id: string;
  spotifyTrackId: string;
  trackName: string;
  artistName: string;
  albumArtUrl: string | null;
  position: number;
  playbackRange: PlaybackRange;
  proposalCount: number;
  voteCount: number;
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
        items={[
          { label: "Bingo sessions", href: "/sessions" },
          { label: session.name },
        ]}
      />
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">{session.name}</h1>
          <p className="text-sm text-zinc-500">
            Each track has team proposals and votes. The winning clip is used at playback.
          </p>
        </div>
        <Link
          href={`/sessions/${sessionId}/play`}
          className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700"
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
            const badge =
              range.source === "vote"
                ? `Team pick · ${range.proposerName} (${range.voteCount} vote${range.voteCount === 1 ? "" : "s"})`
                : "Default clip";

            return (
              <li key={track.id}>
                <Link
                  href={`/sessions/${sessionId}/tracks/${track.id}`}
                  className="flex items-center gap-4 rounded-xl border border-zinc-200 bg-white p-4 hover:border-emerald-300 dark:border-zinc-800 dark:bg-zinc-950 dark:hover:border-emerald-800"
                >
                  <span className="w-8 shrink-0 text-sm text-zinc-400">{index + 1}</span>
                  {track.albumArtUrl && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={track.albumArtUrl}
                      alt=""
                      className="h-12 w-12 rounded object-cover"
                    />
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">{track.trackName}</p>
                    <p className="truncate text-sm text-zinc-500">{track.artistName}</p>
                  </div>
                  <div className="text-right text-sm">
                    <p className="text-zinc-600 dark:text-zinc-300">
                      {msToLabel(range.startMs)} – {msToLabel(range.endMs)}
                    </p>
                    <p
                      className={`mt-0.5 text-xs ${
                        range.source === "vote"
                          ? "text-emerald-600"
                          : "text-zinc-400"
                      }`}
                    >
                      {badge}
                    </p>
                    <p className="mt-0.5 text-xs text-zinc-400">
                      {track.proposalCount} proposal{track.proposalCount === 1 ? "" : "s"} ·{" "}
                      {track.voteCount} vote{track.voteCount === 1 ? "" : "s"}
                    </p>
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
