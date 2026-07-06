import type { TutorialDefinition } from "@/lib/tutorial";

export const editLocksTutorial: TutorialDefinition = {
  id: "edit-locks",
  title: "Edit locks",
  description: "When another member is editing a track.",
  route: "/sessions/[id]/tracks/[clipId]",
  audience: "all",
  steps: [
    {
      id: "locked",
      title: "Someone is editing",
      target: "edit-lock-indicator",
      placement: "bottom",
      body: "Only one person can edit a track at a time. You will see who is editing and the page may be read-only.",
    },
    {
      id: "wait",
      title: "Try again later",
      placement: "center",
      body: "Wait for them to finish or navigate to another track. The lock releases when they leave the editor.",
    },
  ],
};
