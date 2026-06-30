import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/api-auth";
import { requireSessionAccess, teamAccessResponse } from "@/lib/team-auth";
import { loadTrackDetail } from "@/lib/track-summaries";

type RouteContext = { params: Promise<{ id: string; clipId: string }> };

export async function GET(_request: Request, context: RouteContext) {
  const { session, error } = await requireAuth();
  if (error) return error;

  const { id, clipId } = await context.params;
  const userId = session!.user!.id;

  try {
    await requireSessionAccess(id, userId);

    const detail = await loadTrackDetail(id, clipId, userId);
    if (!detail) {
      return NextResponse.json({ error: "Track not found" }, { status: 404 });
    }

    return NextResponse.json(detail);
  } catch (err) {
    const response = teamAccessResponse(err);
    if (response) return response;
    throw err;
  }
}
