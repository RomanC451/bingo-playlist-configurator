"use client";

import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { isMp3File } from "@/lib/audio-file-matching";
import {
  SessionAudioUploadDialog,
  type SessionAudioUploadTrack,
} from "@/components/SessionAudioUploadDialog";

export type SessionAudioUploadTriggerHandle = {
  openFilePicker: () => void;
};

interface SessionAudioUploadTriggerProps {
  sessionId: string;
  tracks: SessionAudioUploadTrack[];
  onComplete: () => void;
  autoOpen?: boolean;
  onAutoOpenHandled?: () => void;
  hideButton?: boolean;
}

export const SessionAudioUploadTrigger = forwardRef<
  SessionAudioUploadTriggerHandle,
  SessionAudioUploadTriggerProps
>(function SessionAudioUploadTrigger(
  {
    sessionId,
    tracks,
    onComplete,
    autoOpen = false,
    onAutoOpenHandled,
    hideButton = false,
  },
  ref,
) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [initialFiles, setInitialFiles] = useState<File[]>([]);
  const autoOpenHandledRef = useRef(false);

  useImperativeHandle(ref, () => ({
    openFilePicker: () => inputRef.current?.click(),
  }));

  useEffect(() => {
    if (!autoOpen || autoOpenHandledRef.current) return;
    autoOpenHandledRef.current = true;
    onAutoOpenHandled?.();
    inputRef.current?.click();
  }, [autoOpen, onAutoOpenHandled]);

  function openDialog(files: File[]) {
    setInitialFiles(files);
    setDialogOpen(true);
  }

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept=".mp3,audio/mpeg"
        multiple
        className="hidden"
        onChange={(event) => {
          const picked = [...(event.target.files ?? [])].filter(isMp3File);
          event.target.value = "";
          if (picked.length === 0) return;
          openDialog(picked);
        }}
      />
      {!hideButton ? (
        <Button
          type="button"
          variant="outline"
          className="inline-flex w-full items-center justify-center whitespace-nowrap sm:w-auto"
          onClick={() => inputRef.current?.click()}
        >
          Upload audio
        </Button>
      ) : null}
      <SessionAudioUploadDialog
        open={dialogOpen}
        sessionId={sessionId}
        tracks={tracks}
        initialFiles={initialFiles}
        onClose={() => setDialogOpen(false)}
        onComplete={onComplete}
      />
    </>
  );
});
