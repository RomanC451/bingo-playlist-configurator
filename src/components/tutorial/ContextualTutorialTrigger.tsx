"use client";

import { useEffect } from "react";
import { useTutorial } from "@/hooks/useTutorial";
import { isTutorialCompleted } from "@/lib/tutorial";
import type { ContextualTutorialId } from "@/lib/tutorials";

interface ContextualTutorialTriggerProps {
  tutorialId: ContextualTutorialId;
  when: boolean;
}

export function ContextualTutorialTrigger({
  tutorialId,
  when,
}: ContextualTutorialTriggerProps) {
  const { startTutorial, activeTutorialId } = useTutorial();

  useEffect(() => {
    if (
      when &&
      !isTutorialCompleted(tutorialId) &&
      activeTutorialId === null
    ) {
      startTutorial(tutorialId);
    }
  }, [activeTutorialId, startTutorial, tutorialId, when]);

  return null;
}
