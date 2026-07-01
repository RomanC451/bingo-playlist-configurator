import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/api-auth";
import { prisma } from "@/lib/db";
import { requireSessionAccess, teamAccessResponse } from "@/lib/team-auth";
import { touchSessionUpdated } from "@/lib/session-activity";
import {
  assertTrackEditableByUser,
  TrackEditLockedError,
  TrackEditNotHeldError,
} from "@/lib/track-edit-lock-db";
import { clearTrackClipReviews } from "@/lib/track-review-db";
import { resolveTrackPlaybackRange } from "@/lib/track-review";
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
      include: {
        proposal: {
          include: {
            trackClip: {
              include: {
                proposal: {
                  include: {
                    versions: { orderBy: { createdAt: "desc" } },
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!version) {
      return NextResponse.json({ error: "Version not found" }, { status: 404 });
    }

    const clip = version.proposal.trackClip;
    const removingCurrentClip =
      resolveTrackPlaybackRange(clip).versionId === versionId;

    await assertTrackEditableByUser(clipId, userId);

    const proposalId = version.proposalId;

    await prisma.clipProposalVersion.delete({ where: { id: versionId } });

    if (removingCurrentClip) {
      await clearTrackClipReviews(clipId);
    }

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
    if (err instanceof TrackEditLockedError) {
      return NextResponse.json(
        { error: err.message, editingBy: err.editingBy },
        { status: 409 },
      );
    }
    if (err instanceof TrackEditNotHeldError) {
      return NextResponse.json({ error: err.message }, { status: 409 });
    }
    const response = teamAccessResponse(err);
    if (response) return response;
    throw err;
  }
}
