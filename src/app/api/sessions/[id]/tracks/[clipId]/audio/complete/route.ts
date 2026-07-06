import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { z } from "zod";import { requireAuth } from "@/lib/api-auth";
import { prisma } from "@/lib/db";
import {
  buildUploadedAudioKey,
  extensionForMimeType,
  isAllowedUploadedAudioMimeType,
  mapUploadedAudioMetadata,
  UPLOADED_AUDIO_MAX_BYTES,
} from "@/lib/uploaded-audio";
import { headAudioObject, isS3AudioConfigError } from "@/lib/s3-audio";
import { generateAndStoreClipWaveform } from "@/lib/server-audio-waveform";
import { requireSessionAccess, teamAccessResponse } from "@/lib/team-auth";

export const runtime = "nodejs";

const completeSchema = z.object({
  key: z.string().min(1),
  mimeType: z.string(),
  durationMs: z.number().int().positive(),
  sizeBytes: z.number().int().positive().max(UPLOADED_AUDIO_MAX_BYTES),
});

type RouteContext = { params: Promise<{ id: string; clipId: string }> };

export async function POST(request: Request, context: RouteContext) {
  const { session, error } = await requireAuth();
  if (error) return error;

  const { id: sessionId, clipId } = await context.params;
  const userId = session!.user!.id;

  let body: z.infer<typeof completeSchema>;
  try {
    body = completeSchema.parse(await request.json());
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  if (!isAllowedUploadedAudioMimeType(body.mimeType)) {
    return NextResponse.json({ error: "Unsupported audio type" }, { status: 400 });
  }

  const expectedKey = buildUploadedAudioKey(
    sessionId,
    clipId,
    extensionForMimeType(body.mimeType),
  );
  if (body.key !== expectedKey) {
    return NextResponse.json({ error: "Invalid upload key" }, { status: 400 });
  }

  try {
    await requireSessionAccess(sessionId, userId);

    const clip = await prisma.trackClip.findFirst({
      where: { id: clipId, sessionId },
      select: { id: true, uploadedAudioKey: true },
    });
    if (!clip) {
      return NextResponse.json({ error: "Track not found" }, { status: 404 });
    }

    const head = await headAudioObject(body.key);
    if (head.contentLength <= 0 || head.contentLength > UPLOADED_AUDIO_MAX_BYTES) {
      return NextResponse.json({ error: "Uploaded file size is invalid" }, { status: 400 });
    }

    if (clip.uploadedAudioKey && clip.uploadedAudioKey !== body.key) {
      // Old object cleanup is best-effort; ignore delete failures.
      try {
        const { deleteAudioObject } = await import("@/lib/s3-audio");
        await deleteAudioObject(clip.uploadedAudioKey);
      } catch {
        // ignore
      }
    }

    const updated = await prisma.trackClip.update({
      where: { id: clipId },
      data: {
        uploadedAudioKey: body.key,
        uploadedAudioMimeType: body.mimeType,
        uploadedAudioSizeBytes: head.contentLength,
        uploadedAudioDurationMs: body.durationMs,
        uploadedAudioUploadedAt: new Date(),
        uploadedAudioUploadedByUserId: userId,
        durationMs: body.durationMs,
        uploadedAudioWaveformPeaks: Prisma.JsonNull,
      },
      select: {
        uploadedAudioKey: true,
        uploadedAudioMimeType: true,
        uploadedAudioSizeBytes: true,
        uploadedAudioDurationMs: true,
        uploadedAudioUploadedAt: true,
      },
    });

    await generateAndStoreClipWaveform(clipId);

    return NextResponse.json({
      hasUploadedAudio: true,
      uploadedAudio: mapUploadedAudioMetadata(updated),
    });
  } catch (err) {
    if (isS3AudioConfigError(err)) {
      return NextResponse.json({ error: err.message }, { status: 503 });
    }
    const response = teamAccessResponse(err);
    if (response) return response;
    throw err;
  }
}
