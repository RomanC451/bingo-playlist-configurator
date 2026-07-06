import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { requireAuth } from "@/lib/api-auth";import { prisma } from "@/lib/db";
import { hasUploadedAudio } from "@/lib/uploaded-audio";
import { deleteAudioObject, isS3AudioConfigError } from "@/lib/s3-audio";
import { requireSessionAccess, teamAccessResponse } from "@/lib/team-auth";

export const runtime = "nodejs";

type RouteContext = { params: Promise<{ id: string; clipId: string }> };

export async function DELETE(_request: Request, context: RouteContext) {
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

    try {
      await deleteAudioObject(clip.uploadedAudioKey!);
    } catch (err) {
      if (!isS3AudioConfigError(err)) {
        throw err;
      }
      return NextResponse.json({ error: (err as Error).message }, { status: 503 });
    }

    await prisma.trackClip.update({
      where: { id: clipId },
      data: {
        uploadedAudioKey: null,
        uploadedAudioMimeType: null,
        uploadedAudioSizeBytes: null,
        uploadedAudioDurationMs: null,
        uploadedAudioUploadedAt: null,
        uploadedAudioUploadedByUserId: null,
        uploadedAudioWaveformPeaks: Prisma.JsonNull,
      },
    });

    return NextResponse.json({ hasUploadedAudio: false, uploadedAudio: null });
  } catch (err) {
    const response = teamAccessResponse(err);
    if (response) return response;
    throw err;
  }
}
