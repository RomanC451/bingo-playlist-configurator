import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAuth } from "@/lib/api-auth";
import { prisma } from "@/lib/db";
import { requireSessionAccess, teamAccessResponse } from "@/lib/team-auth";
import { touchSessionUpdated } from "@/lib/session-activity";
import { loadTrackDetail } from "@/lib/track-summaries";

const voteSchema = z.object({
  proposalId: z.string(),
});

type RouteContext = { params: Promise<{ id: string; clipId: string }> };

export async function PUT(request: Request, context: RouteContext) {
  const { session, error } = await requireAuth();
  if (error) return error;

  const { id, clipId } = await context.params;
  const userId = session!.user!.id;

  try {
    await requireSessionAccess(id, userId);

    const clip = await prisma.trackClip.findFirst({
      where: { id: clipId, sessionId: id },
    });

    if (!clip) {
      return NextResponse.json({ error: "Track not found" }, { status: 404 });
    }

    const body = await request.json();
    const parsed = voteSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid input" }, { status: 400 });
    }

    const proposal = await prisma.clipProposal.findFirst({
      where: { id: parsed.data.proposalId, trackClipId: clipId },
    });

    if (!proposal) {
      return NextResponse.json(
        { error: "Proposal not found for this track" },
        { status: 404 },
      );
    }

    await prisma.clipVote.upsert({
      where: { trackClipId_userId: { trackClipId: clipId, userId } },
      create: {
        trackClipId: clipId,
        userId,
        proposalId: parsed.data.proposalId,
      },
      update: { proposalId: parsed.data.proposalId },
    });
    await touchSessionUpdated(id);

    const detail = await loadTrackDetail(id, clipId, userId);
    return NextResponse.json(detail);
  } catch (err) {
    const response = teamAccessResponse(err);
    if (response) return response;
    throw err;
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
  const { session, error } = await requireAuth();
  if (error) return error;

  const { id, clipId } = await context.params;
  const userId = session!.user!.id;

  try {
    await requireSessionAccess(id, userId);

    await prisma.clipVote.deleteMany({
      where: { trackClipId: clipId, userId },
    });
    await touchSessionUpdated(id);

    const detail = await loadTrackDetail(id, clipId, userId);
    return NextResponse.json(detail);
  } catch (err) {
    const response = teamAccessResponse(err);
    if (response) return response;
    throw err;
  }
}
