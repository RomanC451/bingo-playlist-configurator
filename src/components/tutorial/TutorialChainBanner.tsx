"use client";

import { Button } from "@/components/ui/button";
import { getTutorial, type TutorialId } from "@/lib/tutorials";

interface TutorialChainBannerProps {
  tutorialId: TutorialId;
  onStart: () => void;
  onDismiss: () => void;
}

export function TutorialChainBanner({
  tutorialId,
  onStart,
  onDismiss,
}: TutorialChainBannerProps) {
  const tutorial = getTutorial(tutorialId);

  return (
    <div className="fixed bottom-4 right-4 z-[150] max-w-sm rounded-xl border border-emerald-200 bg-background p-4 shadow-xl dark:border-emerald-900/60">
      <p className="font-medium">Continue the tour?</p>
      <p className="mt-1 text-sm text-muted-foreground">
        Next up: {tutorial.title} — {tutorial.description}
      </p>
      <div className="mt-3 flex items-center gap-2">
        <Button size="sm" onClick={onStart}>
          Start tour
        </Button>
        <Button variant="ghost" size="sm" onClick={onDismiss}>
          Not now
        </Button>
      </div>
    </div>
  );
}
