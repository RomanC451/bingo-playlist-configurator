import { headers } from "next/headers";
import { decrypt } from "@/lib/encryption";
import { prisma } from "@/lib/db";
import { createSpotifyOAuthState } from "@/lib/spotify-oauth-state";
import {
  canStartSpotifyOAuthFromOrigin,
  originFromHeaders,
  resolveSpotifyRedirectUriFromOrigin,
} from "@/lib/spotify-config";
import { revokeSpotifyRefreshToken } from "@/lib/spotify";
import { buildSpotifyAuthUrl } from "@/lib/spotify-types";
import { requireTeamAdmin } from "@/lib/team-auth";

export class SpotifyConnectError extends Error {
  constructor(
    message: string,
    public code:
      | "loopback_required"
      | "not_configured"
      | "forbidden"
      | "team_required",
  ) {
    super(message);
    this.name = "SpotifyConnectError";
  }
}

export async function unlinkTeamSpotify(teamId: string) {
  const existing = await prisma.spotifyConnection.findUnique({
    where: { teamId },
  });
  if (existing) {
    try {
      await revokeSpotifyRefreshToken(decrypt(existing.refreshToken));
    } catch {
      // Continue even if revoke fails.
    }
    await prisma.spotifyConnection.delete({ where: { teamId } });
  }
}

export async function buildTeamSpotifyAuthUrl(options: {
  teamId: string;
  userId: string;
  switchAccount?: boolean;
  origin?: string;
}): Promise<string> {
  const { teamId, userId, switchAccount = false } = options;
  const origin = options.origin ?? originFromHeaders(await headers());

  await requireTeamAdmin(teamId, userId);

  const redirectUri = resolveSpotifyRedirectUriFromOrigin(origin);
  if (!canStartSpotifyOAuthFromOrigin(origin, redirectUri)) {
    throw new SpotifyConnectError(
      "Spotify OAuth must be started from http://127.0.0.1:3000 (not LAN/VPN addresses).",
      "loopback_required",
    );
  }

  if (switchAccount) {
    await unlinkTeamSpotify(teamId);
  }

  try {
    const state = createSpotifyOAuthState(teamId, userId, redirectUri);
    return buildSpotifyAuthUrl(state, redirectUri);
  } catch (err) {
    if (err instanceof Error && err.message === "SPOTIFY_NOT_CONFIGURED") {
      throw new SpotifyConnectError("Spotify is not configured", "not_configured");
    }
    throw err;
  }
}

export function teamSpotifyConnectPath(teamId: string, switchAccount = false): string {
  const path = `/teams/${teamId}/settings/connect-spotify`;
  return switchAccount ? `${path}?switch=1` : path;
}
