import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAuth } from "@/lib/api-auth";
import { setActiveTeamCookie } from "@/lib/active-team";
import { prisma } from "@/lib/db";
import { apiErrorResponse } from "@/lib/team-auth";

const joinTeamSchema = z.object({
  teamId: z.string().min(1),
});

export async function POST(request: Request) {
  const { session, error } = await requireAuth();
  if (error) return error;

  const userId = session!.user!.id;
  const body = await request.json();
  const parsed = joinTeamSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }

  try {
    const team = await prisma.team.findUnique({
      where: { id: parsed.data.teamId },
      select: { id: true, name: true },
    });

    if (!team) {
      return NextResponse.json({ error: "Team not found" }, { status: 404 });
    }

    await prisma.teamMember.upsert({
      where: { teamId_userId: { teamId: team.id, userId } },
      create: { teamId: team.id, userId, role: "MEMBER" },
      update: {},
    });

    const response = NextResponse.json({ team, activeTeamId: team.id });
    setActiveTeamCookie(response, team.id);
    return response;
  } catch (err) {
    return apiErrorResponse(err, "Failed to join team");
  }
}
