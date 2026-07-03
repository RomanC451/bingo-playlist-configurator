import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/api-auth";
import { prisma } from "@/lib/db";
import { getValidSpotifyAccessToken, getSpotifyProfile, SpotifyApiError } from "@/lib/spotify";
import { hasStreamingScope } from "@/lib/spotify-types";
import { requireTeamMember, teamAccessResponse } from "@/lib/team-auth";

export async function GET(request: Request) {
  const { session, error } = await requireAuth();
  if (error) return error;

  const userId = session!.user!.id;
  const { searchParams } = new URL(request.url);
  const teamId = searchParams.get("teamId");

  if (!teamId) {
    return NextResponse.json({ error: "teamId is required" }, { status: 400 });
  }

  try {
    await requireTeamMember(teamId, userId);

    const connection = await prisma.spotifyConnection.findUnique({
      where: { teamId },
      select: { scope: true, expiresAt: true },
    });

    if (!connection) {
      return NextResponse.json(
        { error: "Spotify account not linked", code: "not_linked" },
        { status: 403 },
      );
    }

    if (!hasStreamingScope(connection.scope)) {
      return NextResponse.json(
        {
          error: "Spotify connection must be updated to enable in-browser preview",
          code: "missing_streaming_scope",
        },
        { status: 403 },
      );
    }

    let profileProduct: string | null = null;
    try {
      const profile = await getSpotifyProfile(teamId);
      profileProduct = profile.product ?? null;
    } catch (err) {
      if (err instanceof SpotifyApiError && err.message === "not_allowlisted") {
        return NextResponse.json(
          { error: "Spotify account not allowlisted for this app", code: "not_allowlisted" },
          { status: 403 },
        );
      }
      throw err;
    }

    if (profileProduct !== "premium") {
      return NextResponse.json(
        {
          error: "Team Spotify account needs Premium for in-browser preview",
          code: "not_premium",
        },
        { status: 403 },
      );
    }

    const accessToken = await getValidSpotifyAccessToken(teamId);
    const refreshed = await prisma.spotifyConnection.findUnique({
      where: { teamId },
      select: { expiresAt: true },
    });

    return NextResponse.json(
      {
        accessToken,
        expiresAt: refreshed?.expiresAt.toISOString() ?? connection.expiresAt.toISOString(),
      },
      {
        headers: { "Cache-Control": "no-store" },
      },
    );
  } catch (err) {
    const response = teamAccessResponse(err);
    if (response) return response;
    const message = err instanceof Error ? err.message : "Failed to issue player token";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
