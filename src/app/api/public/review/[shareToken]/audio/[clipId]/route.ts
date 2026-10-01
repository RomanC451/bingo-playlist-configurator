import { NextResponse } from "next/server";
import { z } from "zod";
import {
  GUEST_REVIEW_GUEST_HEADER,
  GUEST_REVIEW_GUEST_QUERY_PARAM,
  ReviewShareError,
  resolveReviewShareSession,
} from "@/lib/guest-review";
import { prisma } from "@/lib/db";
import { hasUploadedAudio } from "@/lib/uploaded-audio";
import { streamUploadedAudioResponse } from "@/lib/uploaded-audio-stream";

export const runtime = "nodejs";

const guestIdSchema = z.string().uuid();

type RouteContext = { params: Promise<{ shareToken: string; clipId: string }> };

function readGuestId(request: Request) {
  const header = request.headers.get(GUEST_REVIEW_GUEST_HEADER);
  const query = new URL(request.url).searchParams.get(GUEST_REVIEW_GUEST_QUERY_PARAM);
  const parsed = guestIdSchema.safeParse(header ?? query);
  if (!parsed.success) {
    return null;
  }
  return parsed.data;
}

export async function GET(request: Request, context: RouteContext) {
  const { shareToken, clipId } = await context.params;
  const guestId = readGuestId(request);

  if (!guestId) {
    return NextResponse.json({ error: "Valid guest id required" }, { status: 400 });
  }

  try {
    const bingoSession = await resolveReviewShareSession(shareToken);

    const clip = await prisma.trackClip.findFirst({
      where: { id: clipId, sessionId: bingoSession.id },
      select: { uploadedAudioKey: true },
    });

    if (!clip || !hasUploadedAudio(clip)) {
      return NextResponse.json({ error: "Uploaded audio not found" }, { status: 404 });
    }

    return streamUploadedAudioResponse(clip.uploadedAudioKey!, request);
  } catch (err) {
    if (err instanceof ReviewShareError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    throw err;
  }
}
