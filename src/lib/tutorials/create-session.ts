import type { TutorialDefinition } from "@/lib/tutorial";

export const createSessionTutorial: TutorialDefinition = {
  id: "create-session",
  title: "New session",
  description: "Import a Spotify playlist with default clip lengths.",
  route: "/sessions/new",
  audience: "all",
  nextTutorialId: "session-edit",
  steps: [
    {
      id: "welcome",
      title: "Import a playlist",
      body: "Create a bingo session from any Spotify playlist your team account can access.",
      placement: "center",
    },
    {
      id: "session-name",
      title: "Session name",
      target: "session-name",
      placement: "bottom",
      body: "Pick a name your team will recognize, like \"80s Night Bingo\".",
    },
    {
      id: "playlist-input",
      title: "Spotify playlist",
      target: "playlist-input",
      placement: "bottom",
      body: "Paste a playlist URL or ID. Editorial playlists may not work in development mode.",
    },
    {
      id: "clip-duration",
      title: "Default clip length",
      target: "clip-duration",
      placement: "bottom",
      body: "Every track starts with this default range. You can trim individual tracks later in the clip editor.",
    },
  ],
};
