"use client";

import {
  BarChart3,
  ClipboardCheck,
  Link2,
  MoreVertical,
  Music2,
  Trash2,
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
import type { TutorialStepAction } from "@/lib/tutorial-actions";
import { useTutorialStepActionListener } from "@/hooks/useTutorialStepActionListener";
import { useCallback, useRef, useState, type ReactNode } from "react";

interface SessionActionsDropdownProps {
  sessionId: string;
  reviewLabel: string;
  onTeamProgress: () => void;
  onDelete?: () => void;
  uploadTracks?: SessionAudioUploadTrack[];
  onUploadComplete?: () => void;
  autoOpenUpload?: boolean;
  onAutoOpenHandled?: () => void;
  trigger?: ReactNode;
}

export function SessionActionsDropdown({
  sessionId,
  reviewLabel,
  onTeamProgress,
  onDelete,
  uploadTracks,
  onUploadComplete,
  autoOpenUpload = false,
  onAutoOpenHandled,
  trigger,
}: SessionActionsDropdownProps) {
  const uploadRef = useRef<SessionAudioUploadTriggerHandle>(null);
  const [clipGuessOpen, setClipGuessOpen] = useState(false);
  const hasInlineUpload = uploadTracks != null && onUploadComplete != null;

  const handleTutorialAction = useCallback(
    (action: TutorialStepAction) => {
      if (action === "open-audio-upload") {
        uploadRef.current?.openFilePicker();
      } else if (action === "open-clip-guess") {
        setClipGuessOpen(true);
      } else if (action === "open-team-reviews") {
        onTeamProgress();
      }
    },
    [onTeamProgress],
  );

  useTutorialStepActionListener(handleTutorialAction);

  return (
    <>
      <DropdownMenu
        align="right"
        trigger={
          trigger ?? (
            <Button
              type="button"
              variant="outline"
              className="gap-2"
              data-tutorial="session-actions"
            >
              <MoreVertical className="size-4" aria-hidden="true" />
              Actions
            </Button>
          )
        }
      >
        {hasInlineUpload ? (
          <DropdownMenuItem onClick={() => uploadRef.current?.openFilePicker()}>
            <Upload className="size-4 shrink-0" aria-hidden="true" />
            Upload audio
          </DropdownMenuItem>
        ) : (
          <DropdownMenuItem href={`/sessions/${sessionId}/edit?uploadAudio=1`}>
            <Upload className="size-4 shrink-0" aria-hidden="true" />
            Upload audio
          </DropdownMenuItem>
        )}
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
        {onDelete ? (
          <DropdownMenuItem destructive onClick={onDelete}>
            <Trash2 className="size-4 shrink-0" aria-hidden="true" />
            Delete session
          </DropdownMenuItem>
        ) : null}
      </DropdownMenu>
      <ClipGuessSettingsDialog
        sessionId={sessionId}
        open={clipGuessOpen}
        onClose={() => setClipGuessOpen(false)}
      />
      {hasInlineUpload ? (
        <SessionAudioUploadTrigger
          ref={uploadRef}
          sessionId={sessionId}
          tracks={uploadTracks}
          onComplete={onUploadComplete}
          autoOpen={autoOpenUpload}
          onAutoOpenHandled={onAutoOpenHandled}
          hideButton
        />
      ) : null}
    </>
  );
}
