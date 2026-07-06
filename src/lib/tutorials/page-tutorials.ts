import type { TutorialId } from "@/lib/tutorials";
import {
  filterAccessibleTutorials,
  type TutorialCategory,
} from "@/lib/tutorials/tutorial-categories";
import { isTutorialCompleted } from "@/lib/tutorial";

/** Tours most relevant to the current route (for highlighting in the menu). */
export function getTutorialsForPath(pathname: string): TutorialId[] {
  if (pathname === "/dashboard") return ["dashboard"];
  if (pathname === "/teams") return ["teams"];
  if (pathname.startsWith("/teams/") && pathname.endsWith("/settings")) {
    return ["team-settings"];
  }
  if (pathname === "/sessions") return ["sessions-list", "spotify-connect"];
  if (pathname === "/sessions/new") return ["create-session"];
  if (/^\/sessions\/[^/]+\/edit$/.test(pathname)) {
    return [
      "session-edit",
      "audio-upload",
      "team-reviews",
      "clip-guess-setup",
      "session-admin",
    ];
  }
  if (/^\/sessions\/[^/]+\/tracks\/[^/]+$/.test(pathname)) {
    return ["track-editor"];
  }
  if (/^\/sessions\/[^/]+\/review$/.test(pathname)) {
    return ["review-clips"];
  }
  if (/^\/sessions\/[^/]+\/play$/.test(pathname)) {
    return ["play-session"];
  }
  if (/^\/sessions\/[^/]+\/guess-analytics$/.test(pathname)) {
    return ["guess-analytics"];
  }
  if (pathname === "/profile") return ["profile"];
  if (pathname === "/help") return [];

  return [];
}

export interface PageTutorialAttention {
  shouldPing: boolean;
  sortedCategories: (TutorialCategory & { tutorialIds: TutorialId[] })[];
  pingTutorialId: TutorialId | null;
}

export function getPageTutorialAttention(
  pathname: string,
  categories: (TutorialCategory & { tutorialIds: TutorialId[] })[],
  isTeamAdmin: boolean,
): PageTutorialAttention {
  const pageTutorialIds = filterAccessibleTutorials(
    getTutorialsForPath(pathname),
    isTeamAdmin,
  );
  const firstUndonePageId = pageTutorialIds.find((id) => !isTutorialCompleted(id));

  if (!firstUndonePageId) {
    return {
      shouldPing: false,
      sortedCategories: categories,
      pingTutorialId: null,
    };
  }

  const priorityCategory = categories.find((category) =>
    category.tutorialIds.includes(firstUndonePageId),
  );

  const sortedCategories = priorityCategory
    ? [
        priorityCategory,
        ...categories.filter((category) => category.id !== priorityCategory.id),
      ]
    : categories;

  const pingTutorialId =
    priorityCategory?.tutorialIds.find((id) => !isTutorialCompleted(id)) ?? null;

  return {
    shouldPing: true,
    sortedCategories,
    pingTutorialId,
  };
}

export { filterAccessibleTutorials } from "@/lib/tutorials/tutorial-categories";
