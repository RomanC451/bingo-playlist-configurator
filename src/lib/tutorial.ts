export type TutorialPlacement = "top" | "bottom" | "left" | "right" | "center";

export type TutorialAudience = "all" | "admin";

export interface TutorialStep {
  id: string;
  title: string;
  body: string;
  /** Matches `data-tutorial` on a DOM element. Omit for a centered intro step. */
  target?: string;
  placement?: TutorialPlacement;
  /** Optional action when entering this step (e.g. open a dialog). */
  onEnter?: string;
}

export interface TutorialDefinition {
  id: string;
  title: string;
  description: string;
  route: string;
  audience: TutorialAudience;
  steps: TutorialStep[];
  /** Suggested next tour in the onboarding journey. */
  nextTutorialId?: string;
}

const STORAGE_PREFIX = "tutorial-completed:";

export function isTutorialCompleted(tutorialId: string): boolean {
  if (typeof window === "undefined") return true;
  if (localStorage.getItem(`${STORAGE_PREFIX}${tutorialId}`) === "true") {
    return true;
  }
  // Renamed from clip-voting → clip-reactions
  if (
    tutorialId === "clip-reactions" &&
    localStorage.getItem(`${STORAGE_PREFIX}clip-voting`) === "true"
  ) {
    return true;
  }
  return false;
}

export function markTutorialCompleted(tutorialId: string): void {
  localStorage.setItem(`${STORAGE_PREFIX}${tutorialId}`, "true");
  if (typeof window !== "undefined") {
    window.dispatchEvent(
      new CustomEvent("tutorial-completed", { detail: { tutorialId } }),
    );
  }
}

export function resetTutorialCompletion(tutorialId: string): void {
  localStorage.removeItem(`${STORAGE_PREFIX}${tutorialId}`);
  if (typeof window !== "undefined") {
    window.dispatchEvent(
      new CustomEvent("tutorial-completed", { detail: { tutorialId } }),
    );
  }
}

export function resetAllTutorialCompletions(): void {
  if (typeof window === "undefined") return;

  const keysToRemove: string[] = [];
  for (let index = 0; index < localStorage.length; index++) {
    const key = localStorage.key(index);
    if (key?.startsWith(STORAGE_PREFIX)) {
      keysToRemove.push(key);
    }
  }

  for (const key of keysToRemove) {
    localStorage.removeItem(key);
  }

  window.dispatchEvent(new CustomEvent("tutorial-completed", { detail: { all: true } }));
}

export function getTutorialTargetRect(target: string): DOMRect | null {
  const element = document.querySelector(`[data-tutorial="${target}"]`);
  if (!element) return null;

  const rect = element.getBoundingClientRect();
  if (rect.width === 0 && rect.height === 0) return null;

  return rect;
}
