"use client";

import { createContext, useContext } from "react";
import type { TutorialId } from "@/lib/tutorials";

export interface TutorialContextValue {
  activeTutorialId: TutorialId | null;
  stepIndex: number;
  isTutorialNavigating: boolean;
  /** Start immediately on the current page (contextual / in-page triggers). */
  startTutorial: (id: TutorialId) => void;
  /** Resolve the right page, navigate if needed, then start the tour. */
  navigateAndStartTutorial: (id: TutorialId) => Promise<void>;
  nextStep: () => void;
  prevStep: () => void;
  skipTutorial: () => void;
}

export const TutorialContext = createContext<TutorialContextValue | null>(null);

export function useTutorial(): TutorialContextValue {
  const context = useContext(TutorialContext);
  if (!context) {
    throw new Error("useTutorial must be used within TutorialProvider");
  }
  return context;
}
