import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAuth } from "@/lib/api-auth";
import { prisma } from "@/lib/db";
import { touchSessionUpdated } from "@/lib/session-activity";
import { requireSessionAccess, teamAccessResponse } from "@/lib/team-auth";

const updateClipSchema = z.object({
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

export async function PATCH(request: Request, context: RouteContext) {
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
      return NextResponse.json({ error: "Clip not found" }, { status: 404 });
    }

    const body = await request.json();
    const parsed = updateClipSchema.safeParse(body);

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

    const proposal = await prisma.clipProposal.upsert({
      where: { trackClipId_userId: { trackClipId: clipId, userId } },
      create: { trackClipId: clipId, userId, startMs, endMs },
      update: { startMs, endMs },
    });
    await touchSessionUpdated(id);

    return NextResponse.json(proposal);
  } catch (err) {
    const response = teamAccessResponse(err);
    if (response) return response;
    throw err;
  }
}
