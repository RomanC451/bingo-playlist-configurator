"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { useTutorial } from "@/hooks/useTutorial";
import { useCanStartTutorial } from "@/hooks/useTutorialAccess";
import { isTutorialCompleted } from "@/lib/tutorial";
import type { TutorialId } from "@/lib/tutorials";
import { getTutorial } from "@/lib/tutorials";

interface TutorialWelcomeBannerProps {
  tutorialId: TutorialId;
  isTeamAdmin?: boolean;
}

export function TutorialWelcomeBanner({
  tutorialId,
  isTeamAdmin,
}: TutorialWelcomeBannerProps) {
  const { navigateAndStartTutorial, activeTutorialId, isTutorialNavigating } =
    useTutorial();
  const hookAllowed = useCanStartTutorial(tutorialId);
  const canStart =
    isTeamAdmin !== undefined
      ? getTutorial(tutorialId).audience === "all" || isTeamAdmin
      : hookAllowed;
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    setVisible(!isTutorialCompleted(tutorialId));
  }, [tutorialId]);

  if (!visible || !canStart || activeTutorialId !== null) return null;

  return (
    <div className="mb-6 flex flex-col gap-3 rounded-xl border border-emerald-200 bg-emerald-50/80 p-4 sm:flex-row sm:items-center sm:justify-between dark:border-emerald-900/60 dark:bg-emerald-950/30">
      <div>
        <p className="font-medium text-emerald-900 dark:text-emerald-100">New here?</p>
        <p className="mt-1 text-sm text-emerald-800/80 dark:text-emerald-200/80">
          Take a guided tour of this page. You can replay it anytime.
        </p>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <Button variant="ghost" size="sm" onClick={() => setVisible(false)}>
          Dismiss
        </Button>
        <Button
          size="sm"
          disabled={isTutorialNavigating}
          onClick={() => {
            setVisible(false);
            void navigateAndStartTutorial(tutorialId);
          }}
        >
          Start tour
        </Button>
      </div>
    </div>
  );
}
