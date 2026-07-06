"use client";

import { TutorialProvider } from "@/components/tutorial/TutorialProvider";

export function ClipGuessTutorialShell({
  children,
}: {
  children: React.ReactNode;
}) {
  return <TutorialProvider>{children}</TutorialProvider>;
}
