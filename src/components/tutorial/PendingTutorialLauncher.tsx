"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef } from "react";
import { useTutorial } from "@/hooks/useTutorial";
import { getTutorialTargetRect } from "@/lib/tutorial";
import {
  TUTORIAL_TOUR_QUERY_PARAM,
  pathnameMatchesTutorialHref,
  resolveTutorialTarget,
} from "@/lib/tutorials/resolve-tutorial-target";
import { getTutorial, tutorials, type TutorialId } from "@/lib/tutorials";

function isTutorialId(value: string): value is TutorialId {
  return value in tutorials;
}

async function waitForTutorialDom(tutorialId: TutorialId) {
  const tutorial = getTutorial(tutorialId);
  const targetedSteps = tutorial.steps.filter((step) => step.target);
  if (targetedSteps.length === 0) return;

  const deadline = Date.now() + 8000;
  while (Date.now() < deadline) {
    const ready = targetedSteps.some(
      (step) => step.target && getTutorialTargetRect(step.target),
    );
    if (ready) return;
    await new Promise((resolve) => setTimeout(resolve, 150));
  }
}

export function PendingTutorialLauncher() {
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const router = useRouter();
  const { startTutorial, activeTutorialId } = useTutorial();
  const launchedRef = useRef<string | null>(null);

  useEffect(() => {
    const tourParam = searchParams.get(TUTORIAL_TOUR_QUERY_PARAM);
    if (!tourParam || !isTutorialId(tourParam)) return;
    if (activeTutorialId !== null) return;

    const launchKey = `${pathname}?${tourParam}`;
    if (launchedRef.current === launchKey) return;

    let cancelled = false;

    async function launch() {
      const result = await resolveTutorialTarget(tourParam as TutorialId);
      if (cancelled) return;

      if (!result.ok) {
        clearTourParam();
        return;
      }

      if (!pathnameMatchesTutorialHref(pathname, result.href)) {
        return;
      }

      launchedRef.current = launchKey;
      clearTourParam();

      await waitForTutorialDom(tourParam as TutorialId);
      if (!cancelled) startTutorial(tourParam as TutorialId);
    }

    function clearTourParam() {
      const params = new URLSearchParams(searchParams.toString());
      params.delete(TUTORIAL_TOUR_QUERY_PARAM);
      const query = params.toString();
      router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
    }

    void launch();

    return () => {
      cancelled = true;
    };
  }, [activeTutorialId, pathname, router, searchParams, startTutorial]);

  return null;
}
