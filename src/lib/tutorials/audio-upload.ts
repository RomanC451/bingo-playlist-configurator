import type { TutorialDefinition } from "@/lib/tutorial";

export const audioUploadTutorial: TutorialDefinition = {
  id: "audio-upload",
  title: "Upload audio",
  description: "Bulk-upload MP3s and assign them to tracks.",
  route: "/sessions/[id]/edit",
  audience: "all",
  nextTutorialId: "review-clips",
  steps: [
    {
      id: "welcome",
      title: "Why upload audio?",
      body: "MP3 files power clip preview, team review, and Clip Guess. Spotify Connect is only used for live bingo night playback.",
      placement: "center",
    },
    {
      id: "open-upload",
      title: "Open upload",
      target: "session-actions",
      placement: "bottom",
      body: "Choose Upload audio from the Actions menu to start a bulk upload.",
      onEnter: "open-audio-upload",
    },
    {
      id: "file-picker",
      title: "Select files",
      target: "audio-file-picker",
      placement: "bottom",
      body: "Select MP3 files from your computer. Only upload files you have rights to use.",
    },
    {
      id: "assignments",
      title: "Match tracks",
      target: "audio-assignments",
      placement: "top",
      body: "Files are fuzzy-matched by filename. Adjust assignments manually and resolve any conflicts before submitting.",
    },
    {
      id: "submit",
      title: "Upload to session",
      target: "audio-submit",
      placement: "top",
      body: "Submit when every track has a file assigned. Uploads go to secure storage and unlock preview and review.",
    },
  ],
};
