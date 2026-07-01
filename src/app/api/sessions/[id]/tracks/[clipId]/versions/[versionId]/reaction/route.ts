import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAuth } from "@/lib/api-auth";
import { clipReactionTypeFromValue } from "@/lib/clip-reactions";
import { prisma } from "@/lib/db";
import { requireSessionAccess, teamAccessResponse } from "@/lib/team-auth";
import { loadTrackDetail } from "@/lib/track-summaries";

const reactionSchema = z.object({
  reaction: z.enum(["like", "dislike"]),
});

type RouteContext = {
  params: Promise<{ id: string; clipId: string; versionId: string }>;
};

export async function PUT(request: Request, context: RouteContext) {
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
      select: { id: true },
    });

    if (!version) {
      return NextResponse.json({ error: "Version not found" }, { status: 404 });
    }

    const body = await request.json();
    const parsed = reactionSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid input" }, { status: 400 });
    }

    const reactionType = clipReactionTypeFromValue(parsed.data.reaction);
    const existing = await prisma.clipProposalVersionReaction.findUnique({
      where: {
        versionId_userId: {
          versionId,
          userId,
        },
      },
    });

    if (existing?.reaction === reactionType) {
      await prisma.clipProposalVersionReaction.delete({
        where: {
          versionId_userId: {
            versionId,
            userId,
          },
        },
      });
    } else {
      await prisma.clipProposalVersionReaction.upsert({
        where: {
          versionId_userId: {
            versionId,
            userId,
          },
        },
        create: {
          versionId,
          userId,
          reaction: reactionType,
        },
        update: {
          reaction: reactionType,
        },
      });
    }

    const detail = await loadTrackDetail(id, clipId, userId);
    return NextResponse.json(detail);
  } catch (err) {
    const response = teamAccessResponse(err);
    if (response) return response;
    throw err;
  }
}
