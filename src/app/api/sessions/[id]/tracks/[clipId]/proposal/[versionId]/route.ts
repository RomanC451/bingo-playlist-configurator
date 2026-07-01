import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/api-auth";
import { prisma } from "@/lib/db";
import { requireSessionAccess, teamAccessResponse } from "@/lib/team-auth";
import { touchSessionUpdated } from "@/lib/session-activity";
import { loadTrackDetail } from "@/lib/track-summaries";

type RouteContext = {
  params: Promise<{ id: string; clipId: string; versionId: string }>;
};

export async function DELETE(_request: Request, context: RouteContext) {
  const { session, error } = await requireAuth();
  if (error) return error;

  const { id, clipId, versionId } = await context.params;
  const userId = session!.user!.id;

  try {
    await requireSessionAccess(id, userId);

    const version = await prisma.clipProposalVersion.findFirst({
      where: {
        id: versionId,
        proposal: { trackClipId: clipId, trackClip: { sessionId: id } },
      },
      include: { proposal: true },
    });

    if (!version) {
      return NextResponse.json({ error: "Version not found" }, { status: 404 });
    }

    const proposalId = version.proposalId;

    await prisma.clipProposalVersion.delete({ where: { id: versionId } });

    const remaining = await prisma.clipProposalVersion.count({
      where: { proposalId },
    });

    if (remaining === 0) {
      await prisma.clipProposal.delete({ where: { id: proposalId } });
    } else {
      await prisma.clipProposal.update({
        where: { id: proposalId },
        data: { updatedAt: new Date() },
      });
    }

    await touchSessionUpdated(id);

    const detail = await loadTrackDetail(id, clipId, userId);
    return NextResponse.json(detail);
  } catch (err) {
    const response = teamAccessResponse(err);
    if (response) return response;
    throw err;
  }
}
