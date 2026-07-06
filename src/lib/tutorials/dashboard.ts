import type { TutorialDefinition } from "@/lib/tutorial";

export const dashboardTutorial: TutorialDefinition = {
  id: "dashboard",
  title: "Welcome tour",
  description: "Overview of Home, teams, and navigation.",
  route: "/dashboard",
  audience: "all",
  nextTutorialId: "teams",
  steps: [
    {
      id: "welcome",
      title: "Welcome to Bingo Playlist Configurator",
      body: "This short tour shows where teams, sessions, and your home dashboard fit together. You can replay it anytime from Home.",
      placement: "center",
    },
    {
      id: "team-switcher",
      title: "Pick your team",
      target: "team-switcher",
      placement: "right",
      body: "Everything is scoped to a team workspace. Switch teams here, or create and join teams from the Teams page.",
    },
    {
      id: "sessions-nav",
      title: "Bingo sessions",
      target: "nav-sessions",
      placement: "right",
      body: "Import a Spotify playlist to create a session, then edit clips, upload audio, review tracks, and run bingo night.",
    },
    {
      id: "home-panels",
      title: "Your home dashboard",
      target: "home-panels",
      placement: "top",
      body: "Home surfaces what needs attention: your last session, ongoing reviews, and tracks flagged by the team.",
    },
  ],
};
