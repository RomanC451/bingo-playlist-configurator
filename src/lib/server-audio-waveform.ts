import { MPEGDecoder } from "mpg123-decoder";
import decodeWav from "@audio/decode-wav";
import { prisma } from "@/lib/db";
import { getAudioObjectBuffer } from "@/lib/s3-audio";
import { PLACEHOLDER_PEAKS, type WaveformData } from "@/lib/waveform";
import {
  parseStoredWaveformPeaks,
  peaksFromDecodedAudio,
  type DecodedAudio,
} from "@/lib/waveform-peaks";

type PcmAudio = {
  channelData: Float32Array[];
  sampleRate: number;
  samplesDecoded: number;
};

function pcmToDecodedAudio(pcm: PcmAudio): DecodedAudio {
  const length = pcm.channelData[0]?.length ?? 0;
  return {
    length,
    numberOfChannels: pcm.channelData.length,
    getChannelData(channel: number) {
      return pcm.channelData[channel] ?? new Float32Array(0);
    },
  };
}

async function decodeUploadedAudio(buffer: Buffer, mimeType: string): Promise<PcmAudio> {
  const bytes = new Uint8Array(buffer);

  if (mimeType === "audio/mpeg") {
    const decoder = new MPEGDecoder();
    await decoder.ready;
    try {
      const decoded = decoder.decode(bytes);
      return {
        channelData: decoded.channelData,
        sampleRate: decoded.sampleRate,
        samplesDecoded: decoded.samplesDecoded,
      };
    } finally {
      decoder.free();
    }
  }

  if (mimeType === "audio/wav" || mimeType === "audio/x-wav") {
    const decoded = await decodeWav(buffer);
    return {
      channelData: decoded.channelData,
      sampleRate: decoded.sampleRate,
      samplesDecoded: decoded.channelData[0]?.length ?? 0,
    };
  }

  throw new Error(`Unsupported audio type for waveform generation: ${mimeType}`);
}

export async function generateWaveformFromS3Object(
  key: string,
  mimeType: string,
  durationMs?: number | null,
): Promise<WaveformData> {
  const buffer = await getAudioObjectBuffer(key);
  const decoded = await decodeUploadedAudio(buffer, mimeType);
  const peaks = peaksFromDecodedAudio(pcmToDecodedAudio(decoded), PLACEHOLDER_PEAKS);

  return {
    durationMs:
      durationMs ??
      Math.round((decoded.samplesDecoded / decoded.sampleRate) * 1000),
    peaks,
  };
}

export async function ensureClipUploadedWaveform(clipId: string): Promise<WaveformData | null> {
  const clip = await prisma.trackClip.findUnique({
    where: { id: clipId },
    select: {
      uploadedAudioKey: true,
      uploadedAudioMimeType: true,
      uploadedAudioDurationMs: true,
      uploadedAudioWaveformPeaks: true,
      durationMs: true,
    },
  });

  if (!clip?.uploadedAudioKey || !clip.uploadedAudioMimeType) {
    return null;
  }

  const storedPeaks = parseStoredWaveformPeaks(clip.uploadedAudioWaveformPeaks);
  if (storedPeaks) {
    return {
      durationMs: clip.uploadedAudioDurationMs ?? clip.durationMs,
      peaks: storedPeaks,
    };
  }

  const generated = await generateWaveformFromS3Object(
    clip.uploadedAudioKey,
    clip.uploadedAudioMimeType,
    clip.uploadedAudioDurationMs ?? clip.durationMs,
  );

  await prisma.trackClip.update({
    where: { id: clipId },
    data: { uploadedAudioWaveformPeaks: generated.peaks },
  });

  return generated;
}

export async function generateAndStoreClipWaveform(clipId: string): Promise<WaveformData | null> {
  try {
    return await ensureClipUploadedWaveform(clipId);
  } catch (err) {
    console.error(`Failed to generate waveform for clip ${clipId}`, err);
    return null;
  }
}
