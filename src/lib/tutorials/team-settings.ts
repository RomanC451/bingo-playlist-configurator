import type { TutorialDefinition } from "@/lib/tutorial";

export const teamSettingsTutorial: TutorialDefinition = {
  id: "team-settings",
  title: "Team settings",
  description: "Manage members, roles, and Spotify for a team.",
  route: "/teams/[id]/settings",
  audience: "admin",
  steps: [
    {
      id: "welcome",
      title: "Team settings",
      body: "Admins manage members, roles, and the shared Spotify connection for this team.",
      placement: "center",
    },
    {
      id: "add-member",
      title: "Add members",
      target: "add-member",
      placement: "bottom",
      body: "Share the team ID so members can join from the Teams page, or add them by email when that option is available.",
    },
    {
      id: "member-roles",
      title: "Roles",
      target: "member-list",
      placement: "top",
      body: "Admins can manage members, delete sessions, and connect Spotify. Members can edit clips, react to proposals, and review.",
    },
    {
      id: "spotify",
      title: "Spotify connection",
      target: "team-spotify",
      placement: "bottom",
      body: "Connect or switch the team Spotify account used for imports and bingo night playback.",
    },
  ],
};
