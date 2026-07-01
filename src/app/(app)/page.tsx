"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { History, Users } from "lucide-react";
import { HomePageSkeleton } from "@/components/page-skeletons";
import { SessionPanel } from "@/components/session-panel";
import {
  TracksNeedingAttentionPanel,
  type AttentionTrackSummary,
} from "@/components/TracksNeedingAttentionPanel";
import type { Session } from "@/components/session-card";
import { useDelayedLoading } from "@/hooks/useDelayedLoading";
import { errorMessageFromBody } from "@/lib/api-errors";
import { readJsonResponse } from "@/lib/read-json-response";
import { formatRelativeTime } from "@/lib/relative-time";

interface HomeSessionSummary {
  id: string;
  name: string;
  spotifyPlaylistName: string | null;
  trackCount: number;
  ownerName: string;
  updatedAt: string;
  activityAt: string;
  lastWorkedAt?: string;
}

interface HomeData {
  activeTeam: { id: string; name: string } | null;
  lastWorkedByYou: HomeSessionSummary | null;
  lastUpdatedByTeam: HomeSessionSummary | null;
  tracksNeedingAttention: AttentionTrackSummary[];
  error?: string;
}

function toSession(session: HomeSessionSummary, whenIso: string): Session {
  return {
    id: session.id,
    title: session.name,
    playlist: session.spotifyPlaylistName ?? "Spotify playlist",
    tracks: session.trackCount,
    author: session.ownerName,
    updatedAt: formatRelativeTime(whenIso),
  };
}

export default function HomePage() {
  const [data, setData] = useState<HomeData | null>(null);
  const [initialized, setInitialized] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { loading, begin, end } = useDelayedLoading();

  const loadHome = useCallback(async () => {
    begin();
    try {
      const res = await fetch("/api/home");
      const body = await readJsonResponse<HomeData>(res);

      if (!res.ok) {
        setError(errorMessageFromBody(body, "Failed to load home"));
        setData(null);
      } else {
        setData(body);
        setError(null);
      }
      setInitialized(true);
    } finally {
      end();
    }
  }, [begin, end]);

  useEffect(() => {
    void loadHome();
  }, [loadHome]);

  useEffect(() => {
    function onTeamChange() {
      void loadHome();
    }
    window.addEventListener("active-team-changed", onTeamChange);
    return () => window.removeEventListener("active-team-changed", onTeamChange);
  }, [loadHome]);

  if (!initialized) {
    if (loading) return <HomePageSkeleton />;
    return null;
  }

  if (error || !data) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-red-700">{error ?? "Failed to load home"}</div>
    );
  }

  const activeTeam = data.activeTeam;

  return (
    <div>
      <div className="mb-8 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Home</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {activeTeam
              ? `Quick picks for ${activeTeam.name}. Switch teams from the sidebar.`
              : "Select a team in the sidebar to see session highlights."}
          </p>
        </div>
        {activeTeam && (
          <Link
            href="/sessions"
            className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            All sessions
          </Link>
        )}
      </div>

      {!activeTeam ? (
        <div className="rounded-xl border border-dashed border-border p-10 text-center">
          <p className="text-muted-foreground">No active team selected.</p>
          <p className="mt-2 text-sm text-muted-foreground">
            Use the team switcher at the bottom of the sidebar to create, join, or select a team.
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          <div className="grid gap-6 lg:grid-cols-2">
          <SessionPanel
            icon={History}
            title="Last session you worked on"
            description="The most recent bingo session you opened or edited in this team."
            badge="You"
            session={
              data.lastWorkedByYou
                ? toSession(
                    data.lastWorkedByYou,
                    data.lastWorkedByYou.lastWorkedAt ?? data.lastWorkedByYou.updatedAt,
                  )
                : null
            }
            emptyMessage="You have not opened any sessions in this team yet."
          />
          <SessionPanel
            icon={Users}
            title="Latest team update"
            description="The session with the most recent clip save or edit by anyone on the team."
            badge="Team"
            session={
              data.lastUpdatedByTeam
                ? toSession(
                    data.lastUpdatedByTeam,
                    data.lastUpdatedByTeam.activityAt ?? data.lastUpdatedByTeam.updatedAt,
                  )
                : null
            }
            emptyMessage="No sessions in this team yet. Create one from the Sessions page."
          />
          </div>
          <TracksNeedingAttentionPanel tracks={data.tracksNeedingAttention ?? []} />
        </div>
      )}
    </div>
  );
}
