"use client";

import Link from "next/link";
import { useCallback, useEffect, useState, type ReactNode } from "react";
import { readJsonResponse } from "@/lib/read-json-response";

export interface SpotifyWebPlaybackStatus {
  linked: boolean;
  configured: boolean;
  canManage: boolean;
  hasStreamingScope: boolean;
  isPremium: boolean;
  webPlaybackReady: boolean;
  linkUrl: string;
  switchUrl: string;
  profileError?: string;
}

interface SpotifyWebPlaybackGateProps {
  teamId: string | null;
  children: ReactNode;
  /** When false, only show banner; do not block children (e.g. read-only views). */
  blockPlayback?: boolean;
}

function teamSettingsHref(teamId: string) {
  return `/teams/${teamId}/settings`;
}

function teamConnectHref(teamId: string) {
  return `/teams/${teamId}/settings/connect-spotify`;
}

export function SpotifyWebPlaybackGate({
  teamId,
  children,
  blockPlayback = true,
}: SpotifyWebPlaybackGateProps) {
  const [status, setStatus] = useState<SpotifyWebPlaybackStatus | null>(null);
  const [loading, setLoading] = useState(true);

  const loadStatus = useCallback(async () => {
    if (!teamId) {
      setStatus(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(`/api/spotify/status?teamId=${encodeURIComponent(teamId)}`);
      const json = await readJsonResponse<SpotifyWebPlaybackStatus>(res);
      if (res.ok) {
        setStatus(json);
      } else {
        setStatus(null);
      }
    } catch {
      setStatus(null);
    } finally {
      setLoading(false);
    }
  }, [teamId]);

  useEffect(() => {
    void loadStatus();
  }, [loadStatus]);

  const showBanner = !loading && status && !status.webPlaybackReady;
  const blockChildren = blockPlayback && showBanner;

  let bannerTitle = "Spotify preview unavailable";
  let bannerBody: ReactNode = null;
  let actionHref: string | null = null;
  let actionLabel: string | null = null;

  if (status && showBanner) {
    if (!status.linked) {
      bannerTitle = "Connect Spotify to preview clips";
      bannerBody = status.canManage
        ? "Link the team Spotify account to preview clips in the browser."
        : "Ask a team admin to connect Spotify for this team.";
      actionHref = teamId ? teamConnectHref(teamId) : null;
      actionLabel = status.canManage ? "Connect Spotify" : "Team settings";
    } else if (!status.hasStreamingScope) {
      bannerTitle = "Update Spotify connection";
      bannerBody = status.canManage
        ? "Re-link Spotify once to enable in-browser preview on edit and review pages."
        : "Ask your team admin to update the Spotify connection for in-browser preview.";
      actionHref = teamId
        ? status.canManage
          ? `${teamConnectHref(teamId)}?switch=1`
          : teamSettingsHref(teamId)
        : null;
      actionLabel = status.canManage ? "Update connection" : "Team settings";
    } else if (!status.isPremium) {
      bannerTitle = "Spotify Premium required";
      bannerBody =
        "The linked team Spotify account needs Premium for in-browser preview on edit and review pages.";
      actionHref = teamId ? teamSettingsHref(teamId) : null;
      actionLabel = "Team settings";
    } else if (status.profileError === "not_allowlisted") {
      bannerTitle = "Spotify account not allowlisted";
      bannerBody =
        "This Spotify app is in development mode. Add the team account in the Spotify Developer Dashboard.";
      actionHref = teamId ? teamSettingsHref(teamId) : null;
      actionLabel = "Team settings";
    }
  }

  return (
    <div className="space-y-4">
      {showBanner && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-amber-950 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-100">
          <p className="font-medium">{bannerTitle}</p>
          {bannerBody && <p className="mt-1 text-sm">{bannerBody}</p>}
          {actionHref && actionLabel && (
            <Link
              href={actionHref}
              className="mt-2 inline-block text-sm font-medium text-emerald-700 underline dark:text-emerald-400"
            >
              {actionLabel}
            </Link>
          )}
        </div>
      )}

      <div className={blockChildren ? "pointer-events-none opacity-60" : undefined}>
        {children}
      </div>
    </div>
  );
}

export function useSpotifyWebPlaybackStatus(teamId: string | null) {
  const [status, setStatus] = useState<SpotifyWebPlaybackStatus | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!teamId) {
      setStatus(null);
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);

    void (async () => {
      try {
        const res = await fetch(`/api/spotify/status?teamId=${encodeURIComponent(teamId)}`);
        const json = await readJsonResponse<SpotifyWebPlaybackStatus>(res);
        if (!cancelled && res.ok) {
          setStatus(json);
        }
      } catch {
        if (!cancelled) setStatus(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [teamId]);

  return { status, loading, webPlaybackReady: !!status?.webPlaybackReady };
}
