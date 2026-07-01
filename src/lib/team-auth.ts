import { TeamRole } from "@prisma/client";
import { NextResponse } from "next/server";
import { internalError } from "@/lib/api-errors";
import { prisma } from "@/lib/db";

export class TeamAccessError extends Error {
  constructor(
    message: string,
    public status: 403 | 404 = 403,
  ) {
    super(message);
    this.name = "TeamAccessError";
  }
}

export function isTeamManager(role: TeamRole) {
  return role === TeamRole.OWNER || role === TeamRole.ADMIN;
}

export async function requireTeamMember(teamId: string, userId: string) {
  const member = await prisma.teamMember.findUnique({
    where: { teamId_userId: { teamId, userId } },
  });
  if (!member) {
    throw new TeamAccessError("Not a member of this team", 403);
  }
  return member;
}

export async function requireTeamManager(teamId: string, userId: string) {
  const member = await requireTeamMember(teamId, userId);
  if (!isTeamManager(member.role)) {
    throw new TeamAccessError("Team admin required", 403);
  }
  return member;
}

export async function requireTeamOwner(teamId: string, userId: string) {
  const member = await requireTeamMember(teamId, userId);
  if (member.role !== TeamRole.OWNER) {
    throw new TeamAccessError("Team owner required", 403);
  }
  return member;
}

/** @deprecated Use requireTeamManager */
export const requireTeamAdmin = requireTeamManager;

export async function requireSessionAccess(sessionId: string, userId: string) {
  const bingoSession = await prisma.bingoSession.findUnique({
    where: { id: sessionId },
    include: {
      team: {
        include: {
          members: { where: { userId }, take: 1 },
        },
      },
    },
  });

  if (!bingoSession) {
    throw new TeamAccessError("Session not found", 404);
  }

  if (bingoSession.teamId) {
    const membership = bingoSession.team?.members[0];
    if (!membership) {
      throw new TeamAccessError("Not a member of this team", 403);
    }
    return { bingoSession, membership };
  }

  if (bingoSession.userId !== userId) {
    throw new TeamAccessError("Session not found", 404);
  }

  return { bingoSession, membership: null };
}

export async function requireSessionAdmin(sessionId: string, userId: string) {
  const { bingoSession, membership } = await requireSessionAccess(sessionId, userId);

  if (bingoSession.teamId && membership && !isTeamManager(membership.role)) {
    throw new TeamAccessError("Team admin required", 403);
  }

  if (!bingoSession.teamId && bingoSession.userId !== userId) {
    throw new TeamAccessError("Session not found", 404);
  }

  return { bingoSession, membership };
}

export function teamAccessResponse(err: unknown) {
  if (err instanceof TeamAccessError) {
    return NextResponse.json(
      { error: err.message, source: "internal" as const },
      { status: err.status },
    );
  }
  return null;
}

export function apiErrorResponse(err: unknown, fallback = "Request failed") {
  const accessResponse = teamAccessResponse(err);
  if (accessResponse) return accessResponse;
  console.error(err);
  return internalError(fallback);
}
