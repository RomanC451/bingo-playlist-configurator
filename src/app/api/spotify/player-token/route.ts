import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/api-auth";
import { issueTeamSpotifyPlayerToken } from "@/lib/spotify-player-token";
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

    const result = await issueTeamSpotifyPlayerToken(teamId);
    if ("error" in result) {
      return NextResponse.json(
        { error: result.error, code: result.code },
        { status: result.status },
      );
    }

    return NextResponse.json(
      {
        accessToken: result.accessToken,
        expiresAt: result.expiresAt,
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
