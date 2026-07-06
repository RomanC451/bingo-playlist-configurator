"use client";

import { usePathname, useRouter } from "next/navigation";
import { Suspense, useCallback, useMemo, useState } from "react";
import { AppTutorial } from "@/components/tutorial/AppTutorial";
import { PendingTutorialLauncher } from "@/components/tutorial/PendingTutorialLauncher";
import { TutorialChainBanner } from "@/components/tutorial/TutorialChainBanner";
import { TutorialContext } from "@/hooks/useTutorial";
import { errorToast } from "@/lib/error-toast";
import { isTutorialCompleted, markTutorialCompleted } from "@/lib/tutorial";
import { persistActiveTeam } from "@/lib/team-client";
import { getTutorial, type TutorialId } from "@/lib/tutorials";
import {
  TUTORIAL_TOUR_QUERY_PARAM,
  pathnameMatchesTutorialHref,
  resolveTutorialTarget,
} from "@/lib/tutorials/resolve-tutorial-target";

export function TutorialProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [activeTutorialId, setActiveTutorialId] = useState<TutorialId | null>(null);
  const [stepIndex, setStepIndex] = useState(0);
  const [chainOffer, setChainOffer] = useState<TutorialId | null>(null);
  const [isTutorialNavigating, setIsTutorialNavigating] = useState(false);

  const finishTutorial = useCallback(() => {
    if (activeTutorialId) {
      markTutorialCompleted(activeTutorialId);
      const tutorial = getTutorial(activeTutorialId);
      if (
        tutorial.nextTutorialId &&
        !isTutorialCompleted(tutorial.nextTutorialId)
      ) {
        setChainOffer(tutorial.nextTutorialId as TutorialId);
      }
    }
    setActiveTutorialId(null);
    setStepIndex(0);
  }, [activeTutorialId]);

  const startTutorial = useCallback((id: TutorialId) => {
    setChainOffer(null);
    setActiveTutorialId(id);
    setStepIndex(0);
  }, []);

  const navigateAndStartTutorial = useCallback(
    async (id: TutorialId) => {
      if (activeTutorialId !== null || isTutorialNavigating) return;

      setIsTutorialNavigating(true);
      try {
        const result = await resolveTutorialTarget(id);
        if (!result.ok) {
          errorToast(result.message, result.description);
          return;
        }

        if (result.teamId) {
          await persistActiveTeam(result.teamId);
        }

        if (pathnameMatchesTutorialHref(pathname, result.href)) {
          startTutorial(id);
          return;
        }

        const url = new URL(result.href, window.location.origin);
        url.searchParams.set(TUTORIAL_TOUR_QUERY_PARAM, id);
        router.push(`${url.pathname}${url.search}`);
      } finally {
        setIsTutorialNavigating(false);
      }
    },
    [activeTutorialId, isTutorialNavigating, pathname, router, startTutorial],
  );

  const nextStep = useCallback(() => {
    if (!activeTutorialId) return;

    const tutorial = getTutorial(activeTutorialId);
    if (stepIndex >= tutorial.steps.length - 1) {
      finishTutorial();
      return;
    }

    setStepIndex((value) => value + 1);
  }, [activeTutorialId, finishTutorial, stepIndex]);

  const prevStep = useCallback(() => {
    setStepIndex((value) => Math.max(0, value - 1));
  }, []);

  const skipTutorial = useCallback(() => {
    finishTutorial();
  }, [finishTutorial]);

  const dismissChainOffer = useCallback(() => {
    setChainOffer(null);
  }, []);

  const value = useMemo(
    () => ({
      activeTutorialId,
      stepIndex,
      isTutorialNavigating,
      startTutorial,
      navigateAndStartTutorial,
      nextStep,
      prevStep,
      skipTutorial,
    }),
    [
      activeTutorialId,
      isTutorialNavigating,
      navigateAndStartTutorial,
      nextStep,
      prevStep,
      skipTutorial,
      startTutorial,
      stepIndex,
    ],
  );

  return (
    <TutorialContext.Provider value={value}>
      {children}
      <Suspense fallback={null}>
        <PendingTutorialLauncher />
      </Suspense>
      {activeTutorialId && <AppTutorial tutorialId={activeTutorialId} />}
      {chainOffer && !activeTutorialId && (
        <TutorialChainBanner
          tutorialId={chainOffer}
          onStart={() => void navigateAndStartTutorial(chainOffer)}
          onDismiss={dismissChainOffer}
        />
      )}
    </TutorialContext.Provider>
  );
}
