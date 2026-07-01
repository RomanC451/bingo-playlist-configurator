import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/api-auth";
import { clearPersistedActiveTeam, getActiveTeamId } from "@/lib/active-team";
import { prisma } from "@/lib/db";
import { requireTeamMember, teamAccessResponse } from "@/lib/team-auth";
import { TeamRole } from "@prisma/client";

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(_request: Request, context: RouteContext) {
  const { session, error } = await requireAuth();
  if (error) return error;

  const { id: teamId } = await context.params;
  const userId = session!.user!.id;

  try {
    const member = await requireTeamMember(teamId, userId);

    if (member.role === TeamRole.OWNER) {
      return NextResponse.json(
        {
          error:
            "Team owners cannot leave. Transfer ownership or delete the team.",
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
      await clearPersistedActiveTeam(userId, response);
    }
    return response;
  } catch (err) {
    const response = teamAccessResponse(err);
    if (response) return response;
    throw err;
  }
}
