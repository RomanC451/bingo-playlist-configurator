import { PLACEHOLDER_PEAKS } from "@/lib/waveform";

export type DecodedAudio = {
  length: number;
  numberOfChannels: number;
  getChannelData(channel: number): Float32Array;
};

export function peaksFromChannelData(samples: Float32Array, peakCount: number): number[] {
  if (peakCount <= 0 || samples.length === 0) {
    return [];
  }

  const samplesPerPeak = Math.max(1, Math.floor(samples.length / peakCount));
  const peaks: number[] = [];

  for (let i = 0; i < peakCount; i++) {
    const start = i * samplesPerPeak;
    const end =
      i === peakCount - 1 ? samples.length : Math.min(start + samplesPerPeak, samples.length);
    let max = 0;

    for (let j = start; j < end; j++) {
      const abs = Math.abs(samples[j]);
      if (abs > max) max = abs;
    }

    peaks.push(max);
  }

  const maxPeak = Math.max(...peaks, 0.001);
  return peaks.map((peak) => peak / maxPeak);
}

export function peaksFromDecodedAudio(
  audio: DecodedAudio,
  peakCount = PLACEHOLDER_PEAKS,
): number[] {
  if (audio.numberOfChannels === 1) {
    return peaksFromChannelData(audio.getChannelData(0), peakCount);
  }

  const mixed = new Float32Array(audio.length);
  for (let channel = 0; channel < audio.numberOfChannels; channel++) {
    const data = audio.getChannelData(channel);
    for (let i = 0; i < audio.length; i++) {
      mixed[i] += data[i] / audio.numberOfChannels;
    }
  }

  return peaksFromChannelData(mixed, peakCount);
}

export function parseStoredWaveformPeaks(value: unknown): number[] | null {
  if (!Array.isArray(value) || value.length === 0) {
    return null;
  }

  if (!value.every((entry) => typeof entry === "number" && Number.isFinite(entry))) {
    return null;
  }

  return value;
}
