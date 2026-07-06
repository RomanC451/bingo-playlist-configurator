import type { TutorialDefinition } from "@/lib/tutorial";

export const playSessionTutorial: TutorialDefinition = {
  id: "play-session",
  title: "Live playback",
  description: "Run bingo night with Spotify Connect.",
  route: "/sessions/[id]/play",
  audience: "all",
  steps: [
    {
      id: "welcome",
      title: "Bingo night playback",
      body: "Audio streams through Spotify Connect to a speaker, phone, or desktop you select. Clips auto-seek to the start point.",
      placement: "center",
    },
    {
      id: "device-picker",
      title: "Choose a device",
      target: "playback-device",
      placement: "bottom",
      body: "Pick where audio plays. Open Spotify on that device first if it does not appear, then refresh.",
    },
    {
      id: "controls",
      title: "Playback controls",
      target: "playback-controls",
      placement: "top",
      body: "Play, pause, and advance clips. Press Next when you are ready to move to the next track.",
    },
    {
      id: "now-playing",
      title: "Now playing",
      target: "now-playing",
      placement: "bottom",
      body: "Shows the current track and clip range. Playback uses the latest saved team proposal.",
    },
  ],
};
