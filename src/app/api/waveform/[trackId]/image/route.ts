import { NextResponse } from "next/server";
import { formatApiErrorMessage, internalError, waveVisualErrorPayload } from "@/lib/api-errors";
import { requireAuth } from "@/lib/api-auth";
import { getTrack } from "@/lib/spotify";
import {
  deleteCachedWaveform,
  getCachedRawAmplitudes,
  cacheWaveform,
} from "@/lib/waveform-cache";
import {
  waveformFromWaveVisual,
  WaveVisualApiError,
} from "@/lib/waveform-from-wavevisual";
import { isWaveVisualConfigured } from "@/lib/wavevisual-api";
import { renderWaveVisualSvg } from "@/lib/wavevisual-render";

export const runtime = "nodejs";
export const maxDuration = 60;

type RouteContext = { params: Promise<{ trackId: string }> };

export async function GET(request: Request, context: RouteContext) {
  const { session, error } = await requireAuth();
  if (error) return error;

  const { trackId } = await context.params;
  const userId = session!.user!.id;
  const { searchParams } = new URL(request.url);
  const refresh = searchParams.get("refresh") === "1";
  const theme = searchParams.get("theme") === "dark" ? "dark" : "light";

  if (!isWaveVisualConfigured()) {
    return internalError(
      "WaveVisual is not configured. Set WAVEVISUAL_API_TOKEN in .env.",
      503,
    );
  }

  if (refresh) {
    await deleteCachedWaveform(trackId);
  }

  let cached = await getCachedRawAmplitudes(trackId);

  if (!cached) {
    let durationMs = 180_000;
    try {
      const track = await getTrack(userId, trackId);
      durationMs = track.duration_ms;
    } catch {
      // optional Spotify metadata
    }

    try {
      const data = await waveformFromWaveVisual(trackId, durationMs);
      await cacheWaveform(trackId, data);
      cached = {
        durationMs: data.durationMs,
        rawAmplitudes: data.rawAmplitudes ?? [],
      };
    } catch (err) {
      const payload =
        err instanceof WaveVisualApiError
          ? waveVisualErrorPayload(
              err.status === 401
                ? "WaveVisual API token invalid or expired"
                : err.message,
              err.status,
              err.message,
            )
          : waveVisualErrorPayload("Could not load waveform from WaveVisual.", 502);
      return new NextResponse(formatApiErrorMessage(payload), {
        status: payload.upstreamStatus ?? 502,
        headers: { "X-Error-Source": "wavevisual" },
      });
    }
  }

  const svg = renderWaveVisualSvg(cached.rawAmplitudes, theme);

  return new NextResponse(svg, {
    headers: {
      "Content-Type": "image/svg+xml; charset=utf-8",
      "Cache-Control": refresh ? "no-store" : "public, max-age=86400",
    },
  });
}
