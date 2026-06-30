import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAuth } from "@/lib/api-auth";
import { clearActiveTeamCookie, getActiveTeamId } from "@/lib/active-team";
import { prisma } from "@/lib/db";
import { requireTeamAdmin, requireTeamMember, teamAccessResponse } from "@/lib/team-auth";

type RouteContext = { params: Promise<{ id: string }> };

const updateTeamSchema = z.object({
  name: z.string().min(1).max(100),
});

export async function GET(_request: Request, context: RouteContext) {
  const { session, error } = await requireAuth();
  if (error) return error;

  const { id } = await context.params;

  try {
    await requireTeamMember(id, session!.user!.id);

    const team = await prisma.team.findUniqueOrThrow({
      where: { id },
      include: {
        members: {
          include: {
            user: { select: { id: true, name: true, email: true } },
          },
          orderBy: { createdAt: "asc" },
        },
        _count: { select: { bingoSessions: true } },
      },
    });

    return NextResponse.json(team);
  } catch (err) {
    const response = teamAccessResponse(err);
    if (response) return response;
    throw err;
  }
}

export async function PATCH(request: Request, context: RouteContext) {
  const { session, error } = await requireAuth();
  if (error) return error;

  const { id } = await context.params;
  const body = await request.json();
  const parsed = updateTeamSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }

  try {
    await requireTeamAdmin(id, session!.user!.id);

    const team = await prisma.team.update({
      where: { id },
      data: { name: parsed.data.name },
    });

    return NextResponse.json(team);
  } catch (err) {
    const response = teamAccessResponse(err);
    if (response) return response;
    throw err;
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
  const { session, error } = await requireAuth();
  if (error) return error;

  const { id } = await context.params;

  try {
    const userId = session!.user!.id;
    await requireTeamAdmin(id, userId);

    const activeTeamId = await getActiveTeamId(userId);
    await prisma.team.delete({ where: { id } });

    const response = NextResponse.json({ success: true });
    if (activeTeamId === id) {
      clearActiveTeamCookie(response);
    }
    return response;
  } catch (err) {
    const response = teamAccessResponse(err);
    if (response) return response;
    throw err;
  }
}
