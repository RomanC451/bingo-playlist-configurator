"use client";

import { useCallback, useEffect, useState } from "react";
import { Music2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { readJsonResponse } from "@/lib/read-json-response";

const SPOTIFY_LOOPBACK_CALLBACK = "http://127.0.0.1:3000/api/spotify/callback";
const SPOTIFY_LOOPBACK_APP = "http://127.0.0.1:3000/profile";

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
  account: SpotifyAccount | null;
  profileError?: string;
  redirectUri: string | null;
}

function accountLabel(account: SpotifyAccount): string {
  return account.displayName?.trim() || account.email || account.id;
}

function isPremiumProduct(product: string | null): boolean {
  return !!product && product !== "free";
}

function isLoopbackOrigin(origin: string): boolean {
  try {
    const host = new URL(origin).hostname;
    return host === "127.0.0.1" || host === "[::1]" || host === "::1" || host === "localhost";
  } catch {
    return false;
  }
}

export function SpotifyConnectionCard({ className = "" }: { className?: string }) {
  const [status, setStatus] = useState<SpotifyStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [onLoopback, setOnLoopback] = useState(false);

  useEffect(() => {
    setOnLoopback(isLoopbackOrigin(window.location.origin));
  }, []);

  const loadStatus = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/spotify/status");
      if (res.ok) {
        setStatus(await readJsonResponse<SpotifyStatus>(res));
      } else {
        setStatus(null);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadStatus();
  }, [loadStatus]);

  if (loading) {
    return (
      <section
        className={`rounded-xl border border-border bg-card p-4 ${className}`}
        aria-busy="true"
        aria-label="Loading Spotify connection"
      >
        <div className="h-12 animate-pulse rounded-lg bg-muted" />
      </section>
    );
  }

  if (!status?.configured) {
    return null;
  }

  const account = status.account;
  const redirectUri = status.redirectUri ?? SPOTIFY_LOOPBACK_CALLBACK;
  const canLinkNow = onLoopback;

  return (
    <section className={`rounded-xl border border-border bg-card p-4 sm:p-5 ${className}`}>
      <div className="flex items-start gap-3">
        <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-[#1DB954]/15 text-[#1DB954]">
          <Music2 className="size-5" aria-hidden="true" />
        </div>
        <div className="min-w-0 flex-1">
          <h2 className="text-base font-semibold">Spotify</h2>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Used to import playlists and control playback on your devices.
          </p>
        </div>
      </div>

      <div className="mt-4 rounded-lg border border-dashed border-border bg-muted/30 p-3 text-sm">
        <p className="font-medium">Spotify Developer redirect URI</p>
        <p className="mt-1 text-muted-foreground">
          Spotify only accepts loopback HTTP URLs. Register this in your{" "}
          <a
            href="https://developer.spotify.com/dashboard"
            target="_blank"
            rel="noreferrer"
            className="underline underline-offset-2"
          >
            Spotify app settings
          </a>
          :
        </p>
        <code className="mt-2 block break-all rounded bg-background px-2 py-1.5 text-xs">
          {redirectUri}
        </code>
        {!canLinkNow && (
          <p className="mt-3 text-amber-800 dark:text-amber-200">
            You opened the app via VPN/LAN ({typeof window !== "undefined" ? window.location.host : "…"}).
            Spotify login only works from your PC at{" "}
            <a href={SPOTIFY_LOOPBACK_APP} className="font-medium underline underline-offset-2">
              {SPOTIFY_LOOPBACK_APP}
            </a>
            . After linking once, you can keep using the app on your phone.
          </p>
        )}
      </div>

      {status.linked && account ? (
        <div className="mt-4 rounded-lg border border-border bg-background/50 p-3 sm:p-4">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Linked account
          </p>
          <div className="mt-2 flex items-center gap-3">
            {account.imageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={account.imageUrl}
                alt=""
                className="size-11 rounded-full object-cover"
              />
            ) : (
              <div className="flex size-11 items-center justify-center rounded-full bg-[#1DB954]/20 text-sm font-semibold text-[#1DB954]">
                {accountLabel(account).charAt(0).toUpperCase()}
              </div>
            )}
            <div className="min-w-0 flex-1">
              <p className="truncate font-medium">{accountLabel(account)}</p>
              {account.email && account.email !== accountLabel(account) && (
                <p className="truncate text-sm text-muted-foreground">{account.email}</p>
              )}
              <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                {account.product && (
                  <span
                    className={`rounded-full px-2 py-0.5 font-medium ${
                      isPremiumProduct(account.product)
                        ? "bg-[#1DB954]/15 text-[#1DB954]"
                        : "bg-secondary text-secondary-foreground"
                    }`}
                  >
                    {isPremiumProduct(account.product) ? "Premium" : "Free"}
                  </span>
                )}
                <span className="font-mono">{account.id}</span>
              </div>
            </div>
          </div>
          {status.profileError === "not_allowlisted" && (
            <p className="mt-3 text-sm text-amber-700 dark:text-amber-300">
              Spotify blocked API access for this account. Playback may not work until the app
              owner allowlists it.
            </p>
          )}
          <div className="mt-4 flex flex-wrap gap-2">
            {canLinkNow ? (
              <a href="/api/spotify/link">
                <Button type="button" variant="outline" size="sm">
                  Use another account
                </Button>
              </a>
            ) : (
              <a href={SPOTIFY_LOOPBACK_APP}>
                <Button type="button" variant="outline" size="sm">
                  Switch account on PC
                </Button>
              </a>
            )}
          </div>
          {canLinkNow && (
            <p className="mt-2 text-xs text-muted-foreground">
              If Spotify keeps signing in to the same user, log out at{" "}
              <a
                href="https://accounts.spotify.com/logout"
                target="_blank"
                rel="noreferrer"
                className="underline underline-offset-2"
              >
                accounts.spotify.com
              </a>{" "}
              first, then try again.
            </p>
          )}
        </div>
      ) : (
        <div className="mt-4">
          <p className="text-sm text-muted-foreground">No Spotify account linked yet.</p>
          {canLinkNow ? (
            <a href="/api/spotify/link" className="mt-3 inline-block">
              <Button type="button" className="bg-[#1DB954] text-white hover:bg-[#1ed760]">
                Connect Spotify
              </Button>
            </a>
          ) : (
            <a href={SPOTIFY_LOOPBACK_APP} className="mt-3 inline-block">
              <Button type="button" className="bg-[#1DB954] text-white hover:bg-[#1ed760]">
                Connect on PC
              </Button>
            </a>
          )}
        </div>
      )}
    </section>
  );
}
