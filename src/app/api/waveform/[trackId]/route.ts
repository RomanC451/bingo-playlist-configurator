import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/api-auth";
import { getTrack } from "@/lib/spotify";
import { requireSessionAccess, teamAccessResponse } from "@/lib/team-auth";
import { placeholderWaveform } from "@/lib/waveform";

export const runtime = "nodejs";

type RouteContext = { params: Promise<{ trackId: string }> };

export async function GET(request: Request, context: RouteContext) {
  const { session, error } = await requireAuth();
  if (error) return error;

  const { trackId } = await context.params;
  const { searchParams } = new URL(request.url);
  const sessionId = searchParams.get("sessionId");

  if (!sessionId) {
    return NextResponse.json({ error: "sessionId is required" }, { status: 400 });
  }

  try {
    const { bingoSession } = await requireSessionAccess(sessionId, session!.user!.id);
    const teamId = bingoSession.teamId;
    if (!teamId) {
      return NextResponse.json({ error: "Session has no team" }, { status: 400 });
    }

    let durationMs = 180_000;
    try {
      const track = await getTrack(teamId, trackId);
      durationMs = track.duration_ms;
    } catch {
      // Use default duration when Spotify metadata is unavailable.
    }

    return NextResponse.json(placeholderWaveform(durationMs));
  } catch (err) {
    const response = teamAccessResponse(err);
    if (response) return response;
    throw err;
  }
}
