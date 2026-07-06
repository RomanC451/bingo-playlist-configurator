import type { TutorialDefinition } from "@/lib/tutorial";

export const needsAttentionTutorial: TutorialDefinition = {
  id: "needs-attention",
  title: "Needs attention",
  description: "Flag a clip that needs more work.",
  route: "/sessions/[id]/tracks/[clipId]",
  audience: "all",
  steps: [
    {
      id: "flag",
      title: "Flag for attention",
      target: "needs-attention",
      placement: "bottom",
      body: "Mark a clip Not OK during review or flag it here. Add an optional comment so editors know what to fix.",
    },
    {
      id: "clear",
      title: "Clear the flag",
      target: "needs-attention",
      placement: "bottom",
      body: "The flag clears when the issue is resolved and reviewers mark the updated clip OK.",
    },
  ],
};
