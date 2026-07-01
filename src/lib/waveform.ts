export interface WaveformData {
  durationMs: number;
  peaks: number[];
}

export const PLACEHOLDER_PEAKS = 480;

/** @deprecated Renamed to PLACEHOLDER_PEAKS — kept so stale imports still compile. */
export const TARGET_PEAKS = PLACEHOLDER_PEAKS;

export function placeholderWaveform(durationMs: number): WaveformData {
  const peaks = Array.from({ length: PLACEHOLDER_PEAKS }, (_, i) => {
    const t = i / PLACEHOLDER_PEAKS;
    return 0.3 + 0.4 * Math.sin(t * Math.PI * 8) ** 2;
  });

  return { durationMs, peaks };
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

/** Single SVG path for mirrored waveform peaks — scales without per-bar layout. */
export function buildMirroredWaveformPath(
  peaks: number[],
  viewWidth = peaks.length,
  viewHeight = 100,
): string {
  if (peaks.length === 0) {
    return "";
  }

  const mid = viewHeight / 2;
  const step = viewWidth / peaks.length;
  const coords: string[] = [];

  for (let i = 0; i < peaks.length; i++) {
    const x = i * step + step / 2;
    const amplitude = (Math.max(3, peaks[i] * 50) / 100) * mid;
    coords.push(`${x},${mid - amplitude}`);
  }

  for (let i = peaks.length - 1; i >= 0; i--) {
    const x = i * step + step / 2;
    const amplitude = (Math.max(3, peaks[i] * 50) / 100) * mid;
    coords.push(`${x},${mid + amplitude}`);
  }

  return `M ${coords[0]} L ${coords.slice(1).join(" L ")} Z`;
}
