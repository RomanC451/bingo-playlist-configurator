import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { encrypt } from "@/lib/encryption";
import { verifySpotifyOAuthState } from "@/lib/spotify-oauth-state";
import {
  exchangeSpotifyCode,
  fetchSpotifyProfileWithToken,
  SpotifyApiError,
} from "@/lib/spotify";

function teamSettingsUrl(
  request: Request,
  teamId: string,
  params?: Record<string, string>,
) {
  const url = new URL(`/teams/${teamId}/settings`, request.url);
  if (params) {
    for (const [key, value] of Object.entries(params)) {
      url.searchParams.set(key, value);
    }
  }
  return url;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const error = searchParams.get("error");

  const oauth = state ? verifySpotifyOAuthState(state) : null;
  const teamId = oauth?.teamId;

  if (error) {
    const redirectUrl = teamId
      ? teamSettingsUrl(request, teamId, { spotify_error: error })
      : new URL("/sessions?spotify_error=" + encodeURIComponent(error), request.url);
    return NextResponse.redirect(redirectUrl);
  }

  if (!code || !oauth) {
    const redirectUrl = teamId
      ? teamSettingsUrl(request, teamId, { spotify_error: "invalid_state" })
      : new URL("/sessions?spotify_error=invalid_state", request.url);
    return NextResponse.redirect(redirectUrl);
  }

  const { teamId: linkedTeamId, redirectUri } = oauth;

  try {
    const tokens = await exchangeSpotifyCode(code, redirectUri);
    const profile = await fetchSpotifyProfileWithToken(tokens.access_token);
    const expiresAt = new Date(Date.now() + tokens.expires_in * 1000);
    const existing = await prisma.spotifyConnection.findUnique({
      where: { teamId: linkedTeamId },
    });
    const accountChanged =
      existing != null && existing.spotifyUserId !== profile.id;

    if (!tokens.refresh_token) {
      if (!existing?.refreshToken) {
        throw new SpotifyApiError("missing_refresh_token", 400);
      }
      if (accountChanged) {
        throw new SpotifyApiError(
          "account_switch_incomplete",
          400,
          "Spotify did not authorize a new account. Log out at accounts.spotify.com, then try again.",
        );
      }
    }

    await prisma.spotifyConnection.upsert({
      where: { teamId: linkedTeamId },
      create: {
        teamId: linkedTeamId,
        spotifyUserId: profile.id,
        accessToken: encrypt(tokens.access_token),
        refreshToken: encrypt(tokens.refresh_token!),
        expiresAt,
      },
      update: {
        spotifyUserId: profile.id,
        accessToken: encrypt(tokens.access_token),
        ...(tokens.refresh_token
          ? { refreshToken: encrypt(tokens.refresh_token) }
          : {}),
        expiresAt,
      },
    });

    return NextResponse.redirect(
      teamSettingsUrl(request, linkedTeamId, { spotify: "linked" }),
    );
  } catch (err) {
    const message =
      err instanceof SpotifyApiError ? err.message : "link_failed";
    const redirectUrl = teamSettingsUrl(request, linkedTeamId, {
      spotify_error: message,
    });
    if (err instanceof SpotifyApiError && err.detail) {
      redirectUrl.searchParams.set("spotify_detail", err.detail);
    }
    return NextResponse.redirect(redirectUrl);
  }
}
