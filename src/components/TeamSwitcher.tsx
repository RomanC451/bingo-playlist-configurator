"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { Users } from "lucide-react";
import {
  persistActiveTeam,
} from "@/lib/team-client";
import { cn } from "@/lib/utils";

interface TeamSummary {
  id: string;
  name: string;
}

interface TeamsResponse {
  teams: TeamSummary[];
  activeTeamId: string | null;
}

export function TeamSwitcher({
  fullWidth = false,
  compact = false,
}: {
  fullWidth?: boolean;
  compact?: boolean;
}) {
  const menuRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [teams, setTeams] = useState<TeamSummary[]>([]);
  const [activeTeamId, setActiveTeamId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const loadTeams = useCallback(async () => {
    const res = await fetch("/api/teams");
    if (res.ok) {
      const data = (await res.json()) as TeamsResponse;
      setTeams(data.teams);
      setActiveTeamId(data.activeTeamId);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    void loadTeams();
  }, [loadTeams]);

  useEffect(() => {
    function onTeamChange() {
      void loadTeams();
    }
    window.addEventListener("active-team-changed", onTeamChange);
    return () => window.removeEventListener("active-team-changed", onTeamChange);
  }, [loadTeams]);

  useEffect(() => {
    function onPointerDown(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) {
      document.addEventListener("mousedown", onPointerDown);
      return () => document.removeEventListener("mousedown", onPointerDown);
    }
  }, [open]);

  async function handleSwitchTeam(teamId: string) {
    const previous = activeTeamId;
    setActiveTeamId(teamId);
    setOpen(false);
    const ok = await persistActiveTeam(teamId);
    if (!ok) {
      setActiveTeamId(previous);
    }
  }

  const activeTeam = teams.find((t) => t.id === activeTeamId);

  const menuPanel = open && (
    <div
      className={cn(
        "absolute top-0 z-30 w-72 max-w-[calc(100vw-2rem)] overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-lg dark:border-zinc-700 dark:bg-zinc-950",
        compact ? "left-full ml-2" : "top-full mt-2",
        fullWidth ? "left-0" : compact ? "" : "right-0",
      )}
    >
      <div className="max-h-[min(70vh,24rem)] overflow-y-auto p-3">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-zinc-400">
          Your teams
        </h3>
        <ul className="mt-2 space-y-1">
          {teams.length === 0 ? (
            <li className="px-2.5 py-2 text-sm text-zinc-500">No teams yet.</li>
          ) : (
            teams.map((team) => {
              const isActive = team.id === activeTeamId;
              return (
                <li key={team.id}>
                  <button
                    type="button"
                    onClick={() => void handleSwitchTeam(team.id)}
                    className={`flex w-full items-center justify-between rounded-lg px-2.5 py-2 text-left text-sm transition-colors ${
                      isActive
                        ? "bg-emerald-50 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-200"
                        : "hover:bg-zinc-50 dark:hover:bg-zinc-900"
                    }`}
                  >
                    <span className="truncate font-medium">{team.name}</span>
                    {isActive && (
                      <span className="ml-2 shrink-0 text-xs text-emerald-600 dark:text-emerald-400">
                        Active
                      </span>
                    )}
                  </button>
                </li>
              );
            })
          )}
        </ul>
        <div className="mt-3 border-t border-zinc-100 pt-3 dark:border-zinc-800">
          <Link
            href="/teams"
            onClick={() => setOpen(false)}
            className="flex w-full items-center justify-center rounded-lg border border-emerald-600/40 bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-800 hover:bg-emerald-100 dark:border-emerald-500/40 dark:bg-emerald-950/40 dark:text-emerald-300 dark:hover:bg-emerald-950/70"
          >
            Join or create a team
          </Link>
        </div>
      </div>
    </div>
  );

  if (compact) {
    return (
      <div ref={menuRef} className="relative">
        <button
          type="button"
          disabled={loading}
          onClick={() => {
            if (loading) return;
            setOpen((value) => !value);
          }}
          className="flex size-10 items-center justify-center rounded-lg border border-zinc-300 bg-white text-zinc-600 hover:bg-zinc-50 disabled:cursor-default dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800"
          aria-expanded={open}
          aria-haspopup="dialog"
          aria-busy={loading}
          title={activeTeam?.name ?? "Select team"}
        >
          <Users className="size-5" aria-hidden="true" />
        </button>
        {menuPanel}
      </div>
    );
  }

  return (
    <div ref={menuRef} className={`relative ${fullWidth ? "w-full" : ""}`}>
      <button
        type="button"
        disabled={loading}
        onClick={() => {
          if (loading) return;
          setOpen((value) => !value);
        }}
        className={`flex items-center gap-1.5 rounded-lg border border-zinc-300 bg-white px-3 py-1.5 text-sm hover:bg-zinc-50 disabled:cursor-default disabled:hover:bg-white dark:border-zinc-700 dark:bg-zinc-900 dark:disabled:hover:bg-zinc-900 dark:hover:bg-zinc-800 ${
          fullWidth ? "w-full justify-between" : ""
        }`}
        aria-expanded={open}
        aria-haspopup="dialog"
        aria-busy={loading}
      >
        <span className="text-zinc-500">Team</span>
        {loading ? (
          <span className="inline-block h-4 w-24 animate-pulse rounded bg-zinc-200 dark:bg-zinc-800" />
        ) : (
          <span className="max-w-[9rem] truncate font-medium text-zinc-800 dark:text-zinc-100">
            {activeTeam?.name ?? "No team"}
          </span>
        )}
        <svg
          viewBox="0 0 20 20"
          className={`h-4 w-4 text-zinc-400 transition-transform ${open ? "rotate-180" : ""}`}
          aria-hidden
        >
          <path
            fill="currentColor"
            d="M5.23 7.21a.75.75 0 011.06.02L10 10.94l3.71-3.71a.75.75 0 111.06 1.06l-4.24 4.25a.75.75 0 01-1.06 0L5.21 8.29a.75.75 0 01.02-1.08z"
          />
        </svg>
      </button>

      {menuPanel}
    </div>
  );
}
