"use client";

import Link from "next/link";
import { useMemo } from "react";
import { CheckCircle2, Circle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { StartTutorialButton } from "@/components/tutorial/StartTutorialButton";
import { useTutorialCompletionRevision } from "@/hooks/useTutorialCompletionRevision";
import { useActiveTeamAdmin } from "@/hooks/useTutorialAccess";
import { isTutorialCompleted, resetAllTutorialCompletions } from "@/lib/tutorial";
import { getTutorial, type TutorialId } from "@/lib/tutorials";
import { getTutorialCategoriesForUser } from "@/lib/tutorials/tutorial-categories";

function TutorialRow({ tutorialId }: { tutorialId: TutorialId }) {
  const completionRevision = useTutorialCompletionRevision();
  const completed = useMemo(
    () => isTutorialCompleted(tutorialId),
    [completionRevision, tutorialId],
  );
  const tutorial = getTutorial(tutorialId);

  return (
    <li className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          {completed ? (
            <CheckCircle2 className="size-4 shrink-0 text-emerald-600" aria-hidden="true" />
          ) : (
            <Circle className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
          )}
          <h3 className="font-medium">{tutorial.title}</h3>
        </div>
        <p className="mt-1 text-sm text-muted-foreground">{tutorial.description}</p>
        <p className="mt-1 text-xs text-muted-foreground">
          {tutorial.steps.length} steps · {tutorial.route}
          {tutorial.audience === "admin" ? " · Admin" : ""}
        </p>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <Link
          href={tutorial.route
            .replace("[id]", "")
            .replace("[clipId]", "")
            .replace("[shareToken]", "")}
          className="text-sm text-primary hover:underline"
        >
          Open page
        </Link>
        <StartTutorialButton tutorialId={tutorialId} label={completed ? "Replay" : "Start"} />
      </div>
    </li>
  );
}

export default function HelpPage() {
  const isAdmin = useActiveTeamAdmin();
  const categories = getTutorialCategoriesForUser(isAdmin === true);

  function handleResetAllTutorials() {
    if (
      !window.confirm(
        "Reset all tutorial progress? Welcome banners and tips will show again on each page.",
      )
    ) {
      return;
    }

    resetAllTutorialCompletions();
  }

  return (
    <div>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Help & tours</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Guided tours walk you through each part of Bingo Playlist Configurator. Progress
            is saved in your browser. You can also open any tour from the Tutorials button in
            the sidebar.
          </p>
        </div>
        <Button variant="outline" size="sm" className="shrink-0" onClick={handleResetAllTutorials}>
          Reset all tutorials
        </Button>
      </div>

      <div className="mt-8 space-y-10">
        {categories.map((category) => (
          <section key={category.id}>
            <h2 className="text-lg font-medium">{category.label}</h2>
            <p className="mt-1 text-sm text-muted-foreground">{category.description}</p>
            <ul className="mt-4 space-y-3">
              {category.tutorialIds.map((tutorialId) => (
                <TutorialRow key={tutorialId} tutorialId={tutorialId} />
              ))}
            </ul>
          </section>
        ))}
      </div>

      {isAdmin === false && (
        <p className="mt-8 text-sm text-muted-foreground">
          Some admin-only tours are hidden. Team admins can access Spotify, ClipGuess
          setup, and team settings tours.
        </p>
      )}
    </div>
  );
}
