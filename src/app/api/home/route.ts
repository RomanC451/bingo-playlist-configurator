import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/api-auth";
import { getActiveTeamId, restoreActiveTeamCookie } from "@/lib/active-team";
import { prisma } from "@/lib/db";
import { getHomeSessionHighlights } from "@/lib/session-activity";
import { loadOngoingUserReviews } from "@/lib/home-reviews";
import { loadTracksNeedingAttention } from "@/lib/track-attention";
import { apiErrorResponse, teamAccessResponse } from "@/lib/team-auth";

export async function GET() {
  const { session, error } = await requireAuth();
  if (error) return error;

  const userId = session!.user!.id;

  try {
    const activeTeamId = await getActiveTeamId(userId);
    const activeTeam = activeTeamId
      ? await prisma.team.findUnique({
          where: { id: activeTeamId },
          select: { id: true, name: true },
        })
      : null;

    const highlights = await getHomeSessionHighlights(userId, activeTeamId);
    const [tracksNeedingAttention, ongoingReviews] = await Promise.all([
      activeTeamId ? loadTracksNeedingAttention(activeTeamId) : Promise.resolve([]),
      activeTeamId ? loadOngoingUserReviews(activeTeamId, userId) : Promise.resolve([]),
    ]);

    const response = NextResponse.json({
      activeTeam,
      tracksNeedingAttention,
      ongoingReviews,
      ...highlights,
    });
    await restoreActiveTeamCookie(userId, response);
    return response;
  } catch (err) {
    const response = teamAccessResponse(err);
    if (response) return response;
    return apiErrorResponse(err, "Failed to load home");
  }
}
