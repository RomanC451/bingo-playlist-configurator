"use client";

import type React from "react";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import {
  ArrowRight,
  Calendar,
  KeyRound,
  ListMusic,
  Plus,
  Users,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { TeamsPageSkeleton } from "@/components/page-skeletons";
import { useDelayedLoading } from "@/hooks/useDelayedLoading";
import { errorMessageFromBody } from "@/lib/api-errors";
import { readJsonResponse } from "@/lib/read-json-response";
import { notifyActiveTeamChanged, persistActiveTeam } from "@/lib/team-client";

interface TeamSummary {
  id: string;
  name: string;
  members: { role: "ADMIN" | "MEMBER"; user: { id: string } }[];
  _count: { bingoSessions: number };
}

interface JoinableTeam {
  id: string;
  name: string;
  memberCount: number;
}

export function YourTeams() {
  const [teams, setTeams] = useState<TeamSummary[]>([]);
  const [activeTeamId, setActiveTeamId] = useState<string | null>(null);
  const [joinableTeams, setJoinableTeams] = useState<JoinableTeam[]>([]);
  const [initialized, setInitialized] = useState(false);
  const { loading, begin, end } = useDelayedLoading();
  const [error, setError] = useState<string | null>(null);

  const [teamName, setTeamName] = useState("");
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  const [teamId, setTeamId] = useState("");
  const [joining, setJoining] = useState(false);
  const [joinError, setJoinError] = useState<string | null>(null);
  const [showIdField, setShowIdField] = useState(false);

  const loadTeams = useCallback(async () => {
    begin();
    try {
      const [teamsRes, joinableRes] = await Promise.all([
        fetch("/api/teams"),
        fetch("/api/teams/joinable"),
      ]);

      const teamsData = await readJsonResponse<{
        teams: TeamSummary[];
        activeTeamId: string | null;
        error?: string;
      }>(teamsRes);

      if (!teamsRes.ok) {
        setError(errorMessageFromBody(teamsData, "Failed to load teams"));
        setInitialized(true);
        return;
      }

      setTeams(teamsData.teams);
      setActiveTeamId(teamsData.activeTeamId);
      setError(null);

      if (joinableRes.ok) {
        const joinableData = await readJsonResponse<{ teams: JoinableTeam[] }>(joinableRes);
        setJoinableTeams(joinableData.teams);
      }

      setInitialized(true);
    } finally {
      end();
    }
  }, [begin, end]);

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

  async function handleCreateTeam(e: React.FormEvent) {
    e.preventDefault();
    setCreating(true);
    setCreateError(null);

    const res = await fetch("/api/teams", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: teamName.trim() }),
    });
    const data = await readJsonResponse<{ id: string; error?: string }>(res);

    setCreating(false);
    if (!res.ok) {
      setCreateError(errorMessageFromBody(data, "Failed to create team"));
      return;
    }

    setTeamName("");
    setActiveTeamId(data.id);
    await persistActiveTeam(data.id);
    void loadTeams();
  }

  async function joinTeam(id: string) {
    setJoining(true);
    setJoinError(null);

    const res = await fetch("/api/teams/join", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ teamId: id }),
    });
    const data = await readJsonResponse<{ activeTeamId: string; error?: string }>(res);

    setJoining(false);
    if (!res.ok) {
      setJoinError(errorMessageFromBody(data, "Failed to join team"));
      return;
    }

    setTeamId("");
    setShowIdField(false);
    notifyActiveTeamChanged(data.activeTeamId);
    void loadTeams();
  }

  async function handleJoinById(e: React.FormEvent) {
    e.preventDefault();
    await joinTeam(teamId.trim());
  }

  async function handleSelectTeam(id: string) {
    const previous = activeTeamId;
    setActiveTeamId(id);
    const ok = await persistActiveTeam(id);
    if (!ok) {
      setActiveTeamId(previous);
    }
  }

  if (!initialized) {
    if (loading) return <TeamsPageSkeleton />;
    return null;
  }

  if (error) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-300">
        {error}
      </div>
    );
  }

  return (
    <div>
      <header className="mb-8">
        <h1 className="text-pretty text-2xl font-semibold tracking-tight sm:text-3xl">
          Your teams
        </h1>
        <p className="mt-1.5 text-sm text-muted-foreground sm:text-base">
          Pick a team to work in, or create and join one to get started.
        </p>
      </header>

      {teams.length === 0 ? (
        <div className="mb-8 flex items-center justify-center rounded-xl border border-dashed border-border bg-card p-10 text-center text-sm text-muted-foreground shadow-sm">
          You are not in any teams yet. Create one or join an existing team below.
        </div>
      ) : (
        <div className="mb-8 space-y-3">
          {teams.map((team) => {
            const isActive = team.id === activeTeamId;

            return (
              <Card
                key={team.id}
                className={
                  isActive
                    ? "border-primary/40 bg-gradient-to-br from-primary/[0.07] to-transparent"
                    : undefined
                }
              >
                <CardHeader className="flex-row items-start justify-between gap-4 space-y-0">
                  <div className="flex items-start gap-3">
                    <div
                      className={`flex size-11 shrink-0 items-center justify-center rounded-xl ${isActive
                          ? "bg-primary/15 text-primary"
                          : "bg-secondary text-foreground"
                        }`}
                    >
                      <ListMusic className="size-5" aria-hidden="true" />
                    </div>
                    <div>
                      <CardTitle className="text-lg">{team.name}</CardTitle>
                      <CardDescription className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1">
                        <span className="inline-flex items-center gap-1.5">
                          <Users className="size-3.5" aria-hidden="true" />
                          {team.members.length} member{team.members.length === 1 ? "" : "s"}
                        </span>
                        <span className="inline-flex items-center gap-1.5">
                          <Calendar className="size-3.5" aria-hidden="true" />
                          {team._count.bingoSessions} session
                          {team._count.bingoSessions === 1 ? "" : "s"}
                        </span>
                      </CardDescription>
                    </div>
                  </div>
                  {isActive && (
                    <Badge className="shrink-0 gap-1.5 bg-primary/15 text-primary hover:bg-primary/15">
                      <span className="size-1.5 rounded-full bg-primary" aria-hidden="true" />
                      Active
                    </Badge>
                  )}
                </CardHeader>
                <CardContent className="flex flex-wrap gap-3">
                  {isActive ? (
                    <>
                      <Link
                        href="/sessions"
                        className="inline-flex items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
                      >
                        <ListMusic className="size-4" aria-hidden="true" />
                        Open bingo sessions
                      </Link>
                      <Link
                        href={`/teams/${team.id}/settings`}
                        className="inline-flex items-center justify-center rounded-lg border border-border bg-background px-4 py-2 text-sm font-medium transition-colors hover:bg-secondary"
                      >
                        Team settings
                      </Link>
                    </>
                  ) : (
                    <>
                      <Button variant="outline" onClick={() => void handleSelectTeam(team.id)}>
                        Switch to this team
                      </Button>
                      <Link
                        href={`/teams/${team.id}/settings`}
                        className="inline-flex items-center justify-center rounded-lg border border-border bg-background px-4 py-2 text-sm font-medium transition-colors hover:bg-secondary"
                      >
                        Team settings
                      </Link>
                    </>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <div className="grid gap-6 md:grid-cols-2">
        <Card className="flex flex-col">
          <CardHeader className="space-y-0">
            <div className="mb-4 flex size-9 items-center justify-center rounded-lg bg-secondary text-foreground">
              <Plus className="size-4" aria-hidden="true" />
            </div>
            <CardTitle className="text-base">Create a team</CardTitle>
            <CardDescription className="mt-1.5">
              Start a new team and invite others later.
            </CardDescription>
          </CardHeader>
          <CardContent className="mt-auto">
            <form
              className="flex flex-col gap-3 sm:flex-row"
              onSubmit={(e) => void handleCreateTeam(e)}
            >
              <Input
                aria-label="Team name"
                placeholder="Team name"
                maxLength={100}
                value={teamName}
                onChange={(e) => setTeamName(e.target.value)}
              />
              <Button type="submit" disabled={creating || !teamName.trim()} className="gap-1.5">
                {creating ? "Creating…" : "Create"}
                {!creating && <ArrowRight className="size-4" aria-hidden="true" />}
              </Button>
            </form>
            {createError && <p className="mt-2 text-sm text-red-600">{createError}</p>}
          </CardContent>
        </Card>

        <Card className="flex flex-col">
          <CardHeader className="space-y-0">
            <div className="mb-4 flex size-9 items-center justify-center rounded-lg bg-secondary text-foreground">
              <Users className="size-4" aria-hidden="true" />
            </div>
            <CardTitle className="text-base">Join a team</CardTitle>
            <CardDescription className="mt-1.5">
              Join an open team or use a team ID from an owner.
            </CardDescription>
          </CardHeader>
          <CardContent className="mt-auto space-y-4">
            {joinableTeams.length === 0 ? (
              <div className="rounded-lg border border-dashed border-border bg-muted/30 px-4 py-3 text-sm text-muted-foreground">
                No other teams are available to join right now.
              </div>
            ) : (
              <ul className="space-y-2">
                {joinableTeams.map((team) => (
                  <li
                    key={team.id}
                    className="flex items-center justify-between gap-3 rounded-lg border border-border px-3 py-2"
                  >
                    <div className="min-w-0">
                      <p className="truncate font-medium">{team.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {team.memberCount} member{team.memberCount === 1 ? "" : "s"}
                      </p>
                    </div>
                    <Button
                      variant="outline"
                      disabled={joining}
                      className="shrink-0 px-3 py-1.5"
                      onClick={() => void joinTeam(team.id)}
                    >
                      Join
                    </Button>
                  </li>
                ))}
              </ul>
            )}

            {showIdField ? (
              <form
                className="flex flex-col gap-3 sm:flex-row"
                onSubmit={(e) => void handleJoinById(e)}
              >
                <Input
                  aria-label="Team ID"
                  placeholder="Enter team ID"
                  value={teamId}
                  onChange={(e) => setTeamId(e.target.value)}
                />
                <Button type="submit" variant="outline" disabled={joining || !teamId.trim()}>
                  Join
                </Button>
              </form>
            ) : (
              <Button
                variant="ghost"
                className="h-auto gap-2 px-0 text-primary hover:bg-transparent hover:text-primary"
                onClick={() => setShowIdField(true)}
              >
                <KeyRound className="size-4" aria-hidden="true" />
                Have a team ID instead?
              </Button>
            )}

            {joinError && <p className="text-sm text-red-600">{joinError}</p>}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
