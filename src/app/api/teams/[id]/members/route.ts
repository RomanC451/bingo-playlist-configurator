import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAuth } from "@/lib/api-auth";
import { prisma } from "@/lib/db";
import { requireTeamAdmin, teamAccessResponse } from "@/lib/team-auth";

type RouteContext = { params: Promise<{ id: string }> };

const addMemberSchema = z.object({
  email: z.string().email(),
  role: z.enum(["ADMIN", "MEMBER"]).optional(),
});

const removeMemberSchema = z.object({
  userId: z.string(),
});

export async function POST(request: Request, context: RouteContext) {
  const { session, error } = await requireAuth();
  if (error) return error;

  const { id: teamId } = await context.params;
  const body = await request.json();
  const parsed = addMemberSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }

  try {
    await requireTeamAdmin(teamId, session!.user!.id);

    const user = await prisma.user.findUnique({
      where: { email: parsed.data.email.toLowerCase() },
    });

    if (!user) {
      return NextResponse.json(
        { error: "No user with that email. They must register first." },
        { status: 404 },
      );
    }

    const member = await prisma.teamMember.upsert({
      where: { teamId_userId: { teamId, userId: user.id } },
      create: {
        teamId,
        userId: user.id,
        role: parsed.data.role ?? "MEMBER",
      },
      update: parsed.data.role ? { role: parsed.data.role } : {},
      include: {
        user: { select: { id: true, name: true, email: true } },
      },
    });

    return NextResponse.json(member, { status: 201 });
  } catch (err) {
    const response = teamAccessResponse(err);
    if (response) return response;
    throw err;
  }
}

export async function DELETE(request: Request, context: RouteContext) {
  const { session, error } = await requireAuth();
  if (error) return error;

  const { id: teamId } = await context.params;
  const body = await request.json();
  const parsed = removeMemberSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }

  try {
    await requireTeamAdmin(teamId, session!.user!.id);

    const adminCount = await prisma.teamMember.count({
      where: { teamId, role: "ADMIN" },
    });

    const target = await prisma.teamMember.findUnique({
      where: { teamId_userId: { teamId, userId: parsed.data.userId } },
    });

    if (!target) {
      return NextResponse.json({ error: "Member not found" }, { status: 404 });
    }

    if (target.role === "ADMIN" && adminCount <= 1) {
      return NextResponse.json(
        { error: "Cannot remove the only owner" },
        { status: 400 },
      );
    }

    await prisma.teamMember.delete({
      where: { teamId_userId: { teamId, userId: parsed.data.userId } },
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    const response = teamAccessResponse(err);
    if (response) return response;
    throw err;
  }
}
