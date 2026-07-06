import type { TutorialDefinition } from "@/lib/tutorial";

export const sessionsListTutorial: TutorialDefinition = {
  id: "sessions-list",
  title: "Bingo sessions",
  description: "Browse sessions and start a new import.",
  route: "/sessions",
  audience: "all",
  nextTutorialId: "create-session",
  steps: [
    {
      id: "welcome",
      title: "Your bingo sessions",
      body: "Each session is a Spotify playlist import with tracks you trim, review, and play on bingo night.",
      placement: "center",
    },
    {
      id: "new-session",
      title: "Create a session",
      target: "new-session-button",
      placement: "bottom",
      body: "Import a new playlist once Spotify is connected for your active team.",
    },
    {
      id: "session-cards",
      title: "Session cards",
      target: "session-cards",
      placement: "top",
      body: "Open a session to edit clips, upload audio, review tracks, or run live playback. Cards show review progress.",
    },
  ],
};
