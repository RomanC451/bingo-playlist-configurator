import type { TutorialDefinition } from "@/lib/tutorial";

export const teamReviewsTutorial: TutorialDefinition = {
  id: "team-reviews",
  title: "Team reviews",
  description: "See review progress across all members.",
  route: "/sessions/[id]/edit",
  audience: "all",
  steps: [
    {
      id: "welcome",
      title: "Team review progress",
      body: "See how far each member has progressed through the review queue for this session.",
      placement: "center",
    },
    {
      id: "open-dialog",
      title: "Open team reviews",
      target: "session-actions",
      placement: "bottom",
      body: "Choose Team reviews from the Actions menu on the session edit page.",
      onEnter: "open-team-reviews",
    },
    {
      id: "member-progress",
      title: "Member progress",
      target: "team-reviews-progress",
      placement: "top",
      body: "Each row shows reviewed vs remaining clips. Open All reviews to see per-track verdicts.",
    },
  ],
};
