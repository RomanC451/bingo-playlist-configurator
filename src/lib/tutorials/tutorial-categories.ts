import type { TutorialId } from "@/lib/tutorials";
import { getTutorial } from "@/lib/tutorials";

export interface TutorialCategory {
  id: string;
  label: string;
  description: string;
  tutorialIds: TutorialId[];
}

export const tutorialCategories: TutorialCategory[] = [
  {
    id: "getting-started",
    label: "Getting started",
    description: "Home, teams, and your profile",
    tutorialIds: ["dashboard", "teams", "profile"],
  },
  {
    id: "team-setup",
    label: "Team & Spotify",
    description: "Connect Spotify and import playlists",
    tutorialIds: ["spotify-connect", "team-settings", "sessions-list", "create-session"],
  },
  {
    id: "session-edit",
    label: "Edit sessions",
    description: "Track list, clips, uploads, and admin",
    tutorialIds: [
      "session-edit",
      "track-editor",
      "audio-upload",
      "team-reviews",
      "session-admin",
    ],
  },
  {
    id: "review",
    label: "Review clips",
    description: "OK / Not OK workflow with your team",
    tutorialIds: ["review-clips"],
  },
  {
    id: "bingo-night",
    label: "Bingo night",
    description: "Live playback with Spotify Connect",
    tutorialIds: ["play-session"],
  },
  {
    id: "clip-guess",
    label: "Clip Guess",
    description: "Guest game, sharing, and analytics",
    tutorialIds: ["clip-guess-setup", "clip-guess-guest", "guess-analytics"],
  },
  {
    id: "tips",
    label: "In-context tips",
    description: "Short tours that also appear automatically",
    tutorialIds: [
      "needs-attention",
      "clip-reactions",
      "edit-locks",
      "uploaded-audio-required",
      "spotify-device",
    ],
  },
];

export function filterAccessibleTutorials(
  tutorialIds: TutorialId[],
  isTeamAdmin: boolean,
): TutorialId[] {
  return tutorialIds.filter((id) => {
    const tutorial = getTutorial(id);
    return tutorial.audience === "all" || isTeamAdmin;
  });
}

export function getTutorialCategoriesForUser(isTeamAdmin: boolean) {
  return tutorialCategories
    .map((category) => ({
      ...category,
      tutorialIds: filterAccessibleTutorials(category.tutorialIds, isTeamAdmin),
    }))
    .filter((category) => category.tutorialIds.length > 0);
}

export function getAllTutorialIds(): TutorialId[] {
  return tutorialCategories.flatMap((category) => category.tutorialIds);
}
