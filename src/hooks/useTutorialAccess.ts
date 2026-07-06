"use client";

import { useSession } from "next-auth/react";
import { useCallback, useEffect, useState } from "react";
import { isTeamManagerRole, type TeamRoleValue } from "@/lib/team-client";
import { readJsonResponse } from "@/lib/read-json-response";
import { getTutorial, type TutorialId } from "@/lib/tutorials";

export function useActiveTeamAdmin(): boolean | null {
  const { data: session } = useSession();
  const userId = session?.user?.id;
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);

  useEffect(() => {
    if (!userId) {
      setIsAdmin(false);
      return;
    }

    let cancelled = false;

    async function load() {
      const res = await fetch("/api/teams");
      if (!res.ok || cancelled) {
        if (!cancelled) setIsAdmin(false);
        return;
      }

      const data = await readJsonResponse<{
        activeTeamId: string | null;
        teams: { id: string; members: { role: TeamRoleValue; user: { id: string } }[] }[];
      }>(res);

      const activeTeam = data.teams.find((team) => team.id === data.activeTeamId);
      const membership = activeTeam?.members.find((member) => member.user.id === userId);
      if (!cancelled) {
        setIsAdmin(membership ? isTeamManagerRole(membership.role) : false);
      }
    }

    void load();
    function onTeamChange() {
      void load();
    }
    window.addEventListener("active-team-changed", onTeamChange);
    return () => {
      cancelled = true;
      window.removeEventListener("active-team-changed", onTeamChange);
    };
  }, [userId]);

  return isAdmin;
}

export function useCanStartTutorial(tutorialId: TutorialId): boolean {
  const tutorial = getTutorial(tutorialId);
  const isAdmin = useActiveTeamAdmin();

  if (tutorial.audience === "all") return true;
  return isAdmin === true;
}
