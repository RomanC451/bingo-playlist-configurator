import type { TutorialDefinition } from "@/lib/tutorial";

export const uploadedAudioRequiredTutorial: TutorialDefinition = {
  id: "uploaded-audio-required",
  title: "Audio required",
  description: "Why uploaded MP3s are needed.",
  route: "/sessions/[id]/edit",
  audience: "all",
  steps: [
    {
      id: "why",
      title: "Upload audio first",
      target: "uploaded-audio-notice",
      placement: "bottom",
      body: "Preview, review, and Clip Guess use uploaded MP3 files. Spotify streaming is only for live bingo night playback.",
    },
    {
      id: "upload",
      title: "Upload from Actions",
      target: "session-actions",
      placement: "bottom",
      body: "Open Actions → Upload audio to bulk-upload and assign files to tracks.",
    },
  ],
};
