import type { TutorialDefinition } from "@/lib/tutorial";

export const trackEditorTutorial: TutorialDefinition = {
  id: "track-editor",
  title: "Clip editor",
  description: "Trim waveforms, propose versions, and react with likes or dislikes.",
  route: "/sessions/[id]/tracks/[clipId]",
  audience: "all",
  nextTutorialId: "audio-upload",
  steps: [
    {
      id: "welcome",
      title: "Waveform clip editor",
      body: "Trim each song to the perfect moment. Uploaded audio is required to preview and save proposals.",
      placement: "center",
    },
    {
      id: "waveform",
      title: "Waveform",
      target: "waveform-editor",
      placement: "top",
      body: "Drag the handles to set start and end points. The highlighted region is what players will hear.",
    },
    {
      id: "preview",
      title: "Preview clip",
      target: "clip-preview",
      placement: "bottom",
      body: "Play the current range before saving. Preview uses your uploaded MP3, not Spotify streaming.",
    },
    {
      id: "save-proposal",
      title: "Save proposal",
      target: "save-proposal",
      placement: "bottom",
      body: "Save your clip range as a proposal. Teammates can like or dislike saved versions.",
    },
    {
      id: "versions",
      title: "Version history",
      target: "version-list",
      placement: "left",
      body: "See all proposals for this track, who created them, and react with thumbs up or down.",
    },
    {
      id: "needs-attention",
      title: "Needs attention",
      target: "needs-attention",
      placement: "bottom",
      body: "Flag a clip that needs work. Flagged tracks appear on Home and in the review queue.",
    },
  ],
};
