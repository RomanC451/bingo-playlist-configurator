import { NextResponse } from "next/server";
import { ReviewShareError, resolveReviewShareSession } from "@/lib/guest-review";
import { prisma } from "@/lib/db";
import { ensureClipUploadedWaveform } from "@/lib/server-audio-waveform";
import { hasUploadedAudio } from "@/lib/uploaded-audio";
import { placeholderWaveform } from "@/lib/waveform";

export const runtime = "nodejs";

type RouteContext = { params: Promise<{ shareToken: string; clipId: string }> };

export async function GET(_request: Request, context: RouteContext) {
  const { shareToken, clipId } = await context.params;

  try {
    const bingoSession = await resolveReviewShareSession(shareToken);

    const clip = await prisma.trackClip.findFirst({
      where: { id: clipId, sessionId: bingoSession.id },
      select: {
        id: true,
        durationMs: true,
        uploadedAudioDurationMs: true,
        uploadedAudioKey: true,
      },
    });

    if (!clip) {
      return NextResponse.json({ error: "Track not found" }, { status: 404 });
    }

    if (hasUploadedAudio(clip)) {
      const waveform = await ensureClipUploadedWaveform(clip.id);
      if (waveform) {
        return NextResponse.json(waveform);
      }
    }

    const durationMs = clip.uploadedAudioDurationMs ?? clip.durationMs ?? 180_000;
    return NextResponse.json(placeholderWaveform(durationMs));
  } catch (err) {
    if (err instanceof ReviewShareError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    throw err;
  }
}
