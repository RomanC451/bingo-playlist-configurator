import type { TutorialDefinition } from "@/lib/tutorial";

export const spotifyConnectTutorial: TutorialDefinition = {
  id: "spotify-connect",
  title: "Connect Spotify",
  description: "Link a shared Spotify account for playlist import and bingo night playback.",
  route: "/sessions",
  audience: "admin",
  nextTutorialId: "sessions-list",
  steps: [
    {
      id: "welcome",
      title: "Team Spotify account",
      body: "One Spotify account is linked per team. All members use it to import playlists and run ConnectPlayback on bingo night.",
      placement: "center",
    },
    {
      id: "spotify-card",
      title: "Connection card",
      target: "spotify-card",
      placement: "bottom",
      body: "Admins connect, switch, or disconnect the team account here. Premium is required for playback.",
    },
    {
      id: "connect-button",
      title: "Connect Spotify",
      target: "spotify-connect-button",
      placement: "bottom",
      body: "Click Connect Spotify to authorize. Use a playlist the linked account owns or collaborates on when importing.",
    },
  ],
};
