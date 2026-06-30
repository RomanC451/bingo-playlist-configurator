import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { encrypt } from "@/lib/encryption";
import { verifySpotifyOAuthState } from "@/lib/spotify-oauth-state";
import {
  exchangeSpotifyCode,
  fetchSpotifyProfileWithToken,
  SpotifyApiError,
} from "@/lib/spotify";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const error = searchParams.get("error");

  if (error) {
    return NextResponse.redirect(
      new URL(`/profile?spotify_error=${encodeURIComponent(error)}`, request.url),
    );
  }

  const oauth = state ? verifySpotifyOAuthState(state) : null;

  if (!code || !oauth) {
    return NextResponse.redirect(
      new URL("/profile?spotify_error=invalid_state", request.url),
    );
  }

  const { userId, redirectUri } = oauth;

  try {
    const tokens = await exchangeSpotifyCode(code, redirectUri);
    const profile = await fetchSpotifyProfileWithToken(tokens.access_token);
    const expiresAt = new Date(Date.now() + tokens.expires_in * 1000);

    if (!tokens.refresh_token) {
      const existing = await prisma.spotifyConnection.findUnique({ where: { userId } });
      if (!existing?.refreshToken) {
        throw new SpotifyApiError("missing_refresh_token", 400);
      }
    }

    await prisma.spotifyConnection.upsert({
      where: { userId },
      create: {
        userId,
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

    return NextResponse.redirect(new URL("/profile?spotify=linked", request.url));
  } catch (err) {
    const message =
      err instanceof SpotifyApiError ? err.message : "link_failed";
    const redirectUrl = new URL("/profile", request.url);
    redirectUrl.searchParams.set("spotify_error", message);
    if (err instanceof SpotifyApiError && err.detail) {
      redirectUrl.searchParams.set("spotify_detail", err.detail);
    }
    return NextResponse.redirect(redirectUrl);
  }
}
