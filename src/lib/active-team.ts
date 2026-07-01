import type { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { prisma } from "@/lib/db";

export const ACTIVE_TEAM_COOKIE = "activeTeamId";

async function isTeamMember(userId: string, teamId: string): Promise<boolean> {
  const membership = await prisma.teamMember.findUnique({
    where: { teamId_userId: { teamId, userId } },
  });
  return membership != null;
}

async function readPersistedActiveTeamId(userId: string): Promise<string | null> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { activeTeamId: true },
  });

  if (!user?.activeTeamId) {
    return null;
  }

  if (await isTeamMember(userId, user.activeTeamId)) {
    return user.activeTeamId;
  }

  await prisma.user.update({
    where: { id: userId },
    data: { activeTeamId: null },
  });
  return null;
}

export async function getActiveTeamId(userId: string): Promise<string | null> {
  const cookieStore = await cookies();
  const fromCookie = cookieStore.get(ACTIVE_TEAM_COOKIE)?.value;

  if (fromCookie && (await isTeamMember(userId, fromCookie))) {
    return fromCookie;
  }

  return readPersistedActiveTeamId(userId);
}

export function clearActiveTeamCookie(response: NextResponse) {
  response.cookies.set(ACTIVE_TEAM_COOKIE, "", {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
}

export function setActiveTeamCookie(response: NextResponse, teamId: string) {
  response.cookies.set(ACTIVE_TEAM_COOKIE, teamId, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  });
}

export async function persistActiveTeamForUser(
  userId: string,
  teamId: string,
  response?: NextResponse,
) {
  await prisma.user.update({
    where: { id: userId },
    data: { activeTeamId: teamId },
  });
  if (response) {
    setActiveTeamCookie(response, teamId);
  }
}

export async function clearPersistedActiveTeam(
  userId: string,
  response?: NextResponse,
) {
  await prisma.user.update({
    where: { id: userId },
    data: { activeTeamId: null },
  });
  if (response) {
    clearActiveTeamCookie(response);
  }
}

/** Re-apply the active-team cookie when it was lost (e.g. after sign-out). */
export async function restoreActiveTeamCookie(
  userId: string,
  response: NextResponse,
): Promise<string | null> {
  const cookieStore = await cookies();
  if (cookieStore.get(ACTIVE_TEAM_COOKIE)?.value) {
    return getActiveTeamId(userId);
  }

  const activeTeamId = await readPersistedActiveTeamId(userId);
  if (activeTeamId) {
    setActiveTeamCookie(response, activeTeamId);
  }
  return activeTeamId;
}
