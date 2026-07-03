"use client";

import { useCallback, useEffect, useState } from "react";
import { Music2 } from "lucide-react";
import { readJsonResponse } from "@/lib/read-json-response";

interface SpotifyAccount {
  id: string;
  displayName: string | null;
  email: string | null;
  imageUrl: string | null;
  product: string | null;
}

interface SpotifyStatus {
  linked: boolean;
  configured: boolean;
  canManage: boolean;
  canLinkHere: boolean;
  linkUrl: string;
  switchUrl: string;
  loopbackLinkUrl: string;
  linkFallbackUrl: string | null;
  account: SpotifyAccount | null;
  profileError?: string;
  hasStreamingScope?: boolean;
  isPremium?: boolean;
  webPlaybackReady?: boolean;
}

function accountLabel(account: SpotifyAccount): string {
  return account.email?.trim() || account.displayName?.trim() || account.id;
}

export function SpotifyConnectionCard({
  teamId,
  className = "",
}: {
  teamId: string;
  className?: string;
}) {
  const [status, setStatus] = useState<SpotifyStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [unlinking, setUnlinking] = useState(false);

  const loadStatus = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(
        `/api/spotify/status?teamId=${encodeURIComponent(teamId)}`,
      );
      if (res.ok) {
        setStatus(await readJsonResponse<SpotifyStatus>(res));
      } else {
        setStatus(null);
      }
    } finally {
      setLoading(false);
    }
  }, [teamId]);

  useEffect(() => {
    void loadStatus();
  }, [loadStatus]);

  async function handleDisconnect() {
    if (!confirm("Disconnect Spotify from this team? Members will not be able to import or play until an admin reconnects.")) {
      return;
    }
    setUnlinking(true);
    try {
      const res = await fetch(
        `/api/spotify/link?teamId=${encodeURIComponent(teamId)}`,
        { method: "DELETE" },
      );
      if (res.ok) {
        await loadStatus();
      }
    } finally {
      setUnlinking(false);
    }
  }

  if (loading) {
    return (
      <div
        className={`h-9 animate-pulse rounded-lg bg-muted ${className}`}
        aria-busy="true"
        aria-label="Loading Spotify connection"
      />
    );
  }

  if (!status?.configured) {
    return null;
  }

  const account = status.account;
  const connectHref =
    status.canLinkHere ? status.linkUrl : status.loopbackLinkUrl;
  const isLinked = status.linked && account;

  return (
    <div
      className={`flex flex-wrap items-center gap-2.5 rounded-lg border px-3 py-2 text-sm ${
        isLinked
          ? "border-border bg-muted/40"
          : "border-amber-200 bg-amber-50 dark:border-amber-900/60 dark:bg-amber-950/40"
      } ${className}`}
      role={isLinked ? undefined : "alert"}
    >
      <Music2
        className={`size-4 shrink-0 ${isLinked ? "text-[#1DB954]" : "text-amber-600 dark:text-amber-400"}`}
        aria-hidden="true"
      />

      {isLinked ? (
        <>
          <span
            className="size-2 shrink-0 rounded-full bg-[#1DB954]"
            aria-hidden="true"
          />
          <p className="min-w-0 flex-1 truncate text-muted-foreground">
            Team Spotify:{" "}
            <span className="font-medium text-foreground">{accountLabel(account)}</span>
          </p>
          {status.profileError === "not_allowlisted" && (
            <span
              className="shrink-0 text-xs text-amber-600 dark:text-amber-400"
              title="Spotify blocked API access for this account"
            >
              Limited
            </span>
          )}
          {status.linked && status.hasStreamingScope === false && (
            <span
              className="shrink-0 text-xs text-amber-600 dark:text-amber-400"
              title="Re-link once to enable in-browser preview on edit and review pages"
            >
              Update for preview
            </span>
          )}
          {status.canManage && (
            <>
              {status.hasStreamingScope === false && (
                <p className="w-full text-xs text-amber-700 dark:text-amber-300">
                  Re-link Spotify once to enable in-browser clip preview on edit and review pages.
                </p>
              )}
              <a
                href={status.canLinkHere ? status.switchUrl : status.loopbackLinkUrl + "?switch=1"}
                className="shrink-0 text-xs text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
                title="Sign in with a different Spotify account"
              >
                Link different account
              </a>
              <button
                type="button"
                disabled={unlinking}
                onClick={() => void handleDisconnect()}
                className="shrink-0 text-xs text-muted-foreground underline-offset-2 hover:text-foreground hover:underline disabled:opacity-50"
              >
                {unlinking ? "Disconnecting…" : "Disconnect"}
              </button>
            </>
          )}
        </>
      ) : (
        <>
          <p
            className={`min-w-0 flex-1 ${
              status.canManage
                ? "text-amber-900 dark:text-amber-100"
                : "text-amber-800 dark:text-amber-200"
            }`}
          >
            {status.canManage
              ? "Team Spotify not connected — connect an account to import playlists and play clips."
              : "This team has no Spotify account linked. Ask a team admin to connect Spotify."}
          </p>
          {status.canManage && (
            <a
              href={connectHref}
              className="shrink-0 rounded-md border border-amber-300 bg-white px-2.5 py-1 text-xs font-medium text-amber-900 underline-offset-2 hover:bg-amber-100 dark:border-amber-700 dark:bg-amber-950 dark:text-amber-100 dark:hover:bg-amber-900"
            >
              Connect Spotify
            </a>
          )}
        </>
      )}
    </div>
  );
}
