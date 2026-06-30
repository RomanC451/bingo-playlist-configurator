import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/api-auth";
import { formatApiErrorMessage, internalError, waveVisualErrorPayload } from "@/lib/api-errors";
import { getTrack } from "@/lib/spotify";
import { placeholderWaveform } from "@/lib/waveform";
import {
  waveformFromWaveVisual,
  WaveVisualApiError,
} from "@/lib/waveform-from-wavevisual";
import { isWaveVisualConfigured } from "@/lib/wavevisual-api";
import {
  cacheWaveform,
  deleteCachedWaveform,
  getCachedWaveform,
} from "@/lib/waveform-cache";

export const runtime = "nodejs";
export const maxDuration = 60;

type RouteContext = { params: Promise<{ trackId: string }> };

export async function GET(request: Request, context: RouteContext) {
  const { session, error } = await requireAuth();
  if (error) return error;

  const { trackId } = await context.params;
  const userId = session!.user!.id;
  const { searchParams } = new URL(request.url);
  const trackName = searchParams.get("trackName") ?? undefined;
  const artistName = searchParams.get("artistName") ?? undefined;
  const refresh = searchParams.get("refresh") === "1";

  if (!isWaveVisualConfigured()) {
    return internalError(
      "WaveVisual is not configured. Set WAVEVISUAL_API_TOKEN in .env (see .env.example).",
      503,
    );
  }

  if (refresh) {
    await deleteCachedWaveform(trackId);
  }

  const cached = await getCachedWaveform(trackId);
  if (cached?.source === "wavevisual") {
    return NextResponse.json(cached);
  }

  if (cached) {
    await deleteCachedWaveform(trackId);
  }

  let durationMs = 180_000;
  try {
    const track = await getTrack(userId, trackId);
    durationMs = track.duration_ms;
  } catch {
    // WaveVisual can still return duration; Spotify metadata is optional.
    void trackName;
    void artistName;
  }

  try {
    const data = await waveformFromWaveVisual(trackId, durationMs);
    await cacheWaveform(trackId, data);
    return NextResponse.json(data);
  } catch (err) {
    if (err instanceof WaveVisualApiError) {
      const message =
        err.status === 401
          ? "WaveVisual API token invalid or expired. Update WAVEVISUAL_API_TOKEN."
          : err.message;

      console.error("WaveVisual waveform failed:", err.message);

      const payload = waveVisualErrorPayload(message, err.status, err.message);
      return NextResponse.json(
        placeholderWaveform(durationMs, formatApiErrorMessage(payload)),
        { status: err.status === 401 ? 401 : 502, headers: { "X-Error-Source": "wavevisual" } },
      );
    }

    console.error("WaveVisual waveform failed:", err);
    const payload = waveVisualErrorPayload(
      "Could not load waveform from WaveVisual.",
      502,
    );
    return NextResponse.json(
      placeholderWaveform(durationMs, formatApiErrorMessage(payload)),
      { status: 502, headers: { "X-Error-Source": "wavevisual" } },
    );
  }
}
