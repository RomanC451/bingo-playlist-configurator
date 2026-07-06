import type { TutorialDefinition } from "@/lib/tutorial";

export const teamsTutorial: TutorialDefinition = {
  id: "teams",
  title: "Teams tour",
  description: "Create, join, and switch team workspaces.",
  route: "/teams",
  audience: "all",
  nextTutorialId: "spotify-connect",
  steps: [
    {
      id: "welcome",
      title: "Team workspaces",
      body: "Sessions, Spotify, and clips all belong to a team. You can belong to multiple teams and switch between them.",
      placement: "center",
    },
    {
      id: "team-cards",
      title: "Your teams",
      target: "team-cards",
      placement: "bottom",
      body: "Each card shows members and session count. The active team drives what you see on Home and Bingo sessions.",
    },
    {
      id: "create-team",
      title: "Create a team",
      target: "create-team",
      placement: "top",
      body: "Start a new team with a name. You become the owner and can invite members from team settings later.",
    },
    {
      id: "join-team",
      title: "Join a team",
      target: "join-team",
      placement: "top",
      body: "Join open teams from the list, or enter a team ID shared by an admin.",
    },
  ],
};
