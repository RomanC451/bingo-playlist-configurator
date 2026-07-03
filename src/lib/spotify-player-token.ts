import { prisma } from "@/lib/db";
import { getValidSpotifyAccessToken, getSpotifyProfile, SpotifyApiError } from "@/lib/spotify";
import { hasStreamingScope } from "@/lib/spotify-types";

export type SpotifyPlayerTokenError = {
  error: string;
  code:
    | "not_linked"
    | "missing_streaming_scope"
    | "not_premium"
    | "not_allowlisted"
    | "no_team";
  status: 403;
};

export async function issueTeamSpotifyPlayerToken(
  teamId: string,
): Promise<
  | { accessToken: string; expiresAt: string }
  | SpotifyPlayerTokenError
> {
  const connection = await prisma.spotifyConnection.findUnique({
    where: { teamId },
    select: { scope: true, expiresAt: true },
  });

  if (!connection) {
    return {
      error: "Spotify account not linked",
      code: "not_linked",
      status: 403,
    };
  }

  if (!hasStreamingScope(connection.scope)) {
    return {
      error: "Spotify connection must be updated to enable in-browser preview",
      code: "missing_streaming_scope",
      status: 403,
    };
  }

  let profileProduct: string | null = null;
  try {
    const profile = await getSpotifyProfile(teamId);
    profileProduct = profile.product ?? null;
  } catch (err) {
    if (err instanceof SpotifyApiError && err.message === "not_allowlisted") {
      return {
        error: "Spotify account not allowlisted for this app",
        code: "not_allowlisted",
        status: 403,
      };
    }
    throw err;
  }

  if (profileProduct !== "premium") {
    return {
      error: "Team Spotify account needs Premium for in-browser preview",
      code: "not_premium",
      status: 403,
    };
  }

  const accessToken = await getValidSpotifyAccessToken(teamId);
  const refreshed = await prisma.spotifyConnection.findUnique({
    where: { teamId },
    select: { expiresAt: true },
  });

  return {
    accessToken,
    expiresAt: refreshed?.expiresAt.toISOString() ?? connection.expiresAt.toISOString(),
  };
}
