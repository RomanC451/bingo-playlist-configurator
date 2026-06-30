import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAuth } from "@/lib/api-auth";
import { getActiveTeamId, setActiveTeamCookie } from "@/lib/active-team";
import { prisma } from "@/lib/db";
import { apiErrorResponse } from "@/lib/team-auth";

const createTeamSchema = z.object({
  name: z.string().min(1).max(100),
});

export async function GET() {
  const { session, error } = await requireAuth();
  if (error) return error;

  try {
    const userId = session!.user!.id;

    const teams = await prisma.team.findMany({
      where: { members: { some: { userId } } },
      orderBy: { name: "asc" },
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

    const activeTeamId = await getActiveTeamId(userId);

    return NextResponse.json({ teams, activeTeamId });
  } catch (err) {
    return apiErrorResponse(err, "Failed to load teams");
  }
}

export async function POST(request: Request) {
  const { session, error } = await requireAuth();
  if (error) return error;

  const userId = session!.user!.id;
  const body = await request.json();
  const parsed = createTeamSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }

  const team = await prisma.team.create({
    data: {
      name: parsed.data.name,
      members: {
        create: { userId, role: "ADMIN" },
      },
    },
    include: {
      members: {
        include: {
          user: { select: { id: true, name: true, email: true } },
        },
      },
      _count: { select: { bingoSessions: true } },
    },
  });

  const response = NextResponse.json(team, { status: 201 });
  setActiveTeamCookie(response, team.id);
  return response;
}
