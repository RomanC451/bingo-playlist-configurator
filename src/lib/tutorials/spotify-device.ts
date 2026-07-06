import type { TutorialDefinition } from "@/lib/tutorial";

export const spotifyDeviceTutorial: TutorialDefinition = {
  id: "spotify-device",
  title: "Spotify device",
  description: "Get a ConnectPlayback device to appear.",
  route: "/sessions/[id]/play",
  audience: "all",
  steps: [
    {
      id: "no-device",
      title: "No device found?",
      target: "playback-device",
      placement: "bottom",
      body: "Open the Spotify app on your speaker, phone, or desktop and start playing anything briefly.",
    },
    {
      id: "refresh",
      title: "Refresh the list",
      target: "playback-device",
      placement: "bottom",
      body: "Return here and refresh devices. Select your target device before starting bingo night.",
    },
  ],
};
