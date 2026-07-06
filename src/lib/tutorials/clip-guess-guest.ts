import type { TutorialDefinition } from "@/lib/tutorial";

export const clipGuessGuestTutorial: TutorialDefinition = {
  id: "clip-guess-guest",
  title: "ClipGuess",
  description: "How guests play the guess game.",
  route: "/guess/[shareToken]",
  audience: "all",
  steps: [
    {
      id: "welcome",
      title: "Welcome to ClipGuess",
      body: "Hear short clips and pick which song you think it is. No account needed — progress saves in your browser.",
      placement: "center",
    },
    {
      id: "start",
      title: "Start playing",
      target: "clip-guess-start",
      placement: "bottom",
      body: "Tap Start to begin. You can return later and pick up where you left off on this device.",
    },
    {
      id: "player",
      title: "Listen to the clip",
      target: "clip-guess-player",
      placement: "bottom",
      body: "Play the mystery clip as many times as you like before locking in your guess.",
    },
    {
      id: "choices",
      title: "Pick a song",
      target: "clip-guess-choices",
      placement: "top",
      body: "Select the track you think matches. Once submitted, your guess is locked for that clip.",
    },
    {
      id: "results",
      title: "See your results",
      target: "clip-guess-progress",
      placement: "bottom",
      body: "After all clips, see your score. Hosts can view aggregate analytics in the app.",
    },
  ],
};
