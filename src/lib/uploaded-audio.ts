export const UPLOADED_AUDIO_MAX_BYTES = 15 * 1024 * 1024;

export const UPLOADED_AUDIO_MIME_TYPES = [
  "audio/mpeg",
  "audio/mp4",
  "audio/x-m4a",
  "audio/wav",
  "audio/x-wav",
] as const;

export type UploadedAudioMimeType = (typeof UPLOADED_AUDIO_MIME_TYPES)[number];

export type UploadedAudioMetadata = {
  key: string;
  mimeType: string;
  sizeBytes: number;
  durationMs: number;
  uploadedAt: string;
};

export function getUploadedAudioPrefix() {
  return process.env.S3_AUDIO_PREFIX?.trim() || "sessions/";
}

export function buildSessionAudioPrefix(sessionId: string) {
  return `${getUploadedAudioPrefix()}${sessionId}/`;
}

export function buildUploadedAudioKey(sessionId: string, clipId: string, extension: string) {
  const safeExtension = extension.replace(/^\./, "").toLowerCase();
  return `${buildSessionAudioPrefix(sessionId)}tracks/${clipId}.${safeExtension}`;
}

export function hasUploadedAudio(clip: { uploadedAudioKey?: string | null }) {
  return Boolean(clip.uploadedAudioKey);
}

export function mapUploadedAudioMetadata(clip: {
  uploadedAudioKey: string | null;
  uploadedAudioMimeType: string | null;
  uploadedAudioSizeBytes: number | null;
  uploadedAudioDurationMs: number | null;
  uploadedAudioUploadedAt: Date | null;
}): UploadedAudioMetadata | null {
  if (
    !clip.uploadedAudioKey ||
    !clip.uploadedAudioMimeType ||
    clip.uploadedAudioSizeBytes == null ||
    clip.uploadedAudioDurationMs == null ||
    !clip.uploadedAudioUploadedAt
  ) {
    return null;
  }

  return {
    key: clip.uploadedAudioKey,
    mimeType: clip.uploadedAudioMimeType,
    sizeBytes: clip.uploadedAudioSizeBytes,
    durationMs: clip.uploadedAudioDurationMs,
    uploadedAt: clip.uploadedAudioUploadedAt.toISOString(),
  };
}

export function extensionForMimeType(mimeType: string) {
  switch (mimeType) {
    case "audio/mpeg":
      return "mp3";
    case "audio/mp4":
    case "audio/x-m4a":
      return "m4a";
    case "audio/wav":
    case "audio/x-wav":
      return "wav";
    default:
      return "bin";
  }
}

export function isAllowedUploadedAudioMimeType(mimeType: string): mimeType is UploadedAudioMimeType {
  return (UPLOADED_AUDIO_MIME_TYPES as readonly string[]).includes(mimeType);
}

export function sessionTrackAudioStreamPath(sessionId: string, clipId: string) {
  return `/api/sessions/${sessionId}/tracks/${clipId}/audio/stream`;
}

export function publicGuessAudioStreamPath(
  shareToken: string,
  clipId: string,
  guestId?: string | null,
) {
  const base = `/api/public/guess/${encodeURIComponent(shareToken)}/audio/${encodeURIComponent(clipId)}`;
  if (!guestId) return base;
  const params = new URLSearchParams({ guest: guestId });
  return `${base}?${params.toString()}`;
}

export function playbackItemId(clip: { id: string }) {
  return clip.id;
}
