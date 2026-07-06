"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { CheckCircle2, Compass } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useTutorial } from "@/hooks/useTutorial";
import { useTutorialCompletionRevision } from "@/hooks/useTutorialCompletionRevision";
import { useActiveTeamAdmin } from "@/hooks/useTutorialAccess";
import { isTutorialCompleted } from "@/lib/tutorial";
import { getPageTutorialAttention, getTutorialsForPath } from "@/lib/tutorials/page-tutorials";
import {
  filterAccessibleTutorials,
  getTutorialCategoriesForUser,
  type TutorialCategory,
} from "@/lib/tutorials/tutorial-categories";
import { getTutorial, type TutorialId } from "@/lib/tutorials";
import { cn } from "@/lib/utils";

interface SidebarTutorialMenuProps {
  expanded: boolean;
  onNavigate?: () => void;
}

function TutorialPagePing() {
  return (
    <span className="relative mt-0.5 flex size-3.5 shrink-0" aria-hidden="true">
      <span className="absolute inline-flex size-full rounded-full bg-emerald-500/50 animate-tutorial-ping" />
      <span className="relative inline-flex size-3.5 rounded-full bg-emerald-600 dark:bg-emerald-500" />
    </span>
  );
}

export function SidebarTutorialMenu({
  expanded,
  onNavigate,
}: SidebarTutorialMenuProps) {
  const pathname = usePathname();
  const { navigateAndStartTutorial, activeTutorialId, isTutorialNavigating } =
    useTutorial();
  const isTeamAdmin = useActiveTeamAdmin();
  const completionRevision = useTutorialCompletionRevision();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  const categories = useMemo(
    () => getTutorialCategoriesForUser(isTeamAdmin === true),
    [isTeamAdmin],
  );

  const pageTutorialIds = useMemo(() => {
    const ids = filterAccessibleTutorials(
      getTutorialsForPath(pathname),
      isTeamAdmin === true,
    );
    return new Set(ids);
  }, [isTeamAdmin, pathname]);

  const { shouldPing, sortedCategories } = useMemo(
    () =>
      getPageTutorialAttention(pathname, categories, isTeamAdmin === true),
    [categories, completionRevision, isTeamAdmin, pathname],
  );

  const totalTours = categories.reduce(
    (count, category) => count + category.tutorialIds.length,
    0,
  );

  useEffect(() => {
    if (!open) return;

    function onPointerDown(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }

    document.addEventListener("mousedown", onPointerDown);
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  function handleStart(tutorialId: TutorialId) {
    setOpen(false);
    onNavigate?.();
    void navigateAndStartTutorial(tutorialId);
  }

  const helpActive = pathname === "/help";
  const showButtonPing = shouldPing && !open;

  return (
    <div ref={rootRef} className="relative overflow-visible py-1">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        aria-haspopup="menu"
        title={expanded ? undefined : "Tutorials"}
        className={cn(
          "flex w-full items-center rounded-lg font-medium transition-colors",
          expanded ? "gap-3 px-3 py-2.5 text-sm" : "justify-center p-2.5",
          open || helpActive
            ? "bg-emerald-600 text-white shadow-sm shadow-emerald-600/25"
            : "border border-emerald-600/40 bg-emerald-50 text-emerald-800 hover:bg-emerald-100 dark:border-emerald-500/40 dark:bg-emerald-950/50 dark:text-emerald-200 dark:hover:bg-emerald-950/80",
          showButtonPing &&
            "animate-tutorial-bounce border-emerald-500 shadow-[0_0_0_1px_rgb(16_185_129/0.35)] dark:border-emerald-400",
        )}
      >
        <Compass className="size-5 shrink-0" aria-hidden="true" />
        {expanded && <span className="truncate">Tutorials</span>}
      </button>

      {open && (
        <div
          role="menu"
          className={cn(
            "absolute z-50 grid max-h-[min(32rem,70dvh)] w-80 max-w-[calc(100vw-2rem)] grid-rows-[auto_minmax(0,1fr)_auto] overflow-hidden rounded-xl border border-border bg-background shadow-xl",
            expanded ? "bottom-full left-0 mb-2" : "bottom-0 left-full ml-2",
          )}
        >
          <div className="border-b border-border px-4 py-3">
            <p className="font-medium">Guided tours</p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {totalTours} tours across {categories.length} feature areas
            </p>
          </div>

          <ScrollArea className="h-full min-h-0">
            <div className="p-2">
              {sortedCategories.map((category) => (
                <TutorialCategorySection
                  key={category.id}
                  category={category}
                  pageTutorialIds={pageTutorialIds}
                  disabled={activeTutorialId !== null || isTutorialNavigating}
                  onStart={handleStart}
                />
              ))}
            </div>
          </ScrollArea>

          <div className="border-t border-border p-2">
            <Link
              href="/help"
              role="menuitem"
              onClick={() => {
                setOpen(false);
                onNavigate?.();
              }}
              className="block rounded-lg px-3 py-2 text-center text-xs text-muted-foreground hover:bg-secondary hover:text-foreground"
            >
              Open full help catalog
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}

function TutorialCategorySection({
  category,
  pageTutorialIds,
  disabled,
  onStart,
}: {
  category: TutorialCategory & { tutorialIds: TutorialId[] };
  pageTutorialIds: Set<string>;
  disabled: boolean;
  onStart: (tutorialId: TutorialId) => void;
}) {
  return (
    <section className="mb-3 last:mb-0">
      <div className="px-2 pb-1 pt-2">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          {category.label}
        </h3>
        <p className="text-[11px] text-muted-foreground/80">{category.description}</p>
      </div>
      <ul className="space-y-0.5">
        {category.tutorialIds.map((tutorialId) => (
          <TutorialMenuItem
            key={tutorialId}
            tutorialId={tutorialId}
            isOnCurrentPage={pageTutorialIds.has(tutorialId)}
            disabled={disabled}
            onStart={() => onStart(tutorialId)}
          />
        ))}
      </ul>
    </section>
  );
}

function TutorialMenuItem({
  tutorialId,
  isOnCurrentPage,
  disabled,
  onStart,
}: {
  tutorialId: TutorialId;
  isOnCurrentPage: boolean;
  disabled: boolean;
  onStart: () => void;
}) {
  const completionRevision = useTutorialCompletionRevision();
  const tutorial = getTutorial(tutorialId);
  const completed = useMemo(
    () => isTutorialCompleted(tutorialId),
    [completionRevision, tutorialId],
  );
  const showPagePing = isOnCurrentPage && !completed;

  return (
    <li>
      <button
        type="button"
        role="menuitem"
        disabled={disabled}
        onClick={onStart}
        className={cn(
          "flex w-full items-start gap-2 rounded-lg px-3 py-2 text-left text-sm hover:bg-secondary disabled:opacity-50",
          isOnCurrentPage &&
            "bg-emerald-50/80 hover:bg-emerald-50 dark:bg-emerald-950/30 dark:hover:bg-emerald-950/50",
        )}
      >
        {completed ? (
          <CheckCircle2
            className="mt-0.5 size-4 shrink-0 text-emerald-600"
            aria-hidden="true"
          />
        ) : showPagePing ? (
          <TutorialPagePing />
        ) : (
          <Compass className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
        )}
        <span className="min-w-0 flex-1">
          <span className="flex flex-wrap items-center gap-1.5">
            <span className="font-medium">{tutorial.title}</span>
            {isOnCurrentPage && (
              <span className="rounded bg-emerald-600/15 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-emerald-700 dark:text-emerald-300">
                Here
              </span>
            )}
          </span>
          <span className="block text-xs text-muted-foreground">{tutorial.description}</span>
        </span>
      </button>
    </li>
  );
}
