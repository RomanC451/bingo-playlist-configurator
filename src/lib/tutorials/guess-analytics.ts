import type { TutorialDefinition } from "@/lib/tutorial";

export const guessAnalyticsTutorial: TutorialDefinition = {
  id: "guess-analytics",
  title: "Guess analytics",
  description: "Per-clip accuracy and guest engagement metrics.",
  route: "/sessions/[id]/guess-analytics",
  audience: "all",
  steps: [
    {
      id: "welcome",
      title: "ClipGuess analytics",
      body: "See how guests performed across all clips — accuracy, replays, and response time.",
      placement: "center",
    },
    {
      id: "summary",
      title: "Session summary",
      target: "guess-analytics-summary",
      placement: "bottom",
      body: "Overall guess count, accuracy, and engagement across all anonymous guests.",
    },
    {
      id: "per-clip",
      title: "Per-clip table",
      target: "guess-analytics-table",
      placement: "top",
      body: "Sort by accuracy or response time. Clips below 50% accuracy are highlighted — they may be too hard or poorly trimmed.",
    },
  ],
};
