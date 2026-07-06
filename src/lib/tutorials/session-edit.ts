import type { TutorialDefinition } from "@/lib/tutorial";

export const sessionEditTutorial: TutorialDefinition = {
  id: "session-edit",
  title: "Edit session",
  description: "Track list, actions, and navigation for a bingo session.",
  route: "/sessions/[id]/edit",
  audience: "all",
  nextTutorialId: "track-editor",
  steps: [
    {
      id: "welcome",
      title: "Session edit page",
      body: "This is your hub for a bingo session. Open tracks to trim clips, then upload audio and review before bingo night.",
      placement: "center",
    },
    {
      id: "track-list",
      title: "Track list",
      target: "track-list",
      placement: "top",
      body: "Each row shows clip status, contributors, reactions, and whether audio is uploaded. Click a track to edit its clip.",
    },
    {
      id: "start-playback",
      title: "Start playback",
      target: "start-playback",
      placement: "bottom",
      body: "Jump to the live play session when you are ready for bingo night.",
    },
    {
      id: "actions-menu",
      title: "Session actions",
      target: "session-actions",
      placement: "bottom",
      body: "Upload audio, open review, manage ClipGuess, view analytics, and more from the Actions menu.",
    },
  ],
};
