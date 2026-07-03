import { NextResponse } from "next/server";
import { GuessShareError, resolveGuessShareSession } from "@/lib/clip-guess";
import { issueTeamSpotifyPlayerToken } from "@/lib/spotify-player-token";

type RouteContext = { params: Promise<{ shareToken: string }> };

function guessShareResponse(err: unknown) {
  if (err instanceof GuessShareError) {
    return NextResponse.json({ error: err.message }, { status: err.status });
  }
  return null;
}

export async function GET(_request: Request, context: RouteContext) {
  const { shareToken } = await context.params;

  try {
    const bingoSession = await resolveGuessShareSession(shareToken);
    const teamId = bingoSession.teamId!;

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
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (err) {
    const response = guessShareResponse(err);
    if (response) return response;
    throw err;
  }
}
