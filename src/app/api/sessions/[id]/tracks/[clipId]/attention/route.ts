import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAuth } from "@/lib/api-auth";
import { prisma } from "@/lib/db";
import { requireSessionAccess, teamAccessResponse } from "@/lib/team-auth";
import { loadTrackDetail } from "@/lib/track-summaries";

const attentionSchema = z.object({
  needsAttention: z.boolean(),
  comment: z.string().trim().max(500).optional(),
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
      select: { id: true },
    });

    if (!clip) {
      return NextResponse.json({ error: "Track not found" }, { status: 404 });
    }

    const body = await request.json();
    const parsed = attentionSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid input" }, { status: 400 });
    }

    await prisma.trackClip.update({
      where: { id: clipId },
      data: parsed.data.needsAttention
        ? {
            needsAttention: true,
            needsAttentionByUserId: userId,
            needsAttentionComment: parsed.data.comment || null,
          }
        : {
            needsAttention: false,
            needsAttentionByUserId: null,
            needsAttentionComment: null,
          },
    });

    const detail = await loadTrackDetail(id, clipId, userId);
    return NextResponse.json(detail);
  } catch (err) {
    const response = teamAccessResponse(err);
    if (response) return response;
    throw err;
  }
}
