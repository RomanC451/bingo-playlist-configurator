"use client";

import Link from "next/link";
import { Play } from "lucide-react";
import { SessionActionsDropdown } from "@/components/SessionActionsDropdown";
import type { SessionAudioUploadTrack } from "@/components/SessionAudioUploadDialog";

interface SessionEditActionsMenuProps {
  sessionId: string;
  reviewLabel: string;
  uploadTracks: SessionAudioUploadTrack[];
  onUploadComplete: () => void;
  onTeamProgress: () => void;
  onDelete?: () => void;
  autoOpenUpload?: boolean;
  onAutoOpenHandled?: () => void;
  isTeamAdmin?: boolean;
}

export function SessionEditActionsMenu({
  sessionId,
  reviewLabel,
  uploadTracks,
  onUploadComplete,
  onTeamProgress,
  onDelete,
  autoOpenUpload = false,
  onAutoOpenHandled,
}: SessionEditActionsMenuProps) {
  return (
    <div className="flex shrink-0 items-center gap-2">
      <Link
        href={`/sessions/${sessionId}/play`}
        data-tutorial="start-playback"
        className="inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-emerald-700"
      >
        <Play className="size-4" aria-hidden="true" />
        Start playback
      </Link>
      <SessionActionsDropdown
        sessionId={sessionId}
        reviewLabel={reviewLabel}
        uploadTracks={uploadTracks}
        onUploadComplete={onUploadComplete}
        onTeamProgress={onTeamProgress}
        onDelete={onDelete}
        autoOpenUpload={autoOpenUpload}
        onAutoOpenHandled={onAutoOpenHandled}
      />
    </div>
  );
}
