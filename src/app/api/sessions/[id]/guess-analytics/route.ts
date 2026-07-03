import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/api-auth";
import { loadClipGuessAnalytics } from "@/lib/clip-guess";
import { prisma } from "@/lib/db";
import { requireSessionAccess, teamAccessResponse } from "@/lib/team-auth";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_request: Request, context: RouteContext) {
  const { session, error } = await requireAuth();
  if (error) return error;

  const { id: sessionId } = await context.params;
  const userId = session!.user!.id;

  try {
    const { bingoSession } = await requireSessionAccess(sessionId, userId);

    const share = await prisma.bingoSession.findUnique({
      where: { id: sessionId },
      select: { guessShareEnabled: true, guessShareToken: true },
    });

    const analytics = await loadClipGuessAnalytics(sessionId);

    return NextResponse.json({
      session: { id: bingoSession.id, name: bingoSession.name },
      guessShareEnabled: share?.guessShareEnabled ?? false,
      analytics,
    });
  } catch (err) {
    const response = teamAccessResponse(err);
    if (response) return response;
    throw err;
  }
}
