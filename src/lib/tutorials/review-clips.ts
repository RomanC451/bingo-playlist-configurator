import type { TutorialDefinition } from "@/lib/tutorial";

export const reviewClipsTutorial: TutorialDefinition = {
  id: "review-clips",
  title: "Review clips",
  description: "OK / Not OK workflow for team clip review.",
  route: "/sessions/[id]/review",
  audience: "all",
  nextTutorialId: "play-session",
  steps: [
    {
      id: "welcome",
      title: "Review clips",
      body: "Listen to each track's current playback clip and mark it OK or Not OK. Reviews advance automatically through the queue.",
      placement: "center",
    },
    {
      id: "progress",
      title: "Your progress",
      target: "review-progress",
      placement: "bottom",
      body: "Track how many clips you have reviewed and how many remain in this session.",
    },
    {
      id: "waveform",
      title: "Listen and decide",
      target: "review-waveform",
      placement: "top",
      body: "Play the clip using uploaded audio. The range shown is the current saved proposal or the default clip.",
    },
    {
      id: "ok-not-ok",
      title: "OK or Not OK",
      target: "review-verdict",
      placement: "top",
      body: "OK clears your queue entry. Not OK flags the track for more editing and optionally adds a comment.",
    },
    {
      id: "track-nav",
      title: "Track navigation",
      target: "review-track-nav",
      placement: "right",
      body: "Jump between tracks or see which clips are blocked because someone else is reviewing.",
    },
  ],
};
