"use client";

import { useEffect } from "react";
import type { TutorialStepAction } from "@/lib/tutorial-actions";
import { STEP_ACTION_EVENT } from "@/lib/tutorial-actions";

export function useTutorialStepActionListener(
  handler: (action: TutorialStepAction) => void,
) {
  useEffect(() => {
    function onAction(event: Event) {
      handler((event as CustomEvent<TutorialStepAction>).detail);
    }

    window.addEventListener(STEP_ACTION_EVENT, onAction);
    return () => window.removeEventListener(STEP_ACTION_EVENT, onAction);
  }, [handler]);
}
