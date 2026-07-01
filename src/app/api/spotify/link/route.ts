import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/api-auth";
import {
  buildTeamSpotifyAuthUrl,
  SpotifyConnectError,
  teamSpotifyConnectPath,
  unlinkTeamSpotify,
} from "@/lib/spotify-connect";
import { requestOrigin } from "@/lib/spotify-config";
import { requireTeamAdmin, teamAccessResponse } from "@/lib/team-auth";

function teamSettingsUrl(request: Request, teamId: string, params?: Record<string, string>) {
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
  const teamId = searchParams.get("teamId");
  const switchAccount = searchParams.get("switch") === "1";

  if (!teamId) {
    return NextResponse.json({ error: "teamId is required" }, { status: 400 });
  }

  const { session, error } = await requireAuth();
  if (error) {
    const connectPath = teamSpotifyConnectPath(teamId, switchAccount);
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("callbackUrl", connectPath);
    return NextResponse.redirect(loginUrl);
  }

  const userId = session!.user!.id;

  try {
    const authUrl = await buildTeamSpotifyAuthUrl({
      teamId,
      userId,
      switchAccount,
      origin: requestOrigin(request),
    });
    return NextResponse.redirect(authUrl);
  } catch (err) {
    if (err instanceof SpotifyConnectError) {
      if (err.code === "not_configured") {
        return NextResponse.redirect(
          new URL("/sessions?spotify_error=not_configured", request.url),
        );
      }
      return NextResponse.redirect(
        teamSettingsUrl(request, teamId, { spotify_error: err.code }),
      );
    }
    const response = teamAccessResponse(err);
    if (response) return response;
    throw err;
  }
}

export async function DELETE(request: Request) {
  const { session, error } = await requireAuth();
  if (error) return error;

  const userId = session!.user!.id;
  const { searchParams } = new URL(request.url);
  const teamId = searchParams.get("teamId");

  if (!teamId) {
    return NextResponse.json({ error: "teamId is required" }, { status: 400 });
  }

  try {
    await requireTeamAdmin(teamId, userId);
    await unlinkTeamSpotify(teamId);
    return NextResponse.json({ success: true });
  } catch (err) {
    const response = teamAccessResponse(err);
    if (response) return response;
    throw err;
  }
}
