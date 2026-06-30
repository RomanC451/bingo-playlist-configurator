import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/api-auth";
import { clearActiveTeamCookie, getActiveTeamId } from "@/lib/active-team";
import { prisma } from "@/lib/db";
import { requireTeamMember, teamAccessResponse } from "@/lib/team-auth";

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(_request: Request, context: RouteContext) {
  const { session, error } = await requireAuth();
  if (error) return error;

  const { id: teamId } = await context.params;
  const userId = session!.user!.id;

  try {
    const member = await requireTeamMember(teamId, userId);

    const adminCount = await prisma.teamMember.count({
      where: { teamId, role: "ADMIN" },
    });

    if (member.role === "ADMIN" && adminCount <= 1) {
      return NextResponse.json(
        {
          error:
            "You are the only owner. Delete the team before leaving.",
        },
        { status: 400 },
      );
    }

    const activeTeamId = await getActiveTeamId(userId);

    await prisma.teamMember.delete({
      where: { teamId_userId: { teamId, userId } },
    });

    const response = NextResponse.json({ success: true });
    if (activeTeamId === teamId) {
      clearActiveTeamCookie(response);
    }
    return response;
  } catch (err) {
    const response = teamAccessResponse(err);
    if (response) return response;
    throw err;
  }
}
