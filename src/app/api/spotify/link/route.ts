import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/api-auth";
import { createSpotifyOAuthState } from "@/lib/spotify-oauth-state";
import {
  canStartSpotifyOAuthFromOrigin,
  requestOrigin,
  resolveSpotifyRedirectUri,
} from "@/lib/spotify-config";
import { buildSpotifyAuthUrl } from "@/lib/spotify-types";

export async function GET(request: Request) {
  const { session, error } = await requireAuth();
  if (error) return error;

  try {
    const origin = requestOrigin(request);
    if (!canStartSpotifyOAuthFromOrigin(origin)) {
      return NextResponse.redirect(
        new URL("/profile?spotify_error=loopback_required", request.url),
      );
    }

    const redirectUri = resolveSpotifyRedirectUri();
    const state = createSpotifyOAuthState(session!.user!.id, redirectUri);
    return NextResponse.redirect(buildSpotifyAuthUrl(state, redirectUri));
  } catch (err) {
    if (err instanceof Error && err.message === "SPOTIFY_NOT_CONFIGURED") {
      return NextResponse.redirect(
        new URL("/sessions?spotify_error=not_configured", request.url),
      );
    }
    throw err;
  }
}
