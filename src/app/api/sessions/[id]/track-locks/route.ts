import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/api-auth";
import { loadActiveTrackEditLocksForSession } from "@/lib/track-edit-lock-db";
import { requireSessionAccess, teamAccessResponse } from "@/lib/team-auth";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_request: Request, context: RouteContext) {
  const { session, error } = await requireAuth();
  if (error) return error;

  const { id: sessionId } = await context.params;
  const userId = session!.user!.id;

  try {
    await requireSessionAccess(sessionId, userId);

    const locksByClipId = await loadActiveTrackEditLocksForSession(sessionId);
    const locks = Object.fromEntries(locksByClipId.entries());

    return NextResponse.json({ locks });
  } catch (err) {
    const response = teamAccessResponse(err);
    if (response) return response;
    throw err;
  }
}
