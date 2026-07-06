import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAuth } from "@/lib/api-auth";
import { prisma } from "@/lib/db";
import {
  buildUploadedAudioKey,
  extensionForMimeType,
  isAllowedUploadedAudioMimeType,
  UPLOADED_AUDIO_MAX_BYTES,
} from "@/lib/uploaded-audio";
import { createUploadPresignedUrl, isS3AudioConfigError } from "@/lib/s3-audio";
import { requireSessionAccess, teamAccessResponse } from "@/lib/team-auth";

export const runtime = "nodejs";

const uploadUrlSchema = z.object({
  contentType: z.string(),
  sizeBytes: z.number().int().positive().max(UPLOADED_AUDIO_MAX_BYTES),
});

type RouteContext = { params: Promise<{ id: string; clipId: string }> };

export async function POST(request: Request, context: RouteContext) {
  const { session, error } = await requireAuth();
  if (error) return error;

  const { id: sessionId, clipId } = await context.params;
  const userId = session!.user!.id;

  let body: z.infer<typeof uploadUrlSchema>;
  try {
    body = uploadUrlSchema.parse(await request.json());
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  if (!isAllowedUploadedAudioMimeType(body.contentType)) {
    return NextResponse.json({ error: "Unsupported audio type" }, { status: 400 });
  }

  try {
    await requireSessionAccess(sessionId, userId);

    const clip = await prisma.trackClip.findFirst({
      where: { id: clipId, sessionId },
      select: { id: true },
    });
    if (!clip) {
      return NextResponse.json({ error: "Track not found" }, { status: 404 });
    }

    const key = buildUploadedAudioKey(
      sessionId,
      clipId,
      extensionForMimeType(body.contentType),
    );
    const { uploadUrl } = await createUploadPresignedUrl(
      key,
      body.contentType,
      body.sizeBytes,
    );

    return NextResponse.json({
      uploadUrl,
      key,
      maxBytes: UPLOADED_AUDIO_MAX_BYTES,
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
