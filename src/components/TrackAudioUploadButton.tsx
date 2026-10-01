"use client";

import { useRef, useState } from "react";
import { Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { isMp3File } from "@/lib/audio-file-matching";
import { errorToast } from "@/lib/error-toast";
import { uploadTrackAudioFile } from "@/lib/upload-track-audio";

interface TrackAudioUploadButtonProps {
  sessionId: string;
  clipId: string;
  hasUploadedAudio: boolean;
  disabled?: boolean;
  onUploaded: () => void | Promise<void>;
}

export function TrackAudioUploadButton({
  sessionId,
  clipId,
  hasUploadedAudio,
  disabled = false,
  onUploaded,
}: TrackAudioUploadButtonProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  async function handleFile(file: File) {
    setUploading(true);
    try {
      await uploadTrackAudioFile({ sessionId, clipId, file });
      await onUploaded();
    } catch (err) {
      errorToast(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  }

  const label = uploading
    ? "Uploading…"
    : hasUploadedAudio
      ? "Replace audio"
      : "Upload audio";

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept=".mp3,audio/mpeg"
        className="hidden"
        onChange={(event) => {
          const file = event.target.files?.[0];
          event.target.value = "";
          if (!file) return;
          if (!isMp3File(file)) {
            errorToast("Please choose an MP3 file");
            return;
          }
          void handleFile(file);
        }}
      />
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="gap-1.5"
        disabled={disabled || uploading}
        onClick={() => inputRef.current?.click()}
      >
        <Upload className="size-4" aria-hidden="true" />
        {label}
      </Button>
    </>
  );
}
