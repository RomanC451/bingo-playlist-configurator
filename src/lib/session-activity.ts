import { prisma } from "@/lib/db";
import { requireSessionAccess } from "@/lib/team-auth";

export async function recordSessionWork(userId: string, sessionId: string) {
  await requireSessionAccess(sessionId, userId);

  await prisma.sessionUserActivity.upsert({
    where: { userId_sessionId: { userId, sessionId } },
    create: { userId, sessionId },
    update: { lastWorkedAt: new Date() },
  });
}

export async function touchSessionUpdated(sessionId: string) {
  await prisma.bingoSession.update({
    where: { id: sessionId },
    data: { updatedAt: new Date() },
  });
}

export type HomeSessionSummary = {
  id: string;
  name: string;
  spotifyPlaylistName: string | null;
  updatedAt: Date;
  activityAt: Date;
  lastWorkedAt?: Date;
  trackCount: number;
  ownerName: string;
};

type SessionRow = {
  id: string;
  name: string;
  spotifyPlaylistName: string | null;
  updatedAt: Date;
  user: { name: string | null; email: string };
  _count: { trackClips: number };
};

function mapSession(
  session: SessionRow,
  options?: { lastWorkedAt?: Date; activityAt?: Date },
): HomeSessionSummary {
  return {
    id: session.id,
    name: session.name,
    spotifyPlaylistName: session.spotifyPlaylistName,
    updatedAt: session.updatedAt,
    activityAt: options?.activityAt ?? session.updatedAt,
    lastWorkedAt: options?.lastWorkedAt,
    trackCount: session._count.trackClips,
    ownerName: session.user.name ?? session.user.email.split("@")[0],
  };
}

const sessionInclude = {
  user: { select: { name: true, email: true } },
  _count: { select: { trackClips: true } },
} as const;

export async function getHomeSessionHighlights(userId: string, activeTeamId: string | null) {
  if (!activeTeamId) {
    return {
      lastWorkedByYou: null,
      lastUpdatedByTeam: null,
    };
  }

  const [lastActivity, latestSession, latestVersion] = await Promise.all([
    prisma.sessionUserActivity.findFirst({
      where: {
        userId,
        session: { teamId: activeTeamId },
      },
      orderBy: { lastWorkedAt: "desc" },
      include: { session: { include: sessionInclude } },
    }),
    prisma.bingoSession.findFirst({
      where: { teamId: activeTeamId },
      orderBy: { updatedAt: "desc" },
      include: sessionInclude,
    }),
    prisma.clipProposalVersion.findFirst({
      where: { proposal: { trackClip: { session: { teamId: activeTeamId } } } },
      orderBy: { createdAt: "desc" },
      include: { proposal: { include: { trackClip: { include: { session: { include: sessionInclude } } } } } },
    }),
  ]);

  const teamActivityCandidates: { at: Date; session: SessionRow }[] = [];
  if (latestSession) {
    teamActivityCandidates.push({ at: latestSession.updatedAt, session: latestSession });
  }
  if (latestVersion) {
    teamActivityCandidates.push({
      at: latestVersion.createdAt,
      session: latestVersion.proposal.trackClip.session,
    });
  }

  teamActivityCandidates.sort((a, b) => b.at.getTime() - a.at.getTime());
  const lastUpdatedByTeam = teamActivityCandidates[0]
    ? mapSession(teamActivityCandidates[0].session, {
        activityAt: teamActivityCandidates[0].at,
      })
    : null;

  return {
    lastWorkedByYou: lastActivity
      ? mapSession(lastActivity.session, { lastWorkedAt: lastActivity.lastWorkedAt })
      : null,
    lastUpdatedByTeam,
  };
}
