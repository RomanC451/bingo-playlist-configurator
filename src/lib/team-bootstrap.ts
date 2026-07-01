import { TeamRole } from "@prisma/client";
import { prisma } from "@/lib/db";

function personalTeamName(name: string | null | undefined, email: string) {
  const base = name?.trim() || email.split("@")[0];
  return `${base}'s team`;
}

export async function ensurePersonalTeam(userId: string): Promise<string> {
  const existing = await prisma.teamMember.findFirst({
    where: { userId },
    select: { teamId: true },
  });
  if (existing) {
    await migrateOrphanSessions(userId, existing.teamId);
    return existing.teamId;
  }

  const user = await prisma.user.findUniqueOrThrow({
    where: { id: userId },
    select: { name: true, email: true },
  });

  const team = await prisma.team.create({
    data: {
      name: personalTeamName(user.name, user.email),
      members: {
        create: { userId, role: TeamRole.OWNER },
      },
    },
  });

  await migrateOrphanSessions(userId, team.id);
  return team.id;
}

export async function migrateOrphanSessions(userId: string, teamId: string) {
  await prisma.bingoSession.updateMany({
    where: { userId, teamId: null },
    data: { teamId },
  });
}
