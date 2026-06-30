import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/api-auth";
import { prisma } from "@/lib/db";
import {
  requireSessionAccess,
  apiErrorResponse,
} from "@/lib/team-auth";
import { loadSessionEditors, loadSessionTrackSummaries } from "@/lib/track-summaries";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_request: Request, context: RouteContext) {
  const { session, error } = await requireAuth();
  if (error) return error;

  const { id } = await context.params;

  try {
    await requireSessionAccess(id, session!.user!.id);

    const bingoSession = await prisma.bingoSession.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        teamId: true,
        spotifyPlaylistName: true,
        defaultClipDurationMs: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!bingoSession) {
      return NextResponse.json({ error: "Session not found" }, { status: 404 });
    }

    const [tracks, editors] = await Promise.all([
      loadSessionTrackSummaries(id),
      loadSessionEditors(id),
    ]);

    return NextResponse.json({ ...bingoSession, tracks, editors });
  } catch (err) {
    return apiErrorResponse(err, "Failed to load session");
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
  const { session, error } = await requireAuth();
  if (error) return error;

  const { id } = await context.params;

  try {
    await requireSessionAccess(id, session!.user!.id);
    await prisma.bingoSession.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (err) {
    return apiErrorResponse(err, "Failed to delete session");
  }
}
