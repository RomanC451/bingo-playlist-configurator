import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAuth } from "@/lib/api-auth";
import { prisma } from "@/lib/db";
import { requireSessionAccess, teamAccessResponse } from "@/lib/team-auth";
import { touchSessionUpdated } from "@/lib/session-activity";
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

    const { startMs, endMs } = clampClipRange(
      parsed.data.startMs,
      parsed.data.endMs,
      clip.durationMs,
    );

    await prisma.clipProposal.upsert({
      where: { trackClipId_userId: { trackClipId: clipId, userId } },
      create: { trackClipId: clipId, userId, startMs, endMs },
      update: { startMs, endMs },
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

    const clip = await prisma.trackClip.findFirst({
      where: { id: clipId, sessionId: id },
    });

    if (!clip) {
      return NextResponse.json({ error: "Track not found" }, { status: 404 });
    }

    const deleted = await prisma.clipProposal.deleteMany({
      where: { trackClipId: clipId, userId },
    });

    if (deleted.count === 0) {
      return NextResponse.json({ error: "No proposal to remove" }, { status: 404 });
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
