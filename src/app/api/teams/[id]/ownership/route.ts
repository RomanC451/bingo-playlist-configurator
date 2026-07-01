import { NextResponse } from "next/server";
import { z } from "zod";
import { TeamRole } from "@prisma/client";
import { requireAuth } from "@/lib/api-auth";
import { prisma } from "@/lib/db";
import { requireTeamOwner, teamAccessResponse } from "@/lib/team-auth";

type RouteContext = { params: Promise<{ id: string }> };

const transferOwnershipSchema = z.object({
  userId: z.string(),
});

export async function POST(request: Request, context: RouteContext) {
  const { session, error } = await requireAuth();
  if (error) return error;

  const { id: teamId } = await context.params;
  const userId = session!.user!.id;
  const body = await request.json();
  const parsed = transferOwnershipSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }

  if (parsed.data.userId === userId) {
    return NextResponse.json(
      { error: "You are already the team owner" },
      { status: 400 },
    );
  }

  try {
    await requireTeamOwner(teamId, userId);

    const target = await prisma.teamMember.findUnique({
      where: { teamId_userId: { teamId, userId: parsed.data.userId } },
    });

    if (!target) {
      return NextResponse.json({ error: "Member not found" }, { status: 404 });
    }

    if (target.role === TeamRole.OWNER) {
      return NextResponse.json(
        { error: "That member is already the team owner" },
        { status: 400 },
      );
    }

    const [formerOwner, newOwner] = await prisma.$transaction([
      prisma.teamMember.update({
        where: { teamId_userId: { teamId, userId } },
        data: { role: TeamRole.ADMIN },
        include: {
          user: { select: { id: true, name: true, email: true } },
        },
      }),
      prisma.teamMember.update({
        where: { teamId_userId: { teamId, userId: parsed.data.userId } },
        data: { role: TeamRole.OWNER },
        include: {
          user: { select: { id: true, name: true, email: true } },
        },
      }),
    ]);

    return NextResponse.json({
      formerOwner,
      newOwner,
    });
  } catch (err) {
    const response = teamAccessResponse(err);
    if (response) return response;
    throw err;
  }
}
