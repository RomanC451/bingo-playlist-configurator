import type { TutorialDefinition } from "@/lib/tutorial";

export const clipGuessSetupTutorial: TutorialDefinition = {
  id: "clip-guess-setup",
  title: "ClipGuess setup",
  description: "Enable and share the guest guess link.",
  route: "/sessions/[id]/edit",
  audience: "admin",
  nextTutorialId: "clip-guess-guest",
  steps: [
    {
      id: "welcome",
      title: "ClipGuess guest game",
      body: "Share a public link so guests hear short clips and guess the song — no account required. Uploaded audio is required on each track.",
      placement: "center",
    },
    {
      id: "open-dialog",
      title: "Open ClipGuess settings",
      target: "session-actions",
      placement: "bottom",
      body: "Choose ClipGuess from the Actions menu.",
      onEnter: "open-clip-guess",
    },
    {
      id: "enable-link",
      title: "Enable share link",
      target: "clip-guess-enable",
      placement: "top",
      body: "Turn on the guess link, then copy the URL to share with guests before bingo night.",
    },
    {
      id: "rotate-token",
      title: "Rotate token",
      target: "clip-guess-rotate",
      placement: "top",
      body: "Rotate the link to invalidate old URLs if you need to revoke access.",
    },
  ],
};
