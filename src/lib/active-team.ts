import type { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { prisma } from "@/lib/db";

export const ACTIVE_TEAM_COOKIE = "activeTeamId";

export async function getActiveTeamId(userId: string): Promise<string | null> {
  const cookieStore = await cookies();
  const fromCookie = cookieStore.get(ACTIVE_TEAM_COOKIE)?.value;

  if (!fromCookie) {
    return null;
  }

  const membership = await prisma.teamMember.findUnique({
    where: { teamId_userId: { teamId: fromCookie, userId } },
  });

  return membership ? fromCookie : null;
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
