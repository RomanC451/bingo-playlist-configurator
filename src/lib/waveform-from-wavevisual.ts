import {
  fetchWaveVisualSpotifyTrack,
  fetchWaveVisualSpotifyWaveform,
  isWaveVisualConfigured,
  WaveVisualApiError,
} from "@/lib/wavevisual-api";
import { waveformImagePath } from "@/lib/wavevisual-render";
import { type WaveformData } from "@/lib/waveform";

function isNumberArray(value: unknown): value is number[] {
  return Array.isArray(value) && value.length > 0 && value.every((v) => typeof v === "number");
}

function parseDurationMs(payload: Record<string, unknown>, fallbackMs?: number): number {
  const candidates = [
    payload.durationMs,
    payload.duration_ms,
    payload.durationInMs,
    payload.duration,
    (payload.track as Record<string, unknown> | undefined)?.duration_ms,
    (payload.track as Record<string, unknown> | undefined)?.durationMs,
    (payload.data as Record<string, unknown> | undefined)?.duration_ms,
    (payload.data as Record<string, unknown> | undefined)?.durationMs,
  ];

  for (const candidate of candidates) {
    if (typeof candidate === "number" && candidate > 0) {
      return candidate > 1000 ? Math.round(candidate) : Math.round(candidate * 1000);
    }
  }

  return fallbackMs ?? 180_000;
}

function extractRawAmplitudes(payload: unknown): number[] | null {
  if (isNumberArray(payload)) {
    return payload;
  }

  if (!payload || typeof payload !== "object") {
    return null;
  }

  const record = payload as Record<string, unknown>;

  if (isNumberArray(record.data)) {
    return record.data;
  }

  for (const key of ["peaks", "bars", "waveform", "amplitudes", "heights"]) {
    const value = record[key];
    if (isNumberArray(value)) {
      return value;
    }
  }

  return null;
}

export async function waveformFromWaveVisual(
  spotifyTrackId: string,
  durationMsHint?: number,
): Promise<WaveformData> {
  if (!isWaveVisualConfigured()) {
    throw new WaveVisualApiError("WAVEVISUAL_API_TOKEN is not configured", 503);
  }

  let payload: unknown;
  try {
    payload = await fetchWaveVisualSpotifyWaveform(spotifyTrackId);
  } catch (err) {
    if (err instanceof WaveVisualApiError && err.status === 404) {
      payload = await fetchWaveVisualSpotifyTrack(spotifyTrackId);
    } else {
      throw err;
    }
  }

  const rawAmplitudes = extractRawAmplitudes(payload);
  if (!rawAmplitudes) {
    throw new WaveVisualApiError("Unrecognized WaveVisual waveform response", 502);
  }

  const durationMs =
    payload && typeof payload === "object"
      ? parseDurationMs(payload as Record<string, unknown>, durationMsHint)
      : (durationMsHint ?? 180_000);

  return {
    durationMs,
    rawAmplitudes,
    source: "wavevisual",
    imageUrl: waveformImagePath(spotifyTrackId),
    message: "Waveform image rendered from WaveVisual data",
  };
}

export { WaveVisualApiError };
