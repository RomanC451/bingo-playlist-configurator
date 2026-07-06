"use client";

import { useCallback, useEffect, useLayoutEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { useTutorial } from "@/hooks/useTutorial";
import {
  getTutorialTargetRect,
  type TutorialPlacement,
  type TutorialStep,
} from "@/lib/tutorial";
import { dispatchTutorialStepAction, type TutorialStepAction } from "@/lib/tutorial-actions";
import { getTutorial, type TutorialId } from "@/lib/tutorials";
import { cn } from "@/lib/utils";

const SPOTLIGHT_PADDING = 8;
const CARD_GAP = 16;
const VIEWPORT_MARGIN = 16;

interface CardPosition {
  top: number;
  left: number;
  maxWidth: number;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function getCardPosition(
  rect: DOMRect | null,
  placement: TutorialPlacement,
): CardPosition {
  const cardWidth = Math.min(360, window.innerWidth - VIEWPORT_MARGIN * 2);

  if (!rect || placement === "center") {
    return {
      top: Math.max(VIEWPORT_MARGIN, (window.innerHeight - 220) / 2),
      left: Math.max(VIEWPORT_MARGIN, (window.innerWidth - cardWidth) / 2),
      maxWidth: cardWidth,
    };
  }

  const padded = {
    top: rect.top - SPOTLIGHT_PADDING,
    left: rect.left - SPOTLIGHT_PADDING,
    right: rect.right + SPOTLIGHT_PADDING,
    bottom: rect.bottom + SPOTLIGHT_PADDING,
    width: rect.width + SPOTLIGHT_PADDING * 2,
    height: rect.height + SPOTLIGHT_PADDING * 2,
  };

  let top = padded.bottom + CARD_GAP;
  let left = padded.left;

  switch (placement) {
    case "top":
      top = padded.top - 220 - CARD_GAP;
      left = padded.left + padded.width / 2 - cardWidth / 2;
      break;
    case "bottom":
      top = padded.bottom + CARD_GAP;
      left = padded.left + padded.width / 2 - cardWidth / 2;
      break;
    case "left":
      top = padded.top + padded.height / 2 - 110;
      left = padded.left - cardWidth - CARD_GAP;
      break;
    case "right":
      top = padded.top + padded.height / 2 - 110;
      left = padded.right + CARD_GAP;
      break;
    default:
      break;
  }

  return {
    top: clamp(top, VIEWPORT_MARGIN, window.innerHeight - 220 - VIEWPORT_MARGIN),
    left: clamp(left, VIEWPORT_MARGIN, window.innerWidth - cardWidth - VIEWPORT_MARGIN),
    maxWidth: cardWidth,
  };
}

function Spotlight({ rect }: { rect: DOMRect | null }) {
  if (!rect) {
    return <div className="absolute inset-0 bg-black/50" aria-hidden="true" />;
  }

  const top = rect.top - SPOTLIGHT_PADDING;
  const left = rect.left - SPOTLIGHT_PADDING;
  const width = rect.width + SPOTLIGHT_PADDING * 2;
  const height = rect.height + SPOTLIGHT_PADDING * 2;

  return (
    <>
      <div
        className="pointer-events-none absolute rounded-lg"
        style={{
          top,
          left,
          width,
          height,
          boxShadow: "0 0 0 9999px rgba(0, 0, 0, 0.5)",
        }}
        aria-hidden="true"
      />
      <div
        className="pointer-events-none absolute rounded-lg border border-foreground/25 bg-background/10 shadow-sm dark:border-white/20 dark:bg-white/5"
        style={{ top, left, width, height }}
        aria-hidden="true"
      />
    </>
  );
}

function TutorialCard({
  step,
  stepIndex,
  stepCount,
  cardPosition,
  onBack,
  onNext,
  onSkip,
}: {
  step: TutorialStep;
  stepIndex: number;
  stepCount: number;
  cardPosition: CardPosition;
  onBack: () => void;
  onNext: () => void;
  onSkip: () => void;
}) {
  const isFirst = stepIndex === 0;
  const isLast = stepIndex === stepCount - 1;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="tutorial-step-title"
      className="fixed z-[201] rounded-xl border border-border bg-background p-5 shadow-2xl"
      style={{
        top: cardPosition.top,
        left: cardPosition.left,
        width: cardPosition.maxWidth,
      }}
    >
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        Step {stepIndex + 1} of {stepCount}
      </p>
      <h2 id="tutorial-step-title" className="mt-2 text-lg font-semibold">
        {step.title}
      </h2>
      <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{step.body}</p>

      <div className="mt-5 flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={onSkip}
          className="text-sm text-muted-foreground hover:text-foreground"
        >
          Skip tour
        </button>
        <div className="flex items-center gap-2">
          {!isFirst && (
            <Button variant="outline" size="sm" onClick={onBack}>
              Back
            </Button>
          )}
          <Button size="sm" onClick={onNext}>
            {isLast ? "Finish" : "Next"}
          </Button>
        </div>
      </div>
    </div>
  );
}

export function AppTutorial({ tutorialId }: { tutorialId: TutorialId }) {
  const { stepIndex, nextStep, prevStep, skipTutorial } = useTutorial();
  const tutorial = getTutorial(tutorialId);
  const step = tutorial.steps[stepIndex];
  const [targetRect, setTargetRect] = useState<DOMRect | null>(null);
  const [cardPosition, setCardPosition] = useState<CardPosition>({
    top: VIEWPORT_MARGIN,
    left: VIEWPORT_MARGIN,
    maxWidth: 360,
  });

  const updateLayout = useCallback(() => {
    const rect = step.target ? getTutorialTargetRect(step.target) : null;
    setTargetRect(rect);

    if (rect) {
      const element = document.querySelector(`[data-tutorial="${step.target}"]`);
      element?.scrollIntoView({ block: "nearest", behavior: "smooth" });
    }

    const placement = step.placement ?? (step.target ? "bottom" : "center");
    setCardPosition(getCardPosition(rect, placement));
  }, [step]);

  useLayoutEffect(() => {
    if (step.onEnter) {
      dispatchTutorialStepAction(step.onEnter as TutorialStepAction);
    }
    updateLayout();
  }, [updateLayout, step.onEnter]);

  useEffect(() => {
    function onLayoutChange() {
      updateLayout();
    }

    window.addEventListener("resize", onLayoutChange);
    window.addEventListener("scroll", onLayoutChange, true);
    return () => {
      window.removeEventListener("resize", onLayoutChange);
      window.removeEventListener("scroll", onLayoutChange, true);
    };
  }, [updateLayout]);

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") skipTutorial();
    }

    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [skipTutorial]);

  return (
    <div className={cn("fixed inset-0 z-[200]")} aria-live="polite">
      <Spotlight rect={targetRect} />
      <TutorialCard
        step={step}
        stepIndex={stepIndex}
        stepCount={tutorial.steps.length}
        cardPosition={cardPosition}
        onBack={prevStep}
        onNext={nextStep}
        onSkip={skipTutorial}
      />
    </div>
  );
}
