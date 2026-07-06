"use client";

import Link from "next/link";
import {
  BarChart3,
  ClipboardCheck,
  Link2,
  MoreVertical,
  Music2,
  Play,
  Upload,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { ClipGuessSettingsDialog } from "@/components/ClipGuessSettingsDialog";
import {
  SessionAudioUploadTrigger,
  type SessionAudioUploadTriggerHandle,
} from "@/components/SessionAudioUploadTrigger";
import type { SessionAudioUploadTrack } from "@/components/SessionAudioUploadDialog";
import { useRef, useState } from "react";

interface SessionEditActionsMenuProps {
  sessionId: string;
  reviewLabel: string;
  uploadTracks: SessionAudioUploadTrack[];
  onUploadComplete: () => void;
  onTeamProgress: () => void;
  autoOpenUpload?: boolean;
  onAutoOpenHandled?: () => void;
}

export function SessionEditActionsMenu({
  sessionId,
  reviewLabel,
  uploadTracks,
  onUploadComplete,
  onTeamProgress,
  autoOpenUpload = false,
  onAutoOpenHandled,
}: SessionEditActionsMenuProps) {
  const uploadRef = useRef<SessionAudioUploadTriggerHandle>(null);
  const [clipGuessOpen, setClipGuessOpen] = useState(false);

  return (
    <>
      <div className="flex shrink-0 items-center gap-2">
        <Link
          href={`/sessions/${sessionId}/play`}
          className="inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-emerald-700"
        >
          <Play className="size-4" aria-hidden="true" />
          Start playback
        </Link>
        <DropdownMenu
          align="right"
          trigger={
            <Button type="button" variant="outline" className="gap-2">
              <MoreVertical className="size-4" aria-hidden="true" />
              Actions
            </Button>
          }
        >
          <DropdownMenuItem onClick={() => uploadRef.current?.openFilePicker()}>
            <Upload className="size-4 shrink-0" aria-hidden="true" />
            Upload audio
          </DropdownMenuItem>
          <DropdownMenuItem onClick={onTeamProgress}>
            <Users className="size-4 shrink-0" aria-hidden="true" />
            Team reviews
          </DropdownMenuItem>
          <DropdownMenuItem href={`/sessions/${sessionId}/review`}>
            <ClipboardCheck className="size-4 shrink-0" aria-hidden="true" />
            {reviewLabel}
          </DropdownMenuItem>
          <DropdownMenuItem href={`/sessions/${sessionId}/play`}>
            <Music2 className="size-4 shrink-0" aria-hidden="true" />
            Open play session
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => setClipGuessOpen(true)}>
            <Link2 className="size-4 shrink-0" aria-hidden="true" />
            ClipGuess
          </DropdownMenuItem>
          <DropdownMenuItem href={`/sessions/${sessionId}/guess-analytics`}>
            <BarChart3 className="size-4 shrink-0" aria-hidden="true" />
            ClipGuess analytics
          </DropdownMenuItem>
        </DropdownMenu>
      </div>
      <ClipGuessSettingsDialog
        sessionId={sessionId}
        open={clipGuessOpen}
        onClose={() => setClipGuessOpen(false)}
      />
      <SessionAudioUploadTrigger
        ref={uploadRef}
        sessionId={sessionId}
        tracks={uploadTracks}
        onComplete={onUploadComplete}
        autoOpen={autoOpenUpload}
        onAutoOpenHandled={onAutoOpenHandled}
        hideButton
      />
    </>
  );
}
