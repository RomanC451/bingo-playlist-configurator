import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/api-auth";
import { loadGuestReviewSummaries } from "@/lib/guest-review";
import { prisma } from "@/lib/db";
import { requireSessionAccess, teamAccessResponse } from "@/lib/team-auth";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_request: Request, context: RouteContext) {
  const { session, error } = await requireAuth();
  if (error) return error;

  const { id: sessionId } = await context.params;
  const userId = session!.user!.id;

  try {
    await requireSessionAccess(sessionId, userId);

    const share = await prisma.bingoSession.findUnique({
      where: { id: sessionId },
      select: {
        name: true,
        reviewShareEnabled: true,
        reviewShareToken: true,
      },
    });

    if (!share) {
      return NextResponse.json({ error: "Session not found" }, { status: 404 });
    }

    const summaries = await loadGuestReviewSummaries(sessionId);

    return NextResponse.json({
      session: { id: sessionId, name: share.name },
      reviewShareEnabled: share.reviewShareEnabled,
      reviewShareToken: share.reviewShareToken,
      ...summaries,
    });
  } catch (err) {
    const response = teamAccessResponse(err);
    if (response) return response;
    throw err;
  }
}
