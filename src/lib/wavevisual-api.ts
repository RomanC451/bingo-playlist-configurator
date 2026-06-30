const DEFAULT_BASE_URL = "https://wavevisual.com/api/v1";

export class WaveVisualApiError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
    this.name = "WaveVisualApiError";
  }
}

function getWaveVisualConfig() {
  const token = process.env.WAVEVISUAL_API_TOKEN?.trim();
  if (!token) return null;

  return {
    token,
    baseUrl: (process.env.WAVEVISUAL_API_URL ?? DEFAULT_BASE_URL).replace(/\/$/, ""),
  };
}

export function isWaveVisualConfigured(): boolean {
  return getWaveVisualConfig() != null;
}

async function waveVisualFetch<T>(path: string): Promise<T> {
  const config = getWaveVisualConfig();
  if (!config) {
    throw new WaveVisualApiError("WAVEVISUAL_API_TOKEN is not configured", 500);
  }

  const response = await fetch(`${config.baseUrl}${path}`, {
    headers: {
      Authorization: `Bearer ${config.token}`,
      Accept: "application/json",
    },
    cache: "no-store",
  });

  const text = await response.text();
  if (!response.ok) {
    throw new WaveVisualApiError(text.trim() || `WaveVisual API ${response.status}`, response.status);
  }

  try {
    return JSON.parse(text) as T;
  } catch {
    throw new WaveVisualApiError("WaveVisual API returned invalid JSON", 502);
  }
}

export async function fetchWaveVisualSpotifyWaveform(
  spotifyTrackId: string,
): Promise<unknown> {
  return waveVisualFetch(`/spotify/waveform/${encodeURIComponent(spotifyTrackId)}`);
}

export async function fetchWaveVisualSpotifyTrack(
  spotifyTrackId: string,
): Promise<unknown> {
  return waveVisualFetch(`/spotify/track/${encodeURIComponent(spotifyTrackId)}`);
}
