import type { TutorialDefinition } from "@/lib/tutorial";

export const clipReactionsTutorial: TutorialDefinition = {
  id: "clip-reactions",
  title: "Likes & dislikes",
  description: "How to react to clip proposals with thumbs up or down.",
  route: "/sessions/[id]/tracks/[clipId]",
  audience: "all",
  steps: [
    {
      id: "propose",
      title: "Save a proposal",
      target: "save-proposal",
      placement: "bottom",
      body: "Trim the waveform and save your clip range as a proposal. Each member can save their own version per track.",
    },
    {
      id: "react",
      title: "Like or dislike",
      target: "clip-reactions",
      placement: "top",
      body: "Use thumbs up or down on the current proposal to show what you think. Hover a button to see who reacted.",
    },
    {
      id: "versions",
      title: "Version history",
      target: "version-list",
      placement: "left",
      body: "Browse every saved proposal for this track. The latest save is marked Current — that is the clip used for review and bingo night.",
    },
  ],
};
