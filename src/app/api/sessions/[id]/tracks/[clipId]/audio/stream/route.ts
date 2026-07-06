import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/api-auth";
import { prisma } from "@/lib/db";
import { hasUploadedAudio } from "@/lib/uploaded-audio";
import { streamUploadedAudioResponse } from "@/lib/uploaded-audio-stream";
import { requireSessionAccess, teamAccessResponse } from "@/lib/team-auth";

export const runtime = "nodejs";

type RouteContext = { params: Promise<{ id: string; clipId: string }> };

export async function GET(request: Request, context: RouteContext) {
  const { session, error } = await requireAuth();
  if (error) return error;

  const { id: sessionId, clipId } = await context.params;
  const userId = session!.user!.id;

  try {
    await requireSessionAccess(sessionId, userId);

    const clip = await prisma.trackClip.findFirst({
      where: { id: clipId, sessionId },
      select: { uploadedAudioKey: true },
    });

    if (!clip || !hasUploadedAudio(clip)) {
      return NextResponse.json({ error: "Uploaded audio not found" }, { status: 404 });
    }

    return streamUploadedAudioResponse(clip.uploadedAudioKey!, request);
  } catch (err) {
    const response = teamAccessResponse(err);
    if (response) return response;
    throw err;
  }
}
