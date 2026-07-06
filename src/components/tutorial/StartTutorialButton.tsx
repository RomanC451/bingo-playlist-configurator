"use client";

import { Compass } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTutorial } from "@/hooks/useTutorial";
import { useCanStartTutorial } from "@/hooks/useTutorialAccess";
import { getTutorial, type TutorialId } from "@/lib/tutorials";

interface StartTutorialButtonProps {
  tutorialId: TutorialId;
  label?: string;
  variant?: "default" | "outline" | "ghost" | "secondary";
  size?: "default" | "sm" | "lg" | "icon";
  /** Override admin check when the page already knows the user's role. */
  isTeamAdmin?: boolean;
}

export function StartTutorialButton({
  tutorialId,
  label = "Take a tour",
  variant = "outline",
  size = "sm",
  isTeamAdmin,
}: StartTutorialButtonProps) {
  const { navigateAndStartTutorial, activeTutorialId, isTutorialNavigating } =
    useTutorial();
  const hookAllowed = useCanStartTutorial(tutorialId);
  const canStart =
    isTeamAdmin !== undefined
      ? getTutorial(tutorialId).audience === "all" || isTeamAdmin
      : hookAllowed;

  if (!canStart) return null;

  return (
    <Button
      variant={variant}
      size={size}
      onClick={() => void navigateAndStartTutorial(tutorialId)}
      disabled={activeTutorialId !== null || isTutorialNavigating}
    >
      <Compass className="size-4" aria-hidden="true" />
      {label}
    </Button>
  );
}
