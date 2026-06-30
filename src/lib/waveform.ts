export type WaveformSource = "wavevisual" | "placeholder";

export interface WaveformData {
  durationMs: number;
  /** Raw WaveVisual amplitude array (~500–2000 samples). */
  rawAmplitudes?: number[];
  /** Legacy processed peaks kept for placeholder fallback only. */
  peaks?: number[];
  source: WaveformSource;
  imageUrl?: string;
  message?: string;
}

export const PLACEHOLDER_PEAKS = 480;

/** @deprecated Renamed to PLACEHOLDER_PEAKS — kept so stale imports still compile. */
export const TARGET_PEAKS = PLACEHOLDER_PEAKS;

export function placeholderWaveform(
  durationMs: number,
  message?: string,
): WaveformData {
  const peaks = Array.from({ length: PLACEHOLDER_PEAKS }, (_, i) => {
    const t = i / PLACEHOLDER_PEAKS;
    return 0.3 + 0.4 * Math.sin(t * Math.PI * 8) ** 2;
  });

  return {
    durationMs,
    peaks,
    source: "placeholder",
    message: message ?? "Waveform unavailable — check WaveVisual configuration.",
  };
}

export function msToLabel(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

export function labelToMs(label: string): number | null {
  const match = label.trim().match(/^(\d+):(\d{2})$/);
  if (!match) return null;
  const minutes = parseInt(match[1], 10);
  const seconds = parseInt(match[2], 10);
  if (seconds >= 60) return null;
  return (minutes * 60 + seconds) * 1000;
}
