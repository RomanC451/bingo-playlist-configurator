import { prisma } from "@/lib/db";
import { isRawWaveVisualAmplitudes } from "@/lib/wavevisual-render";
import type { WaveformData } from "@/lib/waveform";

export function isFullTrackWaveformSource(source: WaveformData["source"]): boolean {
  return source === "wavevisual";
}

export async function deleteCachedWaveform(spotifyTrackId: string): Promise<void> {
  await prisma.trackWaveform.deleteMany({ where: { spotifyTrackId } });
}

export async function getCachedWaveform(
  spotifyTrackId: string,
): Promise<WaveformData | null> {
  const cached = await prisma.trackWaveform.findUnique({
    where: { spotifyTrackId },
  });
  if (!cached) return null;

  const source = cached.source as WaveformData["source"];
  if (source !== "wavevisual" && source !== "placeholder") {
    return null;
  }

  const stored = cached.peaks as number[];
  if (source === "wavevisual" && !isRawWaveVisualAmplitudes(stored)) {
    return null;
  }

  if (source === "wavevisual") {
    return {
      durationMs: cached.durationMs,
      rawAmplitudes: stored,
      source,
      imageUrl: `/api/waveform/${encodeURIComponent(spotifyTrackId)}/image`,
    };
  }

  return {
    durationMs: cached.durationMs,
    peaks: stored,
    source,
  };
}

export async function getCachedRawAmplitudes(
  spotifyTrackId: string,
): Promise<{ durationMs: number; rawAmplitudes: number[] } | null> {
  const cached = await getCachedWaveform(spotifyTrackId);
  if (!cached?.rawAmplitudes?.length) {
    return null;
  }

  return {
    durationMs: cached.durationMs,
    rawAmplitudes: cached.rawAmplitudes,
  };
}

export async function cacheWaveform(
  spotifyTrackId: string,
  data: WaveformData,
): Promise<void> {
  if (data.source !== "wavevisual" || !data.rawAmplitudes?.length) {
    return;
  }

  await prisma.trackWaveform.upsert({
    where: { spotifyTrackId },
    create: {
      spotifyTrackId,
      durationMs: data.durationMs,
      peaks: data.rawAmplitudes,
      source: data.source,
    },
    update: {
      durationMs: data.durationMs,
      peaks: data.rawAmplitudes,
      source: data.source,
    },
  });
}
