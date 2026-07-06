import type { TutorialDefinition } from "@/lib/tutorial";

export const sessionAdminTutorial: TutorialDefinition = {
  id: "session-admin",
  title: "Session admin",
  description: "Admin-only session actions.",
  route: "/sessions/[id]/edit",
  audience: "admin",
  steps: [
    {
      id: "welcome",
      title: "Session administration",
      body: "Team admins have extra actions for managing sessions and guest links.",
      placement: "center",
    },
    {
      id: "actions",
      title: "Actions menu",
      target: "session-actions",
      placement: "bottom",
      body: "Access ClipGuess settings, analytics, and delete session from the Actions menu.",
    },
    {
      id: "delete",
      title: "Delete session",
      target: "session-actions",
      placement: "bottom",
      body: "Admins can delete a session from Actions → Delete session. You must type the session name to confirm.",
    },
  ],
};
