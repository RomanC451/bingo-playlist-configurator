import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAuth } from "@/lib/api-auth";
import { prisma } from "@/lib/db";
import { requireSessionAccess, teamAccessResponse } from "@/lib/team-auth";
import { touchSessionUpdated } from "@/lib/session-activity";
import { clearTrackNeedsAttention } from "@/lib/track-attention";
import {
  assertTrackEditableByUser,
  TrackEditLockedError,
  TrackEditNotHeldError,
} from "@/lib/track-edit-lock-db";
import { loadTrackDetail } from "@/lib/track-summaries";

const proposalSchema = z.object({
  startMs: z.number().int().min(0),
  endMs: z.number().int().min(1),
});

type RouteContext = { params: Promise<{ id: string; clipId: string }> };

function clampClipRange(
  startMs: number,
  endMs: number,
  durationMs: number,
): { startMs: number; endMs: number } {
  const maxEnd = durationMs > 0 ? durationMs : endMs;
  const clampedStart = Math.min(startMs, maxEnd - 1);
  const clampedEnd = Math.min(endMs, maxEnd);
  return { startMs: clampedStart, endMs: clampedEnd };
}

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
    const parsed = proposalSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid input" }, { status: 400 });
    }

    if (parsed.data.startMs >= parsed.data.endMs) {
      return NextResponse.json(
        { error: "Start must be before end" },
        { status: 400 },
      );
    }

    await assertTrackEditableByUser(clipId, userId);

    const { startMs, endMs } = clampClipRange(
      parsed.data.startMs,
      parsed.data.endMs,
      clip.durationMs,
    );

    const proposal = await prisma.clipProposal.upsert({
      where: { trackClipId: clipId },
      create: { trackClipId: clipId },
      update: {},
    });

    await prisma.$transaction([
      prisma.clipProposalVersion.create({
        data: {
          proposalId: proposal.id,
          startMs,
          endMs,
          createdByUserId: userId,
        },
      }),
      prisma.trackClipReview.deleteMany({ where: { trackClipId: clipId } }),
    ]);

    await prisma.clipProposal.update({
      where: { id: proposal.id },
      data: { updatedAt: new Date() },
    });

    await touchSessionUpdated(id);
    await clearTrackNeedsAttention(clipId);

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
