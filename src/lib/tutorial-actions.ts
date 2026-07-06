import type { TutorialId } from "@/lib/tutorials";

export type TutorialStepAction =
  | "open-audio-upload"
  | "open-clip-guess"
  | "open-team-reviews";

export const STEP_ACTION_EVENT = "tutorial-step-action";

export function dispatchTutorialStepAction(action: TutorialStepAction) {
  window.dispatchEvent(new CustomEvent(STEP_ACTION_EVENT, { detail: action }));
}
