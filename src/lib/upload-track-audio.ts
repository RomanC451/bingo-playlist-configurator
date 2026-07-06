import { readJsonResponse } from "@/lib/read-json-response";
import type { UploadedAudioMetadata } from "@/lib/uploaded-audio";

export const UPLOADED_AUDIO_MIME_MPEG = "audio/mpeg";

export function resolveMp3ContentType(file: File) {
  if (file.type === "audio/mpeg" || file.type === "audio/mp3") {
    return UPLOADED_AUDIO_MIME_MPEG;
  }
  if (!file.type && file.name.toLowerCase().endsWith(".mp3")) {
    return UPLOADED_AUDIO_MIME_MPEG;
  }
  return file.type || UPLOADED_AUDIO_MIME_MPEG;
}

export async function readAudioDurationMs(file: File): Promise<number> {
  const objectUrl = URL.createObjectURL(file);
  try {
    const audio = new Audio();
    audio.preload = "metadata";
    audio.src = objectUrl;
    await new Promise<void>((resolve, reject) => {
      audio.addEventListener("loadedmetadata", () => resolve(), { once: true });
      audio.addEventListener("error", () => reject(new Error("Could not read audio duration")), {
        once: true,
      });
    });
    return Math.round(audio.duration * 1000);
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

export async function uploadTrackAudioFile({
  sessionId,
  clipId,
  file,
}: {
  sessionId: string;
  clipId: string;
  file: File;
}): Promise<UploadedAudioMetadata> {
  const mimeType = resolveMp3ContentType(file);
  const durationMs = await readAudioDurationMs(file);

  const uploadUrlRes = await fetch(
    `/api/sessions/${sessionId}/tracks/${clipId}/audio/upload-url`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contentType: mimeType,
        sizeBytes: file.size,
      }),
    },
  );
  const uploadUrlJson = await readJsonResponse<{
    uploadUrl?: string;
    key?: string;
    error?: string;
  }>(uploadUrlRes);
  if (!uploadUrlRes.ok || !uploadUrlJson.uploadUrl || !uploadUrlJson.key) {
    throw new Error(uploadUrlJson.error ?? "Failed to start upload");
  }

  const putRes = await fetch(uploadUrlJson.uploadUrl, {
    method: "PUT",
    headers: { "Content-Type": mimeType },
    body: file,
  });
  if (!putRes.ok) {
    throw new Error("Upload to storage failed");
  }

  const completeRes = await fetch(
    `/api/sessions/${sessionId}/tracks/${clipId}/audio/complete`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        key: uploadUrlJson.key,
        mimeType,
        durationMs,
        sizeBytes: file.size,
      }),
    },
  );
  const completeJson = await readJsonResponse<{
    uploadedAudio?: UploadedAudioMetadata | null;
    error?: string;
  }>(completeRes);
  if (!completeRes.ok || !completeJson.uploadedAudio) {
    throw new Error(completeJson.error ?? "Failed to finalize upload");
  }

  return completeJson.uploadedAudio;
}

export async function runWithConcurrency<T>(
  items: T[],
  concurrency: number,
  worker: (item: T, index: number) => Promise<void>,
) {
  let index = 0;
  const runners = Array.from({ length: Math.min(concurrency, items.length) }, async () => {
    while (index < items.length) {
      const current = index;
      index += 1;
      await worker(items[current], current);
    }
  });
  await Promise.all(runners);
}
