import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/api-auth";
import { getActiveTeamId } from "@/lib/active-team";
import { prisma } from "@/lib/db";
import { getHomeSessionHighlights } from "@/lib/session-activity";
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

    return NextResponse.json({
      activeTeam,
      ...highlights,
    });
  } catch (err) {
    const response = teamAccessResponse(err);
    if (response) return response;
    return apiErrorResponse(err, "Failed to load home");
  }
}
