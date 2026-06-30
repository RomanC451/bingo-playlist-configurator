import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/api-auth";
import { prisma } from "@/lib/db";
import { apiErrorResponse } from "@/lib/team-auth";

export async function GET() {
  const { session, error } = await requireAuth();
  if (error) return error;

  try {
    const userId = session!.user!.id;

    const memberships = await prisma.teamMember.findMany({
      where: { userId },
      select: { teamId: true },
    });
    const memberTeamIds = memberships.map((m) => m.teamId);

    const teams = await prisma.team.findMany({
      where: { id: { notIn: memberTeamIds } },
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
        _count: { select: { members: true } },
      },
    });

    return NextResponse.json({
      teams: teams.map((team) => ({
        id: team.id,
        name: team.name,
        memberCount: team._count.members,
      })),
    });
  } catch (err) {
    return apiErrorResponse(err, "Failed to load joinable teams");
  }
}
